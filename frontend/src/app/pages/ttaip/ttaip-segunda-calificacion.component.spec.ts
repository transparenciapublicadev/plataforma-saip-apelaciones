import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtaipSegundaCalificacionComponent } from './ttaip-segunda-calificacion.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('SecondQualificationForm — contexto y límites reales', () => {
  const api = environment.apiUrl, expediente = '00021-2026-JUS/TTAIP';
  const session = { success: true, token: 'sesion-sintetica-tribunal', usuarioId: 7, miembroId: 7, tipoUsuario: 'TTAIP' };
  const first = { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'INADMISIBLE', observaciones: 'Punto uno\nPunto dos', fechaResolucion: '2026-10-01' };
  const appeal = (patch: Record<string, unknown> = {}) => ({ id: 21, expediente, estado: 'EN_CALIFICACION_2',
    ciudadanoId: 4, ciudadanoNombre: 'Persona sintética', entidadId: 3, entidadNombre: 'Entidad sintética',
    fundamentos: 'Fundamentos históricos', tipoOrigen: 'EXTERNA', solicitudId: null,
    calificacionPrimera: 'INADMISIBLE', resolucionPrimeraCalificacion: first, calificacionSegunda: null,
    resolucionSegundaCalificacion: null, resoluciones: [first], documentos: [], documentosMetadata: [], ...patch });
  const registered = (patch: Record<string, unknown> = {}) => appeal({ estado: 'NOTIFICACION_SEGUNDA_CALIFICACION', calificacionSegunda: 'ADMITIDO',
    resolucionSegundaCalificacion: { id: 81, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO', numeroResolucion: 'REGISTRADA-81', fundamentos: 'Sustento registrado', fechaResolucion: '2026-10-27' }, ...patch });
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); params = new BehaviorSubject(convertToParamMap({ expediente }));
    TestBed.configureTestingModule({ imports: [TtaipSegundaCalificacionComponent], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params.value }, paramMap: params.asObservable() } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); } });
  function page(data: ReturnType<typeof appeal> = appeal()) {
    const f = TestBed.createComponent(TtaipSegundaCalificacionComponent); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(data); f.detectChanges(); return f;
  }
  const receiptUrl = api + '/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion';
  const aggregate = { id: 41, numeroExpediente: expediente };
  const receipt = (patch: Record<string, unknown> = {}) => ({ expedienteTtaipId: 41, apelacionId: 21, requerimientoId: 71, expediente,
    estado: 'RECIBIDA', recepcionId: 151, fechaRecepcion: '2026-10-28T10:00:00', fundamentosAdicionales: 'Correcciones recibidas', documentos: [], ...patch });
  function ready() { const f = page(appeal({ expedienteTtaip: aggregate })); http.expectOne(receiptUrl).flush(receipt()); f.detectChanges(); return f; }
  function prepare(f: ReturnType<typeof page>) { f.componentInstance.seleccionarDecision('admitido'); f.componentInstance.fundamentos = 'Sustento registrado'; }
  function commandResult(decision = 'ADMITIDO') { return registered({ expedienteTtaip: aggregate,
    estado: decision === 'ADMITIDO' ? 'NOTIFICACION_SEGUNDA_CALIFICACION' : 'RESUELTO_IMPROCEDENTE', calificacionSegunda: decision,
    resolucionSegundaCalificacion: { id: 81, tipoResolucion: 'SEGUNDA_CALIFICACION', decision, fundamentos: 'Sustento registrado', miembroTTAIPId: 7 } }); }

  it('consulta la recepción del agregado y requerimiento sin clave y acepta adjuntos opcionales vacíos', () => {
    const f = page(appeal({ expedienteTtaip: aggregate })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
    const r = http.expectOne(receiptUrl); expect(r.request.headers.get('Authorization')).toBe('Bearer ' + session.token);
    expect(r.request.params.keys()).toEqual([]); r.flush(receipt()); f.detectChanges();
    expect(f.componentInstance.canSubmit()).toBe(true); expect(f.nativeElement.textContent).toContain('Recepción sin adjuntos');
  });
  it('muestra únicamente los documentos asociados de la recepción consultada', () => {
    const f = page(appeal({ expedienteTtaip: aggregate })); http.expectOne(receiptUrl).flush(receipt({ documentos: [
      { id: 154, apelacionId: 21, tipoDocumento: 'SUBSANACION', estado: 'ACTIVO', nombreOriginal: 'Anexo recibido.txt' }
    ] })); f.detectChanges(); prepare(f); expect(f.componentInstance.canSubmit()).toBe(true);
    expect(f.nativeElement.textContent).toContain('Anexo recibido.txt'); expect(f.nativeElement.textContent).toContain('ID 154');
  });
  it.each(['admitido', 'improcedente'] as const)('registra %s con comando específico y exige recuperar el mismo ID antes del éxito', decision => {
    const f = ready(); const c = f.componentInstance; c.seleccionarDecision(decision); c.fundamentos = 'Sustento registrado'; c.enviarCalificacion(); c.enviarCalificacion();
    const post = http.expectOne(api + '/ttaip/calificacion/21/' + (decision === 'admitido' ? 'admitir' : 'inadmitir'));
    expect(post.request.body).toEqual({ fundamentos: 'Sustento registrado', miembroId: 7 });
    const result = commandResult(decision === 'admitido' ? 'ADMITIDO' : 'IMPROCEDENTE'); post.flush(result);
    expect(c.successModalAbierto()).toBe(false); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(result);
    expect(c.resultadoConfirmado()).toBe(true); expect(c.successModalAbierto()).toBe(true); expect(c.canSubmit()).toBe(false);
    expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it.each([401, 403, 404, 409, 500, 503, 0])('error de recepción %i no significa ausencia ni permite registrar', status => {
    const f = page(appeal({ expedienteTtaip: aggregate })); const r = http.expectOne(receiptUrl);
    if (status) r.flush(null, { status, statusText: 'Synthetic error' }); else r.error(new ProgressEvent('error'));
    prepare(f); expect(f.componentInstance.recepcion().estado).toBe('error'); expect(f.componentInstance.canSubmit()).toBe(false);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it.each([
    { estado: 'AUSENTE', recepcionId: null, fechaRecepcion: null, fundamentosAdicionales: null },
    { requerimientoId: 72 }, { apelacionId: 22 }, { expedienteTtaipId: 42 }, { documentos: [{ id: 4, apelacionId: 999, tipoDocumento: 'SUBSANACION' }] }
  ])('ausencia o relación incompatible bloquea el comando: %j', patch => {
    const f = page(appeal({ expedienteTtaip: aggregate })); http.expectOne(receiptUrl).flush(receipt(patch)); prepare(f);
    expect(f.componentInstance.recepcion().estado).toBe(patch.estado === 'AUSENTE' ? 'ausente' : 'incompatible');
    f.componentInstance.enviarCalificacion(); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it.each([400, 401, 403, 404, 409, 422])('rechazo del comando %i conserva texto sin éxito', status => {
    const f = ready(); prepare(f); const c = f.componentInstance; c.enviarCalificacion();
    http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(null, { status, statusText: 'Synthetic rejection' });
    expect(c.fundamentos).toBe('Sustento registrado'); expect(c.error()).not.toBe(''); expect(c.resultadoIncierto()).toBe(false); expect(c.successModalAbierto()).toBe(false);
  });
  it('pérdida de respuesta no atribuye una actuación por texto ni repite el comando al consultar', () => {
    const f = ready(); prepare(f); const c = f.componentInstance; c.enviarCalificacion();
    http.expectOne(api + '/ttaip/calificacion/21/admitir').error(new ProgressEvent('error'));
    expect(c.resultadoIncierto()).toBe(true); c.enviarCalificacion(); c.reintentarConsulta();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(commandResult());
    expect(c.registroObservado()).toBe(81); expect(c.resultadoIncierto()).toBe(true); expect(c.successModalAbierto()).toBe(false);
    expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it('recupera por ID conocido tras fallo de GET sin otra escritura', () => {
    const f = ready(); prepare(f); const c = f.componentInstance; c.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(commandResult());
    http.expectOne(api + '/apelaciones/expediente/' + expediente).error(new ProgressEvent('error')); expect(c.resultadoIncierto()).toBe(true);
    c.recuperarResultado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(commandResult()); expect(c.successModalAbierto()).toBe(true);
    expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it('no confirma si la recuperación devuelve otra actuación aunque coincidan fundamentos', () => {
    const f = ready(); prepare(f); const c = f.componentInstance; c.enviarCalificacion(); http.expectOne(api + '/ttaip/calificacion/21/admitir').flush(commandResult());
    const changed = commandResult(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush({ ...changed,
      resolucionSegundaCalificacion: { id: 82, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO', fundamentos: 'Sustento registrado', miembroTTAIPId: 7 } });
    expect(c.resultadoIncierto()).toBe(true); expect(c.successModalAbierto()).toBe(false); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it('descarta consulta de recepción anterior al cambiar recurso o sesión', () => {
    const f = page(appeal({ expedienteTtaip: aggregate })); const pending = http.expectOne(receiptUrl);
    params.next(convertToParamMap({ expediente: 'OTRO' })); f.detectChanges(); expect(pending.cancelled).toBe(true);
    http.expectOne(api + '/apelaciones/expediente/OTRO').flush(appeal({ id: 22, expediente: 'OTRO' }));
    expect(f.componentInstance.recepcion().datos).toBeUndefined(); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('cambiar sesión cancela POST pendiente y no inicia una continuación en la nueva cuenta', () => {
    const f = ready(); prepare(f); const c = f.componentInstance; c.enviarCalificacion(); const pending = http.expectOne(api + '/ttaip/calificacion/21/admitir');
    TestBed.inject(AuthService).guardarSesion({ ...session, token: 'otra-sesion', usuarioId: 8 }); f.detectChanges(); expect(pending.cancelled).toBe(true);
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(c.fundamentos).toBe(''); expect(c.recepcion().datos).toBeUndefined(); expect(c.successModalAbierto()).toBe(false);
  });
  it('no permite calificar otra vez durante notificación de la segunda actuación', () => {
    const f = page(registered()); f.componentInstance.selectedDecision.set('admitido'); f.componentInstance.fundamentos = 'Texto'; expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('una recarga fallida no mantiene el expediente anterior como utilizable', () => {
    const f = page(); f.componentInstance.cargarApelacion('EXP-22'); http.expectOne(api + '/apelaciones/expediente/EXP-22').flush(null, { status: 503, statusText: 'Unavailable' });
    expect(f.componentInstance.apelacion()).toBeNull();
  });
  it('rechaza un expediente distinto del solicitado', () => { const f = page(appeal({ id: 22, expediente: 'EXP-AJENO' })); expect(f.componentInstance.apelacion()).toBeNull(); });
  it('no recorta el texto histórico para convertir una cola en recepción', () => {
    const historical = 'Original\n--- SUBSANACIÓN ---\nTexto sin relación acreditada'; const f = page(appeal({ fundamentos: historical }));
    expect(f.componentInstance.getOriginalFundamentos()).toBe(historical);
  });
  it('no atribuye archivos a un requerimiento por su tipo o nombre', () => {
    const f = page(appeal({ documentos: [{ id: 51, tipoDocumento: 'SUBSANACION', nombreArchivo: 'Anexo-no-probatorio.pdf' }] }));
    expect(f.nativeElement.textContent).not.toContain('Anexo-no-probatorio.pdf');
  });
  it('una lista vacía no se transforma en ausencia de recepción ni valida campos fuera del contrato', () => {
    const f = page(appeal({ documentos: [], fundamentosSubsanacion: 'Este campo no pertenece al DTO actual' }));
    expect(f.nativeElement.textContent).not.toContain('El backend no registra documentos de subsanación');
    expect(f.nativeElement.textContent).not.toContain('Este campo no pertenece al DTO actual');
  });
  it('sin consulta institucional de recepción no ejecuta ningún comando, tampoco repetido', () => {
    const f = page(); f.componentInstance.selectedDecision.set('admitido'); f.componentInstance.fundamentos = 'Fundamentos del operador';
    f.componentInstance.enviarCalificacion(); f.componentInstance.enviarCalificacion(); const writes = http.match(req => req.method === 'POST');
    writes.forEach(req => req.flush(null, { status: 403, statusText: 'Forbidden' })); expect(writes.length).toBe(0);
  });
  it('tener por no presentado no se ofrece como segunda calificación desde EN_CALIFICACION_2', () => {
    const f = page(); f.componentInstance.seleccionarDecision('no_presentado'); f.componentInstance.fundamentos = 'Texto'; expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('el texto de próximos pasos no atribuye avance a resolución ni plazo local a una admisión registrada', () => {
    const f = page(registered()); f.componentInstance.selectedDecision.set('admitido');
    expect(f.componentInstance.segundaNextSteps().some(step => !!step.hint)).toBe(false);
  });
  it('cambiar ruta cancela la consulta anterior y usa el nuevo expediente', () => {
    const f = TestBed.createComponent(TtaipSegundaCalificacionComponent); f.detectChanges(); const old = http.expectOne(api + '/apelaciones/expediente/' + expediente);
    params.next(convertToParamMap({ expediente: 'EXP-22' })); f.detectChanges();
    http.match(api + '/apelaciones/expediente/EXP-22').forEach(req => req.flush(appeal({ id: 22, expediente: 'EXP-22' }))); expect(old.cancelled).toBe(true);
  });
  it('destruir cancela la consulta', () => {
    const f = TestBed.createComponent(TtaipSegundaCalificacionComponent); f.detectChanges(); const req = http.expectOne(api + '/apelaciones/expediente/' + expediente);
    f.destroy(); expect(req.cancelled).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422, 500, 503])('distingue error HTTP %i de ausencia y no muestra el expediente anterior', status => {
    const f = page(); f.componentInstance.reintentarConsulta();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status, statusText: 'Synthetic rejection' }); f.detectChanges();
    expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.loadError()).not.toBe('');
    expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(f.componentInstance.canSubmit()).toBe(false);
    expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('permite reintentar una consulta de red sin perder fundamentos locales del mismo requerimiento', () => {
    const f = page(); const c = f.componentInstance; c.seleccionarDecision('admitido'); c.fundamentos = 'Borrador en memoria'; c.reintentarConsulta();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).error(new ProgressEvent('error')); f.detectChanges();
    expect(c.loadError()).not.toBe(''); expect(c.fundamentos).toBe('Borrador en memoria'); expect(c.apelacion()).toBeNull();
    c.reintentarConsulta(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(appeal()); f.detectChanges();
    expect(c.fundamentos).toBe('Borrador en memoria'); expect(c.puedePrepararBorrador()).toBe(true);
  });
  it.each([
    { resolucionPrimeraCalificacion: null },
    { resolucionPrimeraCalificacion: { ...first, apelacionId: 999 } },
    { resolucionPrimeraCalificacion: { ...first, tipoResolucion: 'FINAL' } },
    { resolucionPrimeraCalificacion: { ...first, decision: 'ADMISIBLE' } },
    { calificacionSegunda: undefined },
    { resolucionSegundaCalificacion: undefined },
    { resoluciones: undefined },
    { expedienteTtaip: { id: 4, numeroExpediente: 'OTRO' } },
    { plazoSubsanacion: { requerimientoId: 999 } }
  ])('no prepara borrador con asociaciones o evidencias incompletas: %j', patch => {
    const c = page(appeal(patch)).componentInstance; expect(c.contexto()).toBe('incompleto'); expect(c.puedePrepararBorrador()).toBe(false);
  });
  it.each(['EN_SUBSANACION', 'EN_CALIFICACION_1', 'EN_RESOLUCION', 'RESUELTO_IMPROCEDENTE'])('no extrapola segunda calificación al estado %s', estado => {
    const c = page(appeal({ estado })).componentInstance; c.seleccionarDecision('admitido'); expect(c.selectedDecision()).toBeNull(); expect(c.puedePrepararBorrador()).toBe(false);
  });
  it('cambiar requerimiento en la consulta elimina el borrador anterior', () => {
    const f = page(); const c = f.componentInstance; c.seleccionarDecision('admitido'); c.fundamentos = 'Del requerimiento anterior'; c.reintentarConsulta();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(appeal({ resolucionPrimeraCalificacion: { ...first, id: 72 } }));
    expect(c.requerimiento()?.id).toBe(72); expect(c.fundamentos).toBe(''); expect(c.selectedDecision()).toBeNull();
  });
  it('rechaza que el mismo código pase a identificar otra apelación al recargar', () => {
    const c = page().componentInstance; c.reintentarConsulta(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(appeal({ id: 22 }));
    expect(c.apelacion()).toBeNull(); expect(c.loadError()).not.toBe('');
  });
  it.each([
    { estado: 'PENDIENTE_INICIO', requerimientoId: 71, diasHabiles: 2, fechaEficacia: null, fechaLimite: null, diasHabilesRestantes: null, notificacionId: null, expected: 'Inicio pendiente de acreditación' },
    { estado: 'EN_CURSO', requerimientoId: 71, diasHabiles: 2, fechaEficacia: '2026-10-22', fechaLimite: '2026-10-26', diasHabilesRestantes: 0, notificacionId: 61, expected: 'En curso · 0 días hábiles informados' },
    { estado: 'VENCIDO', requerimientoId: 71, diasHabiles: 2, fechaEficacia: '2026-10-22', fechaLimite: '2026-10-26', diasHabilesRestantes: -1, notificacionId: 61, expected: 'Vencido según el servidor' },
    { estado: 'PENDIENTE_INICIO', requerimientoId: 71, diasHabiles: 2, fechaEficacia: '2026-10-22', expected: 'Reloj incompleto' },
    { estado: 'EN_CURSO', requerimientoId: 71, diasHabiles: 2, diasHabilesRestantes: 1, expected: 'Reloj incompleto' },
    { estado: 'DESCONOCIDO', requerimientoId: 71, diasHabiles: 2, expected: 'Reloj incompleto' },
    { estado: 'EN_CURSO', requerimientoId: 72, diasHabiles: 2, expected: 'Reloj incompleto o de otro requerimiento' }
  ])('solo muestra el reloj acreditado del servidor: $expected', ({ expected, ...plazoSubsanacion }) => {
    const c = page(appeal({ plazoSubsanacion })).componentInstance; expect(c.relojTexto()).toBe(expected); expect(c.canSubmit()).toBe(false);
  });
  it('no sustituye un reloj ausente por fecha de primera calificación ni hoy', () => {
    const f = page(); expect(f.componentInstance.relojTexto()).toBe('Reloj no informado'); expect(f.nativeElement.textContent).toContain('No se calcula un calendario local');
  });
  it('la revisión conserva la decisión y no registra al cerrar', () => {
    const f = ready(); const c = f.componentInstance; c.seleccionarDecision('improcedente'); c.fundamentos = 'Sustento local'; c.abrirConfirmacionCalificacion(); f.detectChanges();
    expect(c.confirmModalAbierto()).toBe(true); expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Registro de actuación');
    c.confirmModalAbierto.set(false); expect(c.fundamentos).toBe('Sustento local'); expect(c.successModalAbierto()).toBe(false);
    expect(http.match(req => req.method !== 'GET')).toHaveLength(0);
  });
  it('exige selección y fundamentos explícitos para revisar, respetando el límite de 5000', () => {
    const c = page().componentInstance; c.abrirConfirmacionCalificacion(); expect(c.confirmModalAbierto()).toBe(false);
    c.seleccionarDecision('admitido'); c.fundamentos = '   '; c.abrirConfirmacionCalificacion(); expect(c.confirmModalAbierto()).toBe(false);
    c.fundamentos = 'x'.repeat(5001); expect(c.validacionBorrador()).toContain('5000'); c.fundamentos = 'x'.repeat(5000); expect(c.validacionBorrador()).toBe('');
  });
  it('consulta la segunda actuación por su ID sin atribuirla a un envío ni inventar número', () => {
    const f = page(registered({ resolucionSegundaCalificacion: { id: 81, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO', fundamentos: 'Persistido' } })); const c = f.componentInstance;
    c.verActuacionRegistrada(); f.detectChanges(); expect(c.segundaActuacion()?.id).toBe(81); expect(c.successModalAbierto()).toBe(true);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('no es una confirmación de envío'); expect(f.nativeElement.textContent).toContain('Sin numeración registrada');
    expect(http.match(req => req.method !== 'GET')).toHaveLength(0);
  });
  it.each([
    { id: 81, tipoResolucion: 'FINAL', decision: 'ADMITIDO' },
    { id: 81, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'IMPROCEDENTE' },
    { id: 81, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO', apelacionId: 99 },
    { tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO' }
  ])('no presenta una segunda actuación contradictoria como registro consultado: %j', resolucionSegundaCalificacion => {
    const c = page(registered({ resolucionSegundaCalificacion })).componentInstance; c.verActuacionRegistrada(); expect(c.segundaActuacion()).toBeNull(); expect(c.successModalAbierto()).toBe(false);
  });
  it('la segunda improcedencia consultada no se presenta como segunda admisión', () => {
    const c = page(registered({ estado: 'RESUELTO_IMPROCEDENTE', calificacionSegunda: 'IMPROCEDENTE', resolucionSegundaCalificacion: { id: 81, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'IMPROCEDENTE' } })).componentInstance;
    expect(c.segundaNextSteps()[0].label).toContain('Improcedencia registrada'); expect(c.segundaNextSteps()[0].label).not.toContain('admisión');
  });
  function docs(f: ReturnType<typeof page>, values: unknown[] = []) {
    f.componentInstance.cambiarTab('adjuntos');
    const queries = http.match(req => req.url === api + '/documentos');
    expect(queries.map(req => req.request.params.keys()[0]).sort()).toEqual(['apelacionId', 'resolucionId']);
    queries.forEach(req => req.flush(req.request.params.has('apelacionId') ? values : [])); f.detectChanges();
  }
  const doc = { id: 51, apelacionId: 21, nombreOriginal: 'Anexo conocido.pdf', contentType: 'application/pdf', estado: 'ACTIVO' };
  it('consulta documentos por relaciones exactas, sin buscar claves ciudadanas de recepción', () => {
    const f = page(); docs(f, [doc]); expect(f.componentInstance.documentCount()).toBe(1); expect(f.nativeElement.textContent).toContain(doc.nombreOriginal);
    expect(f.nativeElement.textContent).toContain('sin atribuir recepción'); expect(http.match(req => /recepcion|subsanacion/.test(req.url))).toHaveLength(0);
  });
  it('distingue lista documental vacía de prueba de ausencia de presentación', () => {
    const f = page(); docs(f); expect(f.nativeElement.textContent).toContain('No acredita ausencia de recepción'); expect(f.componentInstance.documentError()).toBe('');
  });
  it.each([{ values: [{ ...doc, apelacionId: 22 }] }, { values: [{ ...doc, resolucionId: 71 }] }, { values: [doc, doc] }, { values: [{ ...doc, id: null }] }])('rechaza asociaciones documentales contradictorias: %j', ({ values }) => {
    const f = page(); docs(f, values); expect(f.componentInstance.documentCount()).toBe(0); expect(f.componentInstance.documentError()).not.toBe('');
  });
  it('un error documental no crea documentos y permite una consulta posterior', () => {
    const f = page(); f.componentInstance.cambiarTab('adjuntos'); const qs = http.match(req => req.url === api + '/documentos');
    qs[0].flush(null, { status: 403, statusText: 'Forbidden' }); qs.slice(1).filter(r => !r.cancelled).forEach(r => r.flush([])); f.detectChanges();
    expect(f.componentInstance.documentError()).not.toBe(''); expect(f.componentInstance.documentCount()).toBe(0);
    f.componentInstance.cargarDocumentos(); http.match(req => req.url === api + '/documentos').forEach(req => req.flush(req.request.params.has('apelacionId') ? [doc] : []));
    expect(f.componentInstance.documentCount()).toBe(1); expect(f.componentInstance.documentError()).toBe('');
  });
  it('solo previsualiza un documento presente en el grupo autorizado actual', () => {
    const f = page(); docs(f, [doc]); const c = f.componentInstance; c.verDocumento({ ...doc, id: 999 }); expect(c.previewTarget()).toBeNull();
    c.verDocumento(c.documentGroups()[0].documents[0]); expect(c.previewTarget()?.id).toBe(51); expect(c.previewTarget()?.expediente).toBe(expediente);
  });
  it.each([401, 403, 404, 500])('descarga HTTP %i no genera sustitutos ni confirma éxito', status => {
    const create = vi.spyOn(URL, 'createObjectURL'); const f = page(); docs(f, [doc]); const c = f.componentInstance; c.descargarDocumento(c.documentGroups()[0].documents[0]);
    http.expectOne(api + '/documentos/51/download').flush(null, { status, statusText: 'Synthetic failure' });
    expect(create).not.toHaveBeenCalled(); expect(c.downloadError()).not.toBe(''); expect(c.downloadingId()).toBeNull(); expect(c.successModalAbierto()).toBe(false);
  });
  it('descarga el Blob autorizado del ID exacto y revoca la URL sin sustituir bytes', () => {
    const f = page(); docs(f, [doc]); const c = f.componentInstance; const blob = new Blob(['contenido sintético'], { type: 'application/pdf' });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    c.descargarDocumento(c.documentGroups()[0].documents[0]); const req = http.expectOne(api + '/documentos/51/download');
    expect(req.request.headers.get('Authorization')).toBe('Bearer ' + session.token); req.flush(blob);
    expect(create).toHaveBeenCalledWith(blob); expect(click).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:synthetic');
  });
  it('cambiar decisión cancela descarga y previsualización anteriores sin escritura', () => {
    const f = page(); docs(f, [doc]); const c = f.componentInstance; c.seleccionarDecision('admitido'); const current = c.documentGroups()[0].documents[0];
    c.verDocumento(current); c.descargarDocumento(current); const req = http.expectOne(api + '/documentos/51/download'); c.seleccionarDecision('improcedente');
    expect(req.cancelled).toBe(true); expect(c.previewTarget()).toBeNull(); expect(c.downloadingId()).toBeNull();
  });
  it('cambiar sesión cancela descarga y elimina el borrador y registro consultado', () => {
    const f = page(); docs(f, [doc]); const c = f.componentInstance; c.seleccionarDecision('admitido'); c.fundamentos = 'Texto privado'; c.descargarDocumento(c.documentGroups()[0].documents[0]);
    const req = http.expectOne(api + '/documentos/51/download'); TestBed.inject(AuthService).guardarSesion({ ...session, token: 'otra-sesion', usuarioId: 8 }); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 403, statusText: 'Forbidden' }); f.detectChanges();
    expect(req.cancelled).toBe(true); expect(c.fundamentos).toBe(''); expect(c.apelacion()).toBeNull(); expect(c.documentCount()).toBe(0); expect(c.previewTarget()).toBeNull();
  });
  it('las pestañas se recorren por teclado y anuncian el panel correcto', () => {
    const f = page(); const firstTab = f.nativeElement.querySelector('#second-tab-subsanacion') as HTMLButtonElement; firstTab.focus();
    firstTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    http.match(req => req.url === api + '/documentos').forEach(req => req.flush([])); f.detectChanges();
    const lastTab = f.nativeElement.querySelector('#second-tab-adjuntos') as HTMLButtonElement;
    expect(document.activeElement).toBe(lastTab); expect(lastTab.getAttribute('aria-selected')).toBe('true'); expect(firstTab.tabIndex).toBe(-1);
    lastTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); f.detectChanges();
    expect(document.activeElement).toBe(firstTab); expect(f.nativeElement.querySelector('#second-panel-adjuntos').hidden).toBe(true);
  });
  it('navega al expediente real y no inventa una ruta de notificación', () => {
    const c = page().componentInstance; const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true); c.irExpediente();
    expect(nav).toHaveBeenCalledExactlyOnceWith(['/ttaip/apelacion', expediente]);
  });
  it('la revisión tiene nombre, foco contenido, Escape y retorno al control de apertura', async () => {
    const f = ready(); const c = f.componentInstance; c.seleccionarDecision('admitido'); c.fundamentos = 'Texto local'; f.detectChanges();
    const opener = f.nativeElement.querySelector('#second-review') as HTMLButtonElement; opener.focus(); opener.click(); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Confirmar segunda calificación'); expect(dialog.contains(document.activeElement)).toBe(true);
    const controls = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); controls.at(-1)!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(controls[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges();
    expect(c.confirmModalAbierto()).toBe(false); expect(document.activeElement).toBe(opener); expect(http.match(req => req.method !== 'GET')).toHaveLength(0);
  });
  it('la búsqueda y los filtros documentales no hacen consultas nuevas ni cambian relaciones', () => {
    const f = page(); docs(f, [doc, ...[52, 53, 54].map(id => ({ ...doc, id, nombreOriginal: 'Informe ' + id + '.pdf' }))]); const c = f.componentInstance;
    c.documentSearch.set('ANEXO'); f.detectChanges(); expect(c.visibleGroups()[0].documents.map(d => d.id)).toEqual([51]);
    c.documentFilter.set('Primera calificación y requerimiento'); expect(c.visibleGroups()).toEqual([]);
    c.documentSearch.set(''); c.documentFilter.set(''); expect(c.documentCount()).toBe(4); expect(http.match(req => req.url === api + '/documentos')).toHaveLength(0);
  });
  it('cambiar ruta cancela la lista documental pendiente y elimina el contenido anterior', () => {
    const f = page(); const c = f.componentInstance; c.cambiarTab('adjuntos'); const previous = http.match(req => req.url === api + '/documentos');
    params.next(convertToParamMap({ expediente: 'EXP-22' })); f.detectChanges();
    http.expectOne(api + '/apelaciones/expediente/EXP-22').flush(null, { status: 404, statusText: 'Not Found' });
    expect(previous.every(req => req.cancelled)).toBe(true); expect(c.apelacion()).toBeNull(); expect(c.documentGroups()).toEqual([]); expect(c.activeTab()).toBe('subsanacion');
  });
  it('una sesión sin rol institucional no inicia una consulta privada', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, tipoUsuario: 'CIUDADANO' });
    const f = TestBed.createComponent(TtaipSegundaCalificacionComponent); f.detectChanges(); expect(f.componentInstance.apelacion()).toBeNull();
    expect(f.componentInstance.loadError()).toContain('acceso interno'); expect(http.match(() => true)).toHaveLength(0);
  });
  it('la revisión se cierra y pierde el borrador al pasar a otra apelación', () => {
    const f = page(); const c = f.componentInstance; c.seleccionarDecision('admitido'); c.fundamentos = 'Anterior'; c.abrirConfirmacionCalificacion(); f.detectChanges();
    params.next(convertToParamMap({ expediente: 'EXP-22' })); f.detectChanges(); http.expectOne(api + '/apelaciones/expediente/EXP-22').flush(appeal({ id: 22, expediente: 'EXP-22' })); f.detectChanges();
    expect(c.fundamentos).toBe(''); expect(c.confirmModalAbierto()).toBe(false); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(c.apelacion()?.id).toBe(22);
  });
});
