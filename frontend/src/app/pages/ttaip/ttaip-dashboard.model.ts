import { PanelApelacion as Apelacion } from '../../models/panel-query.model';
import { CalendarioConfig, PLAZO_META_POR_CLAVE, PlazoClave, habilesEntre, recepcionEfectiva, sumarHabiles } from '../../models/calendario.model';

export type StageKey = 'todos' | 'elevacion' | 'calificacion1' | 'subsanacion' | 'calificacion2' | 'resolucion' | 'notificaciones' | 'resueltos' | 'otras';

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
  { key: 'elevacion',     num: '01', label: 'Pte. de elevación',     shortLabel: 'Elevación',  plazoDias: 0, plazoLabel: 'plazo no informado', norma: 'Reglamento TTAIP',        color: 'var(--muted-foreground)', bg: 'var(--muted)',                           icon: 'inbox' },
  { key: 'calificacion1', num: '02', label: '1ra Calificación',      shortLabel: '1ra Calif.', plazoDias: 0, plazoLabel: 'plazo no informado', norma: 'Reglamento TTAIP',        color: 'var(--info)',     bg: 'color-mix(in srgb, var(--info) 8%, transparent)', icon: 'scale' },
  { key: 'subsanacion',   num: '03', label: 'Subsanación',           shortLabel: 'Subsanación',plazoDias: 0, plazoLabel: 'plazo no informado', norma: 'Espera del administrado', color: 'var(--gold-dark)', bg: 'rgba(176,136,66,0.10)',                              icon: 'hourglass', esperaExterna: true },
  { key: 'calificacion2', num: '04', label: '2da Calificación',      shortLabel: '2da Calif.', plazoDias: 0, plazoLabel: 'plazo no informado', norma: 'Plazo operativo',         color: 'var(--brand-600)', bg: 'var(--brand-subtle)',                          icon: 'layers' },
  { key: 'resolucion',    num: '05', label: 'Resolución Final',      shortLabel: 'Res. Final', plazoDias: 0, plazoLabel: 'plazo no informado', norma: 'Reglamento TTAIP',        color: 'var(--brand-700)', bg: 'var(--brand-subtle)',                          icon: 'gavel' },
  { key: 'notificaciones', num: '06', label: 'Notificaciones pendientes', shortLabel: 'Notificaciones', plazoDias: 0, plazoLabel: 'Validación pendiente', norma: 'Actos de notificación', color: 'var(--gold-dark)', bg: 'var(--muted)', icon: 'inbox' },
  { key: 'resueltos',     num: '07', label: 'Resueltos',             shortLabel: 'Resueltos',  plazoDias: 0,  plazoLabel: 'Cerrados',         norma: 'Archivo',                 color: 'var(--success)',  bg: 'color-mix(in srgb, var(--success) 10%, transparent)', icon: 'check', isResolved: true },
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
  informado: boolean;
  vencido: boolean;
  limite: string | null;
}

/**
 * Saldo de la etapa para la cola del Tribunal.
 * La subsanación conserva el reloj persistido: su inicio es la notificación, no el ingreso.
 * Las demás etapas abiertas cuentan desde la recepción efectiva del ingreso, con el plazo
 * y los feriados del calendario oficial. Sin calendario o sin fecha, el saldo queda sin informar.
 */
