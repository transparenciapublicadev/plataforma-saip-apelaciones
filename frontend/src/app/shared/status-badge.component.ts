import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeTone = 'brand' | 'gold' | 'success' | 'info' | 'violet' | 'rose' | 'slate' | 'amber' | 'dark';

export const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string; border: string; dot: string }> = {
  brand:   { bg: 'var(--brand-50)',  fg: 'var(--brand-700)', border: 'var(--brand-200)', dot: 'var(--brand-600)' },
  gold:    { bg: '#FAF3E2',          fg: '#7A5A1F',          border: '#EAD8A8',          dot: '#B08842' },
  success: { bg: '#E7F6EC',          fg: '#15803D',          border: '#BFE3CB',          dot: '#15803D' },
  info:    { bg: '#E6EFFE',          fg: '#1D4ED8',          border: '#BFD3F8',          dot: '#1D4ED8' },
  violet:  { bg: '#F1ECFB',          fg: '#5B21B6',          border: '#D6C7F1',          dot: '#7C3AED' },
  rose:    { bg: '#FCEDF1',          fg: '#9F1239',          border: '#F1C2D0',          dot: '#BE123C' },
  amber:   { bg: '#FEF3C7',          fg: '#92400E',          border: '#FDE68A',          dot: '#B45309' },
  slate:   { bg: '#F1F5F9',          fg: '#475569',          border: '#E2E8F0',          dot: '#64748B' },
  dark:    { bg: '#1A1410',          fg: '#FBF9F6',          border: '#1A1410',          dot: '#DD5862' },
};

const STATUS_TO_TONE: Record<string, BadgeTone> = {
  // SAIP 1ª Instancia
  'En Proceso': 'info',
  'EN_PROCESO': 'info',
  'Pendiente': 'amber',
  'PENDIENTE': 'amber',
  'Respondida': 'success',
  'RESPONDIDA': 'success',
  'Apelada': 'violet',
  'APELADA': 'violet',
  'Denegada': 'rose',
  'DENEGADA': 'rose',
  'Vencida': 'dark',
  'VENCIDA': 'dark',
  'Archivada': 'slate',
  'ARCHIVADA': 'slate',
  'Archivado': 'slate',
  'ARCHIVADO': 'slate',
  'En Precisión': 'amber',
  'En Precision': 'amber',
  'EN_PRECISION': 'amber',
  'Encauzada': 'violet',
  'ENCAUZADA': 'violet',
  'Por Recoger': 'gold',
  'POR_RECOGER': 'gold',
  'Recepcionada': 'info',
  'RECEPCIONADA': 'info',
  'En Revisión Requisitos': 'info',
  'EN_REVISION_REQUISITOS': 'info',
  'Observada': 'amber',
  'OBSERVADA': 'amber',
  'Atendida': 'success',
  'ATENDIDA': 'success',

  // TTAIP 2ª Instancia
  'Pendiente de Elevación': 'amber',
  'Pendiente de Elevacion': 'amber',
  'PENDIENTE_ELEVACION': 'amber',
  'En 1ra Calificación': 'violet',
  'En 1ra Calificacion': 'violet',
  'EN_CALIFICACION_1': 'violet',
  'En Subsanación': 'rose',
  'En Subsanacion': 'rose',
  'EN_SUBSANACION': 'rose',
  'Esperando Subsanación': 'rose',
  'En 2da Calificación': 'info',
  'En 2da Calificacion': 'info',
  'EN_CALIFICACION_2': 'info',
  'Notificación 2da Calificación': 'info',
  'NOTIFICACION_SEGUNDA_CALIFICACION': 'info',
  'En Resolución': 'gold',
  'En Resolucion': 'gold',
  'EN_RESOLUCION': 'gold',
  'Resuelto': 'success',
  'RESUELTO': 'success',
  'No Presentado': 'slate',
  'TENER_POR_NO_PRESENTADO': 'slate',

  // Fallos / Resoluciones Finales
  'Fundado': 'success',
  'FUNDADO': 'success',
  'Fundada': 'success',
  'FUNDADA': 'success',
  'RESUELTO_FUNDADO': 'success',
  'Admitida': 'success',
  'Admitido': 'success',
  'ADMITIDO': 'success',
  'ADMISIBLE': 'success',
  'Fundado en parte': 'gold',
  'FUNDADO_EN_PARTE': 'gold',
  'RESUELTO_FUNDADO_EN_PARTE': 'gold',
  'Infundado': 'rose',
  'INFUNDADO': 'rose',
  'Infundada': 'rose',
  'INFUNDADA': 'rose',
  'RESUELTO_INFUNDADO': 'rose',
  'Infundado en parte': 'amber',
  'INFUNDADO_EN_PARTE': 'amber',
  'RESUELTO_INFUNDADO_EN_PARTE': 'amber',
  'Improcedente': 'slate',
  'IMPROCEDENTE': 'slate',
  'RESUELTO_IMPROCEDENTE': 'slate',
  'Inadmisible': 'rose',
  'INADMISIBLE': 'rose',
  'Conclusión por sustracción': 'slate',
  'CONCLUSION_SUSTRACCION_MATERIA': 'slate',
  'Conclusión por desistimiento': 'slate',
  'CONCLUSION_DESISTIMIENTO': 'slate',
  'Estese a lo resuelto': 'slate',
  'RESUELTO_ESTESE_A_LO_RESUELTO': 'slate',
  'Nulidad del acto': 'slate',
  'RESUELTO_NULIDAD_ACTO': 'slate',

  // Respuestas Entidad
  'Entrega Total': 'success',
  'ENTREGA_TOTAL': 'success',
  'Entrega Parcial': 'gold',
  'ENTREGA_PARCIAL': 'gold',
  'Denegación Total': 'rose',
  'DENEGACION_TOTAL': 'rose',

  // Compliance
  'Cumplido': 'success',
  'cumplido': 'success',
  'Vencido': 'dark',
  'vencido': 'dark',
  'Observado': 'amber',
  'observado': 'amber',
  'Reiterado': 'info',
  'reiterado': 'info',
  'Cerrado': 'brand',
  'cerrado': 'brand',

  // Entidades, Usuarios y Roles
  'Activa': 'success',
  'activa': 'success',
  'Activo': 'success',
  'activo': 'success',
  'Inactiva': 'slate',
  'inactiva': 'slate',
  'Inactivo': 'slate',
  'inactivo': 'slate',
  'CIUDADANO': 'info',
  'Ciudadano': 'info',
  'FUNCIONARIO': 'violet',
  'Funcionario': 'violet',
  'TTAIP': 'amber',
  'ADMINISTRADOR': 'brand',
  'Administrador': 'brand',
};

