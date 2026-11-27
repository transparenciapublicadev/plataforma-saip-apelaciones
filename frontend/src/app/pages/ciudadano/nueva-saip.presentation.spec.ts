import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NuevaSaipComponent } from './nueva-saip.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('SAIPForm — contrato HTTP y estados de presentación', () => {
  const base = environment.apiUrl;
  const entidades = [{ id: 3, nombre: 'Entidad sintética', estado: 'ACTIVA' }];
  const respuesta = { id: 101, expediente: 'SAIP-2026-00101', ciudadanoId: 5, entidadId: 3,
    asunto: 'Pedido sintético', descripcion: 'Información sintética', estado: 'RECEPCIONADA',
    fechaPresentacion: '2026-10-26T10:00:00', fechaLimite: '2026-11-09',
    formatoDigital: true, formatoFisico: false, copiaSimple: false, copiaCertificada: false,
    consentimientoDatosPersonales: true, canalNotificacion: 'CORREO_ELECTRONICO' };
  let http: HttpTestingController;
  let auth: AuthService;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [NuevaSaipComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'sesion-sintetica', usuarioId: 5, ciudadanoId: 5,
      tipoUsuario: 'CIUDADANO', nombre: 'Persona sintética', email: 'persona@example.invalid' });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => { http.verify({ ignoreCancelled: true }); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });
  function pagina() { const f = TestBed.createComponent(NuevaSaipComponent); f.detectChanges(); return f; }
  function preparar() {
    const f = pagina(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    const c = f.componentInstance; c.entidadId = 3; c.asunto = respuesta.asunto; c.descripcion = respuesta.descripcion;
    c.formatoRespuesta.correo = true; c.medioNotificacion = 'correo'; c.aceptaCorreo = true;
    Object.assign(c, { consentimientoDatosPersonales: true, declaraVeracidad: true }); return f;
  }
  function recibida(f: ReturnType<typeof preparar>, docs: ReturnType<typeof metadata>[] = [], solicitud = respuesta) {
    return { id: 71, claveOperacion: f.componentInstance.claveOperacion(), fechaRecepcion: '2026-10-28T10:00:00', declaraVeracidad: true, solicitud, documentos: docs };
  }
  function confirmar(f: ReturnType<typeof preparar>, solicitud = respuesta, docs: ReturnType<typeof metadata>[] = [], req = http.expectOne(`${base}/solicitudes/recepciones`)) {
    const r = recibida(f, docs, solicitud); req.flush(r); expect(f.componentInstance.successModalAbierto()).toBe(true);
    return r;
  }
  it('no permite presentar sin aceptación expresa del tratamiento de datos', () => {
    const f = preparar(); Object.assign(f.componentInstance, { consentimientoDatosPersonales: false });
    expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('envía alta y todos los archivos en una única recepción multipart con identidad del servidor', () => {
    const f = preparar(), c = f.componentInstance;
    const principal = new File(['principal'], 'principal.txt', { type: 'text/plain' });
    const anexo = new File(['anexo'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(principal); c.anexo2.set(anexo); c.crearSolicitud();
    const req = http.expectOne(r => r.method === 'POST');
    expect(req.request.url).toBe(`${base}/solicitudes/recepciones`);
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).getAll('archivos')).toEqual([principal, anexo]);
    expect((req.request.body as FormData).has('ciudadanoId')).toBe(false);
    req.flush(null, { status: 400, statusText: 'Synthetic rejection' });
    expect(c.successModalAbierto()).toBe(false); expect(c.solicitudCreada()).toBeNull();
  });
  it('evita dos POST concurrentes de creación', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); f.componentInstance.crearSolicitud();
    const requests = http.match(`${base}/solicitudes/recepciones`); requests.forEach(r => confirmar(f, respuesta, [], r));
    expect(requests).toHaveLength(1);
  });
  it('un error de la recepción con archivos no presenta una solicitud parcial como confirmada', async () => {
    const f = preparar(); f.componentInstance.adjunto.set(new File(['archivo'], 'anexo.pdf', { type: 'application/pdf' }));
    f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).flush(null, { status: 500, statusText: 'Error' });
    await f.whenStable(); expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.expedienteCreado()).toBe(''); expect(f.componentInstance.solicitudCreada()).toBeNull();
    http.expectNone(r => r.url.endsWith('/documentos/upload'));
  });
  it('la pérdida de confirmación no permite repetir a ciegas el POST', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    f.componentInstance.crearSolicitud(); const repetidas = http.match(`${base}/solicitudes/recepciones`); repetidas.forEach(r => r.flush(respuesta));
    expect(repetidas).toHaveLength(0);
  });
  it('un timeout cancela la espera del cliente y conserva un resultado incierto sin repetir el POST', async () => {
    const f = preparar(), c = f.componentInstance;
    vi.useFakeTimers();
    try {
      c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
      await vi.advanceTimersByTimeAsync(30_001); expect(req.cancelled).toBe(true);
      expect(c.estadoEnvio()).toBe('incierta'); c.crearSolicitud(); http.expectNone(`${base}/solicitudes/recepciones`);
      expect(c.successModalAbierto()).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('destruir el formulario no inicia subidas desde una creación tardía', () => {
    const f = preparar(); f.componentInstance.adjunto.set(new File(['archivo'], 'anexo.pdf', { type: 'application/pdf' }));
    f.componentInstance.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`); f.destroy();
    if (!req.cancelled) req.flush(respuesta);
    const tardias = http.match(r => r.url.endsWith('/documentos/upload')); tardias.forEach(r => r.flush(null, { status: 500, statusText: 'Error' }));
    expect(tardias).toHaveLength(0);
  });
  it('no ofrece ZIP que el almacenamiento vigente rechaza', () => {
    const f = preparar(); expect(f.componentInstance.validarArchivoConAviso(new File(['zip'], 'anexo.zip', { type: 'application/zip' }), true).valid).toBe(false);
  });
  it('no selecciona silenciosamente solo el primer archivo de un arrastre múltiple', () => {
    const f = preparar(), c = f.componentInstance;
    const event = new Event('drop', { cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [new File(['a'], 'a.txt', { type: 'text/plain' }), new File(['b'], 'b.txt', { type: 'text/plain' })] } });
    c.soltarArchivo(event as DragEvent, 0); expect(c.adjunto()).toBeNull();
    expect(c.fileWarningPrincipal()).toContain('un archivo por casillero');
  });
  it('el borrador no copia el contenido personal al almacenamiento del navegador', () => {
    const f = preparar(); f.componentInstance.guardarBorrador();
    const req = http.expectOne(`${base}/borradores-saip`);
    expect(req.request.method).toBe('POST');
    expect(JSON.stringify(req.request.body)).not.toContain('persona@example');
    expect(req.request.body.asunto).toBe('Pedido sintético');
    req.flush({ id: 9, asunto: 'Pedido sintético', paso: 1, actualizado: '2026-11-21T10:00:00' });
    expect(localStorage.getItem('saip.borrador')).toBeNull();
    expect(f.componentInstance.draftModalAbierto()).toBe(true);
    expect(f.componentInstance.borradorId()).toBe(9);
  });
  it('al confirmar la presentación retira solo el borrador de esa pantalla', () => {
    const f = preparar();
    f.componentInstance.borradorId.set(9);
    f.componentInstance.crearSolicitud();
    confirmar(f);
    const baja = http.expectOne(`${base}/borradores-saip/9`);
    expect(baja.request.method).toBe('DELETE');
    baja.flush(null);
    expect(f.componentInstance.borradorId()).toBeNull();
  });
  it('no crea un borrador si el formulario está vacío', () => {
    const f = pagina(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    f.componentInstance.guardarBorrador();
    http.expectNone(`${base}/borradores-saip`);
    expect(f.componentInstance.error()).toContain('al menos un dato');
  });
  it('continúa un borrador de la cuenta sin leer el legado del navegador', () => {
    const route = TestBed.inject(ActivatedRoute);
    vi.spyOn(route.snapshot.queryParamMap, 'get').mockReturnValue('9');
    const f = pagina(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    const req = http.expectOne(`${base}/borradores-saip/9`);
    req.flush({
      id: 9, entidadId: 3, asunto: 'Pedido guardado', descripcion: 'Texto guardado', tipoInformacion: null,
      oficinaDestinataria: null, formatoCorreo: true, copiaSimple: false, copiaCertificada: false, soporteMagnetico: false,
      canalNotificacion: 'CORREO', aceptaCanal: true, consentimientoDatos: false, declaraVeracidad: false, paso: 2,
      actualizado: '2026-11-21T10:00:00'
    });
    expect(f.componentInstance.asunto).toBe('Pedido guardado');
    expect(f.componentInstance.step()).toBe(2);
    expect(f.componentInstance.medioNotificacion).toBe('correo');
    expect(localStorage.getItem('saip.borrador')).toBeNull();
  });
  it('una respuesta de creación sin identidad verificable no se confirma', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).flush({});
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it.each([{ ciudadanoId: 999 }, { entidadId: 999 }, { canalNotificacion: 'FISICA' }, { formatoDigital: false }])(
    'una respuesta de creación incompatible $ciudadanoId $entidadId $canalNotificacion $formatoDigital no acredita el envío', cambio => {
      const f = preparar(); f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).flush({ ...recibida(f), solicitud: { ...respuesta, ...cambio } });
      expect(f.componentInstance.successModalAbierto()).toBe(false); expect(f.componentInstance.estadoEnvio()).toBe('incierta');
    });
  it('un catálogo tardío de la sesión anterior no repuebla las entidades', () => {
    const f = pagina(); const req = http.expectOne(`${base}/entidades/activas`);
    auth.guardarSesion({ success: true, token: 'otra-sesion', usuarioId: 6, ciudadanoId: 6, tipoUsuario: 'CIUDADANO' });
    req.flush(entidades); expect(f.componentInstance.entidades()).toEqual([]);
  });
  function metadata(file: File, id = 91, tipo = 'SOLICITUD_ORIGINAL') {
    return { id, solicitudId: 101, tipoDocumento: tipo, estado: 'ACTIVO', nombreOriginal: file.name,
      contentType: file.type, sizeBytes: file.size, hashSha256: 'b'.repeat(64) };
  }
  it('permite un anexo sin archivo principal y conserva su tipo documental', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['anexo'], 'anexo.txt', { type: 'text/plain' });
    c.anexo1.set(file); c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    expect((req.request.body as FormData).getAll('tiposDocumento')).toEqual(['DOCUMENTO_ADJUNTO']);
    confirmar(f, respuesta, [metadata(file, 91, 'DOCUMENTO_ADJUNTO')], req); expect(c.successModalAbierto()).toBe(true); expect(c.adjunto()).toBeNull();
  });
  it('no restaura ni elimina automáticamente un borrador legado almacenado por una versión anterior', () => {
    const legado = JSON.stringify({ ciudadanoId: 5, asunto: 'Pedido sintético anterior' }); localStorage.setItem('saip.borrador', legado);
    const f = pagina(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    expect(f.componentInstance.asunto).toBe(''); expect(localStorage.getItem('saip.borrador')).toBe(legado);
  });
  it('conserva datos y archivos entre los cuatro pasos sin crear ni subir anticipadamente', async () => {
    const f = preparar(), c = f.componentInstance;
    c.irPaso(2); f.detectChanges(); await f.whenStable();
    expect(c.step()).toBe(2); expect(document.activeElement?.id).toBe('saip-paso-titulo');
    c.irPaso(3); f.detectChanges();
    const file = new File(['sintético'], 'anexo.txt', { type: 'text/plain' }); c.anexo1.set(file);
    c.irPaso(4); f.detectChanges(); expect(f.nativeElement.textContent).toContain(file.name);
    c.irPaso(1); f.detectChanges(); expect(c.asunto).toBe(respuesta.asunto); expect(c.anexo1()).toBe(file);
    http.expectNone(`${base}/solicitudes/recepciones`); http.expectNone(r => r.url.endsWith('/documentos/upload'));
  });
  it('valida antes de saltar pasos y vincula errores a los campos', async () => {
    const f = pagina(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    f.componentInstance.irPaso(4); f.detectChanges(); await f.whenStable();
    expect(f.componentInstance.step()).toBe(1); expect(f.componentInstance.errores()['asunto']).toBeTruthy();
    expect(f.nativeElement.querySelector('#saip-asunto').getAttribute('aria-describedby')).toContain('saip-asunto-error');
    expect(f.nativeElement.querySelector('#saip-asunto').getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('#saip-asunto-error').textContent).toContain('Ingrese un asunto');
    expect(f.nativeElement.querySelector('#saip-entidad').getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('#saip-descripcion').getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('section.form-shell.zone-invalid')).not.toBeNull();
    expect(document.activeElement?.id).toBe('saip-errores');
  });
  it('marca en el propio paso la entrega, la notificación y las declaraciones que faltan', async () => {
    const f = preparar(), c = f.componentInstance;
    c.formatoRespuesta.correo = false; c.medioNotificacion = '';
    c.irPaso(2); f.detectChanges(); await f.whenStable();
    c.irPaso(3); f.detectChanges(); await f.whenStable();
    expect(c.step()).toBe(2);
    expect(f.nativeElement.querySelector('#saip-formato').classList.contains('zone-invalid')).toBe(true);
    expect(f.nativeElement.querySelector('#saip-formato-error').textContent).toContain('modalidad de entrega');
    expect(f.nativeElement.querySelector('#saip-medio').classList.contains('zone-invalid')).toBe(true);
    expect(f.nativeElement.querySelector('#saip-medio-error').textContent).toContain('medio formal');
    c.formatoRespuesta.correo = true; c.medioNotificacion = 'correo'; c.aceptaCorreo = false;
    c.irPaso(3); f.detectChanges(); await f.whenStable();
    expect(c.step()).toBe(2);
    expect(f.nativeElement.querySelector('[name=aceptaCorreo]').getAttribute('aria-invalid')).toBe('true');
    c.aceptaCorreo = true; c.consentimientoDatosPersonales = false; c.declaraVeracidad = false;
    c.irPaso(4); f.detectChanges(); await f.whenStable();
    c.handleSubmit(false); f.detectChanges(); await f.whenStable();
    expect(c.step()).toBe(4); expect(c.confirmModalAbierto()).toBe(false);
    expect(f.nativeElement.querySelector('[name=consentimiento]').getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('#saip-consentimiento-error').textContent).toContain('datos personales');
    expect(f.nativeElement.querySelector('#saip-veracidad-error').textContent).toContain('veracidad');
    c.asunto = ''; c.handleSubmit(false); f.detectChanges(); await f.whenStable();
    expect(c.step()).toBe(1); expect(f.nativeElement.querySelector('#saip-asunto').getAttribute('aria-invalid')).toBe('true');
  });
  it('registra solo la identidad autenticada y los campos admitidos, sin archivos obligatorios', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-sintetica');
    const body = req.request.body as FormData; expect(body.get('entidadId')).toBe('3'); expect(body.get('consentimientoDatosPersonales')).toBe('true');
    expect(body.get('declaraVeracidad')).toBe('true'); expect(body.get('canalNotificacion')).toBe('CORREO_ELECTRONICO');
    expect(body.get('formatoDigital')).toBe('true'); expect(body.get('claveOperacion')).toBe(f.componentInstance.claveOperacion());
    for (const campo of ['ciudadanoId', 'id', 'estado', 'expediente', 'fechaPresentacion', 'fechaLimite', 'documentoIds']) expect(body.has(campo)).toBe(false);
    confirmar(f, respuesta, [], req); expect(f.componentInstance.estadoEnvio()).toBe('confirmada');
    expect(f.componentInstance.solicitudSuccessMetadata()).toContainEqual({ label: 'Fecha límite de atención', value: '09/11/2026' });
  });
  it('tema y oficina siguen opcionales; soportes se revisan en la descripción sin fingir catálogo o asignación', () => {
    const f = preparar(), c = f.componentInstance; c.tema = 'Materia libre'; c.oficinaDestinataria = 'Oficina sintética';
    c.formatoRespuesta.soporteMagnetico = true; c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    const body = req.request.body as FormData;
    expect(body.get('tipoInformacion')).toBe('Materia libre'); expect(body.get('descripcion')).toContain('[Oficina destinataria: Oficina sintética]');
    expect(body.get('descripcion')).toContain('CD/DVD/USB'); expect(body.get('formatoFisico')).toBe('true');
    confirmar(f, { ...respuesta, descripcion: body.get('descripcion') as string, tipoInformacion: 'Materia libre', formatoFisico: true } as typeof respuesta, [], req);
  });
  it('notificación física requiere aceptación y no cambia el consentimiento de datos', () => {
    const f = preparar(), c = f.componentInstance; c.seleccionarMedioNotificacion('fisica');
    expect(c.aceptaFisica).toBe(false); expect(c.canSubmit()).toBe(false);
    c.aceptaFisica = true; c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    expect((req.request.body as FormData).get('canalNotificacion')).toBe('FISICA'); confirmar(f, { ...respuesta, canalNotificacion: 'FISICA' }, [], req);
  });
  it.each([400, 401, 403, 404, 422])('el rechazo %s conserva el pedido sin confirmar ni mostrar detalles internos', status => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud();
    http.expectOne(`${base}/solicitudes/recepciones`).flush({ detail: 'detalle interno sintético' }, { status, statusText: 'Rejected' });
    expect(c.estadoEnvio()).toBe('rechazada'); expect(c.successModalAbierto()).toBe(false);
    expect(c.asunto).toBe(respuesta.asunto); expect(c.error()).not.toContain('detalle interno'); expect(c.bloqueado()).toBe(false);
  });
  it.each([0, 500, 503])('el error %s deja la creación incierta sin búsquedas heurísticas ni otro POST', status => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    if (status) req.flush(null, { status, statusText: 'Error' }); else req.error(new ProgressEvent('error'));
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.bloqueado()).toBe(true);
    c.crearSolicitud(); c.comprobarRegistro(); http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`).flush(null, { status: 503, statusText: 'Unavailable' });
    http.expectNone(r => r.method === 'POST');
    expect(c.solicitudCreada()).toBeNull(); expect(c.descripcion).toBe(respuesta.descripcion);
  });
  it.each([0, 401, 403, 404, 500])('un catálogo con error %s no se convierte en entidades demo ni vacío confirmado', status => {
    const f = pagina(), c = f.componentInstance; const req = http.expectOne(`${base}/entidades/activas`);
    if (status) req.flush(null, { status, statusText: 'Error' }); else req.error(new ProgressEvent('error'));
    expect(c.entidades()).toEqual([]); expect(c.estadoEntidades()).not.toBe('vacio'); expect(c.errorEntidades()).not.toBe('');
    expect(c.canSubmit()).toBe(false); expect(c.reintentarEntidades()).toBe(status === 0 || status >= 500);
  });
  it('distingue catálogo vacío de metadatos incompletos y permite consultar de nuevo', () => {
    const f = pagina(), c = f.componentInstance; http.expectOne(`${base}/entidades/activas`).flush([]);
    expect(c.estadoEntidades()).toBe('vacio'); c.cargarEntidades(); http.expectOne(`${base}/entidades/activas`).flush([{ nombre: 'Sin ID' }]);
    expect(c.estadoEntidades()).toBe('error'); expect(c.entidades()).toEqual([]);
    c.cargarEntidades(); http.expectOne(`${base}/entidades/activas`).flush(entidades); expect(c.estadoEntidades()).toBe('disponible');
  });
  it('envía todos los bytes seleccionados en una recepción y confirma tras recuperarlos', async () => {
    const f = preparar(), c = f.componentInstance;
    const files = [new File(['primero'], 'mismo.txt', { type: 'text/plain' }), new File(['segundo'], 'mismo.txt', { type: 'text/plain' }), new File(['tercero'], 'tercero.txt', { type: 'text/plain' })];
    c.adjunto.set(files[0]); c.anexo1.set(files[1]); c.anexo2.set(files[2]); c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    const enviados = (req.request.body as FormData).getAll('archivos');
    expect((req.request.body as FormData).getAll('tiposDocumento')).toEqual(['SOLICITUD_ORIGINAL', 'DOCUMENTO_ADJUNTO', 'DOCUMENTO_ADJUNTO']);
    for (const [i, file] of files.entries()) {
      expect(c.successModalAbierto()).toBe(false); const sent = enviados[i] as File; expect(sent.name).toBe(file.name);
      const content = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(sent); });
      expect(content).toBe(['primero', 'segundo', 'tercero'][i]);
    }
    confirmar(f, respuesta, files.map((file, i) => metadata(file, 91 + i, i ? 'DOCUMENTO_ADJUNTO' : 'SOLICITUD_ORIGINAL')), req);
    expect(c.successModalAbierto()).toBe(true); expect(c.archivosEnviados().map(a => a.documento?.id)).toEqual([91, 92, 93]);
  });
  it('un fallo durante la operación no inventa IDs parciales y conserva archivos para recuperar', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['sintético'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(file); c.anexo1.set(file); c.anexo2.set(file); c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.archivosEnviados().every(a => a.documento == null)).toBe(true);
    c.crearSolicitud(); http.expectNone(`${base}/solicitudes/recepciones`); http.expectNone(r => r.url.endsWith('/documentos/upload'));
    expect(c.solicitudCreada()).toBeNull(); expect(c.adjunto()).toBe(file);
  });
  it.each(['solicitud', 'doble-relacion', 'bytes', 'nombre'])('un recibo de archivo incompatible por %s no acredita vinculación', campo => {
    const f = preparar(), c = f.componentInstance; const file = new File(['archivo'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(file); c.crearSolicitud();
    const doc = { ...metadata(file), ...(campo === 'solicitud' ? { solicitudId: 999 } : campo === 'doble-relacion' ? { apelacionId: 999 }
      : campo === 'bytes' ? { sizeBytes: 999 } : { nombreOriginal: 'ajeno.txt' }) };
    http.expectOne(`${base}/solicitudes/recepciones`).flush(recibida(f, [doc]));
    expect(c.successModalAbierto()).toBe(false); expect(c.estadoEnvio()).toBe('incierta'); expect(c.solicitudCreada()).toBeNull();
  });
  it('recupera por clave persistida sin atribuir por nombre ni repetir escrituras', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['archivo'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(file); c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro(); http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`).flush(recibida(f, [metadata(file)]));
    expect(c.documentosConsultados()?.[0].id).toBe(91); expect(c.archivosEnviados()[0].estado).toBe('registrado');
    expect(c.successModalAbierto()).toBe(true); http.expectNone(r => r.method === 'POST');
    http.expectNone(`${base}/solicitudes/101`); http.expectNone(`${base}/documentos`);
  });
  it('una comprobación fallida no elimina el registro ni acredita ausencia documental', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); confirmar(f);
    c.comprobarRegistro(); http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(c.solicitudCreada()?.id).toBe(101); expect(c.documentosConsultados()).toBeNull(); expect(c.errorRecuperacion()).toBeTruthy();
    expect(c.estadoEnvio()).toBe('confirmada');
  });
  it('un cambio de sesión inmediato impide subidas aunque la creación responda antes del efecto', () => {
    const f = preparar(), c = f.componentInstance; c.adjunto.set(new File(['x'], 'x.txt', { type: 'text/plain' }));
    c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    auth.guardarSesion({ success: true, token: 'sesion-sintetica', usuarioId: 6, ciudadanoId: 6, tipoUsuario: 'CIUDADANO' }); req.flush(respuesta);
    http.expectNone(r => r.url.endsWith('/documentos/upload')); expect(c.successModalAbierto()).toBe(false);
    TestBed.tick(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    expect(c.asunto).toBe(''); expect(c.adjunto()).toBeNull(); expect(c.solicitudCreada()).toBeNull();
  });
  it('destruir una recepción en curso cancela la espera y no inicia escrituras independientes', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['x'], 'x.txt', { type: 'text/plain' }); c.adjunto.set(file); c.anexo1.set(file);
    c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes/recepciones`);
    f.destroy(); expect(req.cancelled).toBe(true); http.expectNone(r => r.url.endsWith('/documentos/upload')); expect(c.adjunto()).toBeNull();
  });
  it('la confirmación conserva contexto y exige revisar contenido cambiado', () => {
    const f = preparar(), c = f.componentInstance; c.handleSubmit(false); expect(c.confirmModalAbierto()).toBe(true);
    c.descripcion = 'Otro pedido'; c.crearSolicitud(); http.expectNone(`${base}/solicitudes/recepciones`); expect(c.error()).toContain('contenido cambió');
  });
  it('los modelos no sobrescriben sin confirmación ni se presentan como datos registrados', () => {
    const f = preparar(), c = f.componentInstance; c.usarModelo('Solicito [documentos]'); expect(c.descripcion).toBe(respuesta.descripcion);
    expect(c.modeloPendiente()).not.toBeNull(); c.confirmarModelo(); expect(c.descripcion).toBe('Solicito [documentos]');
    expect(c.avisosCalidad()).toContain('Reemplace los textos entre [corchetes] del modelo.'); http.expectNone(`${base}/solicitudes/recepciones`);
  });
  it('el selector opcional responde al teclado y no interpreta una vista previa local como subida', () => {
    const f = preparar(), c = f.componentInstance; c.irPaso(3); f.detectChanges();
    const input = f.nativeElement.querySelector('#saip-archivo-0') as HTMLInputElement; const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    const trigger = f.nativeElement.querySelector('[role=button][aria-label="Seleccionar Archivo principal (opcional)"]') as HTMLElement;
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); expect(click).toHaveBeenCalledOnce(); expect(input.required).toBe(false);
    const file = new File(['x'], 'x.txt', { type: 'text/plain' }); c.adjunto.set(file); c.previsualizarArchivo(file); expect(c.isPreviewOpen()).toBe(true);
    expect(c.solicitudCreada()).toBeNull(); http.expectNone(r => r.url.endsWith('/documentos/upload'));
  });
  it('los diálogos gestionan foco y Escape; cerrar el resultado no borra su identidad ni presenta otra solicitud', async () => {
    const f = preparar(), c = f.componentInstance; c.irPaso(4); f.detectChanges(); c.handleSubmit(false); f.detectChanges(); await Promise.resolve();
    let dialog = document.querySelector('[role=dialog]')!; expect(dialog.contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); http.expectNone(`${base}/solicitudes/recepciones`);
    c.handleSubmit(false); c.crearSolicitud(); confirmar(f); f.detectChanges(); await Promise.resolve();
    dialog = document.querySelector('[role=dialog]')!; expect(dialog.getAttribute('aria-label')).toBe('Tu SAIP fue registrada');
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button'); buttons[buttons.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(buttons[0]);
    c.cerrarResultado(); f.detectChanges(); await Promise.resolve(); expect(c.successModalAbierto()).toBe(false);
  });
  it('navega a la solicitud creada con expediente devuelto por el servidor', () => {
    const f = preparar(), navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.crearSolicitud(); confirmar(f);
    f.componentInstance.verSolicitudCreada(); expect(navigate).toHaveBeenCalledWith(['/ciudadano/solicitud', respuesta.expediente]);
  });
  it('solo un GET sin recepción habilita reintento explícito con la misma clave, contenido y archivos', () => {
    const f = preparar(), c = f.componentInstance, file = new File(['original'], 'original.txt', { type: 'text/plain' }); c.adjunto.set(file);
    c.crearSolicitud(); const first = http.expectOne(`${base}/solicitudes/recepciones`); const before = first.request.body as FormData;
    first.error(new ProgressEvent('error')); c.reintentarAlta(); http.expectNone(r => r.method === 'POST');
    c.comprobarRegistro(); http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(c.estadoEnvio()).toBe('sin-recepcion'); expect(c.bloqueado()).toBe(true); http.expectNone(r => r.method === 'POST');
    c.asunto = 'No debe cambiar el envío capturado'; c.reintentarAlta(); const retry = http.expectOne(`${base}/solicitudes/recepciones`);
    const body = retry.request.body as FormData; expect(body.get('claveOperacion')).toBe(before.get('claveOperacion'));
    expect(body.get('asunto')).toBe(respuesta.asunto); expect(body.getAll('archivos')).toEqual([file]);
    confirmar(f, respuesta, [metadata(file)], retry); expect(c.successModalAbierto()).toBe(true);
  });
  it.each([401, 403, 409, 500, 503, 0])('consulta de recuperación con error %i no acredita ausencia ni permite reenvío', status => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro(); const r = http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`);
    if (status) r.flush(null, { status, statusText: 'Synthetic failure' }); else r.error(new ProgressEvent('error'));
    c.reintentarAlta(); c.crearSolicitud(); http.expectNone(req => req.method === 'POST');
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.solicitudCreada()).toBeNull(); expect(c.asunto).toBe(respuesta.asunto);
  });
  it('un conflicto de escritura se distingue del resultado incierto y exige consulta antes de otro envío', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).flush(null, { status: 409, statusText: 'Conflict' });
    expect(c.estadoEnvio()).toBe('rechazada'); expect(c.error()).toBeTruthy(); expect(c.bloqueado()).toBe(true);
    c.crearSolicitud(); c.reintentarAlta(); http.expectNone(r => r.method === 'POST');
  });
  it.each([{ id: 0 }, { claveOperacion: 'otra-operacion' }, { declaraVeracidad: false }, { fechaRecepcion: 'sin-fecha' }, { documentos: null }])(
    'no confirma una recepción incompleta o de otra operación: %j', patch => {
      const f = preparar(), c = f.componentInstance; c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).flush({ ...recibida(f), ...patch });
      expect(c.estadoEnvio()).toBe('incierta'); expect(c.successModalAbierto()).toBe(false); expect(c.solicitudCreada()).toBeNull();
    });
  it('documentos repetidos o faltantes no confirman el conjunto seleccionado', () => {
    const f = preparar(), c = f.componentInstance, file = new File(['anexo'], 'anexo.txt', { type: 'text/plain' }); c.adjunto.set(file); c.anexo1.set(file);
    c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).flush(recibida(f, [metadata(file), metadata(file, 91, 'DOCUMENTO_ADJUNTO')]));
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.solicitudCreada()).toBeNull(); expect(c.successModalAbierto()).toBe(false);
  });
  it('la recuperación posterior debe conservar el ID y manifiesto recibidos por el POST', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); const r = recibida(f); http.expectOne(`${base}/solicitudes/recepciones`).flush(r);
    expect(c.successModalAbierto()).toBe(true); c.comprobarRegistro();
    http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`).flush({ ...r, id: 72 });
    expect(c.errorRecuperacion()).toBeTruthy(); expect(c.recepcionId()).toBe(r.id); expect(c.documentosConsultados()).toBeNull();
  });
  it('un reintento tampoco sustituye un ID de recepción ya conocido', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); const r = recibida(f);
    http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro();
    http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`).flush(null, { status: 404, statusText: 'Not Found' });
    (c as any).recepcionEsperada = r;
    c.reintentarAlta(); http.expectOne(`${base}/solicitudes/recepciones`).flush({ ...r, id: 72 });
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.successModalAbierto()).toBe(false);
    http.expectNone(req => req.method === 'GET');
  });
  it('descarta recuperación pendiente al cambiar sesión antes de que se ejecute el efecto', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud();
    http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro();
    const get = http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`); const r = recibida(f);
    auth.guardarSesion({ success: true, token: 'otra-sesion', usuarioId: 6, ciudadanoId: 6, tipoUsuario: 'CIUDADANO' }); get.flush(r);
    expect(c.solicitudCreada()).toBeNull(); expect(c.successModalAbierto()).toBe(false); TestBed.tick();
    http.expectOne(`${base}/entidades/activas`).flush(entidades); expect(c.claveOperacion()).toBe(''); expect(c.asunto).toBe('');
  });
  it('destruir durante la recuperación cancela el GET y no inicia nuevas escrituras', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud();
    http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro();
    const get = http.expectOne(`${base}/solicitudes/recepciones/${c.claveOperacion()}`); f.destroy();
    expect(get.cancelled).toBe(true); expect(c.solicitudCreada()).toBeNull(); http.expectNone(r => r.method === 'POST');
  });
  it('no añade pedido, archivos ni clave al almacenamiento del navegador', () => {
    const f = preparar(), c = f.componentInstance; const before = JSON.stringify([localStorage, sessionStorage]);
    c.crearSolicitud(); http.expectOne(`${base}/solicitudes/recepciones`).error(new ProgressEvent('error')); f.detectChanges();
    expect(JSON.stringify([localStorage, sessionStorage])).toBe(before);
    expect(c.claveOperacion()).not.toBe('');
    expect(f.nativeElement.textContent).not.toContain(c.claveOperacion());
  });
});
