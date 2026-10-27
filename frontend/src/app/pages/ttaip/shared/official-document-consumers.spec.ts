import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { TtaipCalificarComponent } from '../ttaip-calificar.component';
import { TtaipSegundaCalificacionComponent } from '../ttaip-segunda-calificacion.component';
import { TtaipResolverComponent } from '../ttaip-resolver.component';
import { ApelacionService } from '../../../services/apelacion.service';
import { TtaipService } from '../../../services/ttaip.service';
import { DocumentoService } from '../../../services/documento.service';
import { SolicitudService } from '../../../services/solicitud.service';
import { AuthService } from '../../../services/auth.service';
import { ReferenceSuccessModalComponent } from '../../../shared/reference-success-modal.component';
import { ReferenceConfirmModalComponent } from '../../../shared/reference-confirm-modal.component';

// Render de los consumidores reales, backend simulado. Los comandos de calificación no firman PDF.
describe.each([
  ['primera', TtaipCalificarComponent, 'EN_CALIFICACION_1', 'admisible', 'enviarCalificacion', 'admitirApelacion'],
  ['segunda', TtaipSegundaCalificacionComponent, 'EN_CALIFICACION_2', 'admitido', 'enviarCalificacion', 'admitirApelacion'],
  ['final', TtaipResolverComponent, 'EN_RESOLUCION', 'infundado', 'enviarResolucion', 'declararInfundado'],
] as const)('R2: consumidor %s', (_name, type, estado, decision, command, endpoint) => {
  const expediente = '00001-2026-JUS/TTAIP';
  const backend = { admitirApelacion: vi.fn(), declararInfundado: vi.fn() };
  const ap = { id: 1, expediente, estado, ciudadanoNombre: 'Persona sintética', entidadNombre: 'Entidad sintética',
    tipoOrigen: 'EXTERNA', solicitudId: null, calificacionPrimera: _name === 'segunda' ? 'INADMISIBLE' : null,
    ...(_name === 'segunda' ? { calificacionSegunda: null } : {}), resoluciones: [],
    resolucion: _name === 'final' ? { id: 91, numeroResolucion: 'REGISTRADA-91' } : null,
    resolucionPrimeraCalificacion: _name === 'primera' ? null : _name === 'segunda'
      ? { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE', observaciones: 'Punto registrado' }
      : { id: 91, numeroResolucion: 'REGISTRADA-91' },
    resolucionSegundaCalificacion: _name === 'final' ? { id: 91, numeroResolucion: 'REGISTRADA-91' } : null };
  const primeraConfirmada = { ...ap, estado: 'EN_RESOLUCION', calificacionPrimera: 'ADMISIBLE',
    resolucionPrimeraCalificacion: { id: 91, numeroResolucion: 'REGISTRADA-91', tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', fundamentos: 'Fundamentos sintéticos del operador' } };
  // Second qualification cannot submit without an institutional receipt read. R2 checks the
  // persisted second act returned by GET, never a simulated successful submission.
  const segundaConsultada = { ...ap, estado: 'NOTIFICACION_SEGUNDA_CALIFICACION', calificacionSegunda: 'ADMITIDO',
    resolucionSegundaCalificacion: { id: 91, numeroResolucion: 'REGISTRADA-91', tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO', fundamentos: 'Sustento registrado' } };
  const consultas = { findByExpediente: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    consultas.findByExpediente.mockReturnValue(of(ap));
    TestBed.configureTestingModule({ imports: [type], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ expediente }) }, paramMap: of(convertToParamMap({ expediente })) } },
      { provide: ApelacionService, useValue: consultas },
      { provide: SolicitudService, useValue: {} },
      { provide: AuthService, useValue: { cambiosSesion: signal(0), obtenerSesion: () => ({ usuarioId: 7, token: 'sesion-sintetica', tipoUsuario: 'TTAIP' }) } },
      { provide: TtaipService, useValue: backend },
      { provide: DocumentoService, useValue: { listByRelation: vi.fn(() => of([])) } },
    ] });
  });
  function pagina() {
    const f = TestBed.createComponent(type as Type<any>);
    f.detectChanges();
    f.componentInstance.selectedDecision.set(decision);
    f.componentInstance.fundamentos = 'Fundamentos sintéticos del operador';
    return f;
  }
  it('muestra solo la numeración del servidor en la confirmación y no ofrece firmar digitalmente', () => {
    if (_name === 'primera') consultas.findByExpediente.mockReturnValue(of(primeraConfirmada));
    if (_name === 'segunda') consultas.findByExpediente.mockReturnValue(of(segundaConsultada));
    const f = pagina();
    f.componentInstance.successModalAbierto.set(true); f.componentInstance.confirmModalAbierto.set(true);
    f.detectChanges();
    const success = f.debugElement.query(By.directive(ReferenceSuccessModalComponent)).componentInstance;
    const confirm = f.debugElement.query(By.directive(ReferenceConfirmModalComponent)).componentInstance;
    expect(success.expedienteHint).toContain('REGISTRADA-91');
    expect(confirm.confirmLabel).not.toMatch(/firmar|emitir/i);
    expect(f.nativeElement.textContent).not.toContain('Ver resolución y cédulas oficiales');
  });
  it('no confirma emisión ni registro cuando la respuesta no identifica el recurso', () => {
    backend[endpoint].mockReturnValue(of(undefined));
    const f = pagina();
    if (_name === 'segunda') { consultas.findByExpediente.mockReturnValue(of(undefined)); f.componentInstance.cargarApelacion(expediente); }
    f.componentInstance[command]();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.error()).toContain('consulte');
  });
  it('un rechazo conserva el sustento y no confirma emisión', () => {
    const respuesta = new Subject(); backend[endpoint].mockReturnValue(respuesta);
    const f = pagina();
    if (_name === 'segunda') { consultas.findByExpediente.mockReturnValue(respuesta); f.componentInstance.cargarApelacion(expediente); }
    else f.componentInstance[command]();
    respuesta.error({ status: 403 });
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    if (_name === 'segunda') { expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.loadError()).toBeTruthy(); }
    else { expect(f.componentInstance.apelacion()?.expediente).toBe(expediente); expect(f.componentInstance.error()).toBeTruthy(); }
    expect(f.componentInstance.fundamentos).toBe('Fundamentos sintéticos del operador');
  });
  it('la actuación consultada o confirmada conserva identificadores del servidor sin acreditar firma', () => {
    backend[endpoint].mockReturnValue(of(_name === 'primera' ? primeraConfirmada : ap));
    if (_name === 'segunda') consultas.findByExpediente.mockReturnValue(of(segundaConsultada));
    const f = pagina();
    if (_name === 'primera') consultas.findByExpediente.mockReturnValue(of(primeraConfirmada));
    if (_name === 'segunda') { f.componentInstance.verActuacionRegistrada(); expect(backend[endpoint]).not.toHaveBeenCalled(); }
    else f.componentInstance[command]();
    f.detectChanges();
    expect(f.componentInstance.successModalAbierto()).toBe(true);
    const success = f.debugElement.query(By.directive(ReferenceSuccessModalComponent)).componentInstance;
    expect(success.expedienteHint).toBe('REGISTRADA-91');
    expect(success.description).toContain('No acredita firma digital');
    expect(success.plazoDias).toBeNull();
    expect(f.componentInstance.apelacion()?.id).toBe(1);
  });
  it('no presenta una respuesta de otra apelación como actuación propia', () => {
    backend[endpoint].mockReturnValue(of({ ...ap, id: 2, expediente: '00002-2026-JUS/TTAIP' }));
    const f = pagina();
    if (_name === 'segunda') { consultas.findByExpediente.mockReturnValue(of({ ...segundaConsultada, id: 2, expediente: '00002-2026-JUS/TTAIP' })); f.componentInstance.cargarApelacion(expediente); }
    else f.componentInstance[command]();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    if (_name === 'segunda') expect(f.componentInstance.apelacion()).toBeNull();
    else expect(f.componentInstance.apelacion()?.id).toBe(1);
  });
});
