import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtaipCalificarComponent } from './ttaip-calificar.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('ResolutionForm — primera calificación real', () => {
  const api = environment.apiUrl;
  const expediente = '00021-2026-JUS/TTAIP';
  const session = { success: true, token: 'sesion-sintetica-tribunal', usuarioId: 7, miembroId: 7, tipoUsuario: 'TTAIP' };
  const appeal = (patch: Record<string, unknown> = {}) => ({ id: 21, expediente, estado: 'EN_CALIFICACION_1',
    ciudadanoId: 4, ciudadanoNombre: 'Persona sintética', entidadId: 3, entidadNombre: 'Entidad sintética',
    tipoOrigen: 'EXTERNA', solicitudId: null, solicitudExpediente: null, numeroSolicitudExterna: 'EXT-21',
    resumenSolicitudOriginal: 'Información sintética', fundamentos: 'Fundamentos originales', fechaApelacion: '2026-10-01',
    calificacionPrimera: null, resolucionPrimeraCalificacion: null, resolucionSegundaCalificacion: null,
    resolucion: null, resoluciones: [], documentos: [], documentosMetadata: [], ...patch });
  const recorded = (patch: Record<string, unknown> = {}) => appeal({ estado: 'EN_RESOLUCION', calificacionPrimera: 'ADMISIBLE',
    resolucionPrimeraCalificacion: { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE',
      numeroResolucion: 'REGISTRADA-71', fundamentos: 'Fundamentos del operador', fechaResolucion: '2026-10-27' }, ...patch });
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); params = new BehaviorSubject(convertToParamMap({ expediente }));
    TestBed.configureTestingModule({ imports: [TtaipCalificarComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params.value }, paramMap: params.asObservable() } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); } });
  function page(data: ReturnType<typeof appeal> = appeal()) {
    const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges();
    http.expectOne(`${api}/apelaciones/expediente/${expediente}`).flush(data); f.detectChanges(); return f;
  }
  function prepare(f: ReturnType<typeof page>) { f.componentInstance.seleccionarCalificacion('admisible'); f.componentInstance.fundamentos = 'Fundamentos del operador'; }
  it('una recarga fallida no conserva el expediente anterior', () => {
    const f = page(); f.componentInstance.cargarApelacion('EXP-NUEVO');
    http.expectOne(`${api}/apelaciones/expediente/EXP-NUEVO`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.puedeCalificar()).toBe(false);
  });
  it('rechaza un expediente distinto del solicitado aunque tenga el mismo nombre de persona', () => {
    const f = page(appeal({ id: 22, expediente: 'EXP-AJENO' })); expect(f.componentInstance.apelacion()).toBeNull();
  });
  it('no permite repetir una primera actuación ya registrada con estado desactualizado', () => {
    const f = page(recorded({ estado: 'EN_CALIFICACION_1' })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('no duplica el comando mientras la primera petición está pendiente', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); f.componentInstance.enviarCalificacion();
    const requests = http.match(`${api}/ttaip/calificacion/21/admitir`); requests.forEach(req => req.flush(null, { status: 422, statusText: 'Rejected' }));
    expect(requests.length).toBe(1);
  });
  it('un fallo de red conserva fundamentos y bloquea escrituras a ciegas', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(`${api}/ttaip/calificacion/21/admitir`).error(new ProgressEvent('error'));
    expect(f.componentInstance.fundamentos).toBe('Fundamentos del operador'); expect(f.componentInstance.canSubmit()).toBe(false);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('no confirma por ID de apelación cuando falta la actuación solicitada', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(`${api}/ttaip/calificacion/21/admitir`).flush(appeal());
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('recupera por GET la actuación identificada antes de confirmar', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(`${api}/ttaip/calificacion/21/admitir`).flush(recorded());
    const reads = http.match(`${api}/apelaciones/expediente/${expediente}`); const before = f.componentInstance.successModalAbierto();
    reads.forEach(req => req.flush(recorded())); expect(before).toBe(false); expect(reads.length).toBe(1); expect(f.componentInstance.successModalAbierto()).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.irExpediente(); expect(navigate).toHaveBeenCalledWith(['/ttaip/apelacion', expediente]);
  });
  it('cambiar de ruta cancela la consulta anterior', () => {
    const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges(); const old = http.expectOne(`${api}/apelaciones/expediente/${expediente}`);
    params.next(convertToParamMap({ expediente: 'EXP-NUEVO' })); f.detectChanges();
    const reads = http.match(`${api}/apelaciones/expediente/EXP-NUEVO`); reads.forEach(req => req.flush(appeal({ expediente: 'EXP-NUEVO' })));
    expect(old.cancelled).toBe(true);
  });
  it('destruir cancela la consulta de un recurso abandonado', () => {
    const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges(); const req = http.expectOne(`${api}/apelaciones/expediente/${expediente}`);
    f.destroy(); expect(req.cancelled).toBe(true);
  });
  it('presenta registro sin ofrecer emisión formal ni aviso de resolución firme', () => {
    const f = page(); prepare(f); f.componentInstance.abrirConfirmacionCalificacion(); f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Emitir calificacion'); expect(document.body.textContent).not.toContain('Resolución firme');
  });
  it('inadmisibilidad conserva fundamentos explícitos obligatorios, sin sustituirlos por observaciones', () => {
    const f = page(); f.componentInstance.seleccionarCalificacion('inadmisible'); f.componentInstance.observacionesList.set(['Observación del operador']);
    expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it.each([
    ['admisible', 'admitir', 'ADMISIBLE', 'EN_RESOLUCION'],
    ['inadmisible', 'subsanar', 'INADMISIBLE', 'EN_SUBSANACION'],
    ['improcedente', 'inadmitir', 'IMPROCEDENTE', 'RESUELTO_IMPROCEDENTE'],
  ] as const)('%s conserva su comando, texto y actuación de primera calificación', (decision, command, backendDecision, state) => {
    const f = page(); f.componentInstance.seleccionarCalificacion(decision); f.componentInstance.fundamentos = '  Fundamentos del operador  ';
    f.componentInstance.observacionesList.set([' Primera observación ', '', 'Segunda observación']);
    f.componentInstance.enviarCalificacion(); const req = http.expectOne(api + '/ttaip/calificacion/21/' + command);
    expect(req.request.method).toBe('POST'); expect(req.request.headers.get('Authorization')).toBe('Bearer ' + session.token);
    expect(req.request.body).toEqual({ fundamentos: 'Fundamentos del operador', ...(decision === 'inadmisible' ? { observaciones: 'Primera observación\nSegunda observación', diasSubsanacion: 2 } : {}) });
    const result = recorded({ estado: state, calificacionPrimera: backendDecision, resolucionPrimeraCalificacion: {
      id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: backendDecision, fundamentos: 'Fundamentos del operador',
      ...(decision === 'inadmisible' ? { observaciones: 'Primera observación\nSegunda observación' } : {}) } });
    req.flush(result); expect(f.componentInstance.successModalAbierto()).toBe(false);
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(result); f.detectChanges();
    expect(f.componentInstance.successModalAbierto()).toBe(true); expect(f.componentInstance.apelacion()?.resolucionPrimeraCalificacion.id).toBe(71);
    expect(f.componentInstance.canSubmit()).toBe(false); expect(document.body.textContent).not.toContain('Se ha notificado');
    expect(f.componentInstance.calificacionNextSteps().some(step => !!step.hint)).toBe(false);
  });
  it.each([400, 401, 403, 404, 422, 500, 503])('HTTP %i de carga no habilita formulario ni expediente sustituto', status => {
    const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush({ detail: 'detalle interno' }, { status, statusText: 'Failure' }); f.detectChanges();
    expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.canSubmit()).toBe(false);
    expect(f.nativeElement.querySelector('[role=alert]')).not.toBeNull(); expect(f.nativeElement.querySelector('#qualification-grounds')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('detalle interno');
  });
  it('el reintento de lectura usa el expediente original tras error, sin un identificador vacío', () => {
    const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).error(new ProgressEvent('error')); f.detectChanges();
    (f.nativeElement.querySelector('button') as HTMLButtonElement).click();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(appeal()); f.detectChanges();
    expect(f.componentInstance.loadError()).toBe(''); expect(f.nativeElement.textContent).toContain('Persona sintética');
  });
  it('una respuesta vacía de consulta no acredita ausencia de antecedentes', () => {
    const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null); f.detectChanges();
    expect(f.componentInstance.loadError()).toContain('incompleta'); expect(f.componentInstance.puedeCalificar()).toBe(false);
  });
  it.each(['EN_SUBSANACION', 'EN_CALIFICACION_2', 'NOTIFICACION_SEGUNDA_CALIFICACION', 'EN_RESOLUCION', 'PENDIENTE_ELEVACION'])('no ofrece primera calificación desde %s', estado => {
    const f = page(appeal({ estado })); prepare(f); f.componentInstance.enviarCalificacion();
    http.expectNone(req => req.method === 'POST'); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it.each([
    { calificacionPrimera: undefined }, { resolucionPrimeraCalificacion: {} }, { resoluciones: undefined },
    { expedienteTtaip: { id: 51, numeroExpediente: 'EXP-AJENO' } }, { elevacion: { id: 51, apelacionId: 99 } },
  ])('información incompleta o relaciones ajenas no habilitan la actuación: %j', patch => {
    const f = page(appeal(patch)); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false); expect(f.componentInstance.motivoNoDisponible()).toContain('incompleta');
  });
  it('la primera actuación en el historial del agregado impide otra aunque el puntero esté vacío', () => {
    const f = page(appeal({ resoluciones: [{ id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE' }] })); prepare(f);
    expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('la consulta de origen usa exclusivamente el ID vinculado y bloquea mientras está pendiente', () => {
    const f = page(appeal({ tipoOrigen: 'SAIP_INTERNA', solicitudId: 31, solicitudExpediente: 'SAIP-31' })); prepare(f);
    expect(f.componentInstance.canSubmit()).toBe(false);
    http.expectOne(api + '/solicitudes/31').flush({ id: 31, expediente: 'SAIP-31', ciudadanoId: 4, asunto: 'Asunto de origen',
      respuesta: { id: 41, solicitudId: 31, tipoRespuesta: 'DENEGACION_TOTAL', causalDenegatoria: 'DATO_PERSONAL' } }); f.detectChanges();
    expect(f.componentInstance.causalOrigen()).toBe('DENEGACION_TOTAL'); expect(f.nativeElement.textContent).toContain('DATO_PERSONAL');
    expect(f.componentInstance.solicitudOrigen()?.id).toBe(31); http.expectNone(api + '/solicitudes');
  });
  it.each([{ id: 32 }, { expediente: 'SAIP-AJENA' }, { ciudadanoId: 99 }, { respuesta: { id: 41, solicitudId: 99 } }])('rechaza un antecedente explícitamente incompatible: %j', patch => {
    const f = page(appeal({ tipoOrigen: 'SAIP_INTERNA', solicitudId: 31, solicitudExpediente: 'SAIP-31' }));
    http.expectOne(api + '/solicitudes/31').flush({ id: 31, expediente: 'SAIP-31', ciudadanoId: 4, ...patch }); f.detectChanges();
    expect(f.componentInstance.loadError()).toContain('no corresponden'); expect(f.componentInstance.puedeCalificar()).toBe(false);
    expect(f.componentInstance.solicitudOrigen()).toBeNull();
  });
  it('un error de origen impide calificar sin inventar los antecedentes', () => {
    const f = page(appeal({ tipoOrigen: 'SAIP_INTERNA', solicitudId: 31 }));
    http.expectOne(api + '/solicitudes/31').flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.nativeElement.querySelector('#qualification-grounds')).toBeNull(); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('no ofrece una vía directa ni una fecha sustitutiva si el contrato no las informa', () => {
    const f = page(appeal({ fechaApelacion: null })); expect(f.componentInstance.viaIngreso()).toContain('no informada');
    expect(f.componentInstance.fechaVisible(null)).toBeNull(); expect(f.nativeElement.textContent).toContain('No informada');
  });
  it.each([400, 401, 403, 404, 409, 422])('un rechazo HTTP %i no confirma y conserva el sustento', status => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion();
    http.expectOne(api + '/ttaip/calificacion/21/admitir').flush({ detail: 'texto interno' }, { status, statusText: 'Rejected' }); f.detectChanges();
    expect(f.componentInstance.fundamentos).toBe('Fundamentos del operador'); expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('texto interno'); expect(f.componentInstance.resultadoIncierto()).toBe(false);
  });
  it('una validación 422 permite corregir y realizar un nuevo intento explícito', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(null, { status: 422, statusText: 'Rejected' });
    f.componentInstance.fundamentos = 'Sustento corregido'; expect(f.componentInstance.canSubmit()).toBe(true);
    f.componentInstance.enviarCalificacion(); const req = http.expectOne(api + '/ttaip/calificacion/21/admitir'); expect(req.request.body.fundamentos).toBe('Sustento corregido');
    req.flush(null, { status: 422, statusText: 'Rejected' });
  });
  it.each([500, 503])('HTTP %i deja resultado incierto sin reenviar automáticamente', status => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(null, { status, statusText: 'Failure' });
    expect(f.componentInstance.resultadoIncierto()).toBe(true); f.componentInstance.enviarCalificacion(); http.expectNone(req => req.method === 'POST');
  });
  it('una pérdida de confirmación por GET se recupera por el ID devuelto, sin otro POST', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(recorded());
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(f.componentInstance.resultadoIncierto()).toBe(true); f.componentInstance.recuperarResultado();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(recorded()); expect(f.componentInstance.successModalAbierto()).toBe(true);
    http.expectNone(req => req.method === 'POST');
  });
  it('sin ID devuelto no atribuye una actuación por coincidencia de textos', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').error(new ProgressEvent('error'));
    f.componentInstance.recuperarResultado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(recorded()); f.detectChanges();
    expect(f.componentInstance.registroObservado()).toBe(71); expect(f.componentInstance.successModalAbierto()).toBe(false);
    expect(f.componentInstance.resultadoIncierto()).toBe(true); f.componentInstance.enviarCalificacion(); http.expectNone(req => req.method === 'POST');
  });
  it.each([
    { id: 22, expediente: 'EXP-AJENO' }, { calificacionPrimera: 'IMPROCEDENTE' },
    { resolucionPrimeraCalificacion: { id: 71, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMISIBLE', fundamentos: 'Fundamentos del operador' } },
    { resolucionPrimeraCalificacion: { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', fundamentos: 'Otro sustento' } },
  ])('no confirma una respuesta de comando discordante: %j', patch => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(recorded(patch));
    expect(f.componentInstance.successModalAbierto()).toBe(false); expect(f.componentInstance.resultadoIncierto()).toBe(true);
  });
  it('no confirma si la recuperación devuelve otra actuación del mismo expediente', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(recorded());
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(recorded({ resolucionPrimeraCalificacion: { id: 72, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', fundamentos: 'Fundamentos del operador' } }));
    expect(f.componentInstance.resultadoIncierto()).toBe(true); expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('valida los límites reales del contrato sin un mínimo arbitrario', () => {
    const f = page(); prepare(f); f.componentInstance.fundamentos = 'a'; expect(f.componentInstance.canSubmit()).toBe(true);
    f.componentInstance.fundamentos = 'a'.repeat(5001); expect(f.componentInstance.canSubmit()).toBe(false);
    f.componentInstance.fundamentos = 'Fundamentos'; f.componentInstance.seleccionarCalificacion('inadmisible'); f.componentInstance.observacionesList.set(['a'.repeat(1000), 'b'.repeat(1000)]);
    expect(f.componentInstance.canSubmit()).toBe(false); f.componentInstance.observacionesList.set(['a']); expect(f.componentInstance.canSubmit()).toBe(true);
  });
  it('cambiar decisión cierra la revisión anterior y no envía una actuación', () => {
    const f = page(); prepare(f); f.componentInstance.abrirConfirmacionCalificacion(); f.componentInstance.seleccionarCalificacion('improcedente');
    expect(f.componentInstance.confirmModalAbierto()).toBe(false); expect(f.componentInstance.selectedDecision()).toBe('improcedente'); http.expectNone(req => req.method === 'POST');
  });
  it('una decisión no cambia desde los controles mientras se registra', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); const req = http.expectOne(api + '/ttaip/calificacion/21/admitir');
    f.componentInstance.seleccionarCalificacion('improcedente'); expect(f.componentInstance.selectedDecision()).toBe('admisible');
    req.flush(null, { status: 422, statusText: 'Rejected' });
  });
  it('cambiar solicitud durante el registro cancela la continuación y limpia el borrador', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); const old = http.expectOne(api + '/ttaip/calificacion/21/admitir');
    params.next(convertToParamMap({ expediente: 'EXP-22' })); f.detectChanges();
    expect(old.cancelled).toBe(true); http.expectOne(api + '/apelaciones/expediente/EXP-22').flush(appeal({ id: 22, expediente: 'EXP-22' })); f.detectChanges();
    expect(f.componentInstance.fundamentos).toBe(''); expect(f.componentInstance.successModalAbierto()).toBe(false); expect(f.componentInstance.apelacion()?.id).toBe(22);
  });
  it('un cambio de sesión cancela el registro y retira todo contenido anterior', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); const old = http.expectOne(api + '/ttaip/calificacion/21/admitir');
    TestBed.inject(AuthService).guardarSesion({ ...session, usuarioId: 8, miembroId: 8, token: 'otra-sesion-sintetica' }); f.detectChanges();
    expect(old.cancelled).toBe(true); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.fundamentos).toBe(''); expect(f.nativeElement.textContent).not.toContain('Persona sintética');
  });
  it('una cuenta de otro módulo no inicia consultas ni escrituras', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'FUNCIONARIO' }); const f = TestBed.createComponent(TtaipCalificarComponent); f.detectChanges();
    http.expectNone(req => req.url.startsWith(api)); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('cierre de sesión en otra pestaña limpia la pantalla y las revisiones', () => {
    const f = page(); prepare(f); f.componentInstance.abrirConfirmacionCalificacion(); localStorage.removeItem('usuario');
    window.dispatchEvent(new StorageEvent('storage', { key: 'usuario' })); f.detectChanges();
    expect(f.componentInstance.confirmModalAbierto()).toBe(false); expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.fundamentos).toBe('');
  });
  const doc = (patch: Record<string, unknown> = {}) => ({ id: 51, apelacionId: 21, nombreOriginal: 'Anexo sintético.txt', contentType: 'text/plain', estado: 'ACTIVO', sizeBytes: 18, ...patch });
  function documentRequest() { return http.expectOne(req => req.url === api + '/documentos' && req.params.get('apelacionId') === '21'); }
  it('consulta documentos por la apelación autorizada, sin aceptar rutas ni identidades del navegador', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); const req = documentRequest();
    expect(req.request.headers.get('Authorization')).toBe('Bearer ' + session.token); expect(req.request.params.keys()).toEqual(['apelacionId']); req.flush([doc()]); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Anexo sintético.txt'); expect(f.componentInstance.documentGroups()[0].documents[0].id).toBe(51);
  });
  it('la búsqueda documental local distingue coincidencias, vacío de búsqueda y error sin otra consulta', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush(Array.from({ length: 4 }, (_, index) => doc({ id: 51 + index, nombreOriginal: index === 0 ? 'Información solicitada.txt' : 'Cargo ' + index + '.txt' }))); f.detectChanges();
    const search = f.nativeElement.querySelector('#qualification-document-search') as HTMLInputElement;
    search.value = 'informacion'; search.dispatchEvent(new Event('input')); f.detectChanges(); expect(f.componentInstance.visibleGroups()[0].documents.map(d => d.id)).toEqual([51]);
    search.value = 'ninguna coincidencia'; search.dispatchEvent(new Event('input')); f.detectChanges(); expect(f.nativeElement.textContent).toContain('Ningún documento coincide');
    expect(f.componentInstance.documentError()).toBe(''); expect(f.componentInstance.documentCount()).toBe(4);
    const clear = f.nativeElement.querySelector('[aria-label="Limpiar búsqueda de documentos"]') as HTMLButtonElement; clear.click(); f.detectChanges();
    expect(f.componentInstance.visibleGroups()[0].documents.length).toBe(4); http.expectNone(req => req.url.startsWith(api));
  });
  it('los grupos documentales se pliegan con botón accesible y la búsqueda los expande', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]); f.detectChanges();
    const button = f.nativeElement.querySelector('h2 button[aria-expanded]') as HTMLButtonElement;
    expect(button.getAttribute('aria-controls')).toBe('qualification-docs-apelacionId-21');
    expect(f.nativeElement.querySelector('#qualification-docs-apelacionId-21')).not.toBeNull();
    button.click(); f.detectChanges(); expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(f.componentInstance.groupOpen('Apelación')).toBe(false); f.componentInstance.documentSearch.set('Anexo'); f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true'); expect(button.disabled).toBe(true);
  });
  it('filtrar documentos por relación conserva el total real y no cambia las asociaciones', () => {
    const f = page(appeal({ tipoOrigen: 'SAIP_INTERNA', solicitudId: 31, solicitudExpediente: 'SAIP-31' }));
    http.expectOne(api + '/solicitudes/31').flush({ id: 31, expediente: 'SAIP-31', ciudadanoId: 4 }); f.componentInstance.cambiarTab('adjuntos');
    http.expectOne(req => req.url === api + '/documentos' && req.params.has('solicitudId')).flush([{ id: 61, solicitudId: 31, nombreOriginal: 'Solicitud.txt' }]);
    documentRequest().flush([doc()]); f.componentInstance.documentFilter.set('Solicitud SAIP de origen');
    expect(f.componentInstance.visibleGroups().flatMap(g => g.documents).map(d => d.id)).toEqual([61]); expect(f.componentInstance.documentCount()).toBe(2);
    http.expectNone(req => req.method !== 'GET');
  });
  it('la ausencia documental solo aparece tras una lista vacía confirmada', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); f.detectChanges(); expect(f.nativeElement.textContent).toContain('Consultando documentos');
    documentRequest().flush([]); f.detectChanges(); expect(f.componentInstance.documentError()).toBe('');
    expect(f.nativeElement.textContent).toContain('No hay documentos registrados en esta relación consultada');
  });
  it.each([401, 403, 404, 500, 503])('el error documental %i no se presenta como vacío ni conserva archivos previos', status => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]); f.componentInstance.cargarDocumentos();
    documentRequest().flush({ detail: 'detalle interno' }, { status, statusText: 'Failure' }); f.detectChanges();
    expect(f.componentInstance.documentGroups()).toEqual([]); expect(f.nativeElement.textContent).not.toContain('Anexo sintético.txt');
    expect(f.nativeElement.textContent).not.toContain('No hay documentos registrados en esta relación consultada'); expect(f.componentInstance.documentError()).toBeTruthy();
  });
  it('un fallo documental de red permite reintentar la lectura, sin escribir', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().error(new ProgressEvent('error'));
    f.componentInstance.cargarDocumentos(); documentRequest().flush([doc()]); expect(f.componentInstance.documentGroups()[0].documents.length).toBe(1); http.expectNone(req => req.method === 'POST');
  });
  it.each([
    [{ id: 51, apelacionId: 99 }], [{ id: 51, apelacionId: 21, solicitudId: 31 }], [{ id: 51 }],
    [{ id: 51, apelacionId: 21 }, { id: 51, apelacionId: 21 }], [{ id: 51, apelacionId: 21, estado: 'ELIMINADO' }],
  ].map(value => [value]))('no asocia documentos incompatibles ni los reemplaza: %j', value => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush(value); f.detectChanges();
    expect(f.componentInstance.documentGroups()).toEqual([]); expect(f.componentInstance.documentError()).toContain('incompleta');
    f.componentInstance.descargarDocumento(doc()); http.expectNone(req => req.url.endsWith('/download'));
  });
  it('no duplica consultas documentales al volver a la pestaña ni incluye SAIP sin ID vinculado', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([]);
    f.componentInstance.cambiarTab('apelacion'); f.componentInstance.cambiarTab('adjuntos'); http.expectNone(req => req.url === api + '/documentos');
  });
  it('consulta SAIP, respuesta y expediente únicamente mediante sus relaciones verificadas', () => {
    const f = page(appeal({ tipoOrigen: 'SAIP_INTERNA', solicitudId: 31, solicitudExpediente: 'SAIP-31', expedienteTtaip: { id: 61, numeroExpediente: expediente } }));
    http.expectOne(api + '/solicitudes/31').flush({ id: 31, expediente: 'SAIP-31', ciudadanoId: 4, respuesta: { id: 41, solicitudId: 31 } });
    f.componentInstance.cambiarTab('adjuntos'); const reqs = http.match(req => req.url === api + '/documentos');
    expect(reqs.map(req => req.request.params.toString()).sort()).toEqual(['apelacionId=21', 'expedienteTtaipId=61', 'respuestaId=41', 'solicitudId=31']);
    reqs.forEach(req => req.flush([])); expect(f.componentInstance.documentGroups().length).toBe(4);
  });
  it.each([401, 403, 404, 503])('previsualización fallida %i conserva un error y no genera archivo sustituto', status => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]);
    f.componentInstance.verDocumento(f.componentInstance.documentGroups()[0].documents[0]); f.detectChanges();
    http.expectOne(api + '/documentos/51/download').flush(null, { status, statusText: 'Failure' }); f.detectChanges();
    expect(document.body.querySelector('[role=dialog]')?.textContent).toContain(status === 401 ? 'sesión' : status === 403 ? 'permiso' : status === 404 ? 'No se encontró' : 'servidor');
    expect(f.componentInstance.successModalAbierto()).toBe(false); http.expectNone(req => req.url.includes('assets'));
  });
  it('cambiar recurso cancela la previsualización pendiente sin conservar contenido', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]);
    f.componentInstance.verDocumento(f.componentInstance.documentGroups()[0].documents[0]); f.detectChanges(); const old = http.expectOne(api + '/documentos/51/download');
    params.next(convertToParamMap({ expediente: 'EXP-22' })); f.detectChanges(); expect(old.cancelled).toBe(true);
    http.expectOne(api + '/apelaciones/expediente/EXP-22').flush(appeal({ id: 22, expediente: 'EXP-22' })); f.detectChanges();
    expect(f.componentInstance.previewTarget()).toBeNull(); expect(document.body.querySelector('[role=dialog]')).toBeNull();
  });
  it('una descarga fallida no confirma nada ni usa contenido canónico', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]);
    f.componentInstance.descargarDocumento(f.componentInstance.documentGroups()[0].documents[0]); http.expectOne(api + '/documentos/51/download').error(new ProgressEvent('error')); f.detectChanges();
    expect(f.componentInstance.downloadError()).toBeTruthy(); expect(f.componentInstance.successModalAbierto()).toBe(false); http.expectNone(req => req.url.includes('assets'));
  });
  it('descarga el Blob solicitado por ID y el nombre HTTP sin sustituirlo por un borrador', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:documento-sintetico');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Nombre del servidor.txt'); expect(this.href).toBe('blob:documento-sintetico');
    });
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]);
    f.componentInstance.descargarDocumento(f.componentInstance.documentGroups()[0].documents[0]); const blob = new Blob(['contenido sintético'], { type: 'text/plain' });
    http.expectOne(api + '/documentos/51/download').flush(blob, { headers: { 'Content-Disposition': 'attachment; filename="Nombre del servidor.txt"', 'Content-Type': 'text/plain' } });
    expect(create).toHaveBeenCalledWith(blob); expect(revoke).toHaveBeenCalledWith('blob:documento-sintetico'); expect(click).toHaveBeenCalledOnce();
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('cambiar decisión cancela una descarga pendiente y no dispara confirmación', () => {
    const f = page(); prepare(f); f.componentInstance.cambiarTab('adjuntos'); documentRequest().flush([doc()]);
    f.componentInstance.descargarDocumento(f.componentInstance.documentGroups()[0].documents[0]); const req = http.expectOne(api + '/documentos/51/download');
    f.componentInstance.seleccionarCalificacion('improcedente'); expect(req.cancelled).toBe(true); expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('un cambio de selección externo descarta la continuación de otra decisión', () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); const old = http.expectOne(api + '/ttaip/calificacion/21/admitir');
    f.componentInstance.selectedDecision.set('improcedente'); f.detectChanges();
    expect(old.cancelled).toBe(true); expect(f.componentInstance.resultadoIncierto()).toBe(true);
    f.componentInstance.recuperarResultado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(recorded());
    expect(f.componentInstance.successModalAbierto()).toBe(false); http.expectNone(req => req.method === 'POST');
  });
  it('las pestañas ofrecen controles enlazados y navegación con flechas, Home y End', () => {
    const f = page(); const first = f.nativeElement.querySelector('#qual-tab-apelacion') as HTMLButtonElement;
    first.focus(); first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); f.detectChanges(); documentRequest().flush([]);
    expect(f.componentInstance.activeTab()).toBe('adjuntos'); expect(document.activeElement?.id).toBe('qual-tab-adjuntos');
    const second = f.nativeElement.querySelector('#qual-tab-adjuntos') as HTMLButtonElement;
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); f.detectChanges();
    expect(document.activeElement?.id).toBe('qual-tab-apelacion'); expect(first.getAttribute('aria-controls')).toBe('qual-panel-apelacion');
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); f.detectChanges(); expect(document.activeElement?.id).toBe('qual-tab-adjuntos');
    http.expectNone(req => req.method !== 'GET');
  });
  it('confirmación contiene foco, admite Escape y lo devuelve sin registrar', async () => {
    const f = page(); prepare(f); f.detectChanges(); const opener = f.nativeElement.querySelector('#qualification-submit') as HTMLButtonElement;
    opener.focus(); opener.click(); f.detectChanges(); await Promise.resolve();
    const dialog = document.body.querySelector('[role=dialog]') as HTMLElement; expect(dialog.getAttribute('aria-label')).toBe('Confirme la calificación');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')]; controls.at(-1)!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); expect(document.activeElement).toBe(controls[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); await Promise.resolve();
    expect(f.componentInstance.confirmModalAbierto()).toBe(false); expect(document.activeElement).toBe(opener); http.expectNone(req => req.method === 'POST');
  });
  it('el resultado contiene foco y al cerrar lo dirige al registro recuperado, sin navegar', async () => {
    const f = page(); prepare(f); f.componentInstance.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(recorded());
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(recorded()); f.detectChanges(); await Promise.resolve();
    const dialog = document.body.querySelector('[role=dialog]') as HTMLElement; expect(dialog.contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); await Promise.resolve();
    expect(f.componentInstance.successModalAbierto()).toBe(false); expect(document.activeElement?.id).toBe('qualification-result');
  });
  it('conserva etiquetas, nombres extensos y el contexto de borrador sin fechas ni firmantes inventados', () => {
    const f = page(appeal({ ciudadanoNombre: 'Persona sintética '.repeat(30) })); prepare(f); f.componentInstance.togglePreview(); f.detectChanges();
    expect(f.nativeElement.querySelector('label[for=qualification-grounds]')).not.toBeNull();
    expect(f.nativeElement.querySelector('textarea')?.getAttribute('aria-describedby')).toContain('qualification-validation');
    expect(f.componentInstance.docCtx().fechaResolucion).toBeUndefined(); expect(f.componentInstance.docCtx().resolucionNro).toBeUndefined();
    expect(f.nativeElement.textContent).toContain('BORRADOR'); expect(f.componentInstance.docCtx().recurrente).toContain('Persona sintética');
    expect(f.nativeElement.querySelectorAll('h1').length).toBe(1); expect(f.nativeElement.textContent).not.toContain(expediente + '-C1');
  });
});
