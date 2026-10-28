import { Apelacion } from '../../models/apelacion.model';
import { Resolucion, CedulaNotificacion, NotificacionTtaip, HistorialTtaip, DescargoEntidadTtaip, SuspensionPlazoTtaip, CumplimientoResolucionTtaip, ReprocesoNotificacion } from '../../models/resolucion.model';
import { positiveId } from './ttaip-calificar.model';
export type DetailCollection = 'resoluciones' | 'cedulas' | 'notificaciones' | 'historial' | 'descargosEntidad' | 'suspensionesPlazo' | 'cumplimientosResolucion' | 'reprocesos';
export interface Consultado<T> { data: T[] | null; error: string; }
const bad = <T>(name: string): Consultado<T> => ({ data: null, error: `Información incompleta o asociaciones incompatibles: ${name}. No acredita ausencia de registros.` });
const list = <T extends { id?: number }>(value: unknown, name: string, valid: (v: T) => boolean = () => true): Consultado<T> => {
  if (!Array.isArray(value)) return bad(name); const ids = new Set<number>();
  if (value.some((v: T) => !v || !positiveId(v.id) || ids.has(v.id) || !ids.add(v.id) || !valid(v))) return bad(name);
  return { data: value, error: '' };
};
export function actosDetalle(ap: Apelacion | null): Consultado<Resolucion> {
  if (!ap) return bad('actuaciones');
  const groups = [ap.resoluciones, ap.expedienteTtaip?.resoluciones].filter(g => g != null);
  if (!groups.length) return bad('actuaciones');
  const all = new Map<number, Resolucion>();
  const valid = (r: Resolucion) => ['PRIMERA_CALIFICACION', 'SEGUNDA_CALIFICACION', 'RESOLUCION_FINAL'].includes(r.tipoResolucion || '')
    && ((r as Resolucion & { apelacionId?: number }).apelacionId == null || (r as Resolucion & { apelacionId?: number }).apelacionId === ap.id);
  const add = (r: Resolucion) => { if (!r || !positiveId(r.id) || !valid(r)) return false; const prior = all.get(r.id);
    if (prior && ['tipoResolucion', 'decision', 'numeroResolucion'].some(k => { const key = k as keyof Resolucion; return prior[key] != null && r[key] != null && prior[key] !== r[key]; })) return false;
    if (!prior) all.set(r.id, r); return true; };
  for (const values of groups) { const checked = list<Resolucion>(values, 'actuaciones', valid); if (!checked.data || checked.data.some(r => !add(r))) return bad('actuaciones'); }
  for (const [type, r] of [['PRIMERA_CALIFICACION', ap.resolucionPrimeraCalificacion], ['SEGUNDA_CALIFICACION', ap.resolucionSegundaCalificacion], ['RESOLUCION_FINAL', ap.resolucion]] as const)
    if (r != null && (r.tipoResolucion !== type || !add(r as Resolucion))) return bad('actuaciones');
  return { data: [...all.values()], error: '' };
}
export function detalleConsultado(ap: Apelacion | null) {
  const acts = actosDetalle(ap), aggregate = ap?.expedienteTtaip;
  const nested: CedulaNotificacion[] = []; let invalidCedulas = !acts.data;
  for (const r of acts.data || []) { const values = list<CedulaNotificacion>(r.cedulas, 'cédulas', c => ['CIUDADANO', 'ENTIDAD_PUBLICA'].includes(c.destinatario));
    if (!values.data) invalidCedulas = true; else nested.push(...values.data); }
  const cedulas = invalidCedulas ? bad<CedulaNotificacion>('cédulas de las actuaciones') : list<CedulaNotificacion>(nested, 'cédulas de las actuaciones');
  if (Array.isArray(aggregate?.cedulas) && aggregate.cedulas.some(c => !cedulas.data?.some(known => known.id === c.id && known.destinatario === c.destinatario))) { cedulas.data = null; cedulas.error = bad('cédulas sin actuación identificada').error; }
  const notifications = list<NotificacionTtaip>(aggregate?.notificaciones, 'notificaciones y destinatarios', n => !!cedulas.data?.some(c => c.id === n.cedulaId && c.destinatario === n.destinatario));
  const defenses = list<DescargoEntidadTtaip>(aggregate?.descargosEntidad, 'descargos', d => d.expedienteTtaipId === aggregate?.id && d.apelacionId === ap?.id && d.numeroExpediente === ap?.expediente && d.entidadId === ap?.entidadId);
  const suspensions = list<SuspensionPlazoTtaip>(aggregate?.suspensionesPlazo, 'suspensiones', s => s.expedienteTtaipId === aggregate?.id && s.numeroExpediente === ap?.expediente
    && (s.descargoId == null || !!defenses.data?.some(d => d.id === s.descargoId)));
  const compliance = list<CumplimientoResolucionTtaip>(aggregate?.cumplimientosResolucion, 'cumplimientos', c => c.expedienteTtaipId === aggregate?.id && c.apelacionId === ap?.id
    && c.entidadId === ap?.entidadId && !!acts.data?.some(r => r.id === c.resolucionId && r.tipoResolucion === 'RESOLUCION_FINAL'));
  const reprocessing = list<ReprocesoNotificacion>(aggregate?.reprocesos, 'reprocesos', r => !!notifications.data?.some(n => n.id === r.notificacionId)
    && !!cedulas.data?.some(c => c.id === r.cedulaOriginalId && (r.destinatario == null || r.destinatario === c.destinatario)));
  return { resoluciones: acts, cedulas, notificaciones: notifications, historial: list<HistorialTtaip>(aggregate?.historial, 'historial'),
    descargosEntidad: defenses, suspensionesPlazo: suspensions, cumplimientosResolucion: compliance, reprocesos: reprocessing };
}
export function eficaciaConsultada(n: NotificacionTtaip, history: HistorialTtaip[] | null): boolean {
  if (!history || n.resultadoNotificacion?.startsWith('ENTREGADA_POR_')) return false;
  const text = (v: unknown) => typeof v === 'string' && !!v.trim();
  const has = (type: string, suffix: string) => history.some(h => h.tipoEvento === type && h.referencia === `NOTIFICACION-${n.id}:${suffix}`);
  if (n.estado === 'VALIDADA' && n.validadaManualmente === true && n.fechaValidacionManual && text(n.responsableValidacion) && text(n.observacionValidacion)) return has('NOTIFICACION_VALIDADA', 'VALIDACION_MANUAL');
  const medio = n.medioNotificacion ?? n.medio;
  return n.estado === 'ENTREGADA' && n.estadoAcuse === 'ENTREGADO' && !!n.fechaAcuse && text(n.acuseAutomatico)
    && (!medio?.startsWith('CORREO') || text(n.constanciaEnvio)) && has('ACUSE_NOTIFICACION_REGISTRADO', 'ACUSE:ENTREGADO');
}
export const single = <T>(values: T[], predicate: (value: T) => boolean): T | null => { const result = values.filter(predicate); return result.length === 1 ? result[0] : null; };
