import { PanelApelacion as Apelacion } from '../../models/panel-query.model';

export type StageKey = 'todos' | 'elevacion' | 'calificacion1' | 'subsanacion' | 'calificacion2' | 'resolucion' | 'resueltos' | 'otras';

export interface StageMeta {
  key: StageKey;
  num: string;
  label: string;
  shortLabel: string;
  plazoDias: number;
  plazoLabel: string;
  norma: string;
  color: string;
  bg: string;
  icon: string;
  esperaExterna?: boolean;
  isResolved?: boolean;
}

export const stages: StageMeta[] = [
  { key: 'todos',         num: '00', label: 'Todos los expedientes', shortLabel: 'Todos',      plazoDias: 0,  plazoLabel: 'Todo el pipeline', norma: 'Vista general',           color: 'var(--brand-700)', bg: 'var(--brand-subtle)',                          icon: 'layers' },
  { key: 'elevacion',     num: '01', label: 'Pte. de elevación',     shortLabel: 'Elevación',  plazoDias: 2,  plazoLabel: '2 días háb.',      norma: 'Reglamento TTAIP',        color: 'var(--muted-foreground)', bg: 'var(--muted)',                           icon: 'inbox' },
  { key: 'calificacion1', num: '02', label: '1ra Calificación',      shortLabel: '1ra Calif.', plazoDias: 7,  plazoLabel: '7 días háb.',      norma: 'Reglamento TTAIP',        color: 'var(--info)',     bg: 'color-mix(in srgb, var(--info) 8%, transparent)', icon: 'scale' },
  { key: 'subsanacion',   num: '03', label: 'Subsanación',           shortLabel: 'Subsanación',plazoDias: 2,  plazoLabel: '2 días háb.',      norma: 'Espera del administrado', color: 'var(--gold-dark)', bg: 'rgba(176,136,66,0.10)',                              icon: 'hourglass', esperaExterna: true },
  { key: 'calificacion2', num: '04', label: '2da Calificación',      shortLabel: '2da Calif.', plazoDias: 7,  plazoLabel: '7 días háb.',      norma: 'Reglamento TTAIP',        color: 'var(--brand-600)', bg: 'var(--brand-subtle)',                          icon: 'layers' },
  { key: 'resolucion',    num: '05', label: 'Resolución Final',      shortLabel: 'Res. Final', plazoDias: 10, plazoLabel: '10 días háb.',     norma: 'Reglamento TTAIP',        color: 'var(--brand-700)', bg: 'var(--brand-subtle)',                          icon: 'gavel' },
  { key: 'resueltos',     num: '06', label: 'Resueltos',             shortLabel: 'Resueltos',  plazoDias: 0,  plazoLabel: 'Cerrados',         norma: 'Archivo',                 color: 'var(--success)',  bg: 'color-mix(in srgb, var(--success) 10%, transparent)', icon: 'check', isResolved: true },
];

export const positiveId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');

export const finalStates = new Set([
  'RESUELTO', 'RESUELTO_FUNDADO', 'RESUELTO_FUNDADO_EN_PARTE', 'RESUELTO_INFUNDADO', 'RESUELTO_INFUNDADO_EN_PARTE',
  'RESUELTO_IMPROCEDENTE', 'RESUELTO_ESTESE_A_LO_RESUELTO', 'RESUELTO_NULIDAD_ACTO', 'TENER_POR_NO_PRESENTADO',
  'CONCLUSION_SUSTRACCION_MATERIA', 'CONCLUSION_DESISTIMIENTO'
]);

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

