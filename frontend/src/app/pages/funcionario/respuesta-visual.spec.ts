import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { EntidadService } from '../../services/entidad.service';
import { RespuestaService } from '../../services/respuesta.service';
import { SolicitudService } from '../../services/solicitud.service';
import { FuncionarioSolicitudDetalleComponent as Detalle } from './funcionario-solicitud-detalle.component';
import { FuncionarioResponderComponent as Responder } from './funcionario-responder.component';

// Full Angular templates/router; HTTP and account changes are mocked. Real PG/LOCAL is separate.
describe('Respuesta SAIP: presentación y aislamiento del recurso', () => {
  const row = (expediente = 'SAIP-A') => ({ id: expediente === 'SAIP-A' ? 1 : 2, expediente,
    asunto: expediente, estado: 'RECEPCIONADA', fechaPresentacion: '2026-10-23T10:00:00',
    fechaLimite: '2026-11-06', diasRestantes: 11, formatoDigital: true,
    ciudadanoId: 1, ciudadanoNombre: 'Persona sintética', entidadId: 3, entidadNombre: 'Entidad sintética',
    documentosMetadata: [], observaciones: [], ampliacionesPlazo: [], encauzamientos: [], liquidacionesCosto: [], respuesta: null } as any);
  let solicitudes: any, auth: any, documentos: any;
  beforeEach(async () => {
    sessionStorage.clear();
    solicitudes = { findByExpediente: vi.fn((exp: string) => of(row(exp))),
      obtenerSeguimientoPlazo: vi.fn(() => of({ diasRestantes: 14 })), findByCiudadanoId: vi.fn(() => of([])) };
    auth = { cambiosSesion: signal(0), obtenerSesion: vi.fn(() => ({ usuarioId: 2, funcionarioId: 2, token: 'a', rol: 'FUNCIONARIO' })) };
    documentos = { download: vi.fn() };
    await TestBed.configureTestingModule({ imports: [Detalle, Responder], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([
        { path: 'detalle/:expediente', component: Detalle }, { path: 'respuesta/:expediente', component: Responder }]),
      { provide: SolicitudService, useValue: solicitudes }, { provide: AuthService, useValue: auth },
      { provide: DocumentoService, useValue: documentos },
      { provide: EntidadService, useValue: { findActivas: () => of([]) } },
      { provide: RespuestaService, useValue: { getCausalesDenegacion: () => of([]) } }
    ] }).compileComponents();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('recarga al navegar a otro expediente sobre el mismo componente', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    const c = await h.navigateByUrl('/detalle/SAIP-B', Detalle);
    expect(c.solicitud()?.expediente).toBe('SAIP-B');
  });
  it('vacía datos, plazo y documento anterior mientras consulta otro expediente y ante error', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    c.previewTarget.set({ id: 9, nombre: 'anterior.pdf' });
    const pending = new Subject<any>(); solicitudes.findByExpediente.mockReturnValue(pending);
    c.cargarSolicitud('SAIP-B');
    expect(c.solicitud()).toBeNull(); expect(c.plazoSeguimiento()).toBeNull(); expect(c.previewTarget()).toBeNull();
    pending.error(new HttpErrorResponse({ status: 403 })); h.detectChanges();
    expect(c.solicitud()).toBeNull(); expect(c.error()).toMatch(/permiso|autorizad/i);
  });
  it('descarta respuestas tardías de otra consulta y de otra sesión', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    const a = new Subject<any>(), b = new Subject<any>();
    solicitudes.findByExpediente.mockReturnValueOnce(a).mockReturnValueOnce(b);
    c.cargarSolicitud('SAIP-A'); c.cargarSolicitud('SAIP-B'); b.next(row('SAIP-B')); a.next(row());
    expect(c.solicitud()?.expediente).toBe('SAIP-B');
    auth.obtenerSesion.mockReturnValue(null); auth.cambiosSesion.update((n: number) => n + 1);
    h.detectChanges();
    expect(c.solicitud()).toBeNull();
  });
  it('muestra documentos persistidos también en denegatorias sin inventar fecha ni fundamento', async () => {
    solicitudes.findByExpediente.mockReturnValue(of({ ...row(), estado: 'DENEGADA', respuesta: {
      id: 8, tipoRespuesta: 'DENEGACION_TOTAL', documentosMetadata: [{ id: 9, respuestaId: 8, nombreOriginal: 'real.pdf', sizeBytes: 632 }]
    } }));
    const h = await RouterTestingHarness.create(); await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    const text = h.routeNativeElement!.textContent!;
    expect(text).toContain('real.pdf'); expect(text).toContain('No registrada');
    expect(text).not.toContain('Art. 15°'); expect(text).not.toContain('Resolución ·');
  });
  it('distingue una consulta previa no autorizada del resultado vacío', async () => {
    solicitudes.findByCiudadanoId.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    c.activeTab.set('ciudadano'); h.detectChanges();
    expect(h.routeNativeElement!.textContent).toContain('Consulta de solicitudes previas no disponible');
  });
  it('separa los adjuntos de entrega total y parcial y muestra la modalidad registrada', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:adjunto-sintetico');
    const h = await RouterTestingHarness.create();
    const c = await h.navigateByUrl('/respuesta/SAIP-A', Responder);
    c.decision.set('entrega_total');
    c.documentosEntrega.set([new File(['total'], 'informe-total.pdf', { type: 'application/pdf' })]);
    h.detectChanges();
    const root = h.routeNativeElement!;
    expect(root.textContent).toContain('Correo electrónico');
    expect(root.textContent).not.toContain('Copia digital (plataforma)');
    expect(root.textContent).toContain('informe-total.pdf');
    c.decision.set('entrega_parcial');
    h.detectChanges();
    expect(root.textContent).not.toContain('informe-total.pdf');
    c.documentosEntregaParcial.set([new File(['parcial'], 'anexo-parcial.pdf', { type: 'application/pdf' })]);
    h.detectChanges();
    expect(root.textContent).toContain('anexo-parcial.pdf');
    expect(root.textContent).not.toContain('informe-total.pdf');
    c.decision.set('entrega_total');
    h.detectChanges();
    expect(root.textContent).toContain('informe-total.pdf');
    expect(root.textContent).not.toContain('anexo-parcial.pdf');
    expect(c.documentosEntrega().map(file => file.name)).toEqual(['informe-total.pdf']);
    expect(c.documentosEntregaParcial().map(file => file.name)).toEqual(['anexo-parcial.pdf']);
    c.descripcionAceptacion = 'Entrega completa del informe';
    c.descripcionAceptacionParcial = 'Solo se entrega el anexo';
    c.decision.set('entrega_parcial');
    h.detectChanges();
    expect(root.querySelector('#respuesta-descripcion')).toBeNull();
    expect(root.querySelector('#respuesta-descripcion-parcial')).not.toBeNull();
    expect(c.descripcionAceptacion).toBe('Entrega completa del informe');
    c.decision.set('entrega_total');
    h.detectChanges();
    expect(root.querySelector('#respuesta-descripcion-parcial')).toBeNull();
    expect(root.querySelector('#respuesta-descripcion')).not.toBeNull();
    expect(c.descripcionAceptacionParcial).toBe('Solo se entrega el anexo');
  });
  it('expone fundamento parcial, campos etiquetados y errores sin éxito', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/respuesta/SAIP-A', Responder);
    c.decision.set('entrega_parcial'); c.error.set('Operación rechazada'); h.detectChanges();
    const root = h.routeNativeElement!;
    expect(root.querySelector('textarea[id="respuesta-fundamento-parcial"]')).not.toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Operación rechazada');
    expect(root.querySelector('label[for="respuesta-descripcion-parcial"]')).not.toBeNull();
  });
  it('agrega el detalle de precisión punto por punto', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/respuesta/SAIP-A', Responder);
    c.via.set('precision'); h.detectChanges();
    const root = h.routeNativeElement!;
    const primero = root.querySelector<HTMLInputElement>('#precision-punto-0');
    expect(primero).not.toBeNull();
    expect(root.querySelector('button[aria-label="Eliminar punto 1"]')?.hasAttribute('disabled')).toBe(true);
    primero!.value = 'Precise el periodo solicitado';
    primero!.dispatchEvent(new Event('input'));
    root.querySelectorAll('button').forEach(button => { if (button.textContent?.includes('Agregar punto')) button.click(); });
    h.detectChanges();
    expect(root.querySelector('#precision-punto-1')).not.toBeNull();
    expect(c.precisionPuntos()[0]).toBe('Precise el periodo solicitado');
    expect(c.precisionTexto()).toBe('1. Precise el periodo solicitado');
  });
  it('conserva la recepción SAIP y los textos propios al cambiar a un resultado default con marca Yaiku', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/respuesta/SAIP-A', Responder);
    // Render a recovered DTO fixture; persistence is covered by the reception suites.
    c.recepcionRespuesta.set({ id: 15, solicitudId: 1, respuesta: { id: 41, tipoRespuesta: 'ENTREGA_TOTAL' },
      documentos: [{ id: 9, respuestaId: 41, nombreOriginal: 'informe-real.pdf' }] } as any);
    c.decision.set('entrega_total'); c.successModalAbierto.set(true); h.detectChanges();
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Yaiku');
    expect(dialog.textContent).toContain('15 · respuesta 41');
    expect(dialog.textContent).toContain('informe-real.pdf');
    expect(dialog.textContent).toContain('La información ha sido entregada al ciudadano dentro del plazo legal');
    c.via.set('precision'); h.detectChanges();
    expect(dialog.getAttribute('data-presentation')).toBe('default');
    expect(dialog.textContent).toContain('Yaiku');
    expect(dialog.textContent).not.toContain('TTAIP · República del Perú');
    expect(dialog.textContent).toContain('Solicitud de precisión notificada');
    expect(dialog.textContent).toContain('Se notificó al administrado por correo y plataforma. Dispone de 2 días hábiles para subsanar');
    expect(dialog.textContent).not.toContain('15 · respuesta 41');
  });
  it.each([0, 401, 403, 404, 500])('consulta fallida %s sin datos de la solicitud anterior', async status => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    solicitudes.findByExpediente.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    c.cargarSolicitud('SAIP-B'); h.detectChanges();
    expect(c.solicitud()).toBeNull(); expect(h.routeNativeElement!.querySelector('[role="alert"]')).not.toBeNull();
    expect(h.routeNativeElement!.textContent).not.toContain('Persona sintética');
    expect(c.reintentable()).toBe(status === 0 || status === 500);
  });
  it('permite reintentar una consulta sin convertir un vacío en datos ficticios', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    solicitudes.findByExpediente.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })))
      .mockReturnValueOnce(of(null));
    c.cargarSolicitud('SAIP-B'); c.reintentarConsulta(); h.detectChanges();
    expect(c.solicitud()).toBeNull(); expect(h.routeNativeElement!.textContent).toContain('No se encontró la solicitud');
  });
  it('navega las pestañas con flechas y conserva un único tab activo', async () => {
    const h = await RouterTestingHarness.create(); await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    const tabs = h.routeNativeElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); h.detectChanges();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(h.routeNativeElement!.querySelectorAll('[role="tab"][tabindex="0"]').length).toBe(1);
  });
  it('limpia formulario y documentos al cambiar de sesión sin aceptar una consulta tardía', async () => {
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/respuesta/SAIP-A', Responder);
    c.descripcionAceptacion = 'Dato anterior'; c.documentosEntrega.set([new File(['a'], 'anterior.pdf')]);
    const pending = new Subject<any>(); solicitudes.findByExpediente.mockReturnValue(pending); c.cargarSolicitud('SAIP-B');
    auth.obtenerSesion.mockReturnValue({ usuarioId: 4, funcionarioId: 4, token: 'b' }); auth.cambiosSesion.update((n: number) => n + 1);
    h.detectChanges(); pending.next(row('SAIP-B')); h.detectChanges();
    expect(c.solicitud()).toBeNull(); expect(c.descripcionAceptacion).toBe(''); expect(c.documentosEntrega()).toEqual([]);
    expect(c.successModalAbierto()).toBe(false);
  });
  it('una descarga fallida no anuncia entrega ni genera un sustituto', async () => {
    solicitudes.findByExpediente.mockReturnValue(of({ ...row(), documentosMetadata: [{ id: 9, solicitudId: 1, nombreOriginal: 'real.pdf' }] }));
    documentos.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/detalle/SAIP-A', Detalle);
    c.descargarDoc({ id: 9, nombre: 'real.pdf' }); h.detectChanges();
    expect(h.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain('documento');
    expect(c.solicitud()?.estado).toBe('RECEPCIONADA');
  });
});
