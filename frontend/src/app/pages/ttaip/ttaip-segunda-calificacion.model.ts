import { Apelacion } from '../../models/apelacion.model';
import { positiveId } from './ttaip-calificar.model';

export type SegundaDecision = 'admitido' | 'improcedente' | 'no_presentado';
export interface SegundaOperacion {
  apelacionId: number; expediente: string; expedienteTtaipId: number; requerimientoId: number;
  decision: 'admitido' | 'improcedente'; fundamentos: string; miembroId?: number; resolucionId?: number;
}
export const segundaOpciones = [
  { id: 'admitido' as const, label: 'ADMITIDO A TRÁMITE', description: 'Registro de segunda admisión · queda pendiente de notificaciones eficaces', accent: 'var(--success)', command: 'admitir' },
  { id: 'improcedente' as const, label: 'IMPROCEDENTE', description: 'Registro de segunda improcedencia · requiere recepción vinculada y fundamentos', accent: 'var(--muted-foreground)', command: 'inadmitir' },
  { id: 'no_presentado' as const, label: 'TENER POR NO PRESENTADO', description: 'No corresponde a segunda calificación de una recepción: exige EN_SUBSANACION y ausencia acreditada de presentación', accent: 'var(--warning)', command: 'no-presentado' },
];
export function requerimientoConsultado(ap: Apelacion | null) {
  const r = ap?.resolucionPrimeraCalificacion;
  const extra = r as typeof r & { apelacionId?: number };
  return ap && positiveId(r?.id) && r?.tipoResolucion === 'PRIMERA_CALIFICACION' && r.decision === 'INADMISIBLE'
    && ap.calificacionPrimera === 'INADMISIBLE' && (extra?.apelacionId == null || extra.apelacionId === ap.id)
    && (ap.plazoSubsanacion?.requerimientoId == null || ap.plazoSubsanacion.requerimientoId === r.id) ? r : null;
}
export function segundaConsultada(ap: Apelacion | null) {
  const r = ap?.resolucionSegundaCalificacion;
  const extra = r as typeof r & { apelacionId?: number };
  return ap && positiveId(r?.id) && r?.tipoResolucion === 'SEGUNDA_CALIFICACION'
    && ['ADMITIDO', 'IMPROCEDENTE'].includes(r.decision || '') && ap.calificacionSegunda === r.decision
    && (extra?.apelacionId == null || extra.apelacionId === ap.id) ? r : null;
}
export function segundaCompatible(ap: Apelacion, op: SegundaOperacion): boolean {
  if (!ap) return false;
  const r = segundaConsultada(ap);
  return ap.id === op.apelacionId && ap.expediente === op.expediente && ap.expedienteTtaip?.id === op.expedienteTtaipId
    && requerimientoConsultado(ap)?.id === op.requerimientoId && !!r && positiveId(r.id)
    && (op.resolucionId == null || r.id === op.resolucionId)
    && r.decision === (op.decision === 'admitido' ? 'ADMITIDO' : 'IMPROCEDENTE') && r.fundamentos === op.fundamentos
    && (op.miembroId == null || r.miembroTTAIPId === op.miembroId)
    && ap.estado === (op.decision === 'admitido' ? 'NOTIFICACION_SEGUNDA_CALIFICACION' : 'RESUELTO_IMPROCEDENTE');
}
export function contextoSegunda(ap: Apelacion | null): 'incompleto' | 'registrada' | 'incompatible' | 'borrador' {
  if (!ap) return 'incompleto';
  if (ap.expedienteTtaip && (!positiveId(ap.expedienteTtaip.id) || ap.expedienteTtaip.numeroExpediente !== ap.expediente)) return 'incompleto';
  if (segundaConsultada(ap)) return 'registrada';
  if (ap.calificacionSegunda != null || ap.resolucionSegundaCalificacion != null
    || (Array.isArray(ap.resoluciones) && ap.resoluciones.some(r => r?.tipoResolucion === 'SEGUNDA_CALIFICACION'))) return 'incompleto';
  if (ap.estado !== 'EN_CALIFICACION_2') return 'incompatible';
  const r = requerimientoConsultado(ap);
  if (!r || ap.calificacionSegunda !== null || ap.resolucionSegundaCalificacion !== null || !Array.isArray(ap.resoluciones)
    || (ap.plazoSubsanacion?.requerimientoId != null && ap.plazoSubsanacion.requerimientoId !== r.id)) return 'incompleto';
  return 'borrador';
}
/** The DTO clock is observed, never used to infer submission/absence or a new stage deadline. */
export function relojConsultado(ap: Apelacion | null): string {
  const p = ap?.plazoSubsanacion, requirement = requerimientoConsultado(ap);
  if (!p) return 'Reloj no informado';
  if (!requirement || p.requerimientoId !== requirement.id || !Number.isSafeInteger(p.diasHabiles) || p.diasHabiles! <= 0) return 'Reloj incompleto o de otro requerimiento';
  if (p.estado === 'PENDIENTE_INICIO') return p.fechaEficacia == null && p.fechaLimite == null && p.notificacionId == null
    && p.diasHabilesRestantes == null ? 'Inicio pendiente de acreditación' : 'Reloj incompleto';
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value));
  if (!['EN_CURSO', 'VENCIDO'].includes(p.estado || '') || !positiveId(p.notificacionId)
    || !date(p.fechaEficacia) || !date(p.fechaLimite) || !Number.isSafeInteger(p.diasHabilesRestantes)) return 'Reloj incompleto';
  return p.estado === 'VENCIDO' ? 'Vencido según el servidor' : p.diasHabilesRestantes! >= 0
    ? 'En curso · ' + p.diasHabilesRestantes + ' días hábiles informados' : 'Reloj incompleto';
}
