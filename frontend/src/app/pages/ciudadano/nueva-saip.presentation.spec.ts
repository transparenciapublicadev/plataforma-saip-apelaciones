import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
  it('no permite presentar sin aceptación expresa del tratamiento de datos', () => {
    const f = preparar(); Object.assign(f.componentInstance, { consentimientoDatosPersonales: false });
    expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('evita dos POST concurrentes de creación', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); f.componentInstance.crearSolicitud();
    const requests = http.match(`${base}/solicitudes`); requests.forEach(r => r.flush(respuesta));
    expect(requests).toHaveLength(1);
  });
  it('un error posterior de subida no abre el resultado como registro completo de archivos', async () => {
    const f = preparar(); f.componentInstance.adjunto.set(new File(['archivo'], 'anexo.pdf', { type: 'application/pdf' }));
    f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    http.expectOne(r => r.url.endsWith('/documentos/upload')).flush(null, { status: 500, statusText: 'Error' });
    await f.whenStable(); expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.expedienteCreado()).toBe(respuesta.expediente);
  });
  it('la pérdida de confirmación no permite repetir a ciegas el POST', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes`).error(new ProgressEvent('error'));
    f.componentInstance.crearSolicitud(); const repetidas = http.match(`${base}/solicitudes`); repetidas.forEach(r => r.flush(respuesta));
    expect(repetidas).toHaveLength(0);
  });
  it('un timeout cancela la espera del cliente y conserva un resultado incierto sin repetir el POST', async () => {
    const f = preparar(), c = f.componentInstance;
    vi.useFakeTimers();
    try {
      c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`);
      await vi.advanceTimersByTimeAsync(30_001); expect(req.cancelled).toBe(true);
      expect(c.estadoEnvio()).toBe('incierta'); c.crearSolicitud(); http.expectNone(`${base}/solicitudes`);
      expect(c.successModalAbierto()).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('destruir el formulario no inicia subidas desde una creación tardía', () => {
    const f = preparar(); f.componentInstance.adjunto.set(new File(['archivo'], 'anexo.pdf', { type: 'application/pdf' }));
    f.componentInstance.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`); f.destroy();
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
    const f = preparar(); f.componentInstance.guardarBorrador(); expect(localStorage.getItem('saip.borrador')).toBeNull();
  });
  it('una respuesta de creación sin identidad verificable no se confirma', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush({});
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it.each([{ ciudadanoId: 999 }, { entidadId: 999 }, { canalNotificacion: 'FISICA' }, { formatoDigital: false }])(
    'una respuesta de creación incompatible $ciudadanoId $entidadId $canalNotificacion $formatoDigital no acredita el envío', cambio => {
      const f = preparar(); f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush({ ...respuesta, ...cambio });
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
    c.anexo1.set(file); c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    const req = http.expectOne(r => r.url.endsWith('/documentos/upload'));
    expect(req.request.params.get('tipoDocumento')).toBe('DOCUMENTO_ADJUNTO');
    req.flush(metadata(file, 91, 'DOCUMENTO_ADJUNTO')); expect(c.successModalAbierto()).toBe(true); expect(c.adjunto()).toBeNull();
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
    http.expectNone(`${base}/solicitudes`); http.expectNone(r => r.url.endsWith('/documentos/upload'));
  });
  it('valida antes de saltar pasos y vincula errores a los campos', async () => {
    const f = pagina(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    f.componentInstance.irPaso(4); f.detectChanges(); await f.whenStable();
    expect(f.componentInstance.step()).toBe(1); expect(f.componentInstance.errores()['asunto']).toBeTruthy();
    expect(f.nativeElement.querySelector('#saip-asunto').getAttribute('aria-describedby')).toContain('saip-asunto-error');
    expect(document.activeElement?.id).toBe('saip-errores');
  });
  it('registra solo la identidad autenticada y los campos admitidos, sin archivos obligatorios', () => {
    const f = preparar(); f.componentInstance.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-sintetica');
    expect(req.request.body).toEqual(expect.objectContaining({ ciudadanoId: 5, entidadId: 3, consentimientoDatosPersonales: true,
      canalNotificacion: 'CORREO_ELECTRONICO', formatoDigital: true }));
    for (const campo of ['id', 'estado', 'expediente', 'fechaPresentacion', 'fechaLimite', 'claveOperacion']) expect(req.request.body[campo]).toBeUndefined();
    req.flush(respuesta); expect(f.componentInstance.estadoEnvio()).toBe('confirmada');
    expect(f.componentInstance.solicitudSuccessMetadata()).toContainEqual({ label: 'Fecha límite del servidor', value: respuesta.fechaLimite });
  });
  it('tema y oficina siguen opcionales; soportes se revisan en la descripción sin fingir catálogo o asignación', () => {
    const f = preparar(), c = f.componentInstance; c.tema = 'Materia libre'; c.oficinaDestinataria = 'Oficina sintética';
    c.formatoRespuesta.soporteMagnetico = true; c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`);
    expect(req.request.body.tipoInformacion).toBe('Materia libre'); expect(req.request.body.descripcion).toContain('[Oficina destinataria: Oficina sintética]');
    expect(req.request.body.descripcion).toContain('CD/DVD/USB'); expect(req.request.body.formatoFisico).toBe(true);
    req.flush({ ...respuesta, descripcion: req.request.body.descripcion, tipoInformacion: 'Materia libre', formatoFisico: true });
  });
  it('notificación física requiere aceptación y no cambia el consentimiento de datos', () => {
    const f = preparar(), c = f.componentInstance; c.seleccionarMedioNotificacion('fisica');
    expect(c.aceptaFisica).toBe(false); expect(c.canSubmit()).toBe(false);
    c.aceptaFisica = true; c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`);
    expect(req.request.body.canalNotificacion).toBe('FISICA'); req.flush({ ...respuesta, canalNotificacion: 'FISICA' });
  });
  it.each([400, 401, 403, 404, 422])('el rechazo %s conserva el pedido sin confirmar ni mostrar detalles internos', status => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud();
    http.expectOne(`${base}/solicitudes`).flush({ detail: 'detalle interno sintético' }, { status, statusText: 'Rejected' });
    expect(c.estadoEnvio()).toBe('rechazada'); expect(c.successModalAbierto()).toBe(false);
    expect(c.asunto).toBe(respuesta.asunto); expect(c.error()).not.toContain('detalle interno'); expect(c.bloqueado()).toBe(false);
  });
  it.each([0, 500, 503])('el error %s deja la creación incierta sin búsquedas heurísticas ni otro POST', status => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`);
    if (status) req.flush(null, { status, statusText: 'Error' }); else req.error(new ProgressEvent('error'));
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.bloqueado()).toBe(true);
    c.crearSolicitud(); c.comprobarRegistro(); http.expectNone(r => r.url.startsWith(`${base}/solicitudes`));
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
  it('envía todos los bytes seleccionados en tres operaciones vinculadas y no confirma antes de la última', async () => {
    const f = preparar(), c = f.componentInstance;
    const files = [new File(['primero'], 'mismo.txt', { type: 'text/plain' }), new File(['segundo'], 'mismo.txt', { type: 'text/plain' }), new File(['tercero'], 'tercero.txt', { type: 'text/plain' })];
    c.adjunto.set(files[0]); c.anexo1.set(files[1]); c.anexo2.set(files[2]); c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    for (const [i, file] of files.entries()) {
      expect(c.successModalAbierto()).toBe(false); const req = http.expectOne(r => r.url.endsWith('/documentos/upload'));
      expect(req.request.params.get('solicitudId')).toBe('101');
      const sent = (req.request.body as FormData).get('file') as File;
      const content = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(sent); });
      expect(content).toBe(['primero', 'segundo', 'tercero'][i]);
      req.flush(metadata(file, 91 + i, i ? 'DOCUMENTO_ADJUNTO' : 'SOLICITUD_ORIGINAL'));
    }
    expect(c.successModalAbierto()).toBe(true); expect(c.archivosEnviados().map(a => a.documento?.id)).toEqual([91, 92, 93]);
  });
  it('un fallo intermedio conserva IDs confirmados y detiene los archivos que faltan', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['sintético'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(file); c.anexo1.set(file); c.anexo2.set(file); c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    http.expectOne(r => r.url.endsWith('/documentos/upload')).flush(metadata(file));
    http.expectOne(r => r.url.endsWith('/documentos/upload')).error(new ProgressEvent('error'));
    expect(c.estadoEnvio()).toBe('parcial'); expect(c.archivosEnviados().map(a => a.estado)).toEqual(['registrado', 'incierto', 'seleccionado']);
    c.crearSolicitud(); http.expectNone(`${base}/solicitudes`); http.expectNone(r => r.url.endsWith('/documentos/upload'));
    expect(c.solicitudCreada()?.id).toBe(101); expect(c.adjunto()).toBe(file);
  });
  it.each(['solicitud', 'doble-relacion', 'bytes', 'nombre'])('un recibo de archivo incompatible por %s no acredita vinculación', campo => {
    const f = preparar(), c = f.componentInstance; const file = new File(['archivo'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(file); c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    const doc = { ...metadata(file), ...(campo === 'solicitud' ? { solicitudId: 999 } : campo === 'doble-relacion' ? { apelacionId: 999 }
      : campo === 'bytes' ? { sizeBytes: 999 } : { nombreOriginal: 'ajeno.txt' }) };
    http.expectOne(r => r.url.endsWith('/documentos/upload')).flush(doc);
    expect(c.successModalAbierto()).toBe(false); expect(c.estadoEnvio()).toBe('parcial'); expect(c.archivosEnviados()[0].estado).toBe('incierto');
  });
  it('recupera por ID persistido sin atribuir un documento incierto por nombre ni repetir escrituras', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['archivo'], 'anexo.txt', { type: 'text/plain' });
    c.adjunto.set(file); c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    http.expectOne(r => r.url.endsWith('/documentos/upload')).error(new ProgressEvent('error'));
    c.comprobarRegistro(); http.expectOne(`${base}/solicitudes/101`).flush(respuesta);
    http.expectOne(r => r.url === `${base}/documentos` && r.params.get('solicitudId') === '101').flush([metadata(file)]);
    expect(c.documentosConsultados()?.[0].id).toBe(91); expect(c.archivosEnviados()[0].estado).toBe('incierto');
    expect(c.successModalAbierto()).toBe(false); http.expectNone(r => r.method === 'POST');
  });
  it('una comprobación fallida no elimina el registro ni acredita ausencia documental', () => {
    const f = preparar(), c = f.componentInstance; c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    c.comprobarRegistro(); const solicitud = http.expectOne(`${base}/solicitudes/101`); const docs = http.expectOne(r => r.url === `${base}/documentos`);
    solicitud.flush(null, { status: 503, statusText: 'Unavailable' }); expect(docs.cancelled).toBe(true);
    expect(c.solicitudCreada()?.id).toBe(101); expect(c.documentosConsultados()).toBeNull(); expect(c.errorRecuperacion()).toContain('no acredita ausencia');
  });
  it('un cambio de sesión inmediato impide subidas aunque la creación responda antes del efecto', () => {
    const f = preparar(), c = f.componentInstance; c.adjunto.set(new File(['x'], 'x.txt', { type: 'text/plain' }));
    c.crearSolicitud(); const req = http.expectOne(`${base}/solicitudes`);
    auth.guardarSesion({ success: true, token: 'sesion-sintetica', usuarioId: 6, ciudadanoId: 6, tipoUsuario: 'CIUDADANO' }); req.flush(respuesta);
    http.expectNone(r => r.url.endsWith('/documentos/upload')); expect(c.successModalAbierto()).toBe(false);
    TestBed.tick(); http.expectOne(`${base}/entidades/activas`).flush(entidades);
    expect(c.asunto).toBe(''); expect(c.adjunto()).toBeNull(); expect(c.solicitudCreada()).toBeNull();
  });
  it('destruir una subida en curso no inicia la siguiente ni confirma el registro completo', () => {
    const f = preparar(), c = f.componentInstance; const file = new File(['x'], 'x.txt', { type: 'text/plain' }); c.adjunto.set(file); c.anexo1.set(file);
    c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta); const req = http.expectOne(r => r.url.endsWith('/documentos/upload'));
    f.destroy(); expect(req.cancelled).toBe(true); http.expectNone(r => r.url.endsWith('/documentos/upload')); expect(c.adjunto()).toBeNull();
  });
  it('la confirmación conserva contexto y exige revisar contenido cambiado', () => {
    const f = preparar(), c = f.componentInstance; c.handleSubmit(false); expect(c.confirmModalAbierto()).toBe(true);
    c.descripcion = 'Otro pedido'; c.crearSolicitud(); http.expectNone(`${base}/solicitudes`); expect(c.error()).toContain('contenido cambió');
  });
  it('los modelos no sobrescriben sin confirmación ni se presentan como datos registrados', () => {
    const f = preparar(), c = f.componentInstance; c.usarModelo('Solicito [documentos]'); expect(c.descripcion).toBe(respuesta.descripcion);
    expect(c.modeloPendiente()).not.toBeNull(); c.confirmarModelo(); expect(c.descripcion).toBe('Solicito [documentos]');
    expect(c.avisosCalidad()).toContain('Reemplace los textos entre [corchetes] del modelo.'); http.expectNone(`${base}/solicitudes`);
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); http.expectNone(`${base}/solicitudes`);
    c.handleSubmit(false); c.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta); f.detectChanges(); await Promise.resolve();
    dialog = document.querySelector('[role=dialog]')!; expect(dialog.getAttribute('aria-label')).toBe('Su SAIP fue registrada');
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button'); buttons[buttons.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(buttons[0]);
    c.cerrarResultado(); f.detectChanges(); await Promise.resolve(); expect(document.activeElement?.id).toBe('saip-resultado'); expect(c.solicitudCreada()?.id).toBe(101);
  });
  it('navega a la solicitud creada con expediente devuelto por el servidor', () => {
    const f = preparar(), navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.crearSolicitud(); http.expectOne(`${base}/solicitudes`).flush(respuesta);
    f.componentInstance.verSolicitudCreada(); expect(navigate).toHaveBeenCalledWith(['/ciudadano/solicitud', respuesta.expediente]);
  });
});
