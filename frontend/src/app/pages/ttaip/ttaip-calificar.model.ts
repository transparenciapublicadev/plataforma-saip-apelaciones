import { Apelacion } from '../../models/apelacion.model';
import { DOCUMENTO_RELATION_KEYS, DocumentoMetadata, DocumentoRelation } from '../../models/documento.model';

export type CalificacionDecision = 'admisible' | 'inadmisible' | 'improcedente';
export interface CalificacionOperacion {
  apelacionId: number;
  expediente: string;
  decision: CalificacionDecision;
  fundamentos: string;
  observaciones?: string;
  resolucionId?: number;
}
export const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
export const calificacionOpciones = [
  { id: 'admisible' as const, label: 'ADMISIBLE', description: 'Cumple requisitos · pasa a Resolución Final', accent: 'var(--success)', decision: 'ADMISIBLE', estado: 'EN_RESOLUCION', command: 'admitir' },
  { id: 'inadmisible' as const, label: 'INADMISIBLE', description: 'Requiere subsanación · 2 días hábiles', accent: 'var(--warning)', decision: 'INADMISIBLE', estado: 'EN_SUBSANACION', command: 'subsanar' },
  { id: 'improcedente' as const, label: 'IMPROCEDENTE', description: 'No cumple requisitos · proceso archivado', accent: 'var(--muted-foreground)', decision: 'IMPROCEDENTE', estado: 'RESUELTO_IMPROCEDENTE', command: 'inadmitir' },
];
export function apelacionCompatible(value: unknown, expediente: string): value is Apelacion {
  const ap = value as Apelacion | null;
  return !!ap && positiveId(ap.id) && ap.expediente === expediente && typeof ap.estado === 'string' && !!ap.estado.trim();
}
export function primeraRegistrada(ap: Apelacion): boolean {
  return ap.calificacionPrimera != null || ap.resolucionPrimeraCalificacion != null
    || (Array.isArray(ap.resoluciones) && ap.resoluciones.some(r => r?.tipoResolucion === 'PRIMERA_CALIFICACION'));
}
/** Omitted evidence is different from the backend explicitly returning no prior act. */
export function motivoPrimera(ap: Apelacion): string {
  if ((ap.expedienteTtaip && (!positiveId(ap.expedienteTtaip.id) || ap.expedienteTtaip.numeroExpediente !== ap.expediente))
    || (ap.elevacion && ap.elevacion.apelacionId !== ap.id)) return 'Información incompleta o asociaciones incompatibles de antecedentes.';
  const first = ap.resolucionPrimeraCalificacion;
  if (first != null && (!positiveId(first.id) || first.tipoResolucion !== 'PRIMERA_CALIFICACION')) return 'Información incompleta de la primera actuación; no se habilita otra calificación.';
  if (ap.calificacionPrimera != null && first == null) return 'Información incompleta: hay una calificación sin actuación identificada en el resumen.';
  if (primeraRegistrada(ap)) return 'La primera calificación ya está registrada. Consulte la actuación; no se permite registrarla de nuevo.';
  if (ap.estado !== 'EN_CALIFICACION_1') return 'Estado incompatible con primera calificación: ' + ap.estado + '.';
  if (ap.calificacionPrimera !== null || ap.resolucionPrimeraCalificacion !== null || !Array.isArray(ap.resoluciones))
    return 'Información incompleta sobre las actuaciones previas. Consulte nuevamente antes de calificar.';
  return '';
}
/** DTOs embed this record under their appeal; a contradictory explicit FK is never accepted. */
export function actuacionCompatible(ap: Apelacion, op: CalificacionOperacion): boolean {
  const r = ap.resolucionPrimeraCalificacion;
  const option = calificacionOpciones.find(item => item.id === op.decision)!;
  const extra = r as typeof r & { apelacionId?: number; expediente?: string };
  return positiveId(r?.id) && r?.tipoResolucion === 'PRIMERA_CALIFICACION' && r.decision === option.decision
    && ap.calificacionPrimera === option.decision && (op.resolucionId == null || r.id === op.resolucionId)
    && (extra?.apelacionId == null || extra.apelacionId === op.apelacionId)
    && (extra?.expediente == null || extra.expediente === op.expediente)
    && r.fundamentos === op.fundamentos && (op.decision !== 'inadmisible' || r.observaciones === op.observaciones);
}
export function documentosRelacionados(value: unknown, relation: DocumentoRelation): DocumentoMetadata[] | null {
  if (!Array.isArray(value)) return null;
  const [key, id] = Object.entries(relation)[0];
  const seen = new Set<number>();
  for (const doc of value) {
    const links = doc && DOCUMENTO_RELATION_KEYS.filter(field => doc[field] != null);
    if (!doc || !positiveId(doc.id) || seen.has(doc.id) || links.length !== 1 || doc[key] !== id
      || (doc.estado != null && doc.estado !== 'ACTIVO')) return null;
    seen.add(doc.id);
  }
  return value;
}