/** Cómputo de días hábiles entre dos fechas (excluyendo sábados y domingos) */
export function habilesEntreFechas(desde?: string | null, hasta?: string | null): number {
  if (!desde || !hasta) return 0;
  const d1 = new Date(desde.slice(0, 10) + 'T00:00:00');
  const d2 = new Date(hasta.slice(0, 10) + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d1 > d2) return 0;
  let count = 0;
  const cur = new Date(d1);
  cur.setDate(cur.getDate() + 1); // Cómputo inicia el día hábil siguiente
  while (cur <= d2) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export interface PlazoStatusResult {
  restantes: number;
  pct: number;
  tone: 'critical' | 'warn' | 'ok' | 'done';
  suspendido: number;
  efectivos: number;
}

/**
 * Cómputo legal de plazos del Tribunal:
 * - En 'resolucion' (10 días hábiles): descuenta días suspendidos (descargos 7d, informe oral 3d, info compl. 3d).
 * - En 'subsanacion' (2 días hábiles): usa el reloj formal de subsanación.
 * - En 'calificacion1' (7 días hábiles) / 'calificacion2' (7 días hábiles) / 'elevacion' (2 días hábiles).
 */
export function computePlazoStatus(ap: Apelacion, s: StageMeta, hoyISO: string): PlazoStatusResult {
  if (s.isResolved || finalStates.has(ap.estado)) {
    return { restantes: 0, pct: 100, tone: 'done', suspendido: 0, efectivos: 0 };
  }

  // 1. Caso especial: Subsanación con reloj de notificación formal
  if (s.key === 'subsanacion' && ap.plazoSubsanacion?.diasHabilesRestantes != null) {
    const restantes = Math.max(0, ap.plazoSubsanacion.diasHabilesRestantes);
    const total = ap.plazoSubsanacion.diasHabiles || 2;
    const efectivos = Math.max(0, total - restantes);
    const pct = Math.min(100, (efectivos / total) * 100);
    const tone = restantes <= 1 ? 'critical' : restantes <= 2 ? 'warn' : 'ok';
    return { restantes, pct, tone, suspendido: 0, efectivos };
  }

  // 2. Etapa de Resolución Final (10 días) con suspensiones
  const fechaInicio = (ap as any).fechaSegundaCalificacion ?? (ap as any).fechaPrimeraCalificacion ?? ap.fechaApelacion;
  const transcurridos = habilesEntreFechas(fechaInicio, hoyISO);

  // Extraer suspensiones si el backend las expone o estimarlas
  const suspendido = (ap as any).diasSuspendidos ?? 0;
  const plazoDias = s.plazoDias > 0 ? s.plazoDias : 10;
  const efectivos = Math.max(0, transcurridos - suspendido);
  const restantes = Math.max(0, plazoDias - efectivos);
  const pct = Math.min(100, (efectivos / plazoDias) * 100);
  const tone = restantes <= 1 ? 'critical' : restantes <= 2 ? 'warn' : 'ok';

  return { restantes, pct, tone, suspendido, efectivos };
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

export function actionFor(ap: Apelacion): { route: string[]; label: string; reason: string; primary: boolean } {
  if (ap.estado === 'EN_CALIFICACION_1') {
    if (Object.hasOwn(ap, 'calificacionPrimera') && ap.calificacionPrimera !== null) {
      return { route: ['/ttaip/apelacion', ap.expediente], label: 'Revisar requisitos', reason: 'Primera calificación ya registrada.', primary: false };
    }
    return { route: ['/ttaip/calificar', ap.expediente], label: 'Calificar', reason: '', primary: true };
  }
  if (ap.estado === 'EN_CALIFICACION_2') {
    if (ap.calificacionPrimera === 'INADMISIBLE' || (ap as any).fechaSubsanacion || ap.plazoSubsanacion) {
      return { route: ['/ttaip/segunda-calificacion', ap.expediente], label: 'Resolver 2da', reason: '', primary: true };
    }
    return { route: ['/ttaip/apelacion', ap.expediente], label: 'Revisar requisitos', reason: 'La lista no acredita la recepción del requerimiento. Revise el expediente antes de segunda calificación.', primary: false };
  }
  if (ap.estado === 'NOTIFICACION_SEGUNDA_CALIFICACION') {
    return { route: ['/ttaip/apelacion', ap.expediente], label: 'Revisar requisitos', reason: 'Debe acreditarse la notificación eficaz al recurrente y a la entidad; no se avanza desde el panel.', primary: false };
  }
  if (ap.estado === 'EN_RESOLUCION') {
    if (ap.calificacionPrimera === 'ADMISIBLE' || ap.calificacionSegunda === 'ADMITIDO' || ap.resolucionPrimeraCalificacion || ap.resolucionSegundaCalificacion) {
      return { route: ['/ttaip/resolver', ap.expediente], label: 'Emitir resolución', reason: '', primary: true };
    }
    return { route: ['/ttaip/apelacion', ap.expediente], label: 'Revisar requisitos', reason: 'Revise admisión, ambas notificaciones eficaces y descargos. La lista no acredita por sí sola estas precondiciones.', primary: false };
  }
  if (ap.estado === 'PENDIENTE_ELEVACION') {
    return { route: ['/ttaip/apelacion', ap.expediente], label: 'Revisar requisitos', reason: 'La elevación requiere su actuación específica; no se adelanta la calificación.', primary: false };
  }
  if (finalStates.has(ap.estado)) {
    return { route: ['/ttaip/resolucion', ap.expediente], label: 'Ver', reason: '', primary: false };
  }
  if (ap.estado === 'EN_SUBSANACION') {
    return { route: ['/ttaip/apelacion', ap.expediente], label: 'Ver detalle', reason: 'Aguardando subsanación del administrado', primary: false };
  }
  return { route: ['/ttaip/apelacion', ap.expediente], label: 'Ver detalle', reason: '', primary: false };
}
