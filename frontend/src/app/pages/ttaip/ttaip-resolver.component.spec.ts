import { ConsultaAdmision, InformacionComplementaria, PresentacionAdmision, TtaipActuacionesService } from '../../services/ttaip-actuaciones.service';
import { of as respuestaActuaciones } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtaipResolverComponent } from './ttaip-resolver.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

const expediente = '00031-2026-JUS/TTAIP';
const first = { id: 71, tipoResolucion: 'PRIMERA_CALIFICACION', decision: 'ADMISIBLE', fundamentos: 'Admisión', fechaResolucion: '2026-10-01T10:00:00',
  cedulas: [{ id: 61, destinatario: 'CIUDADANO' }, { id: 62, destinatario: 'ENTIDAD_PUBLICA' }], documentos: [] };
const notifications = [61, 62].map((cedulaId, i) => ({ id: 91 + i, cedulaId, destinatario: i === 0 ? 'CIUDADANO' : 'ENTIDAD_PUBLICA',
  estado: 'ENTREGADA', estadoAcuse: 'ENTREGADO', fechaAcuse: '2026-10-02T10:00:00', acuseAutomatico: 'Acuse sintético', medio: 'CASILLA_ELECTRONICA' }));
const history = notifications.map(n => ({ id: n.id + 100, tipoEvento: 'ACUSE_NOTIFICACION_REGISTRADO', referencia: 'NOTIFICACION-' + n.id + ':ACUSE:ENTREGADO' }));
const descargo = { id: 81, expedienteTtaipId: 41, numeroExpediente: expediente, apelacionId: 31, entidadId: 3,
  estadoDescargo: 'PRESENTADO', fechaRequerimiento: '2026-10-02', fechaPresentacion: '2026-10-05', resumenDescargo: 'Descargo sintético' };
const appeal = (patch: Record<string, unknown> = {}) => ({ id: 31, expediente, estado: 'EN_RESOLUCION', resuelta: false, resultado: null,
  ciudadanoId: 4, ciudadanoNombre: 'Persona sintética', entidadId: 3, entidadNombre: 'Entidad sintética', tipoOrigen: 'EXTERNA', solicitudId: null,
  fundamentos: 'Argumentos registrados', tipoDenegatoria: 'EXPRESA', resumenRespuestaEntidad: 'Respuesta declarada',
  calificacionPrimera: 'ADMISIBLE', resolucionPrimeraCalificacion: first, calificacionSegunda: null, resolucionSegundaCalificacion: null,
  resolucion: null, resoluciones: [first], documentos: [], documentosMetadata: [], expedienteTtaip: { id: 41, numeroExpediente: expediente,
    resoluciones: [first], notificaciones: notifications, historial: history, descargosEntidad: [descargo] }, ...patch });
const finalRecord = { id: 101, tipoResolucion: 'RESOLUCION_FINAL', decision: 'INFUNDADO', fundamentos: 'Sustento final', miembroTTAIPId: 7, numeroResolucion: 'REGISTRADA-101' };
const resolved = (patch: Record<string, unknown> = {}) => appeal({ estado: 'RESUELTO_INFUNDADO', resuelta: true, resultado: 'INFUNDADO', resolucion: finalRecord, ...patch });

