import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SolicitudDetalleComponent } from './solicitud-detalle.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';

const expediente = 'SAIP-2026-00023';
const solicitud = {
  id: 23, expediente, estado: 'EN_REVISION', ciudadanoNombre: 'Persona sintética',
  ciudadanoDni: '00000023', ciudadanoEmail: 'sintetico@example.invalid',
  asunto: 'Consulta sintética', entidadNombre: 'Entidad de prueba',
  documentos: [], documentosMetadata: [], observaciones: [],
  fechaPresentacion: '2026-10-21T09:00:00',
};
const documento = {
  id: 88, nombreOriginal: 'precision.pdf', contentType: 'application/pdf', sizeBytes: 18,
  tipoDocumento: 'SUBSANACION', solicitudId: 23, fechaCreacion: '2026-10-21T10:00:00',
};
const base = 'http://localhost:8080/api';
const url = `${base}/solicitudes/expediente/${expediente}`;

describe('SolicitudDetalleComponent — HTTP autorizado sin sustitutos', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    localStorage.clear();
    params = new BehaviorSubject(convertToParamMap({ expediente }));
    await TestBed.configureTestingModule({
      imports: [SolicitudDetalleComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { paramMap: params.value } } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'sesion-a', usuarioId: 17, tipoUsuario: 'CIUDADANO' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:real');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); localStorage.clear(); });

  function pagina() {
    const f = TestBed.createComponent(SolicitudDetalleComponent);
    f.detectChanges();
    return f;
  }
  function responder(f: ReturnType<typeof pagina>, body: Record<string, unknown> | null = solicitud) {
    const req = http.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    req.flush(body);
    f.detectChanges();
  }

  it('consulta el recurso exacto con Bearer y muestra solo datos/IDs reales del contrato sin mutarlos', () => {
    const f = pagina();
    expect(f.componentInstance.loading()).toBe(true);
    expect(f.nativeElement.querySelector('[role=status]').textContent).toContain('Cargando');
    responder(f, { ...solicitud, documentosMetadata: [documento] });
    expect(f.componentInstance.solicitud()?.id).toBe(23);
    expect(f.componentInstance.misDocumentos()).toEqual([expect.objectContaining({ id: 88, nombre: 'precision.pdf', esSubsanacion: true })]);
    expect(f.nativeElement.textContent).toContain('Persona sintética');
    expect(f.componentInstance.getSolicitanteEmail()).toBe('sintetico@example.invalid');
    expect(solicitud.documentos).toEqual([]);
  });

  it('una respuesta sin documentos no inventa adjuntos ni datos personales', () => {
    const f = pagina();
    responder(f, { ...solicitud, ciudadanoNombre: null, ciudadanoDni: null, ciudadanoEmail: null,
      respuesta: { id: 91, tipoRespuesta: 'ENTREGA_TOTAL', documentosMetadata: [], documentos: [] } });
    expect(f.componentInstance.misDocumentos()).toEqual([]);
    expect(f.componentInstance.adjuntosRespuesta()).toEqual([]);
    expect(f.componentInstance.getSolicitanteDni()).toBe('No registrado');
    expect(f.componentInstance.getSolicitanteEmail()).toBe('No registrado');
    expect(f.nativeElement.textContent).not.toContain('Juan Carlos');
  });

  it.each([[400, 'validacion'], [422, 'validacion'], [401, 'autenticacion'], [403, 'autorizacion'],
    [404, 'inexistente'], [500, 'servidor'], [503, 'servidor'], [0, 'red']])(
    'el error %s no encuentra una solicitud ficticia y muestra un mensaje accesible', (status, estado) => {
      const f = pagina();
      const req = http.expectOne(url);
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ detail: 'dato interno no publicable' }, { status: Number(status), statusText: 'Error' });
      f.detectChanges();
      const c = f.componentInstance;
      expect(c.solicitud()).toBeNull();
      expect(c.estadoConsulta()).toBe(estado);
      expect(c.loading()).toBe(false);
      expect(c.misDocumentos()).toEqual([]);
      expect(c.error()).not.toBe('');
      expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
      expect(f.nativeElement.textContent).not.toContain('dato interno');
      expect(c.puedeReintentarConsulta()).toBe(Number(status) >= 500 || status === 0);
    });

  it('distingue una respuesta vacía de un error y permite reintentar con el mismo identificador', () => {
    const f = pagina();
    responder(f, null);
    expect(f.componentInstance.estadoConsulta()).toBe('vacio');
    expect(f.componentInstance.error()).toBe('');
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.nativeElement.textContent).toContain('no devolvió datos');
    f.nativeElement.querySelector('button').click();
    responder(f);
    expect(f.componentInstance.solicitud()?.expediente).toBe(expediente);
  });

  it('no presenta una respuesta cuyo identificador corresponde a otro recurso', () => {
    const f = pagina();
    responder(f, { ...solicitud, expediente: 'SAIP-2026-99999' });
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.componentInstance.error()).toContain('no corresponde');
  });

  it('cambiar expediente limpia datos, preview y documentos anteriores aunque la nueva consulta falle', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    f.componentInstance.abrirModalPreview({ id: 88, nombre: 'precision.pdf' });
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' }));
    f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.componentInstance.previewTarget()).toBeNull();
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética');
    expect(f.componentInstance.misDocumentos()).toEqual([]);
  });

  it('cancela la consulta anterior al navegar y acepta solo la nueva', () => {
    const f = pagina(); const anterior = http.expectOne(url);
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' }));
    expect(anterior.cancelled).toBe(true);
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush({ ...solicitud, id: 24, expediente: 'SAIP-2026-00024' });
    expect(f.componentInstance.solicitud()?.id).toBe(24);
  });

  it('el cambio de usuario elimina datos y consulta con la nueva sesión; un 403 no conserva información anterior', () => {
    const f = pagina(); responder(f);
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    TestBed.tick();
    expect(f.componentInstance.solicitud()).toBeNull();
    const req = http.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-b');
    req.flush(null, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética');
  });

  it('el logout borra datos sin consultar anónimamente', async () => {
    const f = pagina(); responder(f);
    const cierre = auth.cerrarSesion(); TestBed.tick();
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.componentInstance.estadoConsulta()).toBe('autenticacion');
    http.expectOne(`${base}/auth/logout`).flush(null);
    await cierre;
  });

  it('un cambio de usuario desde otra pestaña tampoco conserva datos del recurso anterior', () => {
    const f = pagina(); responder(f);
    localStorage.setItem('usuario', JSON.stringify({ token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' }));
    TestBed.tick();
    expect(f.componentInstance.solicitud()).toBeNull();
    const req = http.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-b');
    req.flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('una respuesta de la sesión anterior no se acepta antes de procesar el cambio de usuario', () => {
    const f = pagina(); const req = http.expectOne(url);
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    req.flush(solicitud);
    expect(f.componentInstance.solicitud()).toBeNull();
    TestBed.tick(); http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('una descarga fallida no descarga un PDF canónico y se puede repetir contra el ID real', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    const doc = f.componentInstance.misDocumentos()[0];
    f.componentInstance.descargarDoc(doc);
    http.expectOne(`${base}/documentos/88/download`).error(new ProgressEvent('error'));
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(f.componentInstance.documentoError()).toContain('conexión');
    f.componentInstance.descargarDoc(doc);
    const blob = new Blob(['%PDF-real'], { type: 'application/pdf' });
    http.expectOne(`${base}/documentos/88/download`).flush(blob);
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it('cancela la descarga en curso al navegar', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    f.componentInstance.descargarDoc(f.componentInstance.misDocumentos()[0]);
    const descarga = http.expectOne(`${base}/documentos/88/download`);
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' }));
    expect(descarga.cancelled).toBe(true);
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush(null);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('las resoluciones se consultan por el ID de apelación y no inventan PDFs si faltan archivos', () => {
    const f = pagina(); responder(f, { ...solicitud, apelacion: { id: 145, expediente: '00145-2026-JUS/TTAIP', estado: 'EN_RESOLUCION' } });
    expect(f.componentInstance.notifStages()).toEqual([]);
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, resoluciones: [
      { id: 71, numeroResolucion: '00071-2026-JUS/TTAIP', tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', documentos: [], cedulas: [] },
    ] });
    f.componentInstance.cambiarTab('notificaciones'); f.detectChanges();
    expect(f.componentInstance.notifStages()[0].docs).toEqual([]);
    expect(f.nativeElement.textContent).toContain('sin archivos recuperables');
  });

  it('un error documental TTAIP no se convierte en lista vacía; reintenta y recupera los IDs reales', () => {
    const f = pagina(); responder(f, { ...solicitud, apelacion: { id: 145 } });
    http.expectOne(`${base}/apelaciones/145`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(f.componentInstance.errorApelacion()).not.toBe('');
    expect(f.componentInstance.notifStages()).toEqual([]);
    f.componentInstance.cargarDocumentosTribunal();
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, resoluciones: [
      { id: 71, documentos: [{ ...documento, id: 89, resolucionId: 71 }], cedulas: [{ id: 6, documentos: [{ ...documento, id: 90, cedulaNotificacionId: 6 }] }] },
    ] });
    expect(f.componentInstance.notifStages()[0].docs.map(d => d.id)).toEqual([89, 90]);
  });
});
