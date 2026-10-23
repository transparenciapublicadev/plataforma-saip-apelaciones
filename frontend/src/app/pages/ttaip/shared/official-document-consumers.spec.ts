import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TtaipCalificarComponent } from '../ttaip-calificar.component';
import { TtaipSegundaCalificacionComponent } from '../ttaip-segunda-calificacion.component';
import { TtaipResolverComponent } from '../ttaip-resolver.component';
import { ApelacionService } from '../../../services/apelacion.service';
import { TtaipService } from '../../../services/ttaip.service';
import { DocumentoService } from '../../../services/documento.service';
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
    resolucion: { id: 91, numeroResolucion: 'REGISTRADA-91' },
    resolucionPrimeraCalificacion: { id: 91, numeroResolucion: 'REGISTRADA-91' },
    resolucionSegundaCalificacion: { id: 91, numeroResolucion: 'REGISTRADA-91' } };
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ imports: [type], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ expediente }) } } },
      { provide: ApelacionService, useValue: { findByExpediente: vi.fn(() => of(ap)) } },
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
    const f = pagina(); f.componentInstance[command]();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.error()).toContain('consulte');
  });
  it('un rechazo conserva el expediente y no confirma emisión', () => {
    const respuesta = new Subject(); backend[endpoint].mockReturnValue(respuesta);
    const f = pagina(); f.componentInstance[command](); respuesta.error({ status: 403 });
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.apelacion()?.expediente).toBe(expediente);
    expect(f.componentInstance.error()).toBeTruthy();
  });
  it('el registro confirmado conserva los identificadores del servidor sin acreditar firma', () => {
    backend[endpoint].mockReturnValue(of(ap));
    const f = pagina(); f.componentInstance[command](); f.detectChanges();
    expect(f.componentInstance.successModalAbierto()).toBe(true);
    const success = f.debugElement.query(By.directive(ReferenceSuccessModalComponent)).componentInstance;
    expect(success.expedienteHint).toBe('REGISTRADA-91');
    expect(success.description).toContain('No acredita firma digital');
    expect(success.plazoDias).toBeNull();
    expect(f.componentInstance.apelacion()?.id).toBe(1);
  });
  it('no presenta una respuesta de otra apelación como actuación propia', () => {
    backend[endpoint].mockReturnValue(of({ ...ap, id: 2, expediente: '00002-2026-JUS/TTAIP' }));
    const f = pagina(); f.componentInstance[command]();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.apelacion()?.id).toBe(1);
  });
});