const STATUS_LABELS: Record<string, string> = {
  'EN_PROCESO': 'En trámite',
  'RECEPCIONADA': 'Recepcionada',
  'EN_REVISION_REQUISITOS': 'En revisión de requisitos',
  'OBSERVADA': 'Observada (en precisión)',
  'ENTREGA_TOTAL': 'Entrega total',
  'ENTREGA_PARCIAL': 'Entrega parcial',
  'DENEGADA': 'Denegada',
  'ATENDIDA': 'Atendida',
  'VENCIDA': 'Vencida',
  'ARCHIVADO': 'Archivado',
  'ARCHIVADA': 'Archivado',
  'PENDIENTE_ELEVACION': 'Pendiente de elevación',
  'EN_CALIFICACION_1': 'En 1ra Calificación',
  'EN_SUBSANACION': 'En Subsanación',
  'EN_CALIFICACION_2': 'En 2da Calificación',
  'NOTIFICACION_SEGUNDA_CALIFICACION': 'Notificación 2da Calificación',
  'EN_RESOLUCION': 'En Resolución Final',
  'RESUELTO': 'Resuelto',
  'TENER_POR_NO_PRESENTADO': 'Tener por no presentado',
  'CONCLUSION_SUSTRACCION_MATERIA': 'Conclusión por sustracción',
  'CONCLUSION_DESISTIMIENTO': 'Conclusión por desistimiento',
  'RESUELTO_FUNDADO': 'Fundado',
  'RESUELTO_FUNDADO_EN_PARTE': 'Fundado en parte',
  'RESUELTO_INFUNDADO': 'Infundado',
  'RESUELTO_INFUNDADO_EN_PARTE': 'Infundado en parte',
  'RESUELTO_IMPROCEDENTE': 'Improcedente',
  'RESUELTO_ESTESE_A_LO_RESUELTO': 'Estese a lo resuelto',
  'RESUELTO_NULIDAD_ACTO': 'Nulidad del acto',
  'ADMISIBLE': 'Admitido',
  'INADMISIBLE': 'Inadmisible (subsanable)',
  'IMPROCEDENTE': 'Improcedente',
  'CIUDADANO': 'Ciudadano',
  'FUNCIONARIO': 'Funcionario',
  'TTAIP': 'TTAIP',
  'ADMINISTRADOR': 'Administrador',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors"
      [style.background]="c().bg"
      [style.color]="c().fg"
      [style.border]="'1px solid ' + c().border"
      style="padding: 3px 10px 3px 8px; font-size: 11px; letter-spacing: 0.02em; line-height: 1.4;">
      <span
        aria-hidden="true"
        [style.background]="c().dot"
        [style.boxShadow]="'0 0 0 3px ' + c().bg"
        style="width: 6px; height: 6px; border-radius: 999px; display: inline-block; flex-shrink: 0;">
      </span>
      <span>{{ label() }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly raw = input<boolean>(false);
  readonly toneOverride = input<BadgeTone | null>(null);

  readonly label = computed(() => {
    const s = this.status() || '';
    if (this.raw()) return s;
    const normalized = s.trim().toUpperCase().replace(/ /g, '_');
    return STATUS_LABELS[s] || STATUS_LABELS[normalized] || s;
  });

  readonly c = computed(() => {
    const override = this.toneOverride();
    if (override && BADGE_TONES[override]) {
      return BADGE_TONES[override];
    }
    const s = this.status() || '';
    const normalized = s.trim().toUpperCase().replace(/ /g, '_');
    const tone = STATUS_TO_TONE[s] || STATUS_TO_TONE[normalized] || 'slate';
    return BADGE_TONES[tone];
  });
}