export function computePlazoStatus(ap: Apelacion, s: StageMeta, hoyISO: string, cfg: CalendarioConfig | null = null): PlazoStatusResult {
  if (s.key === 'calificacion1' && ap.plazoPrimeraCalificacion?.fechaLimite) {
    const { diasRestantes, vencido, diasSuspendidos, fechaLimite } = ap.plazoPrimeraCalificacion;
    const efectivos = Math.max(0, 7 - diasRestantes);
    return { restantes: diasRestantes, pct: Math.min(100, efectivos / 7 * 100),
      tone: vencido ? 'critical' : diasRestantes <= 2 ? 'warn' : 'ok',
      suspendido: diasSuspendidos ?? 0, efectivos, informado: true, vencido, limite: fechaLimite };
  }
  if (s.isResolved || (finalStates.has(ap.estado) && !ap.actosNotificacionPendientes)) {
    return { restantes: 0, pct: 100, tone: 'done', suspendido: 0, efectivos: 0, informado: true, vencido: false, limite: null };
  }

  if (s.key === 'subsanacion' && ap.plazoSubsanacion?.diasHabilesRestantes != null) {
    const restantes = Math.max(0, ap.plazoSubsanacion.diasHabilesRestantes);
    const total = ap.plazoSubsanacion.diasHabiles || 2;
    const efectivos = Math.max(0, total - restantes);
    const pct = Math.min(100, (efectivos / total) * 100);
    const tone = restantes <= 1 ? 'critical' : restantes <= 2 ? 'warn' : 'ok';
    const vencido = ap.plazoSubsanacion?.estado === 'VENCIDO';
    return { restantes, pct, tone: vencido ? 'critical' : tone, suspendido: 0, efectivos, informado: true, vencido, limite: recordedDate(ap.plazoSubsanacion?.fechaLimite) };
  }

  const saldo = saldoDesdeIngreso(recordedDate(ap.fechaApelacion), s.plazoDias, cfg, hoyISO);
  if (!saldo) return { restantes: 0, pct: 0, tone: 'ok', suspendido: 0, efectivos: 0, informado: false, vencido: false, limite: null };
  const tone = saldo.vencido || saldo.restantes <= 1 ? 'critical' : saldo.restantes <= 2 ? 'warn' : 'ok';
  const pct = Math.min(100, (saldo.transcurridos / s.plazoDias) * 100);
  return { restantes: saldo.restantes, pct, tone, suspendido: 0, efectivos: saldo.transcurridos, informado: true, vencido: saldo.vencido, limite: saldo.limite };
}

function saldoDesdeIngreso(fecha: string | null, dias: number, cfg: CalendarioConfig | null, hoy: string) {
  if (!cfg || dias <= 0 || !fecha || !/^\d{4}-\d{2}-\d{2}/.test(hoy)) return null;
  const inicio = recepcionEfectiva(fecha.slice(0, 10), cfg);
  const limite = sumarHabiles(inicio, dias, cfg);
  const transcurridos = habilesEntre(inicio, hoy, cfg);
  return { transcurridos, restantes: habilesEntre(hoy, limite, cfg), vencido: hoy > limite, limite };
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
  if (p.diasHabilesRestantes === 0) return 'Vence hoy';
  return p.diasHabilesRestantes! > 0 ? `${p.diasHabilesRestantes}d` : 'Reloj incompleto';
}

const decisions = new Set(['FUNDADO', 'FUNDADO_EN_PARTE', 'INFUNDADO', 'INFUNDADO_EN_PARTE', 'IMPROCEDENTE', 'CONCLUSION_SUSTRACCION_MATERIA',
  'CONCLUSION_DESISTIMIENTO', 'ESTESE_A_LO_RESUELTO', 'NULIDAD_DEL_ACTO', 'TENER_POR_NO_PRESENTADO']);

export function finalDecision(ap: Apelacion): string | null {
  const r = ap.resolucion;
  return finalStates.has(ap.estado) && positiveId(r?.id) && r?.tipoResolucion === 'RESOLUCION_FINAL'
    && typeof r.decision === 'string' && decisions.has(r.decision) ? r.decision : null;
}

