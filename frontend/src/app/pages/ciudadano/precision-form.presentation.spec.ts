import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrecisionFormComponent } from './precision-form.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';

const expediente = 'SAIP-2026-00023';
const base = 'http://localhost:8080/api';
const consulta = `${base}/solicitudes/expediente/${expediente}`;
const precision = `${base}/solicitudes/23/observaciones/9/precision`;
const observacion = { id: 9, solicitudId: 23, estado: 'PENDIENTE_SUBSANACION',
  motivoObservacion: 'Precise el periodo.', fechaObservacion: '2026-10-21T09:00:00', fechaLimiteSubsanacion: '2026-10-23' };
const solicitud = { id: 23, expediente, ciudadanoId: 17, entidadNombre: 'Entidad sintética',
  asunto: 'Pedido sintético', estado: 'PENDIENTE_INFORMACION', observaciones: [observacion], documentosMetadata: [], documentos: [] };

describe('PrecisionFormComponent — presentación y contexto autorizado', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    sessionStorage.clear(); localStorage.clear();
    params = new BehaviorSubject(convertToParamMap({ expediente }));
    await TestBed.configureTestingModule({
      imports: [PrecisionFormComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { paramMap: params.value } } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController); auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'sesion-a', usuarioId: 17, tipoUsuario: 'CIUDADANO' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sintetico');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear(); });
  function pagina() { const f = TestBed.createComponent(PrecisionFormComponent); f.detectChanges(); return f; }
  function responder(f: ReturnType<typeof pagina>, body: Record<string, unknown> | null = solicitud) {
    const req = http.expectOne(consulta); expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    req.flush(body); f.detectChanges();
  }
  function completar(f: ReturnType<typeof pagina>) {
    const textarea = f.nativeElement.querySelector('#precision-respuesta') as HTMLTextAreaElement;
    textarea.value = 'Preciso el periodo solicitado.'; textarea.dispatchEvent(new Event('input'));
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['%PDF-1.4\nprecision'], 'precision.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change')); f.detectChanges();
    return file;
  }
  function enviarDesdeDialogo(f: ReturnType<typeof pagina>) {
    f.componentInstance.abrirConfirmacion(); f.detectChanges();
    (document.querySelector('[role=dialog] .btn-brand') as HTMLButtonElement).click(); f.detectChanges();
    const req = http.expectOne(precision);
    const body = req.request.body as FormData;
    return { req, clave: body.get('claveOperacion') as string, body };
  }
  function recibida(clave: string) {
    return { solicitudId: 23, observacionId: 9, claveOperacion: clave, comentario: 'Preciso el periodo solicitado.',
      estado: 'SUBSANADA', fechaRecepcion: '2026-10-21T09:30:00', documento: {
        id: 88, solicitudId: 23, tipoDocumento: 'SUBSANACION', estado: 'ACTIVO', nombreOriginal: 'precision.pdf',
        contentType: 'application/pdf', sizeBytes: 18, hashSha256: 'a'.repeat(64) } };
  }

  it('durante la carga no muestra un formulario ni acredita ausencia de observaciones o documentos', () => {
    const f = pagina(); http.expectOne(consulta);
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('aún no ha registrado');
    expect(f.nativeElement.textContent).not.toContain('No hay documentos');
    expect(f.nativeElement.querySelector('[role=status]').textContent).toContain('Recuperando');
  });

  it('un error de consulta no muestra formulario ni conserva contenido del expediente anterior', () => {
    const f = pagina(); http.expectOne(consulta).flush(null, { status: 503, statusText: 'Unavailable' }); f.detectChanges();
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('aún no ha registrado');
  });

  it('una solicitud con otro expediente no habilita la precisión', () => {
    const f = pagina(); responder(f, { ...solicitud, expediente: 'SAIP-2026-00999' });
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.componentInstance.puedeEnviar()).toBe(false);
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('distingue la lista de observaciones ausente de una lista vacía confirmada', () => {
    const f = pagina(); responder(f, { ...solicitud, observaciones: undefined });
    expect(f.nativeElement.textContent).toContain('información del requerimiento está incompleta');
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('la fecha de observación no se presenta como evidencia de notificación eficaz', () => {
    const f = pagina(); responder(f);
    expect(f.nativeElement.textContent).toContain('Fecha de observación');
    expect(f.nativeElement.textContent).toContain('Fecha registrada para subsanar');
    expect(f.nativeElement.textContent).toContain('Pendiente de subsanar');
    expect(f.nativeElement.textContent).not.toContain('PENDIENTE_SUBSANACION');
    const volver = f.nativeElement.querySelector('a[href="/ciudadano/solicitud/SAIP-2026-00023"]');
    expect(volver?.textContent).toContain('Volver al expediente');
    expect(volver?.nextElementSibling.textContent).toContain('Subsanación de requisitos');
  });

  it('asocia el comentario a su etiqueta y ofrece selección de archivo por teclado', () => {
    const f = pagina(); responder(f);
    const label = f.nativeElement.querySelector('label[for="precision-respuesta"]');
    expect(label).not.toBeNull();
    const control = f.nativeElement.querySelector('#precision-respuesta');
    expect(control.getAttribute('aria-required')).toBe('true');
    const trigger = f.nativeElement.querySelector('[role=button][aria-label*="Seleccionar archivo"]') as HTMLElement;
    expect(trigger?.getAttribute('tabindex')).toBe('0');
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('cambiar la ruta cancela la consulta anterior y no acepta sus datos', () => {
    const f = pagina(); const old = http.expectOne(consulta);
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' })); f.detectChanges();
    expect(old.cancelled).toBe(true);
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush(null, { status: 404, statusText: 'Not Found' }); f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull();
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('cambiar de sesión cancela la lectura anterior y consulta con la sesión actual', () => {
    const f = pagina(); const old = http.expectOne(consulta);
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' }); TestBed.tick();
    expect(old.cancelled).toBe(true);
    const nueva = http.expectOne(consulta); expect(nueva.request.headers.get('Authorization')).toBe('Bearer sesion-b');
    nueva.flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull();
  });

  it('cerrar la confirmación no envía una operación ni acredita recepción', async () => {
    const f = pagina(); responder(f);
    f.componentInstance.respuesta.set('Preciso el periodo solicitado.');
    f.componentInstance.archivoSeleccionado.set(new File(['contenido'], 'precision.txt', { type: 'text/plain' }));
    f.componentInstance.abrirConfirmacion(); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.textContent).toContain('desde el día siguiente a la notificación válida');
    expect(dialog.textContent).not.toContain('servidor');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    http.expectNone(precision);
    expect(f.componentInstance.recepcion()).toBeNull();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.confirmModalAbierto()).toBe(false);
  });

  it.each([{ observaciones: [] }, { observaciones: [{ ...observacion, estado: 'SUBSANADA' }] }])('un requerimiento ausente o atendido no habilita otro formulario: $observaciones', ({ observaciones }) => {
    const f = pagina(); responder(f, { ...solicitud, observaciones });
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.componentInstance.puedeEnviar()).toBe(false);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });

  it.each([{ observaciones: null }, { observaciones: [{ ...observacion, solicitudId: 99 }] },
    { observaciones: [{ ...observacion, motivoObservacion: '' }] },
    { observaciones: [observacion, { ...observacion, id: 10 }] }])('datos incompletos o contradictorios del requerimiento no se convierten en ausencia confirmada: $observaciones', ({ observaciones }) => {
    const f = pagina(); responder(f, { ...solicitud, observaciones });
    expect(f.componentInstance.estadoFormulario()).toBe('incompleto');
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('una consulta vacía no acredita ausencia de requerimientos y permite reintentar', () => {
    const f = pagina(); responder(f, null);
    expect(f.nativeElement.textContent).toContain('No se puede determinar');
    f.componentInstance.reintentarCarga(); responder(f);
    expect(f.nativeElement.querySelector('textarea')).not.toBeNull();
  });

  it('las fechas ausentes permanecen no disponibles sin recurrir a presentación ni hoy', () => {
    const f = pagina(); responder(f, { ...solicitud, fechaPresentacion: '2026-10-01', observaciones: [
      { ...observacion, fechaObservacion: null, fechaLimiteSubsanacion: null }] });
    expect(f.componentInstance.fechaObservacion()).toBe(''); expect(f.componentInstance.fechaLimite()).toBe('');
    expect(f.nativeElement.textContent).toContain('No disponible');
    expect(f.nativeElement.textContent).not.toContain('01/10/2026');
  });

  it('seleccionar un archivo es un estado local y eliminarlo permite seleccionarlo otra vez', () => {
    const f = pagina(); responder(f); const file = completar(f);
    expect(f.nativeElement.textContent).toContain('Archivo seleccionado: precision.pdf');
    expect(f.componentInstance.recepcion()).toBeNull();
    http.expectNone(precision);
    f.componentInstance.removerArchivo(); f.detectChanges();
    expect(f.componentInstance.archivoSeleccionado()).toBeNull();
    expect(f.nativeElement.querySelector('input[type=file]').value).toBe('');
    completar(f); expect(f.componentInstance.archivoSeleccionado()?.size).toBe(file.size);
  });

  it('los errores de archivo se vinculan al control y no eliminan un archivo válido previo', () => {
    const f = pagina(); responder(f); const anterior = completar(f);
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'x.zip', { type: 'application/zip' })] });
    input.dispatchEvent(new Event('change')); f.detectChanges();
    expect(f.componentInstance.archivoSeleccionado()).toBe(anterior);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('#precision-archivo-error').textContent).toContain('Formato no permitido');
  });

  it('el envío de interfaz transfiere bytes y confirma solo una recepción del requerimiento correcto', async () => {
    const f = pagina(); responder(f); const file = completar(f);
    const { req, clave, body } = enviarDesdeDialogo(f);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-a');
    const enviado = body.get('archivo') as File;
    expect(enviado.name).toBe(file.name); expect(enviado.size).toBe(file.size);
    const reader = new FileReader();
    const contenido = new Promise(resolve => { reader.onload = () => resolve(reader.result); });
    reader.readAsText(enviado);
    expect(await contenido).toBe('%PDF-1.4\nprecision');
    expect(body.get('comentario')).toBe('Preciso el periodo solicitado.');
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    req.flush(recibida(clave)); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector('[role=dialog]');
    expect(dialog?.getAttribute('aria-label')).toBe('Precisión registrada');
    expect(dialog?.textContent).toContain('precision.pdf');
    expect(dialog?.textContent).toContain('21/10/2026');
    expect(dialog?.textContent).not.toMatch(/servidor|Clave de operación|2026-10-21T/);
    expect(dialog?.textContent).not.toContain(clave);
    expect(f.componentInstance.recepcion()?.documento.id).toBe(88);
    expect(f.componentInstance.solicitud()?.estado).toBe('PENDIENTE_INFORMACION');
    expect(document.body.textContent).not.toContain('dentro del plazo legal');
    (document.querySelector('[role=dialog] button[aria-label="Cerrar"]') as HTMLButtonElement).click();
    f.detectChanges(); await Promise.resolve();
    expect(document.activeElement?.id).toBe('precision-recepcion');
    expect(f.nativeElement.querySelector('#precision-recepcion').textContent).toContain('21/10/2026');
    expect(f.nativeElement.textContent).not.toContain(clave);
    expect(f.nativeElement.textContent).toContain('Subsanada');
  });

  it('la pérdida de confirmación consulta la misma clave y recupera sin segundo POST', () => {
    const f = pagina(); responder(f); completar(f);
    const { req, clave } = enviarDesdeDialogo(f);
    req.error(new ProgressEvent('error'));
    const get = http.expectOne(`${precision}/${clave}`); expect(get.request.method).toBe('GET');
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    get.flush(recibida(clave)); f.detectChanges();
    expect(f.componentInstance.recepcion()?.documento.id).toBe(88);
    f.componentInstance.confirmarEnvio(); http.expectNone(precision);
  });

  it('una recepción no comprobable conserva el contenido y solo permite consultar el resultado', async () => {
    const f = pagina(); responder(f); const file = completar(f);
    const { req, clave } = enviarDesdeDialogo(f);
    req.error(new ProgressEvent('error'));
    http.expectOne(`${precision}/${clave}`).error(new ProgressEvent('error')); f.detectChanges();
    await f.whenStable(); f.detectChanges();
    expect(f.componentInstance.archivoSeleccionado()).toBe(file);
    expect(f.componentInstance.respuesta()).toBe('Preciso el periodo solicitado.');
    expect(f.componentInstance.verificacionPendiente()).toBe(true);
    expect(f.nativeElement.querySelector('textarea').disabled).toBe(true);
    f.componentInstance.confirmarEnvio();
    http.expectNone(precision);
    http.expectOne(`${precision}/${clave}`).flush(recibida(clave));
  });

  it('cambiar de solicitud mientras se envía cancela continuaciones y preserva únicamente la clave recuperable', () => {
    const f = pagina(); responder(f); completar(f);
    const { req, clave } = enviarDesdeDialogo(f);
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' })); f.detectChanges();
    expect(req.cancelled).toBe(true);
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush({ ...solicitud, id: 24, expediente: 'SAIP-2026-00024', observaciones: [] });
    f.componentInstance.confirmarDesdeDialogo();
    http.expectNone(precision);
    expect(f.componentInstance.recepcion()).toBeNull(); expect(f.componentInstance.archivoSeleccionado()).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('yaiku:precision:17:23:9')!).claveOperacion).toBe(clave);
    expect(sessionStorage.getItem('yaiku:precision:17:23:9')).not.toContain('precision.pdf');
  });

  it('al cambiar sesión una respuesta anterior no confirma ni inicia una consulta de recuperación con otro Bearer', () => {
    const f = pagina(); responder(f); completar(f);
    const { req, clave } = enviarDesdeDialogo(f);
    auth.guardarSesion({ success: true, token: 'sesion-b', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    req.error(new ProgressEvent('error'));
    http.expectNone(`${precision}/${clave}`);
    expect(f.componentInstance.recepcion()).toBeNull();
    TestBed.tick(); http.expectOne(consulta).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.componentInstance.archivoSeleccionado()).toBeNull();
  });

  it('una descarga anterior se cancela al cambiar de recurso y no repuebla su vista previa', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [{ id: 80, solicitudId: 23, nombreOriginal: 'real.txt' }] });
    f.componentInstance.abrirDoc(f.componentInstance.documentosExpediente()[0], false);
    const old = http.expectOne(`${base}/documentos/80/download`);
    params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' })); f.detectChanges();
    expect(old.cancelled).toBe(true);
    http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush(null);
    expect(f.componentInstance.previewTarget()).toBeNull();
  });

  it('destruir el componente durante un POST no lo repite ni inicia recuperación tardía', () => {
    const f = pagina(); responder(f); completar(f);
    const { req, clave } = enviarDesdeDialogo(f);
    f.destroy(); expect(req.cancelled).toBe(true);
    f.componentInstance.confirmarEnvio(); http.expectNone(precision); http.expectNone(`${precision}/${clave}`);
    expect(f.componentInstance.archivoSeleccionado()).toBeNull();
  });

  it.each([400, 401, 403, 404, 500, 0])('la consulta rechazada con %s no muestra una observación ficticia ni otro formulario', status => {
    const f = pagina(); const req = http.expectOne(consulta);
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush({ detail: 'detalle interno no publicable' }, { status, statusText: 'Error' });
    f.detectChanges();
    expect(f.componentInstance.solicitud()).toBeNull(); expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('detalle interno');
    expect(f.componentInstance.puedeReintentarCarga()).toBe(status === 0 || status >= 500);
  });

  it('el resultado incierto se recupera al recrear el formulario con solo los identificadores conservados', () => {
    const f = pagina(); responder(f); completar(f);
    const { req, clave } = enviarDesdeDialogo(f); req.error(new ProgressEvent('error'));
    http.expectOne(`${precision}/${clave}`).error(new ProgressEvent('error'));
    f.destroy();
    const nueva = pagina(); responder(nueva, { ...solicitud, observaciones: [{ ...observacion, estado: 'SUBSANADA' }] });
    expect(nueva.componentInstance.archivoSeleccionado()).toBeNull(); expect(nueva.componentInstance.respuesta()).toBe('');
    http.expectOne(`${precision}/${clave}`).flush(recibida(clave)); nueva.detectChanges();
    expect(nueva.componentInstance.recepcion()?.documento.id).toBe(88);
    expect(nueva.nativeElement.textContent).not.toContain(clave);
    expect(nueva.componentInstance.recepcion()?.claveOperacion).toBe(clave);
    http.expectNone(precision);
  });

  it('un 409 no confirma éxito y permite consultar la operación existente sin sustituir su clave', () => {
    const f = pagina(); responder(f); const file = completar(f);
    const { req, clave } = enviarDesdeDialogo(f);
    req.flush({ detail: 'detalle interno' }, { status: 409, statusText: 'Conflict' }); f.detectChanges();
    expect(f.componentInstance.successModalAbierto()).toBe(false); expect(f.componentInstance.archivoSeleccionado()).toBe(file);
    expect(f.nativeElement.textContent).not.toContain('detalle interno');
    const comprobar = [...f.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent.includes('Comprobar recepción')) as HTMLButtonElement;
    comprobar.click();
    http.expectOne(`${precision}/${clave}`).flush(recibida(clave)); http.expectNone(precision);
    expect(f.componentInstance.recepcion()?.claveOperacion).toBe(clave);
  });

  it('una confirmación de contenido cambiado exige nueva revisión antes de hacer un POST', () => {
    const f = pagina(); responder(f); completar(f);
    f.componentInstance.abrirConfirmacion(); f.detectChanges();
    f.componentInstance.respuesta.set('Otro comentario'); f.componentInstance.confirmarDesdeDialogo();
    http.expectNone(precision); expect(f.componentInstance.confirmModalAbierto()).toBe(false);
    expect(f.componentInstance.error()).toContain('contenido cambió');
  });

  it('una revisión de sesión con el mismo token también descarta las continuaciones previas', () => {
    const f = pagina(); const req = http.expectOne(consulta);
    auth.guardarSesion({ success: true, token: 'sesion-a', usuarioId: 18, tipoUsuario: 'CIUDADANO' });
    req.flush(solicitud); expect(f.componentInstance.solicitud()).toBeNull();
    TestBed.tick(); http.expectOne(consulta).flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('los metadatos de otro recurso no aparecen ni permiten descargar por un ID arbitrario', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [{ id: 80, solicitudId: 99, nombreOriginal: 'ajeno.txt' }] });
    expect(f.componentInstance.documentosExpediente()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('información documental está incompleta');
    f.componentInstance.abrirDoc({ id: 80, nombre: 'ajeno.txt', kind: 'ciudadano' }, true);
    http.expectNone(`${base}/documentos/80/download`);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('una vista previa local cancela la descarga anterior y permanece identificada como archivo seleccionado', () => {
    const f = pagina(); responder(f, { ...solicitud, documentosMetadata: [{ id: 80, solicitudId: 23, nombreOriginal: 'real.txt' }] });
    const file = completar(f);
    f.componentInstance.abrirDoc(f.componentInstance.documentosExpediente()[0], false);
    const old = http.expectOne(`${base}/documentos/80/download`);
    f.componentInstance.abrirPreviewArchivoLocal();
    expect(old.cancelled).toBe(true);
    expect(f.componentInstance.previewTarget()?.file).toBe(file);
    expect(f.componentInstance.recepcion()).toBeNull();
  });

  it('arrastrar varios archivos no selecciona solo el primero silenciosamente', () => {
    const f = pagina(); responder(f);
    const files = [new File(['uno'], 'uno.txt', { type: 'text/plain' }), new File(['dos'], 'dos.txt', { type: 'text/plain' })];
    f.componentInstance.onDrop({ preventDefault: vi.fn(), dataTransfer: { files } } as unknown as DragEvent);
    expect(f.componentInstance.archivoSeleccionado()).toBeNull();
    expect(f.componentInstance.archivoError()).toContain('un solo archivo');
    http.expectNone(precision);
  });

  it('la revisión local del archivo no es obligatoria ni acredita recepción y se limpia al quitarlo', () => {
    const f = pagina(); responder(f); completar(f);
    const checkbox = f.nativeElement.querySelector('#precision-archivo-revisado') as HTMLInputElement;
    expect(checkbox.required).toBe(false); expect(f.componentInstance.puedeEnviar()).toBe(true);
    checkbox.checked = true; checkbox.dispatchEvent(new Event('change'));
    expect(f.componentInstance.archivoRevisado()).toBe(true);
    expect(f.componentInstance.recepcion()).toBeNull(); http.expectNone(precision);
    f.componentInstance.removerArchivo(); expect(f.componentInstance.archivoRevisado()).toBe(false);
  });

  it('una clave no recuperable de un requerimiento ya atendido no ofrece volver a presentarlo', () => {
    const clave = crypto.randomUUID();
    sessionStorage.setItem('yaiku:precision:17:23:9', JSON.stringify({ solicitudId: 23, observacionId: 9, claveOperacion: clave }));
    const f = pagina(); responder(f, { ...solicitud, observaciones: [{ ...observacion, estado: 'SUBSANADA' }] });
    http.expectOne(`${precision}/${clave}`).flush(null, { status: 404, statusText: 'Not Found' }); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Puede reintentar con el mismo');
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    f.componentInstance.confirmarEnvio(); http.expectNone(precision);
  });
});
