import { Apelacion } from '../../models/apelacion.model';

export type StageKey = 'todos' | 'elevacion' | 'calificacion1' | 'subsanacion' | 'calificacion2' | 'resolucion' | 'resueltos' | 'otras';
export interface StageMeta { key: StageKey; num: string; label: string; shortLabel: string; plazoLabel: string; color: string; bg: string; icon: string; }
export const stages: StageMeta[] = [
  { key: 'todos', num: '00', label: 'Todos los registros', shortLabel: 'Todos', plazoLabel: 'Consulta recibida', color: 'var(--brand-700)', bg: 'var(--brand-subtle)', icon: 'layers' },
  { key: 'elevacion', num: '01', label: 'Pendiente de elevación', shortLabel: 'Elevación', plazoLabel: 'Actuación pendiente', color: 'var(--muted-foreground)', bg: 'var(--muted)', icon: 'inbox' },
  { key: 'calificacion1', num: '02', label: 'Primera calificación', shortLabel: '1ra Calif.', plazoLabel: 'Sin reloj de etapa', color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 8%, transparent)', icon: 'scale' },
  { key: 'subsanacion', num: '03', label: 'Subsanación', shortLabel: 'Subsanación', plazoLabel: 'Reloj acreditado', color: 'var(--gold-dark)', bg: 'color-mix(in srgb, var(--gold-dark) 10%, transparent)', icon: 'hourglass' },
  { key: 'calificacion2', num: '04', label: 'Segunda calificación / notificación', shortLabel: '2da Calif.', plazoLabel: 'Actuaciones propias', color: 'var(--brand-600)', bg: 'var(--brand-subtle)', icon: 'layers' },
  { key: 'resolucion', num: '05', label: 'Resolución final', shortLabel: 'Res. Final', plazoLabel: 'Base temporal pendiente', color: 'var(--brand-700)', bg: 'var(--brand-subtle)', icon: 'gavel' },
  { key: 'resueltos', num: '06', label: 'Apelaciones resueltas / concluidas', shortLabel: 'Resueltos', plazoLabel: 'No acredita cumplimiento', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 10%, transparent)', icon: 'check' },
];
export const positiveId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
export const finalStates = new Set(['RESUELTO', 'RESUELTO_FUNDADO', 'RESUELTO_FUNDADO_EN_PARTE', 'RESUELTO_INFUNDADO', 'RESUELTO_INFUNDADO_EN_PARTE',
  'RESUELTO_IMPROCEDENTE', 'RESUELTO_ESTESE_A_LO_RESUELTO', 'RESUELTO_NULIDAD_ACTO', 'TENER_POR_NO_PRESENTADO', 'CONCLUSION_SUSTRACCION_MATERIA', 'CONCLUSION_DESISTIMIENTO']);
export function stageOf(state: string): StageKey {
  if (state === 'PENDIENTE_ELEVACION') return 'elevacion';
  if (state === 'EN_CALIFICACION_1') return 'calificacion1';
  if (state === 'EN_SUBSANACION') return 'subsanacion';
  if (state === 'EN_CALIFICACION_2' || state === 'NOTIFICACION_SEGUNDA_CALIFICACION') return 'calificacion2';
  if (state === 'EN_RESOLUCION') return 'resolucion';
  return finalStates.has(state) ? 'resueltos' : 'otras';
}
export function readAppeals(value: unknown): Apelacion[] | null {
  if (!Array.isArray(value)) return null;
  const ids = new Set<number>(), codes = new Set<string>();
  for (const item of value) {
    if (!item || !positiveId(item.id) || typeof item.expediente !== 'string' || !item.expediente.trim()
      || typeof item.estado !== 'string' || !item.estado.trim() || ids.has(item.id) || codes.has(item.expediente)) return null;
    for (const field of ['ciudadanoNombre', 'entidadNombre', 'entidadExternaNombre', 'solicitudAsunto', 'resumenSolicitudOriginal', 'fundamentos', 'fechaApelacion']) {
      if (item[field] != null && typeof item[field] !== 'string') return null;
    }
    ids.add(item.id); codes.add(item.expediente);
  }
  return value;
}
export function recordedDate(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}
export function clockText(ap: Apelacion): string {
  if (ap.estado !== 'EN_SUBSANACION') return finalStates.has(ap.estado) ? 'Estado registrado' : 'Plazo no informado';
  const p = ap.plazoSubsanacion;
  if (!p) return 'Reloj no informado';
  if (!positiveId(p.requerimientoId) || !Number.isSafeInteger(p.diasHabiles) || p.diasHabiles! <= 0
    || (ap.resolucionPrimeraCalificacion?.id != null && p.requerimientoId !== ap.resolucionPrimeraCalificacion.id)) return 'Reloj incompleto';
  if (p.estado === 'PENDIENTE_INICIO') return p.fechaEficacia == null && p.notificacionId == null && p.fechaLimite == null && p.diasHabilesRestantes == null ? 'Pendiente de inicio' : 'Reloj incompleto';
  if (!['EN_CURSO', 'VENCIDO'].includes(p.estado ?? '') || !positiveId(p.notificacionId)
    || !recordedDate(p.fechaEficacia) || !recordedDate(p.fechaLimite) || !Number.isSafeInteger(p.diasHabilesRestantes)) return 'Reloj incompleto';
  if (p.estado === 'VENCIDO') return 'Vencido';
  return p.diasHabilesRestantes! >= 0 ? `${p.diasHabilesRestantes}d` : 'Reloj incompleto';
}
const decisions = new Set(['FUNDADO', 'FUNDADO_EN_PARTE', 'INFUNDADO', 'INFUNDADO_EN_PARTE', 'IMPROCEDENTE', 'CONCLUSION_SUSTRACCION_MATERIA',
  'CONCLUSION_DESISTIMIENTO', 'ESTESE_A_LO_RESUELTO', 'NULIDAD_DEL_ACTO', 'TENER_POR_NO_PRESENTADO']);
export function finalDecision(ap: Apelacion): string | null {
  const r = ap.resolucion;
  return finalStates.has(ap.estado) && positiveId(r?.id) && r?.tipoResolucion === 'RESOLUCION_FINAL'
    && typeof r.decision === 'string' && decisions.has(r.decision) ? r.decision : null;
}
export function actionFor(ap: Apelacion): { route: string[]; label: string; reason: string } {
  if (ap.estado === 'EN_CALIFICACION_1' && Object.hasOwn(ap, 'calificacionPrimera') && ap.calificacionPrimera === null
    && Object.hasOwn(ap, 'resolucionPrimeraCalificacion') && ap.resolucionPrimeraCalificacion === null) {
    return { route: ['/ttaip/calificar', ap.expediente], label: 'Calificar', reason: 'La operación vuelve a comprobar estado y actuaciones en el servidor.' };
  }
  const reason = ap.estado === 'EN_CALIFICACION_2' ? 'La lista no acredita la recepción del requerimiento. Revise el expediente antes de segunda calificación.'
    : ap.estado === 'NOTIFICACION_SEGUNDA_CALIFICACION' ? 'Debe acreditarse la notificación eficaz al recurrente y a la entidad; no se avanza desde el panel.'
    : ap.estado === 'EN_RESOLUCION' ? 'Revise admisión, ambas notificaciones eficaces y descargos. La lista no acredita por sí sola estas precondiciones.'
    : ap.estado === 'PENDIENTE_ELEVACION' ? 'La elevación requiere su actuación específica; no se adelanta la calificación.' : '';
  return { route: ['/ttaip/apelacion', ap.expediente], label: reason ? 'Revisar requisitos' : 'Ver detalle', reason };
}