describe('FinalResolutionForm — contexto, registro y documentos', () => {
  const api = environment.apiUrl;
  const session = { success: true, token: 'sesion-sintetica-tribunal', usuarioId: 7, miembroId: 7, tipoUsuario: 'TTAIP' };
  let http: HttpTestingController; let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); params = new BehaviorSubject(convertToParamMap({ expediente }));
    TestBed.configureTestingModule({ imports: [TtaipResolverComponent], providers: [provideRouter([]),
      { provide: TtaipActuacionesService, useValue: {
        documentos: () => respuestaActuaciones(['RESOLUCION', 'CIUDADANO', 'ENTIDAD_PUBLICA'].map((clave, i) => ({
          clave, decision: 'INFUNDADO', numero: '2026-' + i, sala: 'PRIMERA SALA', archivo: { id: 90 + i, nombreOriginal: 'firmado.pdf' },
        }))),
        informacion: () => respuestaActuaciones({ solicitudes: [], puedeSolicitar: false, diasSuspendidos: 0 }),
        presentacionesAdmision: () => respuestaActuaciones({ descargo: null, presentaciones: [] }),
      } },
 provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params.value }, paramMap: params.asObservable() } }] });
    http = TestBed.inject(HttpTestingController); TestBed.inject(AuthService).guardarSesion(session);
  });
  afterEach(() => { try { http.verify({ ignoreCancelled: true }); } finally { TestBed.resetTestingModule(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); } });
  function page(data = appeal()) {
    const f = TestBed.createComponent(TtaipResolverComponent); f.detectChanges(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(data); f.detectChanges(); return f;
  }
  function prepare(f: ReturnType<typeof page>) { f.componentInstance.selectedDecision.set('infundado'); f.componentInstance.fundamentos = 'Sustento final'; }
  it('rechaza una apelación diferente del código solicitado', () => { const c = page(appeal({ id: 32, expediente: 'AJENO' })).componentInstance; expect(c.apelacion()).toBeNull(); });
  it('una consulta fallida elimina el expediente previo', () => {
    const c = page().componentInstance; c.cargarApelacion('OTRO'); http.expectOne(api + '/apelaciones/expediente/OTRO').flush(null, { status: 503, statusText: 'Unavailable' }); expect(c.apelacion()).toBeNull();
  });
  it('con notificaciones acreditadas permite resolver sin descargos', () => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, descargosEntidad: [] } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(true);
  });
  it('una resolución final previa impide otra operación incluso con estado incoherente', () => { const f = page(resolved({ estado: 'EN_RESOLUCION' })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false); });
  it('tener por no presentado no es una resolución final desde EN_RESOLUCION', () => { const c = page().componentInstance; c.seleccionarDecision('no_presentado'); expect(c.selectedDecision()).toBeNull(); });
  it('una admisión pendiente de notificación eficaz no habilita el registro', () => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, notificaciones: notifications.map(n => ({ ...n, estado: 'PENDIENTE' })) } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('no inventa un plazo de cumplimiento a partir del selector local', () => { const c = page().componentInstance; c.selectedDecision.set('fundado'); c.ordenarEntrega = true; expect(c.resolucionPlazoDias()).toBeNull(); });
  it('un doble clic no repite el comando mientras está pendiente', () => {
    const f = page(); prepare(f); f.componentInstance.enviarResolucion(); f.componentInstance.enviarResolucion(); const writes = http.match(req => req.method === 'POST'); writes.forEach(req => req.flush(null, { status: 409, statusText: 'Conflict' })); expect(writes).toHaveLength(1);
  });
  it('la respuesta del comando requiere recuperación por GET antes de confirmar', () => {
    const f = page(); prepare(f); f.componentInstance.enviarResolucion(); http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(resolved());
    const reads = http.match(api + '/apelaciones/expediente/' + expediente); expect(f.componentInstance.successModalAbierto()).toBe(false); reads.forEach(r => r.flush(resolved())); expect(reads).toHaveLength(1);
  });
  it('cambiar ruta cancela la lectura anterior', () => {
    const f = TestBed.createComponent(TtaipResolverComponent); f.detectChanges(); const previous = http.expectOne(api + '/apelaciones/expediente/' + expediente);
    params.next(convertToParamMap({ expediente: 'OTRO' })); f.detectChanges(); http.match(api + '/apelaciones/expediente/OTRO').forEach(r => r.flush(appeal({ expediente: 'OTRO', id: 32 }))); expect(previous.cancelled).toBe(true);
  });
  it('destruir cancela la lectura', () => { const f = TestBed.createComponent(TtaipResolverComponent); f.detectChanges(); const req = http.expectOne(api + '/apelaciones/expediente/' + expediente); f.destroy(); expect(req.cancelled).toBe(true); });
  it.each([400, 401, 403, 404, 422, 500, 503])('consulta HTTP %i no muestra el expediente anterior ni ausencia ficticia', status => {
    const f = page(); const c = f.componentInstance; c.cargarApelacion('OTRO'); http.expectOne(api + '/apelaciones/expediente/OTRO').flush(null, { status, statusText: 'Synthetic error' }); f.detectChanges();
    expect(c.apelacion()).toBeNull(); expect(c.loadError()).not.toBe(''); expect(f.nativeElement.textContent).not.toContain('Persona sintética'); expect(c.successModalAbierto()).toBe(false);
  });
  it('conserva el texto ante error de red en una lectura del mismo contexto y permite reintentar', () => {
    const c = page().componentInstance; c.fundamentos = 'En memoria'; c.consultarEstado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).error(new ProgressEvent('error'));
    expect(c.apelacion()).toBeNull(); expect(c.fundamentos).toBe('En memoria'); c.consultarEstado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(appeal()); expect(c.puedeEmitirResolucion()).toBe(true);
  });
  it.each([
    { resuelta: undefined }, { resolucion: undefined }, { calificacionSegunda: undefined }, { resoluciones: undefined },
    { resolucionPrimeraCalificacion: null }, { resolucionPrimeraCalificacion: { ...first, apelacionId: 999 } },
    { expedienteTtaip: { ...appeal().expedienteTtaip, numeroExpediente: 'AJENO' } }, { expedienteTtaip: null },
    { resolucionPrimeraCalificacion: { ...first, tipoResolucion: 'RESOLUCION_FINAL' } }
  ])('datos incompletos o contradictorios no habilitan resolución: %j', patch => {
    const f = page(appeal(patch)); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false); expect(f.componentInstance.motivoNoDisponible()).not.toBe('');
  });
  it('la segunda admisión no habilita registro mientras la consulta institucional esté pendiente', () => {
    const f = page(appeal({ calificacionPrimera: 'INADMISIBLE', resolucionPrimeraCalificacion: { ...first, decision: 'INADMISIBLE' }, calificacionSegunda: 'ADMITIDO',
      resolucionSegundaCalificacion: { ...first, id: 72, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO' } })); prepare(f);
    expect(f.componentInstance.canSubmit()).toBe(false); f.componentInstance.enviarResolucion(); expect(http.match(req => req.method !== 'GET')).toHaveLength(0);
    http.expectOne(api + '/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance.recepcion().estado).toBe('error'); expect(f.componentInstance.canSubmit()).toBe(false);
  });

  const receiptUrl = api + '/ttaip/expedientes/41/requerimientos/71/subsanacion/recepcion';
  const second = { ...first, id: 72, tipoResolucion: 'SEGUNDA_CALIFICACION', decision: 'ADMITIDO' };
  function afterSecond(patch: Record<string, unknown> = {}) { return appeal({ calificacionPrimera: 'INADMISIBLE',
    resolucionPrimeraCalificacion: { ...first, decision: 'INADMISIBLE' }, calificacionSegunda: 'ADMITIDO', resolucionSegundaCalificacion: second,
    resoluciones: [{ ...first, decision: 'INADMISIBLE' }, second], ...patch }); }
  const receipt = (patch: Record<string, unknown> = {}) => ({ expedienteTtaipId: 41, apelacionId: 31, requerimientoId: 71, expediente,
    estado: 'RECIBIDA', recepcionId: 151, fechaRecepcion: '2026-10-28T10:00:00', fundamentosAdicionales: 'Corrección sintética', documentos: [], ...patch });
  it('segunda admisión con recepción, ambas eficacias y descargos habilita el comando final existente', () => {
    const f = page(afterSecond()); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
    http.expectOne(receiptUrl).flush(receipt()); f.detectChanges(); expect(f.componentInstance.canSubmit()).toBe(true);
    f.componentInstance.enviarResolucion(); http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(afterSecond({ estado: 'RESUELTO_INFUNDADO', resuelta: true, resultado: 'INFUNDADO', resolucion: finalRecord }));
    expect(f.componentInstance.successModalAbierto()).toBe(false);
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(afterSecond({ estado: 'RESUELTO_INFUNDADO', resuelta: true, resultado: 'INFUNDADO', resolucion: finalRecord }));
    expect(f.componentInstance.resultadoConfirmado()).toBe(true); expect(f.componentInstance.successModalAbierto()).toBe(true);
  });
  it.each([
    { notificaciones: notifications.slice(0, 1) }, { notificaciones: notifications.map(n => ({ ...n, estado: 'FALLIDA' })) },
    { historial: [] }
  ])('la recepción no sustituye otras precondiciones finales: %j', patch => {
    const f = page(afterSecond({ expedienteTtaip: { ...appeal().expedienteTtaip, ...patch } })); http.expectOne(receiptUrl).flush(receipt()); prepare(f);
    expect(f.componentInstance.canSubmit()).toBe(false); f.componentInstance.enviarResolucion(); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it.each([
    { estado: 'AUSENTE', recepcionId: null, fechaRecepcion: null, fundamentosAdicionales: null },
    { requerimientoId: 999 }, { apelacionId: 999 }, { expedienteTtaipId: 999 }, { documentos: undefined }
  ])('recepción ausente o incompatible no permite la resolución: %j', patch => {
    const f = page(afterSecond()); http.expectOne(receiptUrl).flush(receipt(patch)); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it.each([401, 403, 404, 409, 500, 0])('error de consulta institucional %i no es ausencia ni éxito', status => {
    const f = page(afterSecond()); const r = http.expectOne(receiptUrl); if (status) r.flush(null, { status, statusText: 'Synthetic error' }); else r.error(new ProgressEvent('error'));
    prepare(f); expect(f.componentInstance.recepcion().estado).toBe('error'); expect(f.componentInstance.canSubmit()).toBe(false); expect(f.componentInstance.successModalAbierto()).toBe(false);
  });
  it('cambiar sesión cancela la consulta institucional y limpia la recepción anterior', () => {
    const f = page(afterSecond()); const r = http.expectOne(receiptUrl); TestBed.inject(AuthService).guardarSesion({ ...session, token: 'otra', usuarioId: 8 }); f.detectChanges();
    expect(r.cancelled).toBe(true); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(f.componentInstance.recepcion().datos).toBeUndefined(); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it.each(['PENDIENTE', 'FALLIDA', 'OBSERVADA', 'ENVIADA'])('notificación %s no equivale a eficacia', estado => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, notificaciones: notifications.map(n => ({ ...n, estado })) } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it.each([
    { notificaciones: [notifications[0]] },
    { notificaciones: notifications.map(n => ({ ...n, cedulaId: 999 })) },
    { notificaciones: notifications.map(n => ({ ...n, destinatario: 'CIUDADANO' })) },
    { notificaciones: notifications.map(n => ({ ...n, resultadoNotificacion: 'ENTREGADA_POR_MOCK' })) },
    { notificaciones: notifications.map(n => ({ ...n, medio: 'CORREO_ELECTRONICO', constanciaEnvio: null })) },
    { historial: [] }, { notificaciones: undefined }, { historial: undefined }
  ])('no usa otra cédula, destinatario, proveedor o evidencia incompleta: %j', patch => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, ...patch } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false);
  });
  it('acepta evidencia manual sustentada de ambos destinatarios con su traza estructurada', () => {
    const ns = notifications.map(n => ({ ...n, estado: 'VALIDADA', validadaManualmente: true, fechaValidacionManual: '2026-10-02T10:00:00', responsableValidacion: 'Operador sintético', observacionValidacion: 'Sustento sintético' }));
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, notificaciones: ns, historial: ns.map(n => ({ id: n.id + 100, tipoEvento: 'NOTIFICACION_VALIDADA', referencia: `NOTIFICACION-${n.id}:VALIDACION_MANUAL` })) } }));
    prepare(f); expect(f.componentInstance.canSubmit()).toBe(true);
  });
  it.each([
    { ...descargo, estadoDescargo: 'REQUERIDO' }, { ...descargo, apelacionId: 999 }, { ...descargo, entidadId: 999 },
    { ...descargo, expedienteTtaipId: 999 }, { ...descargo, numeroExpediente: 'OTRO' }, { ...descargo, fechaRequerimiento: '2026-09-01' },
    { ...descargo, fechaPresentacion: null }, { ...descargo, resumenDescargo: '' }, { ...descargo, estadoDescargo: 'CANCELADO' }, { ...descargo, estadoDescargo: 'DESCONOCIDO' }
  ])('los datos de descargos no condicionan la emisión: %j', d => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, descargosEntidad: [d] } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(true);
  });
  it.each(['PRESENTADO_EXTEMPORANEO', 'VENCIDO_SIN_PRESENTACION'])('usa el estado %s del servidor sin recalcular días', estadoDescargo => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, descargosEntidad: [{ ...descargo, estadoDescargo, fechaLimiteDescargo: '2026-10-10' }] } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(true);
  });
  it('un requerimiento todavía pendiente no bloquea una resolución', () => {
    const f = page(appeal({ expedienteTtaip: { ...appeal().expedienteTtaip, descargosEntidad: [descargo, { ...descargo, id: 82, estadoDescargo: 'REQUERIDO' }] } })); prepare(f); expect(f.componentInstance.canSubmit()).toBe(true);
  });
  it('sin miembro identificado no utiliza el autor predeterminado del backend', () => {
    TestBed.inject(AuthService).guardarSesion({ ...session, miembroId: undefined }); const f = page(); prepare(f); expect(f.componentInstance.canSubmit()).toBe(false); f.componentInstance.enviarResolucion(); expect(http.match(req => req.method !== 'GET')).toHaveLength(0);
  });
  const commands = [
    ['fundado', 'fundado', 'FUNDADO', 'RESUELTO_FUNDADO'], ['fundado_en_parte', 'fundado-en-parte', 'FUNDADO_EN_PARTE', 'RESUELTO_FUNDADO_EN_PARTE'],
    ['infundado', 'infundado', 'INFUNDADO', 'RESUELTO_INFUNDADO'], ['infundado_en_parte', 'infundado-en-parte', 'INFUNDADO_EN_PARTE', 'RESUELTO_INFUNDADO_EN_PARTE'],
    ['improcedente', 'improcedente', 'IMPROCEDENTE', 'RESUELTO_IMPROCEDENTE'], ['sustraccion_materia', 'sustraccion-materia', 'CONCLUSION_SUSTRACCION_MATERIA', 'CONCLUSION_SUSTRACCION_MATERIA'],
    ['desistimiento', 'desistimiento', 'CONCLUSION_DESISTIMIENTO', 'CONCLUSION_DESISTIMIENTO'], ['estese_a_lo_resuelto', 'estese-a-lo-resuelto', 'ESTESE_A_LO_RESUELTO', 'RESUELTO_ESTESE_A_LO_RESUELTO'],
    ['nulidad_del_acto', 'nulidad-acto', 'NULIDAD_DEL_ACTO', 'RESUELTO_NULIDAD_ACTO']
  ] as const;
  it.each(commands)('decisión %s utiliza su comando específico y confirma el mismo ID por GET', (selection, path, decision, estado) => {
    const f = page(); const c = f.componentInstance; c.seleccionarDecision(selection); c.fundamentos = 'Sustento final'; c.momentoVicio = 'Actuación viciada'; c.actuacionOrdenada = 'Retroacción sustentada';
    c.enviarResolucion(); const req = http.expectOne(api + '/ttaip/resolucion/31/' + path); expect(req.request.body.miembroId).toBe(7); expect(req.request.body.fundamentos).toBe('Sustento final');
    expect(req.request.body).not.toHaveProperty('plazoDias'); expect(req.request.body).not.toHaveProperty('causal');
    const data = resolved({ estado, resultado: decision, resolucion: { ...finalRecord, decision, observaciones: req.request.body.observaciones, iniciarProcesoDisciplinario: req.request.body.iniciarProcesoDisciplinario } });
    req.flush(data); expect(c.successModalAbierto()).toBe(false); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(data);
    expect(c.resultadoConfirmado()).toBe(true); expect(c.successModalAbierto()).toBe(true); expect(c.resolucionRegistrada()?.id).toBe(101); expect(c.canSubmit()).toBe(false);
  });
  it('valida fundamentos y nulidad sin fabricar valores, ni enviar observaciones ignoradas por otro comando', () => {
    const c = page().componentInstance; c.seleccionarDecision('nulidad_del_acto'); c.fundamentos = 'Sustento final'; expect(c.validacionTexto()).toContain('momento');
    c.momentoVicio = 'Vicio'; c.actuacionOrdenada = 'Actuación'; c.observacionesResolucion = 'x'.repeat(5000); expect(c.validacionTexto()).toContain('observaciones');
    c.observacionesResolucion = ''; c.fundamentos = 'x'.repeat(5001); expect(c.validacionTexto()).toContain('5000');
    c.seleccionarDecision('infundado'); c.fundamentos = 'Sustento final'; c.observacionesResolucion = 'Solo memoria'; c.enviarResolucion();
    const req = http.expectOne(api + '/ttaip/resolucion/31/infundado'); expect(req.request.body.observaciones).toBeUndefined(); req.flush(null, { status: 422, statusText: 'Invalid' });
  });
  it.each([400, 401, 403, 404, 409, 422])('rechazo del comando %i conserva contenido y no presenta éxito', status => {
    const f = page(); prepare(f); const c = f.componentInstance; c.enviarResolucion(); http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(null, { status, statusText: 'Synthetic rejection' });
    expect(c.successModalAbierto()).toBe(false); expect(c.fundamentos).toBe('Sustento final'); expect(c.error()).not.toBe(''); expect(c.loading()).toBe(false);
    expect(c.resultadoIncierto()).toBe(false); expect(http.match(req => req.method !== 'GET')).toHaveLength(0);
  });
  it.each([0, 500, 503])('resultado incierto %i no repite escritura aunque una consulta observe texto coincidente', status => {
    const f = page(); prepare(f); const c = f.componentInstance; c.enviarResolucion(); const req = http.expectOne(api + '/ttaip/resolucion/31/infundado');
    if (status) req.flush(null, { status, statusText: 'Unknown outcome' }); else req.error(new ProgressEvent('error'));
    c.enviarResolucion(); expect(http.match(req => req.method === 'POST')).toHaveLength(0); c.recuperarResultado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(resolved());
    expect(c.registroObservado()).toBe(101); expect(c.resultadoConfirmado()).toBe(false); expect(c.successModalAbierto()).toBe(false); expect(c.resultadoIncierto()).toBe(true);
  });
  it('recupera por ID conocido después de fallo del GET sin repetir el comando', () => {
    const f = page(); prepare(f); const c = f.componentInstance; c.enviarResolucion(); http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(resolved());
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 500, statusText: 'Unavailable' }); expect(c.resultadoIncierto()).toBe(true);
    c.recuperarResultado(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(resolved()); expect(c.resultadoConfirmado()).toBe(true); expect(c.resultadoIncierto()).toBe(false);
    expect(http.match(req => req.method === 'POST')).toHaveLength(0);
  });
  it.each([
    { id: 102 }, { decision: 'FUNDADO' }, { tipoResolucion: 'PRIMERA_CALIFICACION' }, { fundamentos: 'Otro texto' }, { miembroTTAIPId: 8 }, { apelacionId: 999 }
  ])('el GET de resolución incompatible no confirma ni inicia subidas: %j', patch => {
    const f = page(); prepare(f); const c = f.componentInstance; c.documentosSeleccionados.set([new File(['x'], 'anexo.txt', { type: 'text/plain' })]); c.enviarResolucion();
    http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(resolved()); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(resolved({ resolucion: { ...finalRecord, ...patch } }));
    expect(c.resultadoConfirmado()).toBe(false); expect(c.successModalAbierto()).toBe(false); expect(http.match(req => req.url.endsWith('/upload'))).toHaveLength(0);
  });
  function confirmedWithFiles(f: ReturnType<typeof page>, files: File[]) {
    prepare(f); const c = f.componentInstance; c.documentosSeleccionados.set(files); c.enviarResolucion(); http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(resolved());
    expect(http.match(req => req.url.endsWith('/upload'))).toHaveLength(0); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(resolved()); return c;
  }
  const metadata = (id: number, patch: Record<string, unknown> = {}) => ({ id, resolucionId: 101, tipoDocumento: 'RESOLUCION_TTAIP', nombreOriginal: 'anexo.txt', contentType: 'text/plain', estado: 'ACTIVO', ...patch });
  async function bytes(file: Blob): Promise<number[]> {
    const buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(file);
    });
    return Array.from(new Uint8Array(buffer));
  }
  it('sube los bytes de todos los archivos al ID confirmado y comprueba cada documento por GET', async () => {
    const f = page(); const files = [new File(['bytes uno'], 'uno.txt', { type: 'text/plain' }), new File(['bytes dos'], 'dos.txt', { type: 'text/plain' })];
    const c = confirmedWithFiles(f, files);
    for (const [i, file] of files.entries()) { const req = http.expectOne(r => r.url === api + '/documentos/upload'); const sent = req.request.body.get('file') as File;
      expect(sent.name).toBe(file.name); expect(sent.type).toBe(file.type); expect(await bytes(sent)).toEqual(await bytes(file));
      expect(req.request.params.get('resolucionId')).toBe('101'); expect(req.request.params.get('tipoDocumento')).toBe('RESOLUCION_TTAIP'); req.flush(metadata(201 + i));
      expect(c.successModalAbierto()).toBe(false); http.expectOne(api + '/documentos/' + (201 + i) + '/metadata').flush(metadata(201 + i)); }
    expect(c.archivos().map(f => f.estado)).toEqual(['registrado', 'registrado']); expect(c.successModalAbierto()).toBe(true); expect(c.mensaje()).toContain('por separado');
  });
  it('una subida rechazada produce resultado parcial y el reintento solo sube ese archivo, nunca la decisión', () => {
    const f = page(); const c = confirmedWithFiles(f, [new File(['uno'], 'uno.txt', { type: 'text/plain' }), new File(['dos'], 'dos.txt', { type: 'text/plain' })]);
    http.expectOne(r => r.url.endsWith('/upload')).flush(null, { status: 422, statusText: 'Rejected' }); http.expectOne(r => r.url.endsWith('/upload')).flush(metadata(202)); http.expectOne(api + '/documentos/202/metadata').flush(metadata(202));
    expect(c.archivos().map(f => f.estado)).toEqual(['rechazado', 'registrado']); expect(c.resolucionSuccessTone()).toBe('warning'); expect(c.mensaje()).toContain('pendientes o inciertos');
    c.reintentarArchivos(); http.expectOne(r => r.url.endsWith('/upload')).flush(metadata(201)); http.expectOne(api + '/documentos/201/metadata').flush(metadata(201));
    expect(c.archivos().every(f => f.estado === 'registrado')).toBe(true); expect(http.match(req => /\/resolucion\//.test(req.url))).toHaveLength(0);
  });
  it('una subida incierta sin ID no se repite; otro archivo pendiente se sube solo a petición explícita', async () => {
    const f = page(); const one = new File(['uno'], 'uno.txt', { type: 'text/plain' }), two = new File(['dos'], 'dos.txt', { type: 'text/plain' }); const c = confirmedWithFiles(f, [one, two]);
    http.expectOne(r => r.url.endsWith('/upload')).error(new ProgressEvent('error')); expect(c.archivos().map(f => f.estado)).toEqual(['incierto', 'seleccionado']);
    expect(http.match(req => req.method === 'POST')).toHaveLength(0); c.reintentarArchivos(); const next = http.expectOne(r => r.url.endsWith('/upload')); expect(await bytes(next.request.body.get('file'))).toEqual(await bytes(two));
    next.flush(metadata(202)); http.expectOne(api + '/documentos/202/metadata').flush(metadata(202)); expect(c.archivos()[0].estado).toBe('incierto');
    c.enviarResolucion(); c.reintentarArchivos(); expect(http.match(req => req.method === 'POST')).toHaveLength(0);
  });
  it('un archivo con ID y recuperación fallida se reconcilia por GET, sin nueva subida', () => {
    const f = page(); const c = confirmedWithFiles(f, [new File(['uno'], 'uno.txt', { type: 'text/plain' })]);
    http.expectOne(r => r.url.endsWith('/upload')).flush(metadata(201)); http.expectOne(api + '/documentos/201/metadata').flush(null, { status: 500, statusText: 'Unavailable' });
    expect(c.archivos()[0].estado).toBe('incierto'); c.recuperarArchivo(c.archivos()[0]); http.expectOne(api + '/documentos/201/metadata').flush(metadata(201));
    expect(c.archivos()[0].estado).toBe('registrado'); expect(http.match(req => req.method === 'POST')).toHaveLength(0);
  });
  it('una subida asociada a otra resolución no se confirma ni provoca consulta del documento ajeno', () => {
    const f = page(); const c = confirmedWithFiles(f, [new File(['uno'], 'uno.txt', { type: 'text/plain' })]); http.expectOne(r => r.url.endsWith('/upload')).flush(metadata(201, { resolucionId: 999 }));
    expect(c.archivos()[0].estado).toBe('incierto'); expect(c.archivos()[0].documentoId).toBeUndefined(); expect(http.match(req => /\/metadata$/.test(req.url))).toHaveLength(0);
  });
  it('cambiar sesión durante subida cancela y no inicia el archivo siguiente ni muestra el resultado anterior', () => {
    const f = page(); const c = confirmedWithFiles(f, [new File(['uno'], 'uno.txt', { type: 'text/plain' }), new File(['dos'], 'dos.txt', { type: 'text/plain' })]); const upload = http.expectOne(r => r.url.endsWith('/upload'));
    TestBed.inject(AuthService).guardarSesion({ ...session, token: 'otra-sesion', usuarioId: 8 }); f.detectChanges(); http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(upload.cancelled).toBe(true); expect(c.archivos()).toEqual([]); expect(c.apelacion()).toBeNull(); expect(c.successModalAbierto()).toBe(false); expect(http.match(req => req.method === 'POST')).toHaveLength(0);
  });
  it('cambiar expediente durante POST cancela continuaciones sin afirmar rollback del servidor', () => {
    const f = page(); prepare(f); const c = f.componentInstance; c.enviarResolucion(); const write = http.expectOne(api + '/ttaip/resolucion/31/infundado');
    params.next(convertToParamMap({ expediente: 'OTRO' })); f.detectChanges(); http.expectOne(api + '/apelaciones/expediente/OTRO').flush(appeal({ id: 32, expediente: 'OTRO', expedienteTtaip: null }));
    expect(write.cancelled).toBe(true); expect(c.fundamentos).toBe(''); expect(c.resultadoConfirmado()).toBe(false); expect(c.successModalAbierto()).toBe(false);
  });
  it('durante el comando no permite cambiar decisión ni descartar archivos para alterar la operación capturada', () => {
    const f = page(); prepare(f); const c = f.componentInstance; c.documentosSeleccionados.set([new File(['x'], 'uno.txt', { type: 'text/plain' })]); c.enviarResolucion();
    c.seleccionarDecision('fundado'); c.seleccionarDocumentos([]); expect(c.selectedDecision()).toBe('infundado'); expect(c.documentosSeleccionados()).toHaveLength(1); http.expectOne(api + '/ttaip/resolucion/31/infundado').flush(null, { status: 422, statusText: 'Rejected' });
  });
  it('la navegación del resultado dirige al expediente real en vez de volver siempre al panel', () => {
    const c = page(resolved()).componentInstance; const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true); c.irExpediente(); expect(nav).toHaveBeenCalledExactlyOnceWith(['/ttaip/apelacion', expediente]);
  });
  it('un ID documental repetido no acredita la recepción de dos archivos', () => {
    const f = page(); const c = confirmedWithFiles(f, [new File(['uno'], 'mismo.txt', { type: 'text/plain' }), new File(['dos'], 'mismo.txt', { type: 'text/plain' })]);
    http.expectOne(r => r.url.endsWith('/upload')).flush(metadata(201)); http.expectOne(api + '/documentos/201/metadata').flush(metadata(201));
    http.expectOne(r => r.url.endsWith('/upload')).flush(metadata(201)); expect(c.archivos().map(f => f.estado)).toEqual(['registrado', 'incierto']); expect(c.resolucionSuccessTone()).toBe('warning');
  });
  function loadDocuments(f: ReturnType<typeof page>, values: unknown[] = []) {
    f.componentInstance.cambiarTab('adjuntos'); const queries = http.match(r => r.url === api + '/documentos');
    expect(queries.map(r => r.request.params.keys()[0]).sort()).toEqual(['apelacionId', 'expedienteTtaipId', 'resolucionId']);
    queries.forEach(r => r.flush(r.request.params.has('apelacionId') ? values : [])); f.detectChanges();
  }
  const registeredDoc = { id: 301, apelacionId: 31, nombreOriginal: 'Documento registrado.pdf', contentType: 'application/pdf', tipoDocumento: 'APELACION', estado: 'ACTIVO' };
  it('consulta documentos por relaciones persistidas sin convertir la referencia del descargo en un archivo', () => {
    const f = page(); loadDocuments(f, [registeredDoc]); const c = f.componentInstance; expect(c.documentCount()).toBe(1);
    c.verDocumento(c.documentGroups()[0].documents[0]); expect(c.previewTarget()?.id).toBe(301); expect(c.previewTarget()?.expediente).toBe(expediente);
    c.verDocumento({ ...registeredDoc, id: 999 }); expect(c.previewTarget()?.id).toBe(301); expect(http.match(r => /descargos/.test(r.url))).toHaveLength(0);
  });
  it.each([
    { value: [{ ...registeredDoc, apelacionId: 999 }] }, { value: [{ ...registeredDoc, resolucionId: 71 }] }, { value: [registeredDoc, registeredDoc] }
  ])('rechaza metadatos documentales incompatibles: %j', ({ value }) => {
    const f = page(); loadDocuments(f, value); expect(f.componentInstance.documentGroups()).toEqual([]); expect(f.componentInstance.documentError()).not.toBe('');
  });
  it('un vacío documental correcto no significa ausencia de admisión, descargo o recepción', () => {
    const f = page(); loadDocuments(f); expect(f.componentInstance.documentCount()).toBe(0); expect(f.componentInstance.documentError()).toBe(''); expect(f.componentInstance.admision()?.id).toBe(71);
  });
  it('la búsqueda documental es local, combina relación y texto y diferencia cero coincidencias', () => {
    const f = page(); loadDocuments(f, [registeredDoc, ...[302, 303, 304].map(id => ({ ...registeredDoc, id, nombreOriginal: 'Anexo ' + id }))]); const c = f.componentInstance;
    c.documentSearch.set('DOCUMENTO'); expect(c.visibleGroups()[0].documents.map(d => d.id)).toEqual([301]); c.documentFilter.set('Primera calificación'); expect(c.visibleGroups()).toEqual([]);
    expect(c.documentCount()).toBe(4); expect(http.match(r => r.url === api + '/documentos')).toHaveLength(0);
  });
  it('un error documental no se presenta como vacío y permite reintentar', () => {
    const f = page(); const c = f.componentInstance; c.cambiarTab('adjuntos'); const queries = http.match(r => r.url === api + '/documentos'); queries[0].flush(null, { status: 500, statusText: 'Unavailable' });
    queries.slice(1).filter(q => !q.cancelled).forEach(q => q.flush([])); expect(c.documentError()).not.toBe(''); expect(c.documentCount()).toBe(0);
    c.cargarDocumentos(); http.match(r => r.url === api + '/documentos').forEach(r => r.flush(r.request.params.has('apelacionId') ? [registeredDoc] : [])); expect(c.documentCount()).toBe(1);
  });
  it.each([401, 403, 404, 500])('una descarga HTTP %i no genera sustituto ni éxito', status => {
    const f = page(); loadDocuments(f, [registeredDoc]); const c = f.componentInstance; const create = vi.spyOn(URL, 'createObjectURL');
    c.descargarDocumento(c.documentGroups()[0].documents[0]); http.expectOne(api + '/documentos/301/download').flush(null, { status, statusText: 'Synthetic failure' });
    expect(create).not.toHaveBeenCalled(); expect(c.downloadError()).not.toBe(''); expect(c.successModalAbierto()).toBe(false);
  });
  it('un error de preview queda en el visor autorizado sin sustituir el PDF', () => {
    const f = page(); loadDocuments(f, [registeredDoc]); const c = f.componentInstance; c.verDocumento(c.documentGroups()[0].documents[0]); f.detectChanges();
    const req = http.expectOne(api + '/documentos/301/download'); expect(req.request.headers.get('Authorization')).toBe('Bearer ' + session.token); req.flush(null, { status: 404, statusText: 'Not Found' }); f.detectChanges();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull(); expect(c.successModalAbierto()).toBe(false); expect(http.match(r => /canonic|plantilla/.test(r.url))).toHaveLength(0);
  });
  it('cambiar decisión cancela descargas y consultas documentales pendientes', () => {
    const f = page(); loadDocuments(f, [registeredDoc]); const c = f.componentInstance; c.descargarDocumento(c.documentGroups()[0].documents[0]); const file = http.expectOne(api + '/documentos/301/download');
    c.cargarDocumentos(); const queries = http.match(r => r.url === api + '/documentos'); c.seleccionarDecision('fundado');
    expect(file.cancelled).toBe(true); expect(queries.every(q => q.cancelled)).toBe(true); expect(c.previewTarget()).toBeNull(); expect(c.loadingDocuments()).toBe(false);
  });
  it('la selección valida los archivos, conserva los aceptados y los diferencia de documentos registrados', () => {
    const f = page(); const c = f.componentInstance; const valid = new File(['texto'], 'anexo.txt', { type: 'text/plain' });
    c.seleccionarDocumentos([valid, new File(['exe'], 'no.exe', { type: 'application/octet-stream' })]);
    expect(c.documentosSeleccionados()).toEqual([valid]); expect(c.archivos()).toEqual([]); expect(c.error()).not.toBe(''); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
    c.seleccionarDocumentos([]); expect(c.documentosSeleccionados()).toEqual([]);
  });
  it('las pestañas tienen nombre, panel y recorrido de teclado con foco', () => {
    const f = page(); const firstTab = f.nativeElement.querySelector('#final-tab-apelacion') as HTMLButtonElement; firstTab.focus();
    firstTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); f.detectChanges(); const documentos = f.nativeElement.querySelector('#final-tab-adjuntos') as HTMLButtonElement;
    expect(document.activeElement).toBe(documentos); expect(documentos.getAttribute('aria-selected')).toBe('true'); expect(f.nativeElement.querySelector('#final-panel-apelacion').hidden).toBe(true);
    http.match(r => r.url === api + '/documentos').forEach(r => r.flush([]));
    const actuaciones = TestBed.inject(TtaipActuacionesService);
    const basePresentacion: Omit<PresentacionAdmision, 'id' | 'tipo'> = {
      origen: 'CIUDADANO', operacion: 'operación-sintética', texto: null, numeroOficio: null,
      fechaPresentacion: '2026-11-21T10:30:00', aceptada: null, fechaRespuesta: null,
      operacionRespuesta: null, documentos: [], respuesta: null,
    };
    vi.spyOn(actuaciones, 'presentacionesAdmision').mockReturnValue(respuestaActuaciones<ConsultaAdmision>({
      puedePresentarSolicitudes: false, puedeResponderInformeOral: true, fechaLimiteResolucion: '2026-12-17',
      descargo: { id: 81, estado: 'PRESENTADO', fechaLimite: '2026-11-30', fechaPresentacion: null, resumen: null, referencia: null, puedePresentar: false },
      presentaciones: [
        { ...basePresentacion, id: 1, tipo: 'DESCARGOS', numeroOficio: 'OF-SINTÉTICO', documentos: [{ id: 10, nombreOriginal: 'oficio.pdf' }] },
        { ...basePresentacion, id: 2, tipo: 'INFORME_ORAL', origen: 'CIUDADANO', texto: 'Sustento de la audiencia', documentos: [] },
        { ...basePresentacion, id: 3, tipo: 'DOCUMENTACION_ADICIONAL', origen: 'ENTIDAD_PUBLICA', documentos: [{ id: 11, nombreOriginal: 'escrito.pdf' }] },
      ],
    }));
    vi.spyOn(actuaciones, 'informacion').mockReturnValue(respuestaActuaciones<InformacionComplementaria>({
      etapa: 'RESOLUCION_FINAL', puedeSolicitar: true, entidad: 'Entidad sintética', fechaLimiteCalificacion: null, diasSuspendidos: 0, solicitudes: [],
    }));
    documentos.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges();
    expect(document.activeElement).toBe(f.nativeElement.querySelector('#final-tab-subprocesos'));
    const panel = f.nativeElement.querySelector('#final-panel-subprocesos') as HTMLElement;
    expect([...panel.querySelectorAll('h3')].map(h => h.textContent.trim())).toEqual([
      'Descargos de la entidad', 'Informe oral', 'Documentación adicional', 'Información complementaria',
    ]);
    expect(panel.querySelector('[aria-label="Previsualizar oficio.pdf"]')).not.toBeNull();
    expect(panel.querySelector('[aria-label="Previsualizar escrito.pdf"]')).not.toBeNull();
    expect(panel.textContent).toContain('Responder solicitud');
    expect(panel.textContent).toContain('Solicitar información complementaria');
  });
  it('ofrece documentos adicionales después de los documentos firmados y emite sin seleccionarlos', () => {
    const f = page();
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelector('#final-optional-attachments')).toBeNull();
    prepare(f);
    f.detectChanges();
    const oficiales = root.querySelector('app-official-docs-section')!;
    const adicionales = root.querySelector('#final-optional-attachments')!;
    expect(oficiales.compareDocumentPosition(adicionales) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(adicionales.textContent).toContain('Documentos adicionales (opcional)');
    const emitir = root.querySelector<HTMLButtonElement>('#final-review')!;
    expect(emitir.disabled).toBe(false);
    emitir.click();
    f.detectChanges();
    f.componentInstance.enviarResolucion();
    http.expectOne({ url: api + '/ttaip/resolucion/31/infundado', method: 'POST' }).flush(resolved());
    http.expectOne(api + '/apelaciones/expediente/' + expediente).flush(resolved());
    expect(f.componentInstance.resultadoConfirmado()).toBe(true);
    http.expectNone({ url: api + '/documentos', method: 'POST' });
  });

  it('espera que se carguen ambas cédulas antes de mostrar los adjuntos opcionales', () => {
    vi.spyOn(TestBed.inject(TtaipActuacionesService), 'documentos').mockReturnValue(respuestaActuaciones([
      { clave: 'RESOLUCION', decision: 'INFUNDADO', numero: '2026-90', sala: 'PRIMERA SALA', archivo: { id: 90 } },
      { clave: 'CIUDADANO', decision: 'INFUNDADO', numero: '2026-91', sala: 'PRIMERA SALA', archivo: { id: 91 } },
    ]));
    const f = page();
    prepare(f);
    f.detectChanges();
    expect(f.nativeElement.querySelector('#final-optional-attachments')).toBeNull();
    expect(f.nativeElement.querySelector('#final-review').disabled).toBe(true);
  });

  it('la revisión contiene el foco y Escape devuelve al control sin ejecutar un comando', async () => {
    const f = page(); prepare(f); f.detectChanges(); const button = f.nativeElement.querySelector('#final-review') as HTMLButtonElement; button.focus(); button.click(); f.detectChanges(); await Promise.resolve();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!; expect(dialog.getAttribute('aria-label')).toBe('Confirme el registro de la resolución'); expect(dialog.contains(document.activeElement)).toBe(true);
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); buttons.at(-1)!.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(buttons[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); expect(f.componentInstance.confirmModalAbierto()).toBe(false); expect(document.activeElement).toBe(button); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });
  it('el resultado consultado devuelve el foco a un control habilitado del acto persistido', async () => {
    const f = page(resolved()); const button = f.nativeElement.querySelector('#final-view-record') as HTMLButtonElement; button.focus(); button.click(); f.detectChanges(); await Promise.resolve();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('no confirma un envío anterior');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); f.detectChanges(); await Promise.resolve(); expect(document.activeElement).toBe(button);
  });
  it('una sesión ilegible muestra acceso no disponible sin consultar un expediente privado', () => {
    localStorage.setItem('usuario', '{'); const f = TestBed.createComponent(TtaipResolverComponent); expect(() => f.detectChanges()).not.toThrow();
    expect(f.componentInstance.apelacion()).toBeNull(); expect(f.componentInstance.loadError()).toContain('acceso interno'); expect(http.match(() => true)).toHaveLength(0);
  });
  it('permite seleccionar etapa de retroacción cuando la decisión es nulidad_del_acto e incorpora la etapa en las observaciones', () => {
    const f = page(); const c = f.componentInstance;
    c.selectedDecision.set('nulidad_del_acto');
    c.fundamentos = 'Fundamento válido';
    c.momentoVicio = 'Al denegar sin motivar';
    c.actuacionOrdenada = 'Emitir nueva respuesta';
    c.retrotraeA = 'entidad_respuesta';
    expect(c.showNulidad()).toBe(true);
    expect(c.validacionTexto()).toBe('');
    const obs = (c as any).observacionesTexto();
    expect(obs).toContain('Momento del vicio: Al denegar sin motivar');
    expect(obs).toContain('Actuación ordenada: Emitir nueva respuesta');
    expect(obs).toContain('Retroacción ordenada: Entidad · nueva respuesta de fondo');
  });
  it('permite configurar orden de entrega y plazo de 7 días hábiles por defecto para resoluciones fundadas', () => {
    const f = page(); const c = f.componentInstance;
    c.selectedDecision.set('fundado');
    expect(c.showOrden()).toBe(true);
    expect(c.ordenarEntrega).toBe(true);
    expect(c.plazoDias).toBe(7);
    const obs = (c as any).observacionesTexto();
    expect(obs).toContain('Mandato: Entrega de información ordenada a la entidad en un plazo de 7 días hábiles');
  });
});
