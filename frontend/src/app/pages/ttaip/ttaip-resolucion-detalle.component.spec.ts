import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TtaipResolucionDetalleComponent } from './ttaip-resolucion-detalle.component';
import { TtaipService } from '../../services/ttaip.service';
import { ApelacionService } from '../../services/apelacion.service';
import { Apelacion } from '../../models/apelacion.model';

describe('Evidencia de notificación — fechas explícitas', () => {
  let servicio: { validarNotificacionManualmente: ReturnType<typeof vi.fn>; registrarAcuseAutomatico: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    servicio = { validarNotificacionManualmente: vi.fn(() => new Subject()), registrarAcuseAutomatico: vi.fn(() => new Subject()) };
    TestBed.configureTestingModule({ imports: [TtaipResolucionDetalleComponent], providers: [
      { provide: ActivatedRoute, useValue: {} }, { provide: ApelacionService, useValue: {} }, { provide: TtaipService, useValue: servicio }] });
  });
  function pagina() {
    const c = TestBed.createComponent(TtaipResolucionDetalleComponent).componentInstance;
    c.apelacion.set({ id: 1, expediente: '00001-2026-JUS/TTAIP', expedienteTtaip: { id: 12 } } as Apelacion);
    return c;
  }
  it('envía la fecha eficaz manual del sustento separada de la fecha de validación', () => {
    pagina().validarNotificacionManual(91, 'Cargo de entrega', 'CARGO-1', '2026-10-20T09:30');
    expect(servicio.validarNotificacionManualmente).toHaveBeenCalledWith(12, 91, expect.objectContaining({
      fechaEficacia: '2026-10-20T09:30:00', observacionValidacion: 'Cargo de entrega', referenciaEvidencia: 'CARGO-1' }));
  });
  it('no inventa una fecha eficaz cuando el operador la omite', () => {
    pagina().validarNotificacionManual(91, 'Revisión del cargo', 'CARGO-1');
    expect(servicio.validarNotificacionManualmente).toHaveBeenCalledWith(12, 91, expect.objectContaining({ fechaEficacia: null }));
  });
  it('envía la fecha explícita del acuse sin sustituirla por hoy', () => {
    pagina().registrarAcuseNotificacion(91, 'ENTREGADO', 'Acuse de entrega', 'ACUSE-1', '2026-10-20T10:30');
    expect(servicio.registrarAcuseAutomatico).toHaveBeenCalledWith(12, 91, expect.objectContaining({ fechaAcuse: '2026-10-20T10:30:00' }));
  });
});

describe('R2: borrador de la resolución y relación con el expediente', () => {
  const consultas = { findByExpediente: vi.fn() };
  beforeEach(() => {
    consultas.findByExpediente.mockReset();
    TestBed.configureTestingModule({ imports: [TtaipResolucionDetalleComponent], providers: [
      { provide: ActivatedRoute, useValue: {} }, { provide: ApelacionService, useValue: consultas }, { provide: TtaipService, useValue: {} }] });
  });
  function expediente(id: number): Apelacion {
    return { id, expediente: `0000${id}-2026-JUS/TTAIP`, ciudadanoNombre: `Persona ${id}` } as Apelacion;
  }
  it('el borrador se identifica como tal y no modifica la resolución o sus documentos persistidos', () => {
    const c = TestBed.createComponent(TtaipResolucionDetalleComponent).componentInstance;
    const ap = expediente(1);
    consultas.findByExpediente.mockReturnValue(of(ap));
    c.cargarApelacion(ap.expediente!);
    c.verResolucion();
    expect(c.previewModalDoc()?.nombre).toMatch(/^Borrador_/);
    expect(c.previewModalDoc()?.expediente).toBe(ap.expediente);
    expect(c.previewModalDoc()?.id).toBeUndefined();
    expect(c.apelacion()).toBe(ap);
    expect(c.docCtx().fechaResolucion).toBeUndefined();
    expect(consultas.findByExpediente).toHaveBeenCalledOnce();
    expect(consultas.findByExpediente).toHaveBeenCalledWith(ap.expediente);
  });
  it('una consulta nueva limpia el borrador y un fallo no reutiliza el expediente anterior', () => {
    const respuesta = new Subject<Apelacion>();
    consultas.findByExpediente.mockReturnValueOnce(of(expediente(1))).mockReturnValueOnce(respuesta);
    const c = TestBed.createComponent(TtaipResolucionDetalleComponent).componentInstance;
    c.cargarApelacion(expediente(1).expediente!);
    c.verResolucion();
    c.cargarApelacion(expediente(2).expediente!);
    expect(c.previewModalDoc()).toBeNull();
    expect(c.apelacion()).toBeNull();
    respuesta.error(new Error('Red'));
    c.verResolucion();
    expect(c.previewModalOpen()).toBe(false);
    expect(c.draftError()).toContain('Consulte correctamente');
  });
  it('ignora una respuesta tardía y rechaza datos de otra apelación', () => {
    const primera = new Subject<Apelacion>(), segunda = new Subject<Apelacion>();
    consultas.findByExpediente.mockReturnValueOnce(primera).mockReturnValueOnce(segunda);
    const c = TestBed.createComponent(TtaipResolucionDetalleComponent).componentInstance;
    c.cargarApelacion(expediente(1).expediente!); c.cargarApelacion(expediente(2).expediente!);
    primera.next(expediente(1));
    expect(c.apelacion()).toBeNull();
    segunda.next(expediente(1));
    expect(c.apelacion()).toBeNull();
    expect(c.error()).toContain('expediente solicitado');
    c.verResolucion();
    expect(c.previewModalOpen()).toBe(false);
  });
});
