import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultarComponent } from './consultar.component';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

describe('ConsultarEstado — resumen público independiente del expediente autenticado', () => {
  const expediente = 'SAIP-2026-00023';
  const url = `${environment.apiUrl}/solicitudes/publica/expediente/${expediente}`;
  const resumen = { expediente, ciudadano: 'S*** S***', entidad: 'Entidad sintética',
    fechaPresentacion: '2026-10-01T09:30:00', fechaLimite: '2026-10-15', diasTranscurridos: 25,
    diasRestantes: 0, estado: 'EN_PROCESO', respuestaFecha: null,
    respuestaTipo: null, apelacionExpediente: null, apelacionEstado: null, apelacionFecha: null,
    resolucionFecha: null, resolucionResultado: null };
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [ConsultarComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    try { http.verify({ ignoreCancelled: true }); }
    finally { TestBed.resetTestingModule(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); }
  });
  function pagina() { const f = TestBed.createComponent(ConsultarComponent); f.componentInstance.tiempoMinimoMs = 0; f.componentInstance.validarPoW = false; f.detectChanges(); f.componentInstance.query.set(expediente); return f; }
  function escribir(c: ConsultarComponent, value: string) { c.onQueryInput({ target: { value } } as unknown as Event); }
  it('un error 5xx no afirma que la solicitud no existe', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(c.noEncontrado()).toBe(false); expect(c.resultado()).toBeNull();
  });
  it('cambiar la búsqueda descarta una respuesta anterior pendiente', () => {
    const c = pagina().componentInstance; c.buscar(); const req = http.expectOne(url); escribir(c, 'SAIP-2026-00024');
    if (!req.cancelled) req.flush(resumen); expect(c.resultado()).toBeNull(); expect(c.buscando()).toBe(false);
  });
  it('editar el código limpia el resultado del recurso anterior', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush(resumen); escribir(c, 'SAIP-2026-00024');
    expect(c.resultado()).toBeNull();
  });
  it('no fabrica una evaluación ni una respuesta pendiente a partir del estado', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush(resumen);
    expect(c.resultado()?.timeline.some(e => e.title === 'En evaluación' || e.title === 'Respuesta')).toBe(false);
  });
  it('un dato de días ausente no se convierte en cero', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, diasTranscurridos: null });
    expect(c.resultado()?.diasTranscurridos).toBeNull();
  });
  it('no muestra un expediente diferente del solicitado', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, expediente: 'SAIP-2026-00999' });
    expect(c.resultado()).toBeNull();
  });
  it('impide consultas duplicadas del mismo envío', () => {
    const c = pagina().componentInstance; c.buscar(); c.buscar(); const reqs = http.match(url);
    reqs.forEach(r => r.flush(resumen)); expect(reqs).toHaveLength(1);
  });
  it('destruir la pantalla cancela la consulta sin aceptar su resultado tardío', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); const req = http.expectOne(url); f.destroy();
    if (!req.cancelled) req.flush(resumen); expect(req.cancelled).toBe(true); expect(c.resultado()).toBeNull();
  });
  it.each(['', ' ', '123', '00145-2026-JUS-TTAIP', 'SAIP-2026-123', 'SAIP-20AB-00001', 'SAIP-2026-00001/../23'])('valida el expediente %j sin consultar datos privados ni completar la búsqueda', codigo => {
    const f = pagina(), c = f.componentInstance; c.query.set(codigo); c.buscar(); f.detectChanges();
    expect(c.estadoConsulta()).toBe('validacion'); expect(c.noEncontrado()).toBe(false); expect(c.resultado()).toBeNull();
    const input = f.nativeElement.querySelector('#expediente') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true'); expect(input.getAttribute('aria-describedby')).toContain('expediente-error');
    expect(f.nativeElement.querySelector('#expediente-error').textContent).toContain('SAIP'); http.expectNone(() => true);
  });
  it('consulta el número TTAIP completo sin incluir su barra en la ruta', () => {
    const f = pagina(), c = f.componentInstance;
    escribir(c, ' 00145-2026-jus/ttaip ');
    c.buscar();
    const req = http.expectOne(request => request.url === `${environment.apiUrl}/solicitudes/publica/expediente`
      && request.params.get('expediente') === '00145-2026-JUS/TTAIP');
    req.flush({ ...resumen, estado: 'APELADA', apelacionExpediente: '00145-2026-JUS/TTAIP',
      apelacionEstado: 'EN_CALIFICACION_1', apelacionFecha: '2026-10-10' });
    expect(c.resultado()?.apelacionExpediente).toBe('00145-2026-JUS/TTAIP');
    expect(c.resultado()?.expediente).toBe(expediente);
  });
  it('distingue el límite de consultas de un error del servidor', () => {
    const f = pagina(), c = f.componentInstance;
    c.buscar();
    http.expectOne(url).flush(null, { status: 429, statusText: 'Too Many Requests' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Demasiadas consultas');
    expect(f.nativeElement.textContent).not.toContain('No se pudo completar la consulta');
    expect(c.reintentable()).toBe(false);
  });
  it('muestra una apelación externa por su número propio sin inventar una solicitud SAIP', () => {
    const f = pagina(), c = f.componentInstance;
    escribir(c, '00145-2026-JUS/TTAIP');
    c.buscar();
    http.expectOne(request => request.params.get('expediente') === '00145-2026-JUS/TTAIP')
      .flush({ ...resumen, expediente: null, estado: 'APELADA', apelacionExpediente: '00145-2026-JUS/TTAIP',
        apelacionEstado: 'EN_CALIFICACION_1', apelacionFecha: '2026-10-10', fechaPresentacion: null, diasTranscurridos: null });
    f.detectChanges();
    expect(c.resultado()?.expedienteSaip).toBeNull();
    expect(f.nativeElement.textContent).toContain('Expediente TTAIP');
    expect(f.nativeElement.textContent).not.toContain('Solicitud SAIP vinculada');
    expect(f.nativeElement.textContent).not.toContain('días transcurridos');
    expect(c.resultado()?.timeline).toHaveLength(1);
  });
  it('las entradas inválidas y los clics repetidos durante la carga no agotan el límite', () => {
    const c = pagina().componentInstance;
    for (let i = 0; i < 9; i++) {
      c.query.set('incompleto');
      c.buscar();
    }
    expect(c.estadoConsulta()).toBe('validacion');
    c.query.set(expediente);
    c.buscar();
    for (let i = 0; i < 9; i++) c.buscar();
    http.expectOne(url).flush(resumen);
    expect(c.estadoConsulta()).toBe('disponible');
    c.buscar();
    http.expectOne(url).flush(resumen);
    expect(c.estadoConsulta()).toBe('disponible');
  });
  it('normaliza el código sin añadir datos de identificación, admite números secuenciales de más de cinco dígitos', () => {
    const c = pagina().componentInstance; escribir(c, ' saip-2026-100001 '); c.buscar();
    const req = http.expectOne(`${environment.apiUrl}/solicitudes/publica/expediente/SAIP-2026-100001`);
    expect(req.request.method).toBe('GET'); expect(req.request.params.keys()).toEqual([]); expect(req.request.body).toBeNull();
    req.flush({ ...resumen, expediente: 'SAIP-2026-100001' }); expect(c.resultado()?.expediente).toBe('SAIP-2026-100001');
    http.expectNone(() => true);
  });
  it.each([null, 'CIUDADANO', 'FUNCIONARIO', 'TTAIP', 'ADMINISTRADOR'] as const)('con rol=%s se utiliza solo el DTO público y no se conservan campos privados inesperados', rol => {
    if (rol) TestBed.inject(AuthService).guardarSesion({ success: true, token: 'sesion-sintetica', usuarioId: 5, ciudadanoId: 5, tipoUsuario: rol });
    const f = pagina(), c = f.componentInstance; c.buscar(); const req = http.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(!!rol);
    req.flush({ ...resumen, asunto: 'ASUNTO_PRIVADO_NO_PERMITIDO', descripcion: 'DESCRIPCION_PRIVADA_NO_PERMITIDA', documentos: [{ id: 55, nombre: 'DOCUMENTO_PRIVADO_NO_PERMITIDO' }],
      dni: 'DATO_IDENTIFICACION_NO_PERMITIDO', fundamentos: 'FUNDAMENTO_PRIVADO_NO_PERMITIDO', ciudadanoId: 5 }); f.detectChanges();
    expect(c.resultado()?.ciudadano).toBe('S*** S***'); expect(c.resultado()?.entidad).toBe('Entidad sintética');
    expect(JSON.stringify(c.resultado())).not.toContain('NO_PERMITID'); expect(f.nativeElement.textContent).not.toContain('NO_PERMITID');
    expect(f.nativeElement.querySelector('[download]')).toBeNull(); http.expectNone(() => true);
  });
  it('la búsqueda no se hidrata desde la sesión ni guarda código/resultados en URL o almacenamiento', () => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'sesion-sintetica', usuarioId: 5, ciudadanoId: 5, tipoUsuario: 'CIUDADANO' });
    const previous = localStorage.getItem('usuario'), location = window.location.href;
    const localWrites = vi.spyOn(Storage.prototype, 'setItem'); const f = pagina(); f.componentInstance.query.set('');
    expect(f.componentInstance.query()).toBe(''); expect(f.componentInstance.resultado()).toBeNull(); http.expectNone(() => true);
    escribir(f.componentInstance, expediente); f.componentInstance.buscar(); http.expectOne(url).flush(resumen);
    expect(window.location.href).toBe(location); expect(localWrites).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0); expect(localStorage.getItem('usuario')).toBe(previous);
  });
  it.each([0, 400, 401, 403, 422, 500, 503])('status %s distingue el error de una ausencia y no muestra detalles internos', status => {
    const f = pagina(), c = f.componentInstance; c.buscar(); const req = http.expectOne(url);
    if (status) req.flush({ detail: 'DETALLE_INTERNO_NO_PUBLICO' }, { status, statusText: 'Rejected' }); else req.error(new ProgressEvent('error'));
    f.detectChanges(); expect(c.resultado()).toBeNull(); expect(c.noEncontrado()).toBe(false); expect(c.mensaje()).toBeTruthy();
    expect(c.query()).toBe(expediente); expect(f.nativeElement.textContent).not.toContain('DETALLE_INTERNO_NO_PUBLICO');
    expect(c.reintentable()).toBe(status === 0 || status >= 500); http.expectNone(() => true);
  });
  it('solo el 404 del contrato representa ausencia; mantiene el mensaje genérico y los datos para corregir', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush({ detail: 'Coincidencia parcial privada' }, { status: 404, statusText: 'Not found' }); f.detectChanges();
    expect(c.noEncontrado()).toBe(true); expect(c.estadoConsulta()).toBe('inexistente'); expect(c.query()).toBe(expediente);
    expect(f.nativeElement.textContent).toContain('Expediente no encontrado'); expect(c.mensaje()).not.toContain('Coincidencia');
  });
  it.each([null, {}, [], { ...resumen, expediente: 'OTRO' }, { ...resumen, estado: null }, { ...resumen, estado: 'ESTADO_NUEVO' }])('un 200 incompleto o incompatible %j no se transforma en ausencia o estado archivado', data => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush(data); f.detectChanges();
    expect(c.estadoConsulta()).toBe('incompleta'); expect(c.noEncontrado()).toBe(false); expect(c.resultado()).toBeNull();
    expect(c.reintentable()).toBe(true); expect(f.nativeElement.textContent).not.toContain('Archivada');
  });
  it('un 204 sin DTO no es una confirmación de inexistencia', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush(null, { status: 204, statusText: 'No content' });
    expect(c.estadoConsulta()).toBe('incompleta'); expect(c.noEncontrado()).toBe(false);
  });
  it.each([null, -1, 1.5, '25'])('días transcurridos no válidos %j no se recalculan ni se sustituyen por cero', dias => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, diasTranscurridos: dias }); f.detectChanges();
    expect(c.resultado()?.diasTranscurridos).toBeNull(); expect(c.resultado()?.faltantes.length).toBeGreaterThan(0); expect(f.nativeElement.textContent).toContain('No informado');
  });
  it('cero y cantidades recibidas se muestran sin utilizar el reloj local o los días restantes', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, diasTranscurridos: 0, diasRestantes: 99 });
    expect(c.resultado()?.diasTranscurridos).toBe(0); c.limpiarBusqueda(); c.query.set(expediente); c.buscar(); http.expectOne(url).flush({ ...resumen, diasTranscurridos: 1234 });
    expect(c.resultado()?.diasTranscurridos).toBe(1234); expect(JSON.stringify(c.resultado())).not.toContain('diasRestantes');
  });
  it.each([null, 'fecha inventada', '2026-02-30'])('una fecha de presentación ausente/incorrecta %j no genera un hito ni un cálculo sustituto', fecha => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, fechaPresentacion: fecha, diasTranscurridos: 0 });
    expect(c.resultado()?.fechaPresentacion).toBeNull(); expect(c.resultado()?.diasTranscurridos).toBeNull(); expect(c.resultado()?.timeline).toEqual([]);
  });
  it('un resumen parcial mantiene únicamente la información pública recibida sin inventar entidad ni tipo de persona', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, entidad: null, ciudadano: null }); f.detectChanges();
    expect(c.resultado()?.faltantes).toEqual(expect.arrayContaining(['nombre de entidad', 'identificación enmascarada del solicitante']));
    expect(f.nativeElement.textContent).toContain('Nombre no informado'); expect(f.nativeElement.textContent).not.toContain('Persona Natural'); expect(f.nativeElement.textContent).not.toContain('RUC)');
  });
  it('la respuesta registrada no se presenta como entregada, notificada o emitida oficialmente', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, estado: 'RESPONDIDA', respuestaFecha: '2026-10-02T00:15:00Z', respuestaTipo: 'ENTREGA_TOTAL' });
    const eventos = c.resultado()!.timeline; expect(eventos.map(e => e.title)).toEqual(['Registro de la solicitud', 'Registro de respuesta']);
    expect(eventos[1].date).toBe('02/10/2026'); expect(eventos[1].description).toContain('No acredita entrega ni notificación eficaz'); expect(eventos.some(e => e.status === 'pending')).toBe(false);
  });
  it('solo presenta las fechas reales de apelación y resolución vinculadas, sin consultar endpoints TTAIP', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, estado: 'APELADA', apelacionExpediente: '00145-2026-JUS/TTAIP', apelacionEstado: 'RESUELTO',
      apelacionFecha: '2026-10-10', resolucionFecha: '2026-10-20', resolucionResultado: 'FUNDADO' }); f.detectChanges();
    expect(c.resultado()?.timeline.map(e => e.date)).toEqual(['01/10/2026', '10/10/2026', '20/10/2026']);
    expect(f.nativeElement.textContent).toContain('00145-2026-JUS/TTAIP'); expect(f.nativeElement.querySelector('a[href*="ttaip"]')).toBeNull();
    http.expectNone(() => true);
  });
  it('la apelación sin fecha o sin referencia no recibe un hito fechado ni un estado predeterminado', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, estado: 'APELADA', apelacionExpediente: '00145-2026-JUS/TTAIP' });
    expect(c.resultado()?.apelacionEstado).toBeNull(); expect(c.resultado()?.timeline).toHaveLength(1); expect(c.resultado()?.faltantes.join(' ')).toContain('apelación');
    c.query.set('SAIP-2026-00024'); c.buscar(); http.expectOne(`${environment.apiUrl}/solicitudes/publica/expediente/SAIP-2026-00024`).flush({ ...resumen, expediente: 'SAIP-2026-00024', apelacionFecha: '2026-10-10', resolucionFecha: '2026-10-20', resolucionResultado: 'FUNDADO' });
    expect(c.resultado()?.timeline).toHaveLength(1); expect(c.resultado()?.resolucionResultado).toBeNull();
  });
  it('el estado vencido no produce una fecha de vencimiento/actuación a partir del límite informado', () => {
    const c = pagina().componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, estado: 'VENCIDA', fechaLimite: '2026-10-15' });
    expect(c.resultado()?.timeline.map(e => e.title)).toEqual(['Registro de la solicitud']); expect(c.resultado()?.timeline.some(e => e.date === '15/10/2026')).toBe(false);
  });
  it('reintenta una consulta fallida solo al pedirlo y recupera el resultado sin conservar el error', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).error(new ProgressEvent('error')); f.detectChanges(); http.expectNone(url);
    const retry = [...f.nativeElement.querySelectorAll('button')].find((b: unknown) => (b as HTMLElement).textContent?.includes('Reintentar consulta')) as HTMLButtonElement;
    retry.click(); http.expectOne(url).flush(resumen); f.detectChanges(); expect(c.estadoConsulta()).toBe('disponible'); expect(c.mensaje()).toBe('');
    expect(c.resultado()?.expediente).toBe(expediente);
  });
  it('una segunda búsqueda reemplaza la pendiente y una respuesta fuera de orden no repuebla el recurso anterior', () => {
    const c = pagina().componentInstance; c.buscar(); const anterior = http.expectOne(url);
    c.query.set('SAIP-2026-00024'); c.buscar(); expect(anterior.cancelled).toBe(true);
    http.expectOne(`${environment.apiUrl}/solicitudes/publica/expediente/SAIP-2026-00024`).flush({ ...resumen, expediente: 'SAIP-2026-00024' });
    expect(c.resultado()?.expediente).toBe('SAIP-2026-00024'); expect(c.buscando()).toBe(false);
  });
  it('escribir no realiza búsquedas y limpiar cancela la pendiente sin guardar datos', () => {
    const c = pagina().componentInstance; escribir(c, 'SAIP-2026-000'); http.expectNone(() => true); escribir(c, expediente); c.buscar(); const req = http.expectOne(url);
    c.limpiarBusqueda(); expect(req.cancelled).toBe(true); expect(c.query()).toBe(''); expect(c.estadoConsulta()).toBe('inicial'); expect(c.resultado()).toBeNull(); http.expectNone(() => true);
  });
  it('el formulario nativo permite submit por teclado, previene navegación y anuncia/focaliza el resultado', async () => {
    const f = pagina(), c = f.componentInstance; document.body.appendChild(f.nativeElement); f.detectChanges();
    const form = f.nativeElement.querySelector('form') as HTMLFormElement, event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); f.detectChanges(); expect(form.getAttribute('aria-busy')).toBe('true');
    expect(f.nativeElement.querySelector('[role="status"]').textContent).toContain('Consultando');
    http.expectOne(url).flush(resumen); f.detectChanges(); await f.whenStable();
    expect(document.activeElement?.id).toBe('consulta-resultado'); expect(c.resultado()?.expediente).toBe(expediente);
    expect(f.nativeElement.querySelector('label[for="expediente"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('a[href="/login"]')).not.toBeNull(); expect(f.nativeElement.querySelector('a[href*="/ciudadano/solicitud"]')).toBeNull(); f.nativeElement.remove();
  });
  it('error y nueva búsqueda gestionan el foco sin borrar la entrada tras el rechazo', async () => {
    const f = pagina(), c = f.componentInstance; document.body.appendChild(f.nativeElement); c.buscar();
    http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges(); await f.whenStable();
    expect(document.activeElement?.id).toBe('consulta-feedback'); expect(c.query()).toBe(expediente);
    c.limpiarBusqueda(); f.detectChanges(); await f.whenStable(); expect(document.activeElement?.id).toBe('expediente'); f.nativeElement.remove();
  });
  it('nombres largos y texto con marcado se muestran como texto, sin crear enlaces ni contenido ejecutable', () => {
    const f = pagina(), c = f.componentInstance; c.buscar();
    const entidad = 'Entidad sintética '.repeat(12) + '<script>contenido-sintetico</script>';
    http.expectOne(url).flush({ ...resumen, entidad }); f.detectChanges();
    expect(f.nativeElement.textContent).toContain(entidad); expect(f.nativeElement.querySelector('script')).toBeNull();
    expect(f.nativeElement.querySelectorAll('a')).toHaveLength(2); expect(c.resultado()?.entidad).toBe(entidad);
  });
  it('una continuación de foco de una búsqueda cancelada no recupera su resultado anterior', async () => {
    const f = pagina(), c = f.componentInstance; document.body.appendChild(f.nativeElement); c.buscar();
    http.expectOne(url).flush(resumen); c.limpiarBusqueda(); f.detectChanges(); await f.whenStable();
    expect(c.resultado()).toBeNull(); expect(document.activeElement?.id).toBe('expediente'); f.nativeElement.remove();
  });
  it('la omisión deliberada del asunto público no se trata como información incompleta ni dispara consultas privadas', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush(resumen); f.detectChanges();
    expect(c.estadoConsulta()).toBe('disponible'); expect(c.resultado()?.faltantes).toEqual([]);
    expect(c.resultado()).not.toHaveProperty('asunto'); expect(f.nativeElement.textContent).not.toContain('Asunto no informado');
    expect(f.nativeElement.textContent).toContain('no forman parte de esta consulta pública'); http.expectNone(() => true);
  });
  it('un asunto inesperado de una respuesta legacy no se conserva ni se muestra como dato público', () => {
    const f = pagina(), c = f.componentInstance; c.buscar(); http.expectOne(url).flush({ ...resumen, asunto: 'MARCADOR_PERSONAL_SINTETICO_NO_PUBLICO' }); f.detectChanges();
    expect(JSON.stringify(c.resultado())).not.toContain('MARCADOR_PERSONAL_SINTETICO');
    expect(f.nativeElement.textContent).not.toContain('MARCADOR_PERSONAL_SINTETICO'); expect(c.resultado()).not.toHaveProperty('asunto');
    http.expectNone(() => true);
  });

  it('F20 anti-abuso: trampa honeypot bloquea la consulta y muestra aviso', () => {
    const f = pagina(), c = f.componentInstance;
    c.trampa.set('bot-spam');
    c.buscar();
    expect(c.aviso()).toContain('Espere un momento');
    http.expectNone(() => true);
  });

  it('F20 anti-abuso: tiempo de estancia inferior al umbral bloquea la consulta', () => {
    const f = TestBed.createComponent(ConsultarComponent);
    f.componentInstance.tiempoMinimoMs = 5000;
    f.detectChanges();
    f.componentInstance.query.set(expediente);
    f.componentInstance.buscar();
    expect(f.componentInstance.aviso()).toContain('Espere un momento');
    http.expectNone(() => true);
  });

  it('F20 anti-abuso: validación PoW requiere token activo', () => {
    const f = TestBed.createComponent(ConsultarComponent);
    f.componentInstance.tiempoMinimoMs = 0;
    f.componentInstance.validarPoW = true;
    f.detectChanges();
    f.componentInstance.query.set(expediente);
    f.componentInstance.prueba.set(null);
    f.componentInstance.buscar();
    expect(f.componentInstance.aviso()).toContain('anti-bots');
    http.expectNone(() => true);
  });

  it('F20 anti-abuso: ráfaga superior a 8 consultas en 60s es bloqueada', () => {
    const f = pagina(), c = f.componentInstance;
    for (let i = 0; i < 8; i++) {
      c.query.set(`SAIP-2026-0000${i + 1}`);
      c.buscar();
      const req = http.expectOne(`${environment.apiUrl}/solicitudes/publica/expediente/SAIP-2026-0000${i + 1}`);
      req.flush(resumen);
    }
    expect(c.aviso()).toBeNull();
    // Intento 9 dentro del minuto
    c.query.set('SAIP-2026-00009');
    c.buscar();
    f.detectChanges();
    expect(c.estadoConsulta()).toBe('limite');
    expect(c.mensaje()).toContain('muchas consultas seguidas');
    expect(f.nativeElement.textContent).not.toContain('No se pudo completar la consulta');
    http.expectNone(`${environment.apiUrl}/solicitudes/publica/expediente/SAIP-2026-00009`);
  });
});
