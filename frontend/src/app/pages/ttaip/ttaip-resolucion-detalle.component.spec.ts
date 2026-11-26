import { ConsultaAdmision, InformacionComplementaria, PresentacionAdmision, TtaipActuacionesService } from '../../services/ttaip-actuaciones.service';
import { provideRouter, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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
    TestBed.configureTestingModule({ imports: [TtaipResolucionDetalleComponent], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: {} }, { provide: AuthService, useValue: { cambiosSesion: signal(0), obtenerSesion: () => ({ usuarioId: 7, token: 'sesión-sintética', tipoUsuario: 'TTAIP', nombre: 'Operador sintético' }) } },
      { provide: ApelacionService, useValue: { findByExpediente: vi.fn() } }, { provide: TtaipService, useValue: servicio }] });
  });
  function pagina() {
    const c = TestBed.createComponent(TtaipResolucionDetalleComponent).componentInstance;
    const cedula = { id: 61, destinatario: 'CIUDADANO' };
    const ap = { id: 1, expediente: '00001-2026-JUS/TTAIP', estado: 'EN_SUBSANACION', resoluciones: [], expedienteTtaip: { id: 12, numeroExpediente: '00001-2026-JUS/TTAIP',
      resoluciones: [{ id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE', cedulas: [cedula] }], cedulas: [cedula], notificaciones: [{ id: 91, cedulaId: 61, destinatario: 'CIUDADANO' }], historial: [] } } as unknown as Apelacion;
    (TestBed.inject(ApelacionService).findByExpediente as ReturnType<typeof vi.fn>).mockReturnValue(of(ap));
    c.cargarApelacion(ap.expediente);
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
    TestBed.configureTestingModule({ imports: [TtaipResolucionDetalleComponent], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: {} }, { provide: AuthService, useValue: { cambiosSesion: signal(0), obtenerSesion: () => ({ usuarioId: 7, token: 'sesión-sintética', tipoUsuario: 'TTAIP' }) } },
      { provide: ApelacionService, useValue: consultas }, { provide: TtaipService, useValue: {} }] });
  });
  function expediente(id: number): Apelacion {
    return { id, expediente: `0000${id}-2026-JUS/TTAIP`, estado: 'EN_CALIFICACION_1', ciudadanoNombre: `Persona ${id}`, resoluciones: [],
      resolucionPrimeraCalificacion: { id: id + 70, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', cedulas: [] } } as unknown as Apelacion;
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

// HTTP mocks and DOM: these checks do not claim a new Spring or browser run.
describe('ResolutionDetail — identificación y aislamiento', () => {
  const api = environment.apiUrl, code = '00051-2026-JUS/TTAIP';
  const session = { success: true, usuarioId: 7, miembroId: 7, token: 'sesion-sintetica', tipoUsuario: 'TTAIP', nombre: 'Operador sintético' };
  const first = { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE', fundamentos: 'Fundamentos del Tribunal', observaciones: 'Observaciones del Tribunal', fechaResolucion: '2026-10-01' };
  const data = (patch: Record<string, unknown> = {}) => ({ id: 51, expediente: code, ciudadanoId: 4, ciudadanoNombre: 'Persona sintética', entidadId: 3, entidadNombre: 'Entidad sintética',
    estado: 'EN_CALIFICACION_2', tipoOrigen: 'EXTERNA', solicitudId: null, fechaApelacion: '2026-09-28', fundamentos: 'Argumentos históricos', tipoDenegatoria: 'EXPRESA', resumenRespuestaEntidad: 'Respuesta registrada de la entidad',
    resolucionPrimeraCalificacion: first, calificacionPrimera: 'INADMISIBLE', resolucionSegundaCalificacion: null, calificacionSegunda: null, resolucion: null, resuelta: false, resultado: null,
    resoluciones: [], documentos: [], documentosMetadata: [], expedienteTtaip: { id: 41, numeroExpediente: code, sala: null, miembros: [], resoluciones: [], cedulas: [],
      notificaciones: [], historial: [], reprocesos: [], descargosEntidad: [], suspensionesPlazo: [], cumplimientosResolucion: [] }, ...patch });
  let http: HttpTestingController; let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); params = new BehaviorSubject(convertToParamMap({ expediente: code }));
    TestBed.configureTestingModule({ imports: [TtaipResolucionDetalleComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: TtaipActuacionesService, useValue: {
        actos: () => of([]),
        informacion: () => of({ solicitudes: [], puedeSolicitar: false, diasSuspendidos: 0 }),
        presentacionesAdmision: () => of({ descargo: null, presentaciones: [] }),
        cumplimientoDocumental: () => of({ cumplimiento: null }),
      } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params.value }, paramMap: params.asObservable() } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); } });
  function page(body = data()) {
    const f = TestBed.createComponent(TtaipResolucionDetalleComponent); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/' + code).flush(body); f.detectChanges();
    http.match(api + '/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion').forEach(r => r.flush({
      estado: 'RECIBIDA', expedienteTtaipId: 41, apelacionId: body.id, requerimientoId: 71, expediente: body.expediente,
      recepcionId: 111, fechaRecepcion: '2026-10-02T10:00:00', fundamentosAdicionales: 'Fundamentos registrados', documentos: [],
    }));
    f.detectChanges(); return f;
  }
  it('el número de expediente no se confunde con un ID de apelación ausente', () => { expect(page(data({ id: 0 })).componentInstance.apelacion()).toBeNull(); });
  it('rechaza un agregado perteneciente a otro código', () => { expect(page(data({ expedienteTtaip: { ...data().expedienteTtaip, numeroExpediente: 'AJENO' } })).componentInstance.apelacion()).toBeNull(); });
  it('no atribuye observaciones del Tribunal como causal ni fundamento de la entidad', () => {
    const view = page().componentInstance.dataView();
    expect(view.causalDenegatoria).not.toBe(first.decision); expect(view.fundamentoEntidad).not.toBe(first.observaciones);
    expect(view.dni).toBe('No informado'); expect(view.email).toBe('No informado'); expect(view.telefono).toBe('No informado');
    expect(view.causalDenegatoria).toBe('Denegatoria expresa'); expect(view.fundamentoEntidad).toBe('Respuesta registrada de la entidad');
  });
  it('muestra el DNI, el contacto y la causal registrados en la solicitud de origen', () => {
    const f = page(data({ tipoOrigen: 'SAIP_INTERNA', solicitudId: 8, solicitudExpediente: 'SAIP-2026-10008', tipoDenegatoria: null, resumenRespuestaEntidad: null }));
    const req = http.expectOne(api + '/solicitudes/8');
    req.flush({ id: 8, expediente: 'SAIP-2026-10008', ciudadanoId: 4, ciudadanoDni: '12345678', ciudadanoEmail: 'daniel@example.invalid', ciudadanoTelefono: '999111222',
      respuesta: { id: 3, solicitudId: 8, tipoRespuesta: 'DENEGACION_TOTAL', causalDenegatoria: 'reservada', contenido: 'La entidad reservó el extremo solicitado.', fundamentoLegal: 'Artículo 15 de la Ley 27806' } });
    f.detectChanges();
    const view = f.componentInstance.dataView();
    expect(view.dni).toBe('12345678'); expect(view.email).toBe('daniel@example.invalid'); expect(view.telefono).toBe('999111222');
    expect(view.causalDenegatoria).toBe('Información reservada');
    expect(view.fundamentoEntidad).toContain('reservó el extremo'); expect(view.fundamentoEntidad).toContain('Artículo 15');
    expect(view.causalDenegatoria).not.toBe(first.decision); expect(view.fundamentoEntidad).not.toContain(first.observaciones);
    expect(f.nativeElement.textContent).toContain('12345678');
    f.componentInstance.cambiarTab('subsanacion'); f.detectChanges();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('Este es el escrito de subsanación que presentó el administrado.');
    expect(texto).not.toContain('Verlos aquí no confirma');
  });
  it('marca cada archivo recibido como documento de subsanación', () => {
    const f = TestBed.createComponent(TtaipResolucionDetalleComponent); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/' + code).flush(data()); f.detectChanges();
    http.expectOne(api + '/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion').flush({
      estado: 'RECIBIDA', expedienteTtaipId: 41, apelacionId: 51, requerimientoId: 71, expediente: code,
      recepcionId: 111, fechaRecepcion: '2026-10-02T10:00:00', fundamentosAdicionales: 'Fundamentos registrados',
      documentos: [{ id: 15, nombreOriginal: 'anexo-subsanacion.pdf', tipoDocumento: 'SUBSANACION', contentType: 'application/pdf', apelacionId: 51, estado: 'ACTIVO' }],
    });
    f.detectChanges(); f.componentInstance.cambiarTab('subsanacion'); f.detectChanges();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('Documento de subsanación'); expect(texto).toContain('anexo-subsanacion.pdf');
  });
  it('la fecha histórica de requerimiento no crea una recepción de subsanación en el historial', () => { const c = page(data({ fechaSubsanacion: '2026-10-01' })).componentInstance; expect(c.timeline().some(t => t.titulo === 'Subsanación registrada')).toBe(false); });
  it('no usa la ausencia de estado para inventar EN_CALIFICACION_1', () => { expect(page(data({ estado: undefined })).componentInstance.estadoLabel()).not.toBe('En primera calificacion'); });
  it('cambiar ruta cancela la consulta anterior', () => {
    const f = TestBed.createComponent(TtaipResolucionDetalleComponent); f.detectChanges(); const old = http.expectOne(api + '/apelaciones/expediente/' + code);
    params.next(convertToParamMap({ expediente: 'OTRO' })); f.detectChanges(); http.match(api + '/apelaciones/expediente/OTRO').forEach(r => r.flush(data({ id: 52, expediente: 'OTRO', expedienteTtaip: null }))); expect(old.cancelled).toBe(true);
  });
  it('cambiar sesión limpia el expediente y consulta con la sesión nueva', () => {
    const f = page(); TestBed.inject(AuthService).guardarSesion({ ...session, token: 'otra-sesion', usuarioId: 8 }); f.detectChanges();
    http.match(api + '/apelaciones/expediente/' + code).forEach(r => r.flush(null, { status: 403, statusText: 'Forbidden' })); f.detectChanges(); expect(f.componentInstance.apelacion()).toBeNull();
  });
  it('destruir cancela la consulta', () => { const f = TestBed.createComponent(TtaipResolucionDetalleComponent); f.detectChanges(); const r = http.expectOne(api + '/apelaciones/expediente/' + code); f.destroy(); expect(r.cancelled).toBe(true); });
  it('una notificación que contradice el destinatario de su cédula no se presenta como parte del expediente', () => {
    const c = page(data({ expedienteTtaip: { ...data().expedienteTtaip, notificaciones: [{ id: 91, cedulaId: 61, destinatario: 'ENTIDAD_PUBLICA', estado: 'ENTREGADA' }],
      resoluciones: [{ id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE', cedulas: [{ id: 61, destinatario: 'CIUDADANO' }] }] } })).componentInstance;
    expect(c.notificacionesExpediente()).toEqual([]);
  });
  it('no permite registrar un acuse sobre un ID ajeno a las notificaciones consultadas', () => {
    const c = page().componentInstance; c.registrarAcuseNotificacion(999, 'ENTREGADO', 'Acuse sintético', 'Referencia', '2026-10-20T10:30');
    const writes = http.match(r => r.method === 'POST'); writes.forEach(r => r.flush(null, { status: 403, statusText: 'Forbidden' })); expect(writes).toHaveLength(0);
  });
  it('no abre cumplimiento con una fecha base que el contrato no acredita', () => {
    const r = { id: 101, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO', sala: { nombre: 'Sala sintética' } };
    const c = page(data({ resolucion: r, expedienteTtaip: { ...data().expedienteTtaip, resoluciones: [r] } })).componentInstance; c.crearSeguimientoCumplimiento('Texto');
    const writes = http.match(req => req.method === 'POST'); writes.forEach(req => req.flush(null, { status: 409, statusText: 'Conflict' })); expect(writes).toHaveLength(0);
  });
  it.each(['ttaip/apelacion/:expediente', 'ttaip/resolucion/:expediente', 'funcionario/apelaciones/:expediente'])('alias real %s conserva componente y guard configurados', async path => {
    const route = routes.find(r => r.path === path)!; expect(route.canActivate?.length).toBeGreaterThan(0);
    expect(await route.loadComponent!()).toBe(TtaipResolucionDetalleComponent);
  });
  it.each([400, 401, 403, 404, 500, 503])('consulta %i limpia el recurso y el borrador anteriores', status => {
    const f = page(); const c = f.componentInstance; c.verResolucion(); c.cargarApelacion('OTRO'); http.expectOne(api + '/apelaciones/expediente/OTRO').flush(null, { status, statusText: 'Synthetic failure' }); f.detectChanges();
    expect(c.apelacion()).toBeNull(); expect(c.previewModalDoc()).toBeNull(); expect(c.error()).not.toBe(''); expect(f.nativeElement.textContent).not.toContain('Persona sintética');
  });
  it('una consulta vacía no equivale a expediente encontrado y permite reintentar', () => {
    const f = page(); const c = f.componentInstance; c.cargarApelacion(code); http.expectOne(api + '/apelaciones/expediente/' + code).flush(null); expect(c.apelacion()).toBeNull();
    c.cargarApelacion(code); http.expectOne(api + '/apelaciones/expediente/' + code).flush(data()); expect(c.apelacion()?.id).toBe(51);
  });
  it('el alias de funcionario conserva entidad y retorno sin consultar recursos globales', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'FUNCIONARIO', entidadId: 3 }); const f = page(); expect(f.componentInstance.retorno()).toBe('/funcionario'); expect(f.componentInstance.rolInstitucional()).toBe(false);
    f.componentInstance.cargarApelacion(code); http.expectOne(api + '/apelaciones/expediente/' + code).flush(data({ entidadId: 99 })); expect(f.componentInstance.apelacion()).toBeNull(); expect(http.match(r => r.url === api + '/apelaciones')).toHaveLength(0);
  });
  it('desde actuaciones el funcionario vuelve a esa bandeja', () => {
    const route = TestBed.inject(ActivatedRoute) as { snapshot: { queryParamMap?: ReturnType<typeof convertToParamMap> } };
    route.snapshot.queryParamMap = convertToParamMap({ desde: 'actuaciones' });
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'FUNCIONARIO', entidadId: 3 });
    const f = page();
    expect(f.componentInstance.retorno()).toBe('/funcionario/tribunal');
    expect(f.nativeElement.textContent).toContain('Volver a actuaciones');
  });
  it('un parámetro numérico sigue siendo un código y no se reutiliza como ID de resolución', () => {
    const f = page(); f.componentInstance.cargarApelacion('101'); const req = http.expectOne(api + '/apelaciones/expediente/101'); req.flush(null, { status: 404, statusText: 'Not Found' }); expect(http.match(r => /\/resoluciones\/101/.test(r.url))).toHaveLength(0);
  });
  it('historial omitido se distingue de historial confirmado vacío y la línea muestra solo hitos registrados', () => {
    const f = page(data({ fechaSubsanacion: '2026-10-01', expedienteTtaip: { ...data().expedienteTtaip, historial: undefined } }));
    expect(f.componentInstance.detalle().historial.error).not.toBe('');
    expect(f.componentInstance.timeline().map(t => t.titulo)).toEqual(['1ra calificación · INADMISIBLE', 'Apelación presentada']);
    expect(f.componentInstance.timeline().some(t => t.titulo.startsWith('Subsanación'))).toBe(false);
  });
  it('un acuse del historial no sustituye los hitos del proceso ni usa la fecha de apertura', () => {
    const c = page(data({ fechaSubsanacion: '2026-10-01', expedienteTtaip: { ...data().expedienteTtaip, fechaApertura: '2026-01-01', historial: [{ id: 61, tipoEvento: 'ACUSE_NOTIFICACION_REGISTRADO', fechaEvento: '2026-10-03T12:00:00', descripcion: 'Acuse registrado', referencia: 'NOTIFICACION-91:ACUSE:ENTREGADO' }] } })).componentInstance;
    expect(c.historialExpediente()[0].id).toBe(61);
    expect(c.timeline().some(t => t.id === 61 || t.fecha.includes('03/10/2026') || t.fecha.includes('01/01/2026'))).toBe(false);
    expect(c.timeline().map(t => t.titulo)).toEqual(['1ra calificación · INADMISIBLE', 'Apelación presentada']);
  });
  it('una fecha de actuación ausente no se sustituye por hoy ni se llama pendiente', () => {
    const c = page(data({ resolucionPrimeraCalificacion: { ...first, fechaResolucion: null } })).componentInstance;
    expect(c.timeline().find(t => t.titulo.startsWith('1ra'))?.fecha).toBe('Fecha no informada');
  });
  const cedula = { id: 61, destinatario: 'CIUDADANO', numeroCedula: 'CÉDULA-61' };
  const notification = { id: 91, cedulaId: 61, destinatario: 'CIUDADANO', estado: 'PENDIENTE' };
  const notified = (n: Record<string, unknown> = notification, history: unknown[] = []) => data({ expedienteTtaip: { ...data().expedienteTtaip, resoluciones: [{ ...first, cedulas: [cedula] }], cedulas: [cedula], notificaciones: [n], historial: history } });
  it.each(['PENDIENTE', 'FALLIDA', 'OBSERVADA', 'ENTREGADA'])('el estado %s por sí solo no prueba eficacia', estado => {
    const c = page(notified({ ...notification, estado })).componentInstance; expect(c.eficaciaLabel(c.notificacionesExpediente()[0])).toContain('no acreditada');
  });
  it('distingue acuse acreditado de envío técnico aunque conserve una traza antigua', () => {
    const n = { ...notification, estado: 'ENTREGADA', estadoAcuse: 'ENTREGADO', fechaAcuse: '2026-10-02T10:00:00', acuseAutomatico: 'Acuse sintético', resultadoNotificacion: 'ENTREGADA_POR_MOCK' };
    const c = page(notified(n, [{ id: 61, tipoEvento: 'ACUSE_NOTIFICACION_REGISTRADO', referencia: 'NOTIFICACION-91:ACUSE:ENTREGADO' }])).componentInstance; expect(c.eficaciaLabel(c.notificacionesExpediente()[0])).toContain('no acreditada');
  });
  it('una evidencia con su traza y destinatario se muestra consultada sin afirmar firma', () => {
    const n = { ...notification, estado: 'ENTREGADA', estadoAcuse: 'ENTREGADO', fechaAcuse: '2026-10-02T10:00:00', acuseAutomatico: 'Acuse sintético' };
    const c = page(notified(n, [{ id: 61, tipoEvento: 'ACUSE_NOTIFICACION_REGISTRADO', referencia: 'NOTIFICACION-91:ACUSE:ENTREGADO' }])).componentInstance; expect(c.eficaciaLabel(c.notificacionesExpediente()[0])).toBe('Evidencia de eficacia consultada');
  });
  it('un estado FUNDADO sin resolución identificada no crea una resolución final', () => {
    const c = page(data({ estado: 'RESUELTO_FUNDADO', resultado: 'FUNDADO' })).componentInstance; expect(c.mostrarCajaResultado()).toBe(false); expect(c.resolucionFinalFundada()).toBeNull();
  });
  it('una resolución con resultado NULIDAD_DEL_ACTO muestra caja de resultado de nulidad', () => {
    const resFinal = { id: 77, tipoResolucion: 'RESOLUCION_FINAL', decision: 'NULIDAD_DEL_ACTO', fundamentos: 'Vicio en motivación' };
    const c = page(data({
      estado: 'RESUELTO_NULIDAD_ACTO',
      resultado: 'NULIDAD_DEL_ACTO',
      resolucion: resFinal,
      resoluciones: [resFinal]
    })).componentInstance;
    expect(c.mostrarCajaResultado()).toBe(true);
    expect(c.resultadoCajaLabel()).toBe('NULIDAD DEL ACTO APELADO');
    expect(c.resultadoCajaColor()).toBe('var(--warning)');
  });
  it('un descargo de otra apelación no se ofrece como activo ni permite presentación', () => {
    const c = page(data({ expedienteTtaip: { ...data().expedienteTtaip, descargosEntidad: [{ id: 81, expedienteTtaipId: 41, apelacionId: 999, entidadId: 3, numeroExpediente: code, estadoDescargo: 'REQUERIDO' }] } })).componentInstance;
    expect(c.descargoActivo()).toBeNull(); expect(c.detalle().descargosEntidad.error).not.toBe('');
  });
  it('varios descargos requeridos no se seleccionan por posición y no abren otro', () => {
    const d = { expedienteTtaipId: 41, apelacionId: 51, entidadId: 3, numeroExpediente: code, estadoDescargo: 'REQUERIDO' };
    const c = page(data({ estado: 'EN_RESOLUCION', expedienteTtaip: { ...data().expedienteTtaip, descargosEntidad: [{ ...d, id: 81 }, { ...d, id: 82 }] } })).componentInstance;
    expect(c.descargoActivo()).toBeNull(); c.requerirDescargos('Sustento'); expect(http.match(r => r.method === 'POST')).toHaveLength(0);
  });
  it('un acuse se confirma únicamente al recuperar el mismo registro del recurso', () => {
    const c = page(notified()).componentInstance; c.registrarAcuseNotificacion(91, 'ENTREGADO', 'Acuse sintético', 'REF-1', '2026-10-20T10:30');
    const req = http.expectOne(api + '/ttaip/expedientes/41/notificaciones/91/acuse-automatico'); expect(req.request.body.fechaAcuse).toBe('2026-10-20T10:30:00');
    const n = { ...notification, estado: 'ENTREGADA', estadoAcuse: 'ENTREGADO', acuseAutomatico: 'Acuse sintético', fechaAcuse: '2026-10-20T10:30:00' }; req.flush(n); expect(c.notificacionMessage()).toBe('');
    http.expectOne(api + '/apelaciones/expediente/' + code).flush(notified(n)); expect(c.notificacionMessage()).toContain('Actuación registrada y recuperada'); expect(c.notificacionMessage()).toContain('No acredita'); expect(c.notificacionMessage()).not.toContain('ID 91');
  });
  it('un resultado incierto impide otro POST aunque el GET observe la misma notificación', () => {
    const c = page(notified()).componentInstance; c.registrarAcuseNotificacion(91, 'ENTREGADO', 'Acuse sintético', '', '2026-10-20T10:30'); http.expectOne(r => r.method === 'POST').error(new ProgressEvent('error'));
    c.registrarAcuseNotificacion(91, 'ENTREGADO', 'Acuse sintético', '', '2026-10-20T10:30'); expect(http.match(r => r.method === 'POST')).toHaveLength(0);
    c.recuperarActuacion(); http.expectOne(api + '/apelaciones/expediente/' + code).flush(notified()); expect(c.notificacionMessage()).toBe(''); expect(c.actionUncertain()).toBe(true);
  });
  it('reintentar recuperación con ID conocido no repite el registro de evidencia', () => {
    const c = page(notified()).componentInstance; c.validarNotificacionManual(91, 'Sustento explícito', '', '2026-10-20T09:30'); const n = { ...notification, estado: 'VALIDADA', observacionValidacion: 'Sustento explícito' };
    http.expectOne(r => r.method === 'POST').flush({ ...n, validadaManualmente: true }); http.expectOne(api + '/apelaciones/expediente/' + code).flush(null, { status: 500, statusText: 'Unavailable' }); expect(c.apelacion()).toBeNull();
    c.recuperarActuacion(); http.expectOne(api + '/apelaciones/expediente/' + code).flush(notified({ ...n, validadaManualmente: true })); expect(c.actionUncertain()).toBe(false); expect(c.notificacionMessage()).toContain('Actuación registrada y recuperada'); expect(c.notificacionMessage()).not.toContain('ID 91'); expect(http.match(r => r.method === 'POST')).toHaveLength(0);
  });
  it('cambiar ruta con un comando pendiente cancela y no recupera ni confirma en otro expediente', () => {
    const f = page(notified()); const c = f.componentInstance; c.validarNotificacionManual(91, 'Sustento', '', '2026-10-20T09:30'); const req = http.expectOne(r => r.method === 'POST');
    params.next(convertToParamMap({ expediente: 'OTRO' })); f.detectChanges(); http.expectOne(api + '/apelaciones/expediente/OTRO').flush(null, { status: 404, statusText: 'Not Found' }); expect(req.cancelled).toBe(true); expect(c.notificacionMessage()).toBe(''); expect(c.previewModalDoc()).toBeNull();
  });
  it('las pestañas tienen panel asociado y recorrido de teclado sin escrituras', () => {
    const f = page(); const tab = f.nativeElement.querySelector('#detail-tab-apelacion') as HTMLButtonElement; tab.focus(); tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); f.detectChanges();
    const next = f.nativeElement.querySelector('#detail-tab-subsanacion') as HTMLButtonElement; expect(document.activeElement).toBe(next); expect(next.getAttribute('aria-selected')).toBe('true'); expect(f.nativeElement.querySelector('#detail-panel-subsanacion')).not.toBeNull(); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it('el Tribunal recibe los escritos en su propia pestaña del expediente', () => {
    const f = page(data({ estado: 'EN_RESOLUCION' }));
    const tab = f.nativeElement.querySelector('#detail-tab-requerimientos') as HTMLButtonElement;
    expect(tab.textContent).toContain('Requerimientos del administrado');
    const actuaciones = TestBed.inject(TtaipActuacionesService);
    const basePresentacion: Omit<PresentacionAdmision, 'id' | 'tipo'> = {
      origen: 'CIUDADANO', operacion: 'operación-sintética', texto: null, numeroOficio: null,
      fechaPresentacion: '2026-11-21T10:30:00', aceptada: null, fechaRespuesta: null,
      operacionRespuesta: null, documentos: [], respuesta: null,
    };
    vi.spyOn(actuaciones, 'presentacionesAdmision').mockReturnValue(of<ConsultaAdmision>({
      puedePresentarSolicitudes: false, puedeResponderInformeOral: true, fechaLimiteResolucion: null, descargo: null,
      presentaciones: [
        { ...basePresentacion, id: 2, tipo: 'INFORME_ORAL', origen: 'CIUDADANO', texto: 'Motivo de la audiencia', documentos: [] },
        { ...basePresentacion, id: 3, tipo: 'DOCUMENTACION_ADICIONAL', origen: 'ENTIDAD_PUBLICA', numeroOficio: 'OF-01',
          documentos: [{ id: 11, nombreOriginal: 'sustento.pdf' }] },
      ],
    }));
    vi.spyOn(actuaciones, 'informacion').mockReturnValue(of<InformacionComplementaria>({ etapa: 'RESOLUCION_FINAL', entidad: 'Entidad sintética', puedeSolicitar: false, fechaLimiteCalificacion: null, diasSuspendidos: 0, solicitudes: [] }));
    tab.click();
    f.detectChanges();
    const panel = f.nativeElement.querySelector('#detail-panel-requerimientos') as HTMLElement;
    expect(panel.textContent).toContain('Motivo de la audiencia');
    expect(panel.textContent).toContain('Responder solicitud');
    expect(panel.textContent).toContain('OF-01');
    expect(panel.querySelector('[aria-label="Previsualizar sustento.pdf"]')).not.toBeNull();
  });

  it('una sesión ilegible no deja datos anteriores ni inicia una consulta privada', () => {
    localStorage.setItem('usuario', '{'); const f = TestBed.createComponent(TtaipResolucionDetalleComponent); expect(() => f.detectChanges()).not.toThrow(); expect(f.componentInstance.apelacion()).toBeNull(); expect(http.match(() => true)).toHaveLength(0);
  });
  it('un 200 sin el acuse solicitado no confirma una actuación', () => {
    const c = page(notified()).componentInstance; c.registrarAcuseNotificacion(91, 'ENTREGADO', 'Acuse nuevo', '', '2026-10-20T10:30'); http.expectOne(r => r.method === 'POST').flush(notification);
    expect(c.notificacionMessage()).toBe(''); expect(c.actionUncertain()).toBe(true); expect(http.match(() => true)).toHaveLength(0);
  });
  it('la recuperación de otro contenido no atribuye ni confirma el acuse', () => {
    const c = page(notified()).componentInstance; c.registrarAcuseNotificacion(91, 'ENTREGADO', 'Acuse nuevo', '', '2026-10-20T10:30');
    const n = { ...notification, estadoAcuse: 'ENTREGADO', acuseAutomatico: 'Acuse nuevo', fechaAcuse: '2026-10-20T10:30' }; http.expectOne(r => r.method === 'POST').flush(n);
    http.expectOne(api + '/apelaciones/expediente/' + code).flush(notified({ ...n, acuseAutomatico: 'Otra operación' })); expect(c.notificacionMessage()).toBe(''); expect(c.actionUncertain()).toBe(true);
  });
  it('una decisión final no inventa fundamentos, orden de entrega ni inicio de plazo', () => {
    const r = { id: 101, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO_EN_PARTE', cedulas: [] };
    const f = page(data({ resolucion: r }));
    expect(f.componentInstance.resultadoCajaDetalle()).toContain('no sus fundamentos');
    expect(f.componentInstance.resultadoCajaDetalle()).not.toContain('Se ordena');
    f.componentInstance.cambiarTab('subprocesos'); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Pendiente de admisión');
  });
  it('las colecciones omitidas muestran información incompleta sin afirmar ausencia de actuaciones', () => {
    const f = page(data({ expedienteTtaip: { ...data().expedienteTtaip, descargosEntidad: undefined, cumplimientosResolucion: undefined } }));
    f.componentInstance.cambiarTab('subprocesos'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Información incompleta');
    expect(f.nativeElement.textContent).not.toContain('Aún no hay requerimientos');
    expect(f.nativeElement.textContent).not.toContain('Aún no hay seguimientos');
  });
  it('las cédulas incompatibles no reaparecen desde el array crudo de la resolución ni consultan archivos', () => {
    const r = { ...first, cedulas: [{ id: 61, destinatario: 'CIUDADANO' }] };
    const f = page(data({ resolucionPrimeraCalificacion: r, expedienteTtaip: { ...data().expedienteTtaip, cedulas: [{ id: 61, destinatario: 'ENTIDAD_PUBLICA' }] } }));
    f.componentInstance.cambiarTab('notificaciones'); f.detectChanges();
    expect(f.componentInstance.cedulasDeResolucion(71)).toEqual([]);
    expect(f.nativeElement.querySelector('[data-testid="ttaip-cedula-documents"]')).toBeNull();
    const queries = http.match(req => req.url === api + '/documentos');
    expect(queries.some(req => req.request.params.has('cedulaNotificacionId'))).toBe(false);
    queries.forEach(req => req.flush([]));
  });
  it('agrupa el expediente por etapa y no ofrece adjuntar archivos sueltos', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); f.detectChanges();
    const requests = http.match(req => req.url === api + '/documentos');
    expect(requests.flatMap(req => req.request.params.keys()).sort()).toEqual(['apelacionId', 'expedienteTtaipId', 'resolucionId']);
    requests.find(req => req.request.params.get('apelacionId') === '51')!.flush([{ id: 9, nombreOriginal: 'escrito.pdf', tipoDocumento: 'SUBSANACION', contentType: 'application/pdf', fechaCreacion: '2026-11-24T13:10:00', apelacionId: 51, estado: 'ACTIVO' }]);
    requests.find(req => req.request.params.get('resolucionId') === '71')!.flush([{ id: 11, nombreOriginal: 'primera.pdf', tipoDocumento: 'RESOLUCION_TTAIP', contentType: 'application/pdf', fechaCreacion: '2026-11-20', resolucionId: 71, estado: 'ACTIVO' }]);
    requests.find(req => req.request.params.get('expedienteTtaipId') === '41')!.flush([{ id: 10, nombreOriginal: 'cedula.pdf', tipoDocumento: 'CEDULA_NOTIFICACION', contentType: 'application/pdf', fechaCreacion: '2026-11-24', expedienteTtaipId: 41, estado: 'ACTIVO' }]);
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('Subsanación'); expect(text).toContain('Resoluciones del Tribunal'); expect(text).toContain('Notificaciones y cargos');
    expect(text).toContain('Cédula'); expect(text).not.toContain('Adjuntar documento');
    expect(text).toContain('Las cédulas no aparecen en este legajo');
  });
  it('la entidad no consulta la inadmisibilidad ni el legajo cuando las cédulas no están vinculadas', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'FUNCIONARIO', entidadId: 3, funcionarioId: 9 });
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); f.detectChanges();
    const requests = http.match(req => req.url === api + '/documentos');
    expect(requests.map(req => req.request.params.keys()[0])).toEqual(['apelacionId']);
    requests[0].flush([]); f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('notificó a su entidad'); expect(text).not.toContain('No tiene permiso');
  });
  it('la entidad solo consulta lo presentado por el administrado y lo notificado a ella', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'FUNCIONARIO', entidadId: 3, funcionarioId: 9 });
    const entidad = { id: 61, destinatario: 'ENTIDAD_PUBLICA' };
    const ciudadano = { id: 62, destinatario: 'CIUDADANO' };
    const f = page(data({
      resolucionPrimeraCalificacion: { ...first, cedulas: [ciudadano] },
      resolucion: { id: 80, tipoResolucion: 'RESOLUCION_FINAL', decision: 'FUNDADO', cedulas: [entidad] },
      expedienteTtaip: { ...data().expedienteTtaip, cedulas: [entidad, ciudadano], notificaciones: [] },
    }));
    f.componentInstance.cambiarTab('adjuntos'); f.detectChanges();
    const requests = http.match(req => req.url === api + '/documentos');
    const claves = requests.map(req => { const key = req.request.params.keys()[0]; return key + '=' + req.request.params.get(key); }).sort();
    expect(claves).toEqual(['apelacionId=51', 'cedulaNotificacionId=61', 'resolucionId=80']);
    requests.find(req => req.request.params.get('apelacionId') === '51')!.flush([{ id: 9, nombreOriginal: 'recurso-administrado.pdf', tipoDocumento: 'RECURSO_APELACION', contentType: 'application/pdf', fechaCreacion: '2026-11-24', apelacionId: 51, estado: 'ACTIVO' }]);
    requests.find(req => req.request.params.get('resolucionId') === '80')!.flush([{ id: 11, nombreOriginal: 'resolucion-entidad.pdf', tipoDocumento: 'RESOLUCION_TTAIP', contentType: 'application/pdf', fechaCreacion: '2026-11-25', resolucionId: 80, estado: 'ACTIVO' }]);
    requests.find(req => req.request.params.get('cedulaNotificacionId') === '61')!.flush([{ id: 12, nombreOriginal: 'cedula-entidad.pdf', tipoDocumento: 'CEDULA_NOTIFICACION', contentType: 'application/pdf', fechaCreacion: '2026-11-25', cedulaNotificacionId: 61, estado: 'ACTIVO' }]);
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('recurso-administrado.pdf'); expect(text).toContain('resolucion-entidad.pdf'); expect(text).toContain('cedula-entidad.pdf');
    expect(text).toContain('No aparecen documentos de otras entidades'); expect(text).not.toContain('No tiene permiso');
  });
  it('la suspensión requiere un responsable explícito sin atribución institucional predeterminada', () => {
    const f = page(data({ estado: 'EN_RESOLUCION' })); f.componentInstance.cambiarTab('subprocesos'); f.detectChanges();
    f.componentInstance.registrarSuspensionAdicional('INFORME_ORAL', 'CIUDADANO', 'Motivo explícito', '', '');
    expect(http.match(r => r.method === 'POST')).toHaveLength(0);
    expect(f.componentInstance.descargoError()).toContain('responsable');
  });
});
