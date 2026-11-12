import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, map } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NuevaApelacionComponent } from './nueva-apelacion.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('AppealForm — origen, documentos y registro autorizado', () => {
  const base = environment.apiUrl, expediente = 'SAIP-2026-00023';
  const original = { id: 88, solicitudId: 23, tipoDocumento: 'SOLICITUD_ORIGINAL', estado: 'ACTIVO',
    nombreOriginal: 'original.pdf', sizeBytes: 8, contentType: 'application/pdf', hashSha256: 'c'.repeat(64) };
  const respuestaDoc = { ...original, id: 89, solicitudId: null, respuestaId: 91, tipoDocumento: 'RESPUESTA_ENTIDAD', nombreOriginal: 'respuesta.pdf' };
  const solicitud = { id: 23, expediente, ciudadanoId: 5, entidadId: 3, entidadNombre: 'Entidad sintética',
    asunto: 'Pedido sintético', estado: 'DENEGADA', apelacion: null, documentosMetadata: [original],
    respuesta: { id: 91, solicitudId: 23, tipoRespuesta: 'DENEGACION_TOTAL', documentosMetadata: [respuestaDoc] } };
  const creada = { id: 145, expediente: '00145-2026-JUS/TTAIP', ciudadanoId: 5, entidadId: 3, solicitudId: 23,
    solicitudExpediente: expediente, tipoOrigen: 'SAIP_INTERNA', estado: 'EN_CALIFICACION_1',
    fundamentos: 'Fundamentos sintéticos para la revisión del recurso por el Tribunal.' };
  let http: HttpTestingController, auth: AuthService;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<Record<string, string>>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    params = new BehaviorSubject(convertToParamMap({ expediente })); query = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({ imports: [NuevaApelacionComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params, queryParams: query,
        queryParamMap: query.pipe(map(q => convertToParamMap(q))), snapshot: { paramMap: params.value } } }] });
    http = TestBed.inject(HttpTestingController); auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'sesion-sintetica', usuarioId: 5, ciudadanoId: 5, tipoUsuario: 'CIUDADANO' });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sintetico'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });
  afterEach(() => {
    try { http.verify({ ignoreCancelled: true }); }
    finally { TestBed.resetTestingModule(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); }
  });
  function pagina() { const f = TestBed.createComponent(NuevaApelacionComponent); f.detectChanges();
    http.expectOne(`${base}/entidades/activas`).flush([{ id: 3, nombre: 'Entidad sintética' }]); return f; }
  function preparar(data: Record<string, unknown> = solicitud) {
    const f = pagina(); http.expectOne(`${base}/solicitudes/expediente/${expediente}`).flush(data);
    f.componentInstance.file3.set(new File(['recurso'], 'recurso.txt', { type: 'text/plain' }));
    f.componentInstance.fundamentos = creada.fundamentos; return f;
  }
  function escriturasDocumentales() { return http.match(r => r.method === 'POST' && r.url.startsWith(`${base}/documentos`)); }
  it('envía alta y documentos en una única operación coordinada antes de confirmar', () => {
    const f = preparar(); f.componentInstance.crearApelacion();
    const req = http.expectOne(`${base}/apelaciones/recepciones`);
    expect(req.request.body instanceof FormData).toBe(true);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('rechaza una SAIP distinta de la identificada en la ruta', () => {
    const f = preparar({ ...solicitud, id: 999, expediente: 'SAIP-2026-00999' }); expect(f.componentInstance.solicitud()).toBeNull();
  });
  it('descarta una SAIP tardía después de pasar a origen externo', () => {
    const f = pagina(); const req = http.expectOne(`${base}/solicitudes/expediente/${expediente}`);
    f.componentInstance.iniciarApelacionExterna(); http.expectOne(`${base}/entidades/activas`).flush([{ id: 3, nombre: 'Entidad sintética' }]); if (!req.cancelled) req.flush(solicitud);
    expect(f.componentInstance.solicitud()).toBeNull(); expect(f.componentInstance.doc1Auto()).toBeNull();
  });
  it('un documento relacionado con otra SAIP no se considera antecedente propio', () => {
    const f = preparar({ ...solicitud, documentosMetadata: [{ ...original, solicitudId: 999 }] }); expect(f.componentInstance.doc1Auto()).toBeNull();
  });
  it('una descarga fallida no entrega un PDF canónico sustituto', () => {
    const f = preparar(); f.componentInstance.downloadFile(1);
    http.expectOne(`${base}/documentos/88/download`).flush(null, { status: 500, statusText: 'Error' });
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it('impide dos creaciones concurrentes del mismo formulario', () => {
    const f = preparar(); f.componentInstance.crearApelacion(); f.componentInstance.crearApelacion();
    const reqs = http.match(`${base}/apelaciones/recepciones`); expect(reqs).toHaveLength(1);
  });
  it('un rechazo documental de la operación no confirma ni conserva un alta parcial', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion();
    http.expectOne(`${base}/apelaciones/recepciones`).flush(null, { status: 400, statusText: 'Rejected' });
    expect(c.successModalAbierto()).toBe(false); expect(c.expedienteTtaip()).toBe(''); expect(c.apelacionCreada()).toBeNull();
    expect(c.file3()).not.toBeNull(); expect(c.fundamentos).toBe(creada.fundamentos); expect(escriturasDocumentales()).toEqual([]);
  });
  it('una recepción incompatible no confirma ni inicia escrituras documentales', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); http.expectOne(`${base}/apelaciones/recepciones`).flush(resultado(c, { ...creada, solicitudId: 999 }));
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.apelacionCreada()).toBeNull(); expect(escriturasDocumentales()).toEqual([]);
  });
  it('no inicia subidas o clones después de destruir el componente', () => {
    const f = preparar(); f.componentInstance.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`); f.destroy();
    if (!req.cancelled) req.flush(creada); const docs = escriturasDocumentales(); docs.forEach(r => r.flush(null, { status: 500, statusText: 'Error' })); expect(docs).toHaveLength(0);
  });
  it('no acredita la fecha de presentación ante entidad mediante la fecha actual prellenada', () => {
    const f = preparar(); expect(f.componentInstance.fechaPresentacionAnteEntidad).toBe('');
  });
  function catalogo() { http.expectOne(`${base}/entidades/activas`).flush([{ id: 3, nombre: 'Entidad sintética' }]); }
  function externa() {
    const f = preparar(), c = f.componentInstance; c.iniciarApelacionExterna(); catalogo(); c.cambiarEntidad('declarada');
    c.entidadExternaNombre = 'Entidad declarada sintética'; c.numeroSolicitudExterna = 'EXT-23';
    c.fechaPresentacionSolicitudExterna = '2026-10-01'; c.resumenSolicitudOriginal = 'Pedido original declarado';
    c.referenciaDocumentoSolicitud = 'Cargo sintético 23'; c.fechaRespuestaEntidad = '2026-10-10';
    c.resumenRespuestaEntidad = 'Denegatoria declarada'; c.fundamentos = 'Solicito revisión.'; return f;
  }
  function resultadoExterno(datos: Record<string, unknown>) {
    return { ...creada, ...datos, tipoOrigen: 'EXTERNA', solicitudId: null, solicitudExpediente: null, entidadId: datos['entidadId'] ?? null };
  }
  function resultado(c: NuevaApelacionComponent, apelacion: Record<string, unknown> = creada) {
    return { id: 701, claveOperacion: c.claveOperacion(), modalidad: c.esApelacionExterna() ? 'EXTERNA' : c.esPresentacionAnteEntidad() ? 'ANTE_ENTIDAD' : 'DIRECTA_TTAIP',
      fechaRecepcion: '2026-10-28T12:30:00', apelacion, documentos: c.documentosEnviados().map((d, n) => ({ origenId: d.origen?.id ?? null,
        hashAceptado: d.origen?.hashSha256 ?? 'd'.repeat(64), documento: { ...d.origen, id: 188 + n, solicitudId: null, respuestaId: null,
          apelacionId: apelacion['id'], tipoDocumento: d.tipo, nombreOriginal: d.file?.name ?? d.origen?.nombreOriginal,
          sizeBytes: d.file?.size ?? d.origen?.sizeBytes, contentType: d.file?.type ?? d.origen?.contentType,
          hashSha256: d.origen?.hashSha256 ?? 'd'.repeat(64), estado: 'ACTIVO' } })) };
  }
  async function payload(req: ReturnType<HttpTestingController['expectOne']>): Promise<Record<string, unknown>> {
    const blob = (req.request.body as FormData).get('datos') as Blob;
    return JSON.parse(await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); }));
  }
  function confirmar(c: NuevaApelacionComponent, apelacion: Record<string, unknown> = creada) {
    const r = resultado(c, apelacion); http.expectOne(`${base}/apelaciones/recepciones`).flush(r);
    expect(c.successModalAbierto()).toBe(false); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r); return r;
  }
  it('una vinculada pide copias por IDs y versiones sin imponer 50 caracteres ni un tercer archivo', async () => {
    const f = preparar(), c = f.componentInstance; c.file3.set(null); c.fundamentos = 'Solicito revisión.';
    expect(c.puedeEnviar()).toBe(true); c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-sintetica');
    expect(datos).toMatchObject({ modalidad: 'DIRECTA_TTAIP', solicitudId: 23, fundamentos: 'Solicito revisión.',
      documentos: [{ tipoDocumento: 'SOLICITUD_ORIGINAL', origenId: 88, hashOrigen: 'c'.repeat(64) }, { tipoDocumento: 'RESPUESTA_ENTIDAD', origenId: 89, hashOrigen: 'c'.repeat(64) }] });
    expect(datos['ciudadanoId']).toBeUndefined(); expect((req.request.body as FormData).getAll('archivos')).toHaveLength(0);
    const r = resultado(c, { ...creada, fundamentos: c.fundamentos }); req.flush(r); expect(c.successModalAbierto()).toBe(false);
    http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r);
    expect(c.successModalAbierto()).toBe(true); expect(c.documentosEnviados().map(d => d.documento?.id)).toEqual([188, 189]); expect(escriturasDocumentales()).toEqual([]);
  });
  it('un reemplazo seleccionado tiene prioridad y envía todos los bytes junto al manifiesto', async () => {
    const f = preparar(), c = f.componentInstance, file = new File(['reemplazo real'], 'reemplazo.txt', { type: 'text/plain' });
    c.file1.set(file); c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req);
    expect(datos['documentos']).toEqual([{ tipoDocumento: 'SOLICITUD_ORIGINAL' }, { tipoDocumento: 'RESPUESTA_ENTIDAD', origenId: 89, hashOrigen: 'c'.repeat(64) }, { tipoDocumento: 'RECURSO_APELACION' }]);
    const files = (req.request.body as FormData).getAll('archivos') as File[]; expect(files.map(f => f.name)).toEqual(['reemplazo.txt', 'recurso.txt']);
    const bytes = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(files[0]); }); expect(bytes).toBe('reemplazo real');
    const r = resultado(c); req.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r);
    expect(c.documentosEnviados().map(d => d.documento?.id)).toEqual([188, 189, 190]); expect(escriturasDocumentales()).toEqual([]);
  });
  it('el registro de datos SAIP sin archivo no se transforma en un PDF antecedente', () => {
    const f = preparar({ ...solicitud, documentosMetadata: [] }), c = f.componentInstance;
    c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); expect(c.doc1Auto()).toBeNull(); expect(c.errores()['documentos']).toContain('copia real');
  });
  it('una SAIP sin respuesta permite sustento adicional sin fabricar documento de respuesta', () => {
    const f = preparar({ ...solicitud, respuesta: null, estado: 'VENCIDA' }), c = f.componentInstance; c.file3.set(null);
    c.crearApelacion(); confirmar(c); expect(c.successModalAbierto()).toBe(true); expect(c.doc2Auto()).toBeNull(); expect(c.documentosConsultados()).toHaveLength(1);
  });
  it('la modalidad ante entidad conserva su cargo y fecha declarada sin abrir ingreso directo', async () => {
    const f = preparar(), c = f.componentInstance; c.file3.set(null); c.cambiarCanal('ANTE_ENTIDAD'); c.fechaPresentacionAnteEntidad = '2026-10-15'; c.referenciaCargoPresentacionEntidad = 'Cargo real sintético';
    c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req);
    expect(datos).toMatchObject({ modalidad: 'ANTE_ENTIDAD', fechaPresentacionAnteEntidad: '2026-10-15', referenciaCargoPresentacion: 'Cargo real sintético' });
    const r = resultado(c, { ...creada, estado: 'PENDIENTE_ELEVACION', elevacion: { id: 77, apelacionId: 145, fechaPresentacionAnteEntidad: '2026-10-15', referenciaCargoPresentacion: 'Cargo real sintético' } });
    req.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r); expect(c.apelacionCreada()?.estado).toBe('PENDIENTE_ELEVACION'); expect(escriturasDocumentales()).toEqual([]);
  });
  it('no envía ante entidad sin fecha/cargo ni acepta un fundamento externo que excede el DTO', () => {
    const f = preparar(), c = f.componentInstance; c.cambiarCanal('ANTE_ENTIDAD'); c.crearApelacion();
    expect(c.errores()['cargo']).toBeTruthy(); http.expectNone(`${base}/apelaciones/recepciones`);
    c.fechaPresentacionAnteEntidad = '2026-10-15'; c.referenciaCargoPresentacionEntidad = 'Cargo'; c.fundamentos = 'x'.repeat(5001);
    c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); expect(c.errores()['fundamentos']).toBeTruthy();
  });
  it('una externa declarada conserva referencias sin crear SAIP ni asociación institucional', async () => {
    const f = externa(), c = f.componentInstance; c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req);
    expect(datos['solicitudId']).toBeUndefined(); expect(datos['entidadId']).toBeUndefined(); expect(datos['ciudadanoId']).toBeUndefined();
    expect(datos['entidadExternaNombre']).toBe('Entidad declarada sintética'); expect(datos['referenciaDocumentoSolicitud']).toBe('Cargo sintético 23');
    const r = resultado(c, resultadoExterno(datos)); req.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r);
    expect(c.successModalAbierto()).toBe(true); expect(c.solicitud()).toBeNull(); expect(c.documentosEnviados()).toEqual([]); http.expectNone(`${base}/solicitudes`); expect(escriturasDocumentales()).toEqual([]);
  });
  it('una externa catalogada usa el ID del servidor y omite datos declarados residuales', async () => {
    const f = externa(), c = f.componentInstance; c.cambiarEntidad('catalogo'); c.entidadExternaId = 3; c.entidadExternaNombre = 'Texto residual';
    c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req);
    expect(datos['entidadId']).toBe(3); expect(datos['entidadExternaNombre']).toBeUndefined(); const r = resultado(c, resultadoExterno(datos));
    req.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r); expect(c.apelacionCreada()?.entidadId).toBe(3);
  });
  it('denegatoria tácita exige declaración real y limpia datos y archivo de expresa', async () => {
    const f = externa(), c = f.componentInstance; c.file2.set(new File(['x'], 'respuesta.txt', { type: 'text/plain' })); c.cambiarDenegatoria('TACITA');
    expect(c.fechaRespuestaEntidad).toBe(''); expect(c.file2()).toBeNull(); c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`);
    c.evidenciaSilencioAdministrativo = 'Declaro ausencia de respuesta según mis antecedentes.'; c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req);
    expect(datos['tipoDenegatoria']).toBe('TACITA'); expect(datos['fechaRespuestaEntidad']).toBeUndefined(); expect(datos['referenciaRespuestaEntidad']).toBeUndefined();
    const r = resultado(c, resultadoExterno(datos)); req.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r); expect(c.successModalAbierto()).toBe(true);
  });
  it('una externa expresa no reemplaza una referencia requerida por el nombre de un archivo', () => {
    const f = externa(), c = f.componentInstance; c.file1.set(new File(['x'], 'nombre-no-es-referencia.txt', { type: 'text/plain' })); c.referenciaDocumentoSolicitud = '';
    c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); expect(c.errores()['externa']).toBeTruthy();
    c.referenciaDocumentoSolicitud = 'Referencia declarada'; c.resumenRespuestaEntidad = ''; c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`);
    expect(c.errores()['respuesta']).toContain('resumen o referencia');
  });
  it.each([400, 401, 403, 404, 422])('el rechazo %s conserva el formulario sin confirmar ni divulgar detalles internos', status => {
    const f = externa(), c = f.componentInstance; c.crearApelacion(); http.expectOne(`${base}/apelaciones/recepciones`).flush({ detail: 'Detalle privado sintético' }, { status, statusText: 'Rejected' });
    expect(c.estadoEnvio()).toBe('rechazada'); expect(c.successModalAbierto()).toBe(false); expect(c.fundamentos).toBe('Solicito revisión.');
    expect(c.error()).not.toContain('Detalle privado'); expect(c.bloqueado()).toBe(false);
  });
  it.each([0, 500, 503])('la creación incierta %s no se repite ni se recupera por coincidencias de número o asunto', status => {
    const f = externa(), c = f.componentInstance; c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`);
    if (status) req.flush(null, { status, statusText: 'Error' }); else req.error(new ProgressEvent('error'));
    c.crearApelacion(); c.comprobarRegistro(); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(null, { status: 503, statusText: 'Unavailable' }); expect(c.estadoEnvio()).toBe('incierta'); expect(c.bloqueado()).toBe(true);
    http.expectNone(r => r.url.startsWith(`${base}/apelaciones/recepciones`)); expect(c.apelacionCreada()).toBeNull();
  });
  it.each([400, 401, 403, 404, 500, 0])('la consulta fallida %s no conserva la SAIP anterior ni crea un expediente alternativo', status => {
    const f = preparar(), c = f.componentInstance; params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' })); catalogo();
    const req = http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`);
    if (status) req.flush(null, { status, statusText: 'Error' }); else req.error(new ProgressEvent('error'));
    f.detectChanges(); expect(c.solicitud()).toBeNull(); expect(c.doc1Auto()).toBeNull(); expect(c.file3()).toBeNull();
    expect(c.errorConsulta()).toBeTruthy(); expect(c.estadoConsulta()).not.toBe('vacio');
    expect(f.nativeElement.textContent).not.toContain('Pedido sintético'); c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`);
  });
  it('distingue respuesta vacía de datos incompletos y rechaza otro titular', () => {
    const f = pagina(), c = f.componentInstance; http.expectOne(`${base}/solicitudes/expediente/${expediente}`).flush(null);
    expect(c.estadoConsulta()).toBe('vacio'); c.reintentarFuente(); catalogo();
    http.expectOne(`${base}/solicitudes/expediente/${expediente}`).flush({ ...solicitud, ciudadanoId: 99 });
    expect(c.estadoConsulta()).toBe('error'); expect(c.solicitud()).toBeNull();
  });
  it('un catálogo fallido no equivale a catálogo vacío; reintentos cancelan consultas anteriores', () => {
    const f = preparar(), c = f.componentInstance; c.iniciarApelacionExterna();
    http.expectOne(`${base}/entidades/activas`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(c.estadoEntidades()).not.toBe('vacio'); expect(c.errorEntidades()).toBeTruthy();
    c.cargarEntidades(); const vieja = http.expectOne(`${base}/entidades/activas`); c.cargarEntidades(); expect(vieja.cancelled).toBe(true); catalogo();
    expect(c.estadoEntidades()).toBe('disponible');
  });
  it('el alias por ID conserva la identidad y el retorno; un ID mal formado no dispara consultas', () => {
    params.next(convertToParamMap({})); query.next({ solicitudId: '23', expediente }); const f = pagina(), c = f.componentInstance;
    http.expectOne(`${base}/solicitudes/23`).flush(solicitud); expect(c.rutaRegreso()).toEqual(['/ciudadano/solicitud', expediente]);
    query.next({ solicitudId: '23abc' }); expect(c.estadoConsulta()).toBe('validacion'); expect(c.solicitud()).toBeNull();
    http.expectNone(r => r.url.startsWith(`${base}/solicitudes`));
  });
  it('la bandeja muestra registros del servidor sin declarar elegibilidad por estado y refetch por ID', () => {
    params.next(convertToParamMap({})); const f = pagina(), c = f.componentInstance;
    http.expectOne(`${base}/solicitudes/ciudadano/5`).flush([{ ...solicitud, estado: 'RECIBIDA' }]);
    expect(c.filteredSolicitudes()).toHaveLength(1); c.seleccionarSolicitud(c.filteredSolicitudes()[0]); catalogo();
    http.expectOne(`${base}/solicitudes/23`).flush(solicitud); expect(c.solicitud()?.id).toBe(23);
  });
  it('antecedentes ambiguos requieren elección por ID y no se seleccionan por nombre o posición', () => {
    const f = preparar({ ...solicitud, documentosMetadata: [original, { ...original, id: 90 }] }), c = f.componentInstance;
    expect(c.doc1Auto()).toBeNull(); expect(c.antecedentes(1).map(d => d.id)).toEqual([88, 90]);
    c.usarAntecedente(1, c.antecedentes(1)[1]); expect(c.doc1Auto()?.id).toBe(90);
    expect(c.doc2Auto()?.respuestaId).toBe(91);
  });
  it('un documento de otra respuesta no se ofrece aunque tenga el mismo nombre', () => {
    const f = preparar({ ...solicitud, respuesta: { ...solicitud.respuesta, documentosMetadata: [{ ...respuestaDoc, respuestaId: 999 }] } });
    expect(f.componentInstance.doc2Auto()).toBeNull(); expect(f.componentInstance.antecedentes(2)).toEqual([]);
  });
  it('el cambio de sesión cancela el alta e impide sus continuaciones documentales', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const alta = http.expectOne(`${base}/apelaciones/recepciones`);
    auth.guardarSesion({ success: true, token: 'otra-sesion', usuarioId: 99, ciudadanoId: 99, tipoUsuario: 'CIUDADANO' }); TestBed.tick();
    expect(alta.cancelled).toBe(true); catalogo(); http.expectOne(`${base}/solicitudes/expediente/${expediente}`).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(c.apelacionCreada()).toBeNull(); expect(c.fundamentos).toBe(''); expect(c.successModalAbierto()).toBe(false); http.expectNone(r => r.url.startsWith(`${base}/documentos`));
  });
  it('el cambio de recurso cancela una recuperación pendiente sin confirmar otro expediente', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); http.expectOne(`${base}/apelaciones/recepciones`).flush(resultado(c));
    const pending = http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`); params.next(convertToParamMap({ expediente: 'SAIP-2026-00024' }));
    expect(pending.cancelled).toBe(true); catalogo(); http.expectOne(`${base}/solicitudes/expediente/SAIP-2026-00024`).flush(null);
    expect(c.apelacionCreada()).toBeNull(); expect(c.documentosEnviados()).toEqual([]); expect(c.recepcionId()).toBeNull();
  });
  it.each([{ apelacionId: 999 }, { hashSha256: 'e'.repeat(64) }, { id: 88 }, { respuestaId: 91 }, { tipoDocumento: 'OTRO' }])('no confirma metadatos documentales incompatibles: %j', cambio => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const r = resultado(c); Object.assign(r.documentos[0].documento, cambio);
    http.expectOne(`${base}/apelaciones/recepciones`).flush(r); expect(c.estadoEnvio()).toBe('incierta'); expect(c.apelacionCreada()).toBeNull(); expect(c.successModalAbierto()).toBe(false); expect(escriturasDocumentales()).toEqual([]);
  });
  it('una externa con referencias alteradas no confirma otra recepción', async () => {
    const f = externa(), c = f.componentInstance; c.file1.set(new File(['x'], 'original.txt', { type: 'text/plain' })); c.crearApelacion();
    const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req); req.flush(resultado(c, { ...resultadoExterno(datos), referenciaDocumentoSolicitud: 'Otro registro' }));
    expect(c.estadoEnvio()).toBe('incierta'); expect(c.successModalAbierto()).toBe(false); expect(escriturasDocumentales()).toEqual([]);
  });
  it('la recepción recuperada identifica los documentos y un error posterior no acredita ausencia', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const r = resultado(c); http.expectOne(`${base}/apelaciones/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro(); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r);
    expect(c.documentosConsultados()?.map(d => d.id)).toEqual([188, 189, 190]); expect(c.estadoEnvio()).toBe('confirmada'); expect(c.successModalAbierto()).toBe(true);
    c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); c.comprobarRegistro();
    http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(null, { status: 500, statusText: 'Error' });
    expect(c.apelacionCreada()?.id).toBe(145); expect(c.documentosConsultados()).toBeNull(); expect(c.errorRecuperacion()).toBeTruthy();
  });
  it('descarga solo bytes autorizados y cancela una descarga pendiente al abandonar el contexto', () => {
    const f = preparar(), c = f.componentInstance; c.downloadFile(1); const req = http.expectOne(`${base}/documentos/88/download`);
    const blob = new Blob(['bytes conocidos'], { type: 'application/pdf' }); req.flush(blob, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="original.pdf"' } });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob); expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    c.downloadFile(2); const pendiente = http.expectOne(`${base}/documentos/89/download`); c.iniciarApelacionExterna(); catalogo();
    expect(pendiente.cancelled).toBe(true); expect(c.previewTarget()).toBeNull();
  });
  it('selección local por teclado y errores vinculados no se presentan como documento registrado', () => {
    const f = preparar({ ...solicitud, documentosMetadata: [] }), c = f.componentInstance; f.detectChanges();
    const zone = f.nativeElement.querySelector('[aria-label="Seleccionar archivo para SAIP original"]') as HTMLElement;
    const input = f.nativeElement.querySelector('#apelacion-file-1') as HTMLInputElement; const click = vi.spyOn(input, 'click');
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); expect(click).toHaveBeenCalledOnce();
    c.onFileChange({ target: { files: [new File(['x'], 'no-admitido.zip', { type: 'application/zip' })], value: 'fakepath' } } as unknown as Event, 1); f.detectChanges();
    expect(c.file1()).toBeNull(); expect(input.getAttribute('aria-describedby')).toBe('apelacion-file-error-1'); expect(c.avisosArchivo()[1]).toBeTruthy();
    c.file1.set(new File(['x'], 'seleccion.txt', { type: 'text/plain' })); c.previewFile(1); expect(c.previewTarget()?.file?.name).toBe('seleccion.txt');
    expect(c.apelacionCreada()).toBeNull(); expect(c.successModalAbierto()).toBe(false);
  });
  it('cerrar la confirmación con Escape restaura el foco sin enviar y conserva el formulario', async () => {
    const f = preparar(); f.detectChanges(); const button = [...f.nativeElement.querySelectorAll('button')] .find((b: unknown) => (b as HTMLButtonElement).textContent?.includes('Presentar apelación')) as HTMLButtonElement;
    document.body.appendChild(f.nativeElement); button.focus(); button.click(); f.detectChanges(); await f.whenStable();
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement; expect(dialog.getAttribute('aria-label')).toBe('Confirme su apelación');
    expect(dialog.contains(document.activeElement)).toBe(true); dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); await f.whenStable();
    expect(f.componentInstance.confirmModalAbierto()).toBe(false); expect(document.activeElement).toBe(button);
    expect(f.componentInstance.fundamentos).toBe(creada.fundamentos); http.expectNone(`${base}/apelaciones/recepciones`); f.nativeElement.remove();
  });
  it('la navegación a panel y al origen utiliza identificadores recuperados', () => {
    const f = preparar(), router = TestBed.inject(Router), nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.verSolicitudOrigen(); expect(nav).toHaveBeenCalledWith(['/ciudadano/solicitud', expediente]);
    f.componentInstance.irPanelCiudadano(); expect(nav).toHaveBeenCalledWith(['/ciudadano']);
  });
  it('un timeout del alta conserva el contenido y bloquea un segundo POST sin inventar recuperación', async () => {
    const f = externa(), c = f.componentInstance; vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`); await vi.advanceTimersByTimeAsync(30_001);
      expect(req.cancelled).toBe(true); expect(c.estadoEnvio()).toBe('incierta'); expect(c.fundamentos).toBe('Solicito revisión.');
      c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); expect(c.successModalAbierto()).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('la revisión modificada exige confirmar otra vez antes de escribir', () => {
    const f = preparar(), c = f.componentInstance; c.abrirConfirmacionApelacion(); c.fundamentos = 'Texto editado tras la revisión.';
    c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); expect(c.error()).toContain('confirme nuevamente');
    expect(c.confirmModalAbierto()).toBe(false);
  });
  it('el diálogo de recepción contiene el foco y al cerrarse conserva el registro, sin recrearlo', async () => {
    const f = externa(), c = f.componentInstance; document.body.appendChild(f.nativeElement); f.detectChanges();
    c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), datos = await payload(req), r = resultado(c, resultadoExterno(datos)); req.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r); f.detectChanges(); await f.whenStable();
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement; expect(dialog).not.toBeNull(); expect(dialog.contains(document.activeElement)).toBe(true);
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button'); const first = buttons[0], last = buttons[buttons.length - 1];
    last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })); expect(document.activeElement).toBe(last);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); await f.whenStable();
    expect(c.successModalAbierto()).toBe(false); expect(c.apelacionCreada()?.id).toBe(145); expect(document.activeElement?.id).toBe('apelacion-resultado');
    c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`); f.nativeElement.remove();
  });
  it('recupera tras pérdida de confirmación sin otro POST y mantiene los mismos IDs', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const r = resultado(c);
    http.expectOne(`${base}/apelaciones/recepciones`).error(new ProgressEvent('error')); const key = c.claveOperacion();
    c.reintentarAlta(); http.expectNone(`${base}/apelaciones/recepciones`); c.comprobarRegistro();
    http.expectOne(`${base}/apelaciones/recepciones/${key}`).flush(r);
    expect(c.recepcionId()).toBe(701); expect(c.apelacionCreada()?.id).toBe(145); expect(c.successModalAbierto()).toBe(true);
    c.comprobarRegistro(); http.expectOne(`${base}/apelaciones/recepciones/${key}`).flush({ ...r, id: 702 });
    expect(c.recepcionId()).toBe(701); expect(c.errorRecuperacion()).toContain('incompatibles');
  });
  it('solo una consulta 404 habilita reintento explícito con la misma clave, campos, versiones y archivos', async () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const req = http.expectOne(`${base}/apelaciones/recepciones`), first = await payload(req);
    const file = c.file3(); req.flush(null, { status: 503, statusText: 'Unavailable' }); c.reintentarAlta(); http.expectNone(`${base}/apelaciones/recepciones`);
    c.comprobarRegistro(); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(c.estadoEnvio()).toBe('sin-recepcion'); c.fundamentos = 'Edición directa que no reemplaza el intento capturado'; c.reintentarAlta();
    const retry = http.expectOne(`${base}/apelaciones/recepciones`); expect(await payload(retry)).toEqual(first);
    expect((retry.request.body as FormData).getAll('archivos')).toHaveLength(1); expect(c.file3()).toBe(file);
    const r = resultado(c); retry.flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r);
    expect(c.successModalAbierto()).toBe(true); expect(c.apelacionCreada()?.fundamentos).toBe(creada.fundamentos);
  });
  it.each([0, 400, 401, 403, 500, 503])('el error de recuperación %s no habilita escrituras ni éxito', status => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); http.expectOne(`${base}/apelaciones/recepciones`).error(new ProgressEvent('error'));
    c.comprobarRegistro(); const get = http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`);
    if (status) get.flush(null, { status, statusText: 'Error' }); else get.error(new ProgressEvent('error'));
    c.reintentarAlta(); c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`);
    expect(c.successModalAbierto()).toBe(false); expect(c.apelacionCreada()).toBeNull(); expect(c.file3()).not.toBeNull(); expect(c.bloqueado()).toBe(true);
  });
  it('un conflicto conserva la clave y exige consultar antes de otro intento', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const key = c.claveOperacion();
    http.expectOne(`${base}/apelaciones/recepciones`).flush(null, { status: 409, statusText: 'Conflict' });
    expect(c.bloqueado()).toBe(true); c.reintentarAlta(); c.crearApelacion(); http.expectNone(`${base}/apelaciones/recepciones`);
    c.comprobarRegistro(); http.expectOne(`${base}/apelaciones/recepciones/${key}`).flush(resultado(c)); expect(c.successModalAbierto()).toBe(true);
  });
  it.each(['id', 'modalidad', 'claveOperacion', 'fechaRecepcion', 'documentos', 'procedencia', 'duplicados'])('rechaza recepción incompatible por %s', campo => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const r = resultado(c);
    if (campo === 'id') r.id = 0;
    if (campo === 'modalidad') r.modalidad = 'EXTERNA';
    if (campo === 'claveOperacion') r.claveOperacion = crypto.randomUUID();
    if (campo === 'fechaRecepcion') r.fechaRecepcion = 'fecha ausente';
    if (campo === 'documentos') r.documentos.pop();
    if (campo === 'procedencia') r.documentos[0].origenId = 999;
    if (campo === 'duplicados') r.documentos[1].documento.id = r.documentos[0].documento.id;
    http.expectOne(`${base}/apelaciones/recepciones`).flush(r); expect(c.successModalAbierto()).toBe(false); expect(c.estadoEnvio()).toBe('incierta'); expect(c.apelacionCreada()).toBeNull();
  });
  it('la recuperación tras un POST válido no puede cambiar identidad de recepción ni manifiesto', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); const r = resultado(c);
    http.expectOne(`${base}/apelaciones/recepciones`).flush(r); const changed = structuredClone(r); changed.documentos[0].documento.id = 999;
    http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(changed); expect(c.successModalAbierto()).toBe(false); expect(c.recepcionId()).toBeNull();
  });
  it('cerrar o cambiar modalidad descarta recuperación pendiente sin repoblar otro contexto', () => {
    const f = preparar(), c = f.componentInstance; c.crearApelacion(); http.expectOne(`${base}/apelaciones/recepciones`).flush(resultado(c));
    const pending = http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`); c.iniciarApelacionExterna(); catalogo();
    expect(pending.cancelled).toBe(true); expect(c.claveOperacion()).toBe(''); expect(c.recepcionId()).toBeNull(); expect(c.apelacionCreada()).toBeNull(); expect(c.file3()).toBeNull();
  });
  it('no persiste preparación, clave o archivos personales y advierte pérdida tras recarga', () => {
    const f = preparar(), c = f.componentInstance; const local = vi.spyOn(localStorage, 'setItem'), session = vi.spyOn(sessionStorage, 'setItem');
    c.crearApelacion(); http.expectOne(`${base}/apelaciones/recepciones`).error(new ProgressEvent('error')); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('solo en memoria'); expect(f.nativeElement.textContent).toContain(c.claveOperacion());
    expect(local).not.toHaveBeenCalled(); expect(session).not.toHaveBeenCalled();
  });

  it('acepta el nombre normalizado por almacenamiento sin usarlo como identidad documental', () => {
    const f = preparar(), c = f.componentInstance; c.file1.set(new File(['contenido'], 'copia  real.txt', { type: 'text/plain' }));
    c.crearApelacion(); const r = resultado(c); r.documentos[0].documento.nombreOriginal = 'copia real.txt';
    http.expectOne(`${base}/apelaciones/recepciones`).flush(r); http.expectOne(`${base}/apelaciones/recepciones/${c.claveOperacion()}`).flush(r);
    expect(c.successModalAbierto()).toBe(true); expect(c.documentosConsultados()?.[0].nombreOriginal).toBe('copia real.txt');
    expect(c.documentosConsultados()?.[0].id).toBe(188); expect(c.file1()?.name).toBe('copia  real.txt');
  });

  it('la bandeja solo ofrece SAIP con respuesta de la entidad y sin apelación', () => {
    params.next(convertToParamMap({}));
    const f = TestBed.createComponent(NuevaApelacionComponent); f.detectChanges();
    http.expectOne(`${base}/entidades/activas`).flush([{ id: 3, nombre: 'Entidad sintética' }]);
    const parcial = { ...solicitud, id: 24, expediente: 'SAIP-2026-00024', estado: 'RESPONDIDA', apelacion: null,
      respuesta: { ...solicitud.respuesta, id: 92, tipoRespuesta: 'ENTREGA_PARCIAL' } };
    const pendiente = { ...solicitud, id: 30, expediente: 'SAIP-2026-00030', estado: 'RECEPCIONADA', respuesta: null, apelacion: null };
    const apelada = { ...solicitud, id: 31, expediente: 'SAIP-2026-00031', apelacion: { id: 9 } };
    const silencio = { ...solicitud, id: 32, expediente: 'SAIP-2026-00032', estado: 'VENCIDA',
      respuesta: { ...solicitud.respuesta, id: 93, tipoRespuesta: 'SILENCIO_ADMINISTRATIVO' }, apelacion: null };
    http.expectOne(`${base}/solicitudes/ciudadano/5`).flush([solicitud, parcial, pendiente, apelada, silencio]);
    f.detectChanges();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain(expediente); expect(texto).toContain('SAIP-2026-00024');
    expect(texto).toContain('Expedientes apelables'); expect(texto).toContain('Denegatoria total'); expect(texto).toContain('Entrega parcial');
    expect(texto).not.toContain('SAIP-2026-00030'); expect(texto).not.toContain('SAIP-2026-00031'); expect(texto).not.toContain('SAIP-2026-00032');
    expect(f.nativeElement.querySelectorAll('[aria-label^="Apelar expediente"]')).toHaveLength(2);
  });

  it.each([{ hashSha256: null }, { hashSha256: 'incompleto' }, { sizeBytes: 0 }, { contentType: null }])('no ofrece clonar un antecedente sin versión recuperable: %j', cambio => {
    const f = preparar({ ...solicitud, documentosMetadata: [{ ...original, ...cambio }] }), c = f.componentInstance;
    expect(c.doc1Auto()).toBeNull(); expect(c.antecedentes(1)).toEqual([]); expect(c.documentosIncompletos()).toBe(true); expect(c.puedeEnviar()).toBe(false);
    c.file1.set(new File(['copia real'], 'copia.txt', { type: 'text/plain' })); expect(c.puedeEnviar()).toBe(true);
    expect(escriturasDocumentales()).toEqual([]);
  });

});