const decisionFromState: Record<string, string> = {
  RESUELTO_FUNDADO: 'FUNDADO',
  RESUELTO_FUNDADO_EN_PARTE: 'FUNDADO_EN_PARTE',
  RESUELTO_INFUNDADO: 'INFUNDADO',
  RESUELTO_INFUNDADO_EN_PARTE: 'INFUNDADO_EN_PARTE',
  RESUELTO_IMPROCEDENTE: 'IMPROCEDENTE',
  RESUELTO_ESTESE_A_LO_RESUELTO: 'ESTESE_A_LO_RESUELTO',
  RESUELTO_NULIDAD_ACTO: 'NULIDAD_DEL_ACTO',
  TENER_POR_NO_PRESENTADO: 'TENER_POR_NO_PRESENTADO',
  CONCLUSION_SUSTRACCION_MATERIA: 'CONCLUSION_SUSTRACCION_MATERIA',
  CONCLUSION_DESISTIMIENTO: 'CONCLUSION_DESISTIMIENTO',
};

export const decisionLabels: Record<string, string> = {
  FUNDADO: 'Fundado',
  FUNDADO_EN_PARTE: 'Fundado en parte',
  INFUNDADO: 'Infundado',
  INFUNDADO_EN_PARTE: 'Infundado en parte',
  IMPROCEDENTE: 'Improcedente',
  ESTESE_A_LO_RESUELTO: 'Estese a lo resuelto',
  NULIDAD_DEL_ACTO: 'Nulidad del acto',
  TENER_POR_NO_PRESENTADO: 'Tener por no presentado',
  CONCLUSION_SUSTRACCION_MATERIA: 'Conclusión por sustracción',
  CONCLUSION_DESISTIMIENTO: 'Conclusión por desistimiento',
};

/** One recorded decision for a closed appeal. The stage chip already names the stage. */
export function decisionLista(ap: Apelacion): string | null {
  if (!finalStates.has(ap.estado)) return null;
  return finalDecision(ap) ?? decisionFromState[ap.estado] ?? null;
}

const plazoClave: Partial<Record<StageKey, PlazoClave>> = {
  elevacion: 'TTAIP_ELEVACION',
  calificacion1: 'TTAIP_CALIFICACION_1',
  subsanacion: 'TTAIP_SUBSANACION',
  calificacion2: 'TTAIP_CALIFICACION_2',
  resolucion: 'TTAIP_RESOLUCION',
};

/** Days come only from the official calendar response. Missing or out-of-range values stay uninformed. */
export function stagesConPlazos(plazos: Record<string, unknown> | null): StageMeta[] {
  return stages.map(stage => {
    const clave = plazoClave[stage.key];
    if (!clave) return stage;
    const meta = PLAZO_META_POR_CLAVE[clave];
    const dias = Number(plazos?.[clave]);
    if (!Number.isInteger(dias) || dias < meta.min || dias > meta.max) {
      return { ...stage, plazoDias: 0, plazoLabel: 'plazo no informado' };
    }
    return { ...stage, plazoDias: dias, plazoLabel: `${dias} días háb.` };
  });
}

export function plazoEtapaCaption(key: StageKey): string {
  if (key === 'elevacion') return 'para elevar';
  if (key === 'calificacion1' || key === 'calificacion2') return 'para calificar';
  if (key === 'subsanacion') return 'espera del administrado';
  if (key === 'resolucion') return 'para resolver';
  return 'plazo no informado';
}

export function actionFor(ap: Apelacion): { route: string[]; label: string; reason: string; primary: boolean; tab?: string } {
  if (ap.actosNotificacionPendientes) {
    return { route: ['/ttaip/apelacion', ap.expediente], label: 'Validar notificaciones',
      reason: 'El expediente requiere validar los actos de notificación antes de continuar.',
      primary: true, tab: 'notificaciones' };
  }
  if (ap.estado === 'EN_CALIFICACION_1') {
    if (Object.hasOwn(ap, 'calificacionPrimera') && ap.calificacionPrimera !== null) {
      return { route: ['/ttaip/apelacion', ap.expediente], label: 'Revisar requisitos', reason: 'Primera calificación ya registrada.', primary: false };
    }
    return { route: ['/ttaip/calificar', ap.expediente], label: 'Resolver', reason: '', primary: true };
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
