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
      { id: 71, documentos: [{ ...documento, id: 89, resolucionId: 71 }], cedulas: [{ id: 6, destinatario: 'CIUDADANO', documentos: [{ ...documento, id: 90, cedulaNotificacionId: 6 }] }] },
    ] });
    expect(f.componentInstance.notifStages()[0].docs.map(d => d.id)).toEqual([89, 90]);
  });

  it('las pestañas exponen selección, panel asociado y navegación con flechas/Home/End', () => {
    const f = pagina(); responder(f);
    const tabs = [...f.nativeElement.querySelectorAll('[role=tab]')] as HTMLButtonElement[];
    expect(tabs).toHaveLength(3);
    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(f.nativeElement.querySelector('[role=tabpanel]').id).toBe(tabs[1].getAttribute('aria-controls'));
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges(); expect(tabs[2].getAttribute('tabindex')).toBe('0');
    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    f.detectChanges(); expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('muestra los formatos con las mismas etiquetas del formulario de creación', () => {
    const f = pagina();
    responder(f, {
      ...solicitud,
      formatoDigital: true,
      formatoFisico: true,
      copiaSimple: true,
      copiaCertificada: false,
      descripcion: '[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]\n\nTexto de la solicitud',
    });
    const formatos = f.componentInstance.formatosSeleccionados();
    expect(formatos).toEqual(['Correo electrónico', 'Copia simple / fotocopia', 'Soportes magnéticos o digitales']);
    expect(f.nativeElement.textContent).toContain('Correo electrónico');
    expect(f.nativeElement.textContent).not.toContain('Digital');
    expect(formatos).not.toContain('Físico');
  });

  it('un soporte magnético sin copias no se muestra como formato físico genérico', () => {
    const f = pagina();
    responder(f, {
      ...solicitud,
      formatoDigital: false,
      formatoFisico: true,
      copiaSimple: false,
      copiaCertificada: false,
      descripcion: 'Solo el pedido',
    });
    expect(f.componentInstance.formatosSeleccionados()).toEqual(['Soportes magnéticos o digitales']);
  });

  it('la pestaña de respuesta explica que la entidad aún no ha respondido', () => {
    const f = pagina();
    responder(f);
    f.componentInstance.cambiarTab('respuesta');
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('Respuesta no disponible todavía');
    expect(text).toContain('La entidad aún no ha respondido');
    expect(text).toContain('En revisión');
    expect(text).not.toContain('«');
    expect(text).not.toContain('En Proceso');
    expect(text).not.toContain('No se recuperó una respuesta registrada');
  });

  it('una solicitud recién registrada muestra Recepcionada en la insignia y en las pestañas de espera', () => {
    const f = pagina();
    responder(f, { ...solicitud, estado: 'RECEPCIONADA' });
    expect(f.nativeElement.textContent).toContain('Recepcionada');
    expect(f.nativeElement.textContent).not.toContain('En trámite');
    f.componentInstance.cambiarTab('respuesta');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('estado Recepcionada');
    f.componentInstance.cambiarTab('apelacion');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('estado Recepcionada');
    expect(f.nativeElement.textContent).not.toContain('«');
    expect(f.nativeElement.textContent).not.toContain('En Proceso');
  });

  it.each(['VENCIDA', 'RESPONDIDA'])('el estado %s sin respuesta recuperable no acredita entrega ni una respuesta completa', estado => {
    const f = pagina(); responder(f, { ...solicitud, estado });
    f.componentInstance.cambiarTab('respuesta'); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('La entidad entregó');
    expect(f.nativeElement.textContent).toContain('No se recuperó una respuesta registrada');
    expect(f.componentInstance.adjuntosRespuesta()).toEqual([]);
  });

  it('una respuesta parcial conserva contenido, causal y fundamento sin afirmar entrega ni firma', () => {
    const f = pagina(); responder(f, { ...solicitud, respuesta: { id: 91, tipoRespuesta: 'ENTREGA_PARCIAL',
      contenido: 'Contenido real', causalDenegatoria: 'Causal registrada', fundamentoLegal: 'Fundamento registrado',
      documentos: [], documentosMetadata: [] } });
    f.componentInstance.cambiarTab('respuesta'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Contenido real');
    expect(f.nativeElement.textContent).toContain('Causal registrada');
    expect(f.nativeElement.textContent).toContain('Fundamento registrado');
    expect(f.nativeElement.textContent).not.toContain('La entidad entregó');
    expect(f.nativeElement.textContent).not.toContain('idénticos a los firmados');
  });

  it('no inventa revisión, notificación ni fecha de resolución final desde la respuesta SAIP', () => {
    const f = pagina(); responder(f, { ...solicitud, respuesta: { id: 91, fechaRespuesta: '2026-10-22T10:00:00' },
      apelacion: { id: 145, estado: 'EN_RESOLUCION', fechaApelacion: '2026-10-23T10:00:00' } });
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, resoluciones: [] });
    const events = f.componentInstance.timelineEvents();
    expect(events.some(e => e.description.includes('notificada'))).toBe(false);
    expect(events.some(e => e.title === 'Revisión de la entidad')).toBe(false);
    expect(events.some(e => e.title === 'Resolución final')).toBe(false);
    expect(events.some(e => e.description.includes('ADMITIDO'))).toBe(false);
  });

  it('una liquidación no permite confirmar un recojo solo en el navegador', () => {
    const f = pagina(); responder(f, { ...solicitud, liquidacionesCosto: [{ id: 6, solicitudId: 23,
      estadoLiquidacion: 'PAGADA', moneda: 'PEN', monto: '2.50', concepto: 'Copias', codigoLiquidacion: 'L-6' }] });
    const button = [...f.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent.includes('Ya recogí')) as HTMLButtonElement;
    expect(button?.disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('no está disponible en esta pantalla');
    expect(f.nativeElement.textContent).not.toContain('Recojo confirmado');
  });

  it('la precisión navega al caso de uso existente con el expediente exacto sin otro formulario inline', () => {
    const f = pagina(); responder(f, { ...solicitud, estado: 'PENDIENTE_INFORMACION', observaciones: [
      { id: 7, estado: 'PENDIENTE_SUBSANACION', motivoObservacion: 'Precise el asunto' }] });
    const link = f.nativeElement.querySelector('a[href="/ciudadano/precision/SAIP-2026-00023"]');
    expect(link).not.toBeNull();
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('no muestra ni descarga un documento asociado explícitamente a otra solicitud', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [{ ...documento, solicitudId: 99 }] });
    expect(f.componentInstance.misDocumentos()).toEqual([]);
    f.componentInstance.descargarDoc({ id: 88, nombre: 'precision.pdf' });
    http.expectNone(`${base}/documentos/88/download`);
    expect(f.componentInstance.documentoError()).not.toBe('');
  });

  it('un objeto documental anterior no permite abrir otro recurso tras navegar', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    const old = f.componentInstance.misDocumentos()[0];
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' }));
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush({ ...solicitud, id: 24, expediente: 'SAIP-2026-00024' });
    f.componentInstance.abrirModalPreview(old);
    f.componentInstance.descargarDoc(old);
    http.expectNone(`${base}/documentos/88/download`);
    expect(f.componentInstance.isPreviewOpen()).toBe(false);
  });

  it('el cambio de sesión inmediato impide iniciar descargas con el detalle anterior', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    f.componentInstance.descargarDoc(f.componentInstance.misDocumentos()[0]);
    http.expectNone(`${base}/documentos/88/download`);
    TestBed.tick(); http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('una revisión de sesión con el mismo token descarta la consulta previa', () => {
    const f = pagina(); const anterior = http.expectOne(url);
    auth.guardarSesion({ success: true, token: 'sesion-a', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    anterior.flush(solicitud);
    expect(f.componentInstance.solicitud()).toBeNull();
    TestBed.tick(); http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('una titularidad explícita ajena no se presenta como expediente del administrado', () => {
    const f = pagina(); responder(f, { ...solicitud, ciudadanoId: 99 });
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética');
  });

  it('una lista documental ausente no se presenta como ausencia confirmada de adjuntos', () => {
    const f = pagina(); responder(f, { ...solicitud, documentos: undefined, documentosMetadata: undefined });
    expect(f.nativeElement.textContent).toContain('información documental está incompleta');
    expect(f.nativeElement.textContent).not.toContain('No adjuntó documentos');
  });

  it('documentos del mismo nombre conservan IDs distintos y una relación de respuesta ajena se excluye', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento, { ...documento, id: 89 }],
      respuesta: { id: 91, documentosMetadata: [{ ...documento, id: 90, solicitudId: null, respuestaId: 999 }] } });
    expect(f.componentInstance.misDocumentos().map(d => d.id)).toEqual([88, 89]);
    expect(f.componentInstance.adjuntosRespuesta()).toEqual([]);
    f.componentInstance.cambiarTab('respuesta'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No se recuperó una lista completa');
    expect(f.nativeElement.textContent).not.toContain('La entidad no adjuntó');
  });

  it('el reintento de consulta limpia el expediente anterior y conserva el identificador', () => {
    const f = pagina(); responder(f);
    f.componentInstance.reintentarConsulta(); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Persona sintética');
    http.expectOne(url).flush(null, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.componentInstance.timelineEvents()).toEqual([]);
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    f.componentInstance.reintentarConsulta(); responder(f);
    expect(f.nativeElement.textContent).toContain('Persona sintética');
  });

  it('rechaza un detalle de apelación con el ID correcto pero asociado a otra solicitud', () => {
    const f = pagina(); responder(f, { ...solicitud, apelacion: { id: 145 } });
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, solicitudId: 999, resoluciones: [{ id: 71 }] });
    expect(f.componentInstance.apelacionDetalle()).toBeNull();
    expect(f.componentInstance.notifStages()).toEqual([]);
    expect(f.componentInstance.errorApelacion()).not.toBe('');
  });

  it('reintentar documentos del Tribunal cancela la consulta anterior', () => {
    const f = pagina(); responder(f, { ...solicitud, apelacion: { id: 145 } });
    const anterior = http.expectOne(`${base}/apelaciones/145`);
    f.componentInstance.cargarDocumentosTribunal();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, resoluciones: [] });
  });

  it('muestra la fecha propia de cada resolución y conserva sin fecha las actuaciones incompletas', () => {
    const f = pagina(); responder(f, { ...solicitud, apelacion: { id: 145, fechaApelacion: '2026-10-22T09:00:00' } });
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, solicitudId: 23, resoluciones: [
      { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', fechaResolucion: '2026-10-23T10:00:00' },
      { id: 72, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO' },
    ] });
    const timeline = f.componentInstance.timelineEvents();
    expect(timeline.find(e => e.description === 'ADMISIBLE')?.date).toContain('23');
    expect(timeline.find(e => e.description === 'Fundado')?.date).toBe('—');
    expect(timeline.some(e => e.description.includes('notificada a'))).toBe(false);
  });

  it('no calcula un vencimiento desde fechas para decidir la acción de precisión', () => {
    const f = pagina(); responder(f, { ...solicitud, observaciones: [{ id: 7, estado: 'PENDIENTE_SUBSANACION',
      fechaLimiteSubsanacion: '2020-01-01', motivoObservacion: 'Motivo real' }] });
    expect(f.nativeElement.querySelector('a[href="/ciudadano/precision/SAIP-2026-00023"]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Subsanación Vencida');
    expect(f.nativeElement.textContent).toContain('se comprueban en el servidor');
  });

  it('navega de vuelta al panel y al formulario de apelación con el expediente persistido', () => {
    const f = pagina(); responder(f, { ...solicitud, estado: 'DENEGADA' });
    expect(f.nativeElement.querySelector('a[href="/ciudadano"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('a[href="/ciudadano/apelacion/nueva/SAIP-2026-00023"]')).not.toBeNull();
  });

  it('cancela consulta, documentos del Tribunal y descarga al destruir el componente', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento], apelacion: { id: 145 } });
    const tribunal = http.expectOne(`${base}/apelaciones/145`);
    f.componentInstance.descargarDoc(f.componentInstance.misDocumentos()[0]);
    const descarga = http.expectOne(`${base}/documentos/88/download`);
    f.destroy();
    expect(tribunal.cancelled).toBe(true); expect(descarga.cancelled).toBe(true);
  });

  it('el visor opt-in recibe foco, contiene Tab, cierra con Escape y lo devuelve al botón del documento', async () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    const trigger = f.nativeElement.querySelector('button[aria-label="Ver precision.pdf"]') as HTMLButtonElement;
    trigger.focus(); trigger.click(); f.detectChanges();
    const request = http.expectOne(`${base}/documentos/88/download`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    request.flush(new Blob(['documento de prueba'], { type: 'text/plain' })); f.detectChanges();
    await Promise.resolve();
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog?.getAttribute('aria-label')).toBe('precision.pdf');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    buttons.item(buttons.length - 1).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons.item(0));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); f.detectChanges();
    expect(f.componentInstance.isPreviewOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('una vista previa pendiente se cancela al cambiar de recurso sin conservar el documento anterior', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [documento] });
    f.nativeElement.querySelector('button[aria-label="Ver precision.pdf"]').click(); f.detectChanges();
    const descarga = http.expectOne(`${base}/documentos/88/download`);
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' })); f.detectChanges();
    expect(descarga.cancelled).toBe(true);
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(f.componentInstance.previewTarget()).toBeNull();
  });

  it('las cédulas de la entidad o sin destinatario no se muestran como documentos del recurrente', () => {
    const f = pagina(); responder(f, { ...solicitud, apelacion: { id: 145 } });
    http.expectOne(`${base}/apelaciones/145`).flush({ id: 145, resoluciones: [{ id: 71, cedulas: [
      { id: 6, destinatario: 'ENTIDAD_PUBLICA', documentos: [{ ...documento, id: 90, cedulaNotificacionId: 6 }] },
      { id: 7, documentos: [{ ...documento, id: 91, cedulaNotificacionId: 7 }] },
      { id: 8, destinatario: 'CIUDADANO', documentos: [{ ...documento, id: 92, cedulaNotificacionId: 8 }] },
    ] }] });
    expect(f.componentInstance.notifStages()[0].docs.map(d => d.id)).toEqual([92]);
    f.componentInstance.descargarDoc({ id: 90, nombre: 'cedula-entidad.pdf' });
    http.expectNone(`${base}/documentos/90/download`);
  });
});
