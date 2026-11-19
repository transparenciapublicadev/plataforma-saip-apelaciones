import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsanacionComponent } from './subsanacion.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';

const expediente = '00023-2026-JUS/TTAIP';
const documento = { id: 88, nombreArchivo: 'original.pdf', tipoArchivo: 'application/pdf', tipoDocumento: 'APELACION' };
const apelacion = {
  id: 145, expediente, estado: 'EN_SUBSANACION', ciudadanoNombre: 'Persona sintética',
  entidadNombre: 'Entidad de prueba', documentos: [documento],
  fechaApelacion: '2026-10-21T09:00:00', diasSubsanacion: 2,
  resolucionPrimeraCalificacion: { id: 71, observaciones: 'Aclarar el periodo solicitado' },
};
const requerimiento = { apelacionId: 145, requerimientoId: 71, observaciones: 'Aclarar el periodo solicitado',
  diasSubsanacion: 2, diasHabilesRestantes: 2, admitePresentacion: true, exigenciasDocumentalesEstructuradas: false };
const base = 'http://localhost:8080/api';
const recepcionUrl = `${base}/apelaciones/145/subsanacion/71/recepcion`;
const url = `${base}/apelaciones/expediente/${expediente}`;

describe('SubsanacionComponent — HTTP autorizado sin sustitutos', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    params = new BehaviorSubject(convertToParamMap({ expediente }));
    await TestBed.configureTestingModule({
      imports: [SubsanacionComponent],
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
    const f = TestBed.createComponent(SubsanacionComponent);
    f.detectChanges();
    return f;
  }
  function responder(f: ReturnType<typeof pagina>, body: Record<string, unknown> | null = apelacion) {
    const req = http.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    req.flush(body);
    if (body?.['id'] && body?.['expediente'] === expediente) responderRequerimiento();
    f.detectChanges();
  }

  function responderRequerimiento(apelacionId = 145, requerimientoId = 71) {
    http.expectOne(`${base}/apelaciones/${apelacionId}/subsanacion/requerimiento`)
      .flush({ ...requerimiento, apelacionId, requerimientoId });
  }
  function recibo(clave: string, documentos: unknown[] = [], texto = 'Correcciones sintéticas') {
    return { id: 501, apelacionId: 145, requerimientoId: 71, expediente, claveOperacion: clave,
      fechaRecepcion: '2026-10-22T10:00:00', fundamentosAdicionales: texto, estado: 'RECIBIDA', documentos: documentos.map((item): Record<string, unknown> => {
        const doc = item as Record<string, unknown>;
        const { nombreArchivo, hashContenido: _legacyHash, ...metadata } = doc;
        return { tipoDocumento: 'SUBSANACION', estado: 'ACTIVO', nombreOriginal: typeof nombreArchivo === 'string' ? nombreArchivo : 'sustento.pdf',
          contentType: 'application/pdf', sizeBytes: 13, hashSha256: 'a'.repeat(64), ...metadata };
      }) };
  }
  function preparar() {
    const f = pagina(); responder(f);
    f.componentInstance.fundamentosAdicionales = 'Correcciones sintéticas';
    return f;
  }
  function envio() {
    const req = http.expectOne(recepcionUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    return { req, clave: (req.request.body as FormData).get('claveOperacion') as string };
  }

  it('no convierte una fecha histórica en vencimiento sin evidencia eficaz', () => {
    const f = pagina(); http.expectOne(url).flush({ ...apelacion, fechaSubsanacion: '2000-01-01' });
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento,
      fechaBasePlazo: '2000-01-01', fechaLimite: '2000-01-03', diasHabilesRestantes: -9000,
      plazo: { requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2 } });
    f.detectChanges();
    expect(f.componentInstance.getFechaNotificacion()).toBeNull();
    expect(f.componentInstance.getFechaLimite()).toBeNull();
    expect(f.componentInstance.calcularDiasRestantes()).toBeNull();
    expect(f.componentInstance.esSubsanacionVencida()).toBe(false);
    expect(f.nativeElement.textContent).toContain('Plazo pendiente de inicio');
    expect(f.nativeElement.textContent).not.toContain('Subsanación Vencida');
    f.componentInstance.fundamentosAdicionales = 'Correcciones sintéticas';
    f.componentInstance.enviarSubsanacion(); const { req, clave } = envio(); req.flush(recibo(clave));
    expect(f.componentInstance.estadoEnvio()).toBe('confirmada');
  });

  it('usa el plazo del requerimiento recibido del servidor y no el reloj local', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento, admitePresentacion: false,
      plazo: { requerimientoId: 71, estado: 'VENCIDO', fechaEficacia: '2026-10-15T10:00:00',
        fechaLimite: '2026-10-19', diasHabiles: 2, diasHabilesRestantes: -3, notificacionId: 91 } });
    f.detectChanges();
    expect(f.componentInstance.esSubsanacionVencida()).toBe(true);
    expect(f.componentInstance.calcularDiasRestantes()).toBe(-3);
    expect(f.nativeElement.textContent).toContain('Subsanación Vencida');
    f.componentInstance.fundamentosAdicionales = 'Correcciones sintéticas'; f.componentInstance.enviarSubsanacion();
    http.expectNone(recepcionUrl);
  });

  it('consulta el número completo TTAIP y muestra las observaciones y documentos recibidos', () => {
    const f = pagina();
    expect(f.componentInstance.loadingApelacion()).toBe(true);
    responder(f);
    expect(f.componentInstance.apelacion()?.id).toBe(145);
    expect(f.componentInstance.documentosOriginales()).toEqual([documento]);
    expect(f.nativeElement.textContent).toContain('Aclarar el periodo solicitado');
    expect(f.nativeElement.textContent).toContain(expediente);
  });

  it.each([[400, 'validacion'], [422, 'validacion'], [401, 'autenticacion'], [403, 'autorizacion'],
    [404, 'inexistente'], [500, 'servidor'], [503, 'servidor'], [0, 'red']])(
    'el error %s no encuentra una apelación ficticia ni habilita la subsanación', (status, estado) => {
      const f = pagina(); const req = http.expectOne(url);
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({ detail: 'dato interno' }, { status: Number(status), statusText: 'Error' });
      f.detectChanges(); const c = f.componentInstance;
      expect(c.apelacion()).toBeNull();
      expect(c.documentosOriginales()).toEqual([]);
      expect(c.estadoConsulta()).toBe(estado);
      expect(c.error()).not.toBe('');
      expect(c.loadingApelacion()).toBe(false);
      expect(c.successModalAbierto()).toBe(false);
      expect(f.nativeElement.querySelector('textarea')).toBeNull();
      expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
      expect(f.nativeElement.textContent).not.toContain('dato interno');
    });

  it('distingue resultado vacío y reintenta la misma apelación', () => {
    const f = pagina(); responder(f, null);
    expect(f.componentInstance.estadoConsulta()).toBe('vacio');
    expect(f.componentInstance.error()).toBe('');
    expect(f.nativeElement.textContent).toContain('no devolvió datos');
    f.componentInstance.reintentarConsulta(); responder(f);
    expect(f.componentInstance.apelacion()?.id).toBe(145);
  });

  it('limpia documentos, archivos locales y formulario al cambiar de expediente aunque el nuevo falle', () => {
    const f = pagina(); responder(f);
    f.componentInstance.fundamentosAdicionales = 'Texto del primer expediente';
    const file = new File(['local'], 'local.pdf', { type: 'application/pdf' });
    f.componentInstance.documentosSeleccionados.set([file]);
    f.componentInstance.previsualizarArchivoLocal(file);
    params.next(convertToParamMap({ expediente: '00024-2026-JUS/TTAIP' })); f.detectChanges();
    expect(f.componentInstance.previewTarget()).toBeNull();
    expect(f.componentInstance.documentosSeleccionados()).toEqual([]);
    expect(f.componentInstance.fundamentosAdicionales).toBe('');
    http.expectOne(`${base}/apelaciones/expediente/00024-2026-JUS/TTAIP`).flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.componentInstance.apelacion()).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('original.pdf');
    expect(f.nativeElement.textContent).not.toContain(expediente);
  });

  it('cancela la consulta anterior al navegar y conserva el ID devuelto por la consulta nueva', () => {
    const f = pagina(); const anterior = http.expectOne(url);
    params.next(convertToParamMap({ expediente: '00024-2026-JUS/TTAIP' }));
    expect(anterior.cancelled).toBe(true);
    http.expectOne(`${base}/apelaciones/expediente/00024-2026-JUS/TTAIP`).flush({ ...apelacion, id: 146, expediente: '00024-2026-JUS/TTAIP' });
    responderRequerimiento(146, 72);
    expect(f.componentInstance.apelacion()?.id).toBe(146);
  });

  it('rechaza una respuesta cuyo número no coincide con el recurso solicitado', () => {
    const f = pagina(); responder(f, { ...apelacion, expediente: '00099-2026-JUS/TTAIP' });
    expect(f.componentInstance.apelacion()).toBeNull();
    expect(f.componentInstance.error()).toContain('no corresponde');
  });

  it('al cambiar de usuario borra datos anteriores y respeta el 403 de la nueva sesión', () => {
    const f = pagina(); responder(f);
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    TestBed.tick();
    expect(f.componentInstance.apelacion()).toBeNull();
    const req = http.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-b');
    req.flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('original.pdf');
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });

  it.each([401, 403, 404, 500, 0])('una descarga fallida %s no descarga PDF canónico ni anuncia éxito', status => {
    const f = pagina(); responder(f);
    f.componentInstance.descargarDocumento(documento);
    const req = http.expectOne(`${base}/documentos/88/download`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush(null, { status, statusText: 'Error' });
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(f.componentInstance.documentoError()).not.toBe('');
    expect(f.componentInstance.mensaje()).toBe('');
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });

  it('preview fallido no presenta un sustituto; al cerrar y reabrir recupera el archivo real', () => {
    const f = pagina(); responder(f);
    f.componentInstance.previsualizarDocumento(documento); f.detectChanges();
    http.expectOne(`${base}/documentos/88/download`).flush(null, { status: 500, statusText: 'Error' });
    f.detectChanges();
    expect(document.body.querySelector('iframe')).toBeNull();
    expect(document.body.textContent).toContain('El servidor no pudo recuperar el documento');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    f.componentInstance.cerrarPreview(); f.detectChanges();
    f.componentInstance.previsualizarDocumento(documento); f.detectChanges();
    const blob = new Blob(['%PDF-real'], { type: 'application/pdf' });
    http.expectOne(`${base}/documentos/88/download`).flush(blob); f.detectChanges();
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(document.body.querySelector('iframe')?.getAttribute('src')).toBe('blob:real#page=1&navpanes=0&view=FitH');
  });

  it('la descarga correcta utiliza los bytes reales y el nombre devuelto por el servidor', () => {
    const f = pagina(); responder(f);
    f.componentInstance.descargarDocumento(documento);
    const blob = new Blob(['%PDF-original'], { type: 'application/pdf' });
    http.expectOne(`${base}/documentos/88/download`).flush(blob, { headers: { 'Content-Disposition': 'attachment; filename="servidor.pdf"' } });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it('un documento sin ID no se sustituye por una plantilla', () => {
    const f = pagina(); responder(f);
    f.componentInstance.previsualizarDocumento({ nombreArchivo: 'Resolucion.pdf' });
    f.componentInstance.descargarDocumento({ nombreArchivo: 'Resolucion.pdf' });
    expect(f.componentInstance.isPreviewOpen()).toBe(false);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(f.componentInstance.documentoError()).toContain('no dispone');
  });

  it('no procesa una descarga antigua tras cambiar de usuario, incluso antes de actualizar la vista', () => {
    const f = pagina(); responder(f);
    f.componentInstance.descargarDocumento(documento);
    const req = http.expectOne(`${base}/documentos/88/download`);
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    req.flush(new Blob(['old']));
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    TestBed.tick(); http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('envía bytes, clave y requerimiento y confirma sólo la recepción devuelta por el servidor', () => {
    const f = preparar();
    const archivo = new File(['%PDF-sustento'], 'sustento.pdf', { type: 'application/pdf' });
    f.componentInstance.documentosSeleccionados.set([archivo]);
    f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    const body = req.request.body as FormData;
    expect(req.request.headers.has('Content-Type')).toBe(false); // El navegador añade el boundary multipart.
    expect(body.get('fundamentosAdicionales')).toBe('Correcciones sintéticas');
    expect(body.getAll('archivos')).toEqual([archivo]);
    expect(clave).toMatch(/^[0-9a-f-]{36}$/);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    const documento = { id: 99, apelacionId: 145, nombreArchivo: 'sustento.pdf', hashContenido: 'hash-real' };
    req.flush(recibo(clave, [documento]));
    expect(f.componentInstance.recepcion()?.id).toBe(501);
    expect(f.componentInstance.successModalAbierto()).toBe(true);
    expect(f.componentInstance.apelacion()?.estado).toBe('EN_SUBSANACION'); // No transición local.
    f.componentInstance.descargarDocumento(documento);
    const bytes = new Blob(['%PDF-sustento']);
    http.expectOne(`${base}/documentos/99/download`).flush(bytes);
    expect(URL.createObjectURL).toHaveBeenCalledWith(bytes);
    http.expectNone(`${base}/documentos/upload`);
  });

  it.each([400, 401, 403, 404, 422])('rechazo %s conserva el formulario sin confirmar', status => {
    const f = preparar(); f.componentInstance.enviarSubsanacion();
    envio().req.flush(null, { status, statusText: 'Error' });
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.estadoEnvio()).toBe('rechazada');
    expect(f.componentInstance.fundamentosAdicionales).toBe('Correcciones sintéticas');
    expect(f.componentInstance.formularioBloqueado()).toBe(false);
    expect(f.componentInstance.error()).not.toBe('');
  });

  it.each([0, 500, 503])('resultado incierto %s consulta antes de permitir un reintento', status => {
    const f = preparar();
    const archivo = new File(['%PDF-sustento'], 'sustento.pdf', { type: 'application/pdf' });
    f.componentInstance.documentosSeleccionados.set([archivo]);
    f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush(null, { status, statusText: 'Error' });
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 503, statusText: 'Error' });
    expect(f.componentInstance.estadoEnvio()).toBe('incierta');
    f.componentInstance.enviarSubsanacion();
    http.expectNone(r => r.method === 'POST');
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance.documentosSeleccionados()).toEqual([archivo]);
    expect(f.componentInstance.fundamentosAdicionales).toBe('Correcciones sintéticas');
    f.componentInstance.enviarSubsanacion();
    const repetido = envio(); expect(repetido.clave).toBe(clave);
    expect((repetido.req.request.body as FormData).getAll('archivos')).toEqual([archivo]);
    repetido.req.flush(recibo(clave, [{ id: 99, apelacionId: 145 }]));
    expect(f.componentInstance.successModalAbierto()).toBe(true);
  });

  it('un conflicto sin recepción es rechazo y exige actualizar en vez de repetir la presentación', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    req.flush(null, { status: 409, statusText: 'Conflict' });
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance.estadoEnvio()).toBe('rechazada');
    expect(f.componentInstance.fundamentosAdicionales).toBe('Correcciones sintéticas');
    expect(f.componentInstance.error()).toContain('conflicto');
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    f.componentInstance.enviarSubsanacion(); http.expectNone(r => r.method === 'POST');
    f.componentInstance.reintentarConsulta(); responder(f, { ...apelacion, estado: 'EN_CALIFICACION_2' });
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance.recepcion()).toBeNull();
  });

  it('no confirma con una respuesta vacía del registro ni de su comprobación', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion();
    const { req, clave } = envio(); req.flush(null);
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.estadoEnvio()).toBe('incierta');
    expect(f.componentInstance.error()).toContain('no acredita');
  });

  it('recupera una recepción confirmada tras pérdida de conexión sin repetir el POST', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion();
    const { req, clave } = envio(); req.error(new ProgressEvent('error'));
    http.expectOne(`${recepcionUrl}/${clave}`).flush(recibo(clave));
    expect(f.componentInstance.recepcion()?.id).toBe(501);
    expect(f.componentInstance.successModalAbierto()).toBe(true);
    f.componentInstance.enviarSubsanacion(); http.expectNone(r => r.method === 'POST');
  });

  it('tras recargar comprueba la clave persistida incluso si el estado ya avanzó', () => {
    sessionStorage.setItem('ttaip:subsanacion:v1:17:145:71', JSON.stringify({ clave: 'clave-previa', numeroArchivos: 0 }));
    const f = pagina(); responder(f, { ...apelacion, estado: 'EN_CALIFICACION_2' });
    http.expectNone(r => r.method === 'POST');
    http.expectOne(`${recepcionUrl}/clave-previa`).flush(recibo('clave-previa'));
    expect(f.componentInstance.recepcion()?.id).toBe(501);
  });

  it.each(['requerimiento', 'documento', 'cantidad'])('no acepta una recepción incompatible: %s', cambio => {
    const f = preparar();
    if (cambio === 'documento') f.componentInstance.documentosSeleccionados.set([new File(['sustento'], 'sustento.pdf', { type: 'application/pdf' })]);
    f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    const r = recibo(clave);
    if (cambio === 'requerimiento') r.requerimientoId = 72;
    if (cambio === 'documento') r.documentos = recibo(clave, [{ id: 99, apelacionId: 999 }]).documentos;
    if (cambio === 'cantidad') r.documentos = [{ id: 99, apelacionId: 145 }];
    req.flush(r);
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 503, statusText: 'Error' });
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });

  it('un timeout consulta la recepción antes de reenviar', async () => {
    vi.useFakeTimers();
    try {
      const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
      await vi.advanceTimersByTimeAsync(30_001);
      expect(req.cancelled).toBe(true);
      http.expectOne(`${recepcionUrl}/${clave}`).flush(recibo(clave));
      expect(f.componentInstance.successModalAbierto()).toBe(true);
      http.expectNone(r => r.method === 'POST');
    } finally { vi.useRealTimers(); }
  });

  it('un requerimiento no recuperable no habilita ni simula la presentación', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush(null, { status: 404, statusText: 'Not Found' });
    f.componentInstance.fundamentosAdicionales = 'Correcciones sintéticas';
    f.componentInstance.enviarSubsanacion();
    expect(f.componentInstance.requerimiento()).toBeNull();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    http.expectNone(r => r.method === 'POST');
    f.componentInstance.cargarRequerimiento(); responderRequerimiento();
    expect(f.componentInstance.requerimiento()?.requerimientoId).toBe(71);
  });

  it('una recepción recuperada después del plazo no aparece como subsanación incumplida', () => {
    sessionStorage.setItem('ttaip:subsanacion:v1:17:145:71', JSON.stringify({ clave: 'clave-previa', numeroArchivos: 0 }));
    const f = pagina(); http.expectOne(url).flush({ ...apelacion, estado: 'EN_CALIFICACION_2' });
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`)
      .flush({ ...requerimiento, fechaLimite: '2020-01-01', admitePresentacion: false });
    http.expectOne(`${recepcionUrl}/clave-previa`).flush(recibo('clave-previa')); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Subsanación Vencida');
    expect(f.nativeElement.textContent).not.toContain('Subsanación no habilitada');
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.componentInstance.recepcion()?.id).toBe(501);
  });

  it('una respuesta tardía de envío no repuebla otra sesión', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    req.flush(recibo(clave));
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    TestBed.tick(); http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance.recepcion()).toBeNull();
  });

  it('cancela la presentación al cambiar de expediente y mantiene la clave para comprobarla después', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req } = envio();
    params.next(convertToParamMap({ expediente: '00024-2026-JUS/TTAIP' }));
    expect(req.cancelled).toBe(true);
    http.expectOne(`${base}/apelaciones/expediente/00024-2026-JUS/TTAIP`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance.recepcion()).toBeNull();
    expect(sessionStorage.getItem('ttaip:subsanacion:v1:17:145:71')).not.toBeNull();
  });

  it('un reloj ausente no se presenta como un inicio pendiente acreditado', () => {
    const f = preparar(); f.detectChanges();
    expect(f.componentInstance.plazoPendienteInicio()).toBe(false);
    expect(f.nativeElement.textContent).toContain('Reloj no disponible');
    expect(f.nativeElement.textContent).not.toContain('Plazo pendiente de inicio');
  });

  it('la lectura pendiente del requerimiento no muestra un formulario ni ausencia de observaciones', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`); f.detectChanges();
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('no registró observaciones');
  });

  it('un requerimiento inexistente no mantiene el formulario vacío habilitado', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush(null, { status: 404, statusText: 'Not Found' }); f.detectChanges();
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
  });

  it('el reloj de otro requerimiento no aporta fechas ni días a este formulario', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento,
      plazo: { requerimientoId: 999, estado: 'EN_CURSO', notificacionId: 91, diasHabiles: 2,
        diasHabilesRestantes: 1, fechaEficacia: '2026-10-21T10:00:00', fechaLimite: '2026-10-23' } }); f.detectChanges();
    expect(f.componentInstance.getFechaNotificacion()).toBeNull();
    expect(f.componentInstance.calcularDiasRestantes()).toBeNull();
    expect(f.nativeElement.textContent).toContain('información del reloj está incompleta');
  });

  it('una revisión de sesión con el mismo token descarta la consulta de la cuenta anterior', () => {
    const f = pagina(); const anterior = http.expectOne(url);
    auth.guardarSesion({ success: true, token: 'sesion-a', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    anterior.flush(apelacion);
    expect(f.componentInstance.apelacion()).toBeNull();
    TestBed.tick(); http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('actualizar el requerimiento cancela el envío anterior y no acepta su recepción en el nuevo', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req } = envio();
    f.componentInstance.cargarRequerimiento(); expect(req.cancelled).toBe(true);
    responderRequerimiento(145, 72);
    expect(f.componentInstance.recepcion()).toBeNull();
    expect(f.componentInstance.fundamentosAdicionales).toBe('');
  });

  it('vincula los fundamentos y permite abrir el selector opcional por teclado', () => {
    const f = preparar(); f.detectChanges();
    expect(f.nativeElement.querySelector('label[for="subsanacion-observaciones"]')).not.toBeNull();
    const trigger = f.nativeElement.querySelector('[role=button][aria-label*="Seleccionar archivos"]') as HTMLElement;
    expect(trigger?.getAttribute('tabindex')).toBe('0');
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(click).toHaveBeenCalledOnce();
    expect(input.required).toBe(false);
  });

  it('la confirmación contiene el foco y Escape cierra sin registrar una presentación', async () => {
    const f = preparar(); f.componentInstance.abrirConfirmacionSubsanacion(); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.confirmModalAbierto()).toBe(false);
    http.expectNone(recepcionUrl); expect(f.componentInstance.recepcion()).toBeNull();
  });

  it.each([
    { estado: 'PENDIENTE_INICIO', dias: null, admite: true },
    { estado: 'EN_CURSO', dias: 0, admite: true },
    { estado: 'EN_CURSO', dias: 1, admite: true },
    { estado: 'VENCIDO', dias: -1, admite: false },
  ])('respeta el estado $estado y saldo $dias del servidor sin calcular un reloj local', ({ estado, dias, admite }) => {
    const f = pagina(); http.expectOne(url).flush({ ...apelacion, fechaSubsanacion: '2000-01-01' });
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento, admitePresentacion: admite,
      plazo: { requerimientoId: 71, estado, diasHabiles: 4, diasHabilesRestantes: dias,
        notificacionId: estado === 'PENDIENTE_INICIO' ? null : 91,
        fechaEficacia: estado === 'PENDIENTE_INICIO' ? null : '2026-10-19T10:00:00',
        fechaLimite: estado === 'PENDIENTE_INICIO' ? null : '2026-10-23' } }); f.detectChanges();
    expect(f.componentInstance.calcularDiasRestantes()).toBe(dias);
    expect(f.componentInstance.getPlazoSubsanacionDias()).toBe(4);
    expect(f.componentInstance.esSubsanacionVencida()).toBe(estado === 'VENCIDO');
    if (estado === 'EN_CURSO' && dias === 0) expect(f.nativeElement.textContent).toContain('Último día permitido');
    f.componentInstance.fundamentosAdicionales = 'Correcciones sintéticas'; f.componentInstance.enviarSubsanacion();
    if (admite) { const { req, clave } = envio(); req.flush(recibo(clave)); }
    else http.expectNone(recepcionUrl);
  });

  it('un rótulo de proveedor no sustituye el estado pendiente ni aporta una fecha eficaz', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento,
      plazo: { requerimientoId: 71, estado: 'PENDIENTE_INICIO', diasHabiles: 2, fuente: 'SMTP_ENTREGADO' } }); f.detectChanges();
    expect(f.componentInstance.plazoPendienteInicio()).toBe(true);
    expect(f.componentInstance.getFechaNotificacion()).toBeNull(); expect(f.componentInstance.calcularDiasRestantes()).toBeNull();
    expect(f.nativeElement.textContent).toContain('Plazo pendiente de inicio');
  });

  it('un reloj en curso con evidencia temporal incompleta se señala sin inventar notificación', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento,
      plazo: { requerimientoId: 71, estado: 'EN_CURSO', diasHabiles: 2, diasHabilesRestantes: 1 } }); f.detectChanges();
    expect(f.componentInstance.relojIncompleto()).toBe(true);
    expect(f.componentInstance.getFechaNotificacion()).toBeNull(); expect(f.componentInstance.getFechaLimite()).toBeNull();
    expect(f.nativeElement.textContent).toContain('información del reloj está incompleta');
  });

  it('no sustituye una duración ausente por la de la apelación ni por dos días', () => {
    const f = pagina(); http.expectOne(url).flush({ ...apelacion, diasSubsanacion: 99 });
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush({ ...requerimiento, diasSubsanacion: null }); f.detectChanges();
    expect(f.componentInstance.getPlazoSubsanacionDias()).toBeNull();
    expect(f.nativeElement.textContent).toContain('No disponible');
  });

  it('un requerimiento vacío no es una ausencia confirmada de observaciones y permite consultar nuevamente', () => {
    const f = pagina(); http.expectOne(url).flush(apelacion);
    http.expectOne(`${base}/apelaciones/145/subsanacion/requerimiento`).flush(null); f.detectChanges();
    expect(f.componentInstance.estadoRequerimiento()).toBe('vacio'); expect(f.nativeElement.querySelector('textarea')).toBeNull();
    f.componentInstance.cargarRequerimiento(); responderRequerimiento(); f.detectChanges();
    expect(f.nativeElement.querySelector('textarea')).not.toBeNull();
  });

  it('no deduce exigencias documentales del texto libre ni impone el límite de comentario SAIP', () => {
    const f = preparar(); f.componentInstance.fundamentosAdicionales = 'Corrección '.repeat(400);
    f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    expect((req.request.body as FormData).getAll('archivos')).toEqual([]);
    req.flush(recibo(clave, [], f.componentInstance.fundamentosAdicionales.trim()));
    expect(f.componentInstance.recepcion()?.id).toBe(501);
  });

  it('incluye todos los archivos seleccionados con igual nombre, sus bytes y el orden original', async () => {
    const f = preparar(); f.detectChanges();
    const files = [new File(['primero'], 'anexo.txt', { type: 'text/plain' }), new File(['segundo'], 'anexo.txt', { type: 'text/plain' })];
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: files }); input.dispatchEvent(new Event('change')); f.detectChanges();
    expect(f.componentInstance.documentosSeleccionados()).toEqual(files);
    f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    const enviados = (req.request.body as FormData).getAll('archivos') as File[];
    expect(enviados).toHaveLength(2);
    const textos = await Promise.all(enviados.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(file); })));
    expect(textos).toEqual(['primero', 'segundo']);
    req.flush(recibo(clave, files.map((file, i) => ({ id: 99 + i, apelacionId: 145, nombreOriginal: file.name, sizeBytes: file.size, contentType: file.type }))));
    expect(f.componentInstance.recepcion()?.documentos.map(d => d.id)).toEqual([99, 100]);
    http.expectNone(`${base}/documentos/upload`);
  });

  it('rechaza una selección parcialmente inválida sin presentar solo un subconjunto silenciosamente', () => {
    const f = preparar(); f.detectChanges();
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['válido'], 'valido.txt', { type: 'text/plain' }), new File(['x'], 'x.zip', { type: 'application/zip' })] });
    input.dispatchEvent(new Event('change')); f.detectChanges();
    expect(f.componentInstance.documentosSeleccionados()).toEqual([]);
    expect(f.componentInstance.archivosError()).toContain('No se añadió esta selección');
    expect(input.getAttribute('aria-invalid')).toBe('true'); http.expectNone(recepcionUrl);
  });

  it('no permite modificar fundamentos o archivos congelados durante un reintento', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    req.error(new ProgressEvent('error')); http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 404, statusText: 'Not Found' });
    f.componentInstance.fundamentosAdicionales = 'Otro texto'; f.componentInstance.enviarSubsanacion();
    http.expectNone(recepcionUrl); expect(f.componentInstance.error()).toContain('mismos fundamentos');
  });

  it('no confirma la recepción de otro expediente aunque sus otros IDs coincidan', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    req.flush({ ...recibo(clave), expediente: '00999-2026-JUS/TTAIP' });
    http.expectOne(`${recepcionUrl}/${clave}`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(f.componentInstance.recepcion()).toBeNull(); expect(f.componentInstance.estadoEnvio()).toBe('incierta');
  });

  it('los metadatos documentales de otra apelación no se muestran ni se descargan', () => {
    const f = pagina(); responder(f, { ...apelacion, documentosMetadata: [{ id: 89, apelacionId: 999, nombreOriginal: 'ajeno.txt' }] });
    expect(f.componentInstance.documentosOriginales()).toEqual([]); expect(f.componentInstance.documentosIncompletos()).toBe(true);
    f.componentInstance.descargarDocumento({ id: 89, nombreArchivo: 'ajeno.txt' }); http.expectNone(`${base}/documentos/89/download`);
  });

  it('vuelve a la solicitud de origen solo con su identidad persistida y mantiene ambas numeraciones', () => {
    const f = pagina(); responder(f, { ...apelacion, solicitudId: 23, solicitudExpediente: 'SAIP-2026-00023' });
    expect(f.nativeElement.querySelector('a[href="/ciudadano/solicitud/SAIP-2026-00023"]')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain(expediente);
    expect(f.componentInstance.rutaRegreso()).toEqual(['/ciudadano/solicitud', 'SAIP-2026-00023']);
  });

  it('una confirmación abierta antes de cambiar de requerimiento no inicia un envío tardío', () => {
    const f = preparar(); f.componentInstance.abrirConfirmacionSubsanacion();
    f.componentInstance.cargarRequerimiento(); responderRequerimiento(145, 72);
    f.componentInstance.confirmarDesdeDialogo(); http.expectNone(recepcionUrl);
    expect(f.componentInstance.confirmModalAbierto()).toBe(false);
  });

  it('destruir el componente cancela las operaciones y no inicia recuperación o envío tardíos', () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio();
    f.destroy(); expect(req.cancelled).toBe(true);
    f.componentInstance.comprobarRecepcion(); f.componentInstance.enviarSubsanacion();
    http.expectNone(recepcionUrl); http.expectNone(`${recepcionUrl}/${clave}`);
    expect(f.componentInstance.documentosSeleccionados()).toEqual([]);
  });

  it('la confirmación persistida recibe foco y al cerrar lo devuelve al resultado del requerimiento', async () => {
    const f = preparar(); f.componentInstance.enviarSubsanacion(); const { req, clave } = envio(); req.flush(recibo(clave));
    f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Subsanación registrada'); expect(dialog.contains(document.activeElement)).toBe(true);
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button'); buttons[buttons.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
    (dialog.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement).click(); f.detectChanges(); await Promise.resolve();
    expect(document.activeElement?.id).toBe('subsanacion-recepcion');
    expect(f.componentInstance.recepcion()?.id).toBe(501); http.expectNone(recepcionUrl);
  });
});
