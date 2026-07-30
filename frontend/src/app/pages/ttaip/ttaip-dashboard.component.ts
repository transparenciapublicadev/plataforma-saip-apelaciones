import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';

type StageKey = 'calificacion1' | 'subsanacion' | 'calificacion2' | 'resolucion' | 'resueltos';
type Priority = 'alta' | 'media' | 'baja';
type Tone = 'critical' | 'warn' | 'ok' | 'done';

interface StageMeta {
  key: StageKey;
  num: string;
  label: string;
  shortLabel: string;
  plazoDias: number;
  plazoLabel: string;
  norma: string;
  color: string;
  bg: string;
  icon: 'scale' | 'hourglass' | 'layers' | 'gavel' | 'check';
  actionLabel: string | null;
  isResolved?: boolean;
  esperaExterna?: boolean;
}

interface QueueItem {
  apelacion: Apelacion;
  stageKey: StageKey;
  ciudadano: string;
  iniciales: string;
  entidad: string;
  materia: string;
  descripcion: string;
  diasHabilesEnEtapa: number;
  prioridad: Priority;
  resultado: string | null;
}

interface PlazoStatus {
  restantes: number;
  pct: number;
  tone: Tone;
}

import {
  LucideGavel, LucideCompass, LucideShieldAlert, LucideSparkles,
  LucideChevronRight, LucideScale, LucideHourglass, LucideLayers,
  LucideCheckCircle2, LucideSearch, LucideInbox, LucideEye,
  LucideArrowRight, LucideActivity, LucideBuilding2, LucideClock,
  LucideFileText, LucideAlertTriangle, LucideTrendingUp
} from '@lucide/angular';

@Component({
  selector: 'app-ttaip-dashboard',
  imports: [
    RouterLink, FormsModule, DatePipe,
    LucideGavel, LucideCompass, LucideShieldAlert, LucideSparkles,
    LucideChevronRight, LucideScale, LucideHourglass, LucideLayers,
    LucideCheckCircle2, LucideSearch, LucideInbox, LucideEye,
    LucideArrowRight, LucideActivity, LucideBuilding2, LucideClock,
    LucideFileText, LucideAlertTriangle, LucideTrendingUp
  ],
  templateUrl: './ttaip-dashboard.component.html',
  styleUrl: './ttaip-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipDashboardComponent implements OnInit {
  private readonly ttaipService = inject(TtaipService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tourService = inject(GuidedTourService);

  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="t-hero"]', title: 'Mesa del Tribunal', body: 'Fecha, total de expedientes en el pipeline y cuántos están en riesgo crítico de incumplir el plazo del Reglamento.' },
    { selector: '[data-tour="t-tasa"]', title: 'Tasa de fundadas', body: 'Indicador institucional: qué proporción de las resoluciones emitidas dieron la razón al administrado.' },
    { selector: '[data-tour="t-pipeline"]', title: 'Pipeline del proceso', body: 'El flujo completo de una apelación, etapa por etapa según el Reglamento del Tribunal. Toca una etapa para enfocar su cola.' },
    { selector: '[data-tour="t-cola"]', title: 'Cola de la etapa', body: 'Los expedientes de la etapa seleccionada, ordenados por plazo restante. Desde aquí calificas, resuelves o consultas cada caso.', align: 'start', onEnter: () => this.selectStage('calificacion1') },
    { selector: '[data-tour="t-estadistica"]', title: 'Resoluciones del periodo', body: 'Distribución de los fallos emitidos: fundados, infundados e improcedentes.' },
    { selector: '[data-tour="t-concentracion"]', title: 'Entidades más apeladas', body: 'Dónde se concentran las apelaciones, para identificar patrones de denegación recurrente.' },
    { selector: '[data-tour="t-disciplinario"]', title: 'Procesos disciplinarios', body: 'Acceso al procedimiento sancionador contra funcionarios que incumplen la ley de transparencia.' },
  ];

  private focusStageFromState: StageKey | null = null;

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { focusStage?: StageKey } | undefined;
    if (state?.focusStage) {
      this.focusStageFromState = state.focusStage;
    }
  }

  readonly stages: StageMeta[] = [
    {
      key: 'calificacion1',
      num: '01',
      label: 'Primera calificación',
      shortLabel: '1ra Calif.',
      plazoDias: 7,
      plazoLabel: '7 días háb.',
      norma: 'Reglamento TTAIP',
      color: 'var(--info)',
      bg: 'rgba(29,78,216,0.08)',
      icon: 'scale',
      actionLabel: 'Calificar'
    },
    {
      key: 'subsanacion',
      num: '02',
      label: 'Subsanación',
      shortLabel: 'Subsanación',
      plazoDias: 2,
      plazoLabel: '2 días háb.',
      norma: 'Espera del ciudadano',
      color: 'var(--gold-dark)',
      bg: 'rgba(176,136,66,0.10)',
      icon: 'hourglass',
      actionLabel: null,
      esperaExterna: true
    },
    {
      key: 'calificacion2',
      num: '03',
      label: 'Segunda calificación',
      shortLabel: '2da Calif.',
      plazoDias: 3,
      plazoLabel: 'Post-subsan.',
      norma: 'Reglamento TTAIP',
      color: 'var(--brand-600)',
      bg: 'var(--brand-subtle)',
      icon: 'layers',
      actionLabel: 'Resolver 2da'
    },
    {
      key: 'resolucion',
      num: '04',
      label: 'Resolución final',
      shortLabel: 'Res. Final',
      plazoDias: 10,
      plazoLabel: '10 días háb.',
      norma: 'Reglamento TTAIP',
      color: 'var(--brand-700)',
      bg: 'var(--brand-subtle)',
      icon: 'gavel',
      actionLabel: 'Emitir resolución'
    },
    {
      key: 'resueltos',
      num: '05',
      label: 'Resueltos',
      shortLabel: 'Resueltos',
      plazoDias: 0,
      plazoLabel: 'Cerrados',
      norma: 'Archivo',
      color: 'var(--success)',
      bg: 'rgba(5,150,105,0.10)',
      icon: 'check',
      actionLabel: 'Ver',
      isResolved: true
    }
  ];

  readonly donutRadius = 26;
  readonly donutCirc = 2 * Math.PI * this.donutRadius;

  readonly apelaciones = signal<Apelacion[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');

  readonly stageKey = signal<StageKey>('calificacion1');
  readonly search = signal<string>('');
  readonly salaFiltro = signal<'TODAS' | 'PRIMERA' | 'SEGUNDA'>('TODAS');
  readonly paginaActual = signal<number>(1);
  readonly itemsPorPagina = signal<number>(10);
  readonly mostrarModalLineaTiempo = signal<boolean>(false);
  readonly apelacionModalSeleccionada = signal<Apelacion | null>(null);
  readonly nombreMiembro = signal<string>('Miembro TTAIP');

  readonly fechaHoy = computed(() =>
    new Date().toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  );

  readonly queueItems = computed(() =>
    this.apelaciones()
      .filter((apelacion) => !this.esPendienteElevacion(apelacion))
      .map((apelacion) => this.toQueueItem(apelacion))
  );

  readonly counts = computed<Record<StageKey, number>>(() => {
    const base: Record<StageKey, number> = {
      calificacion1: 0,
      subsanacion: 0,
      calificacion2: 0,
      resolucion: 0,
      resueltos: 0
    };

    for (const item of this.queueItems()) {
      base[item.stageKey] += 1;
    }

    return base;
  });

  readonly activeStage = computed(() => this.stages.find((stage) => stage.key === this.stageKey()) ?? this.stages[0]);

  readonly filtered = computed(() => {
    const active = this.activeStage();
    const query = this.search().trim().toLowerCase();
    const sala = this.salaFiltro();

    let base = this.queueItems().filter((item) => item.stageKey === active.key);
    
    if (sala !== 'TODAS') {
      base = base.filter((item) => {
        const itemSala = (item.apelacion.expedienteTtaip?.sala?.nombre || '').toUpperCase();
        return sala === 'PRIMERA' ? (itemSala.includes('1') || itemSala.includes('PRIMERA') || !itemSala) : (itemSala.includes('2') || itemSala.includes('SEGUNDA'));
      });
    }

    const searched = query
      ? base.filter((item) => this.matchesQuery(item, query))
      : base;

    if (active.isResolved || active.esperaExterna) {
      return searched;
    }

    return [...searched].sort((a, b) => this.plazoStatus(a, active).restantes - this.plazoStatus(b, active).restantes);
  });

  readonly totalRegistros = computed(() => this.filtered().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.itemsPorPagina()) || 1);
  readonly inicioRegistro = computed(() => this.totalRegistros() === 0 ? 0 : (this.paginaActual() - 1) * this.itemsPorPagina() + 1);
  readonly finRegistro = computed(() => Math.min(this.paginaActual() * this.itemsPorPagina(), this.totalRegistros()));
  readonly filteredVisibles = computed(() => {
    const start = (this.paginaActual() - 1) * this.itemsPorPagina();
    return this.filtered().slice(start, start + this.itemsPorPagina());
  });

  cambiarSala(sala: 'TODAS' | 'PRIMERA' | 'SEGUNDA'): void {
    this.salaFiltro.set(sala);
    this.paginaActual.set(1);
  }

  selectStage(stage: StageKey): void {
    this.stageKey.set(stage);
    this.paginaActual.set(1);
  }

  abrirModalLineaTiempo(apelacion: Apelacion, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.apelacionModalSeleccionada.set(apelacion);
    this.mostrarModalLineaTiempo.set(true);
  }

  cerrarModalLineaTiempo(): void {
    this.mostrarModalLineaTiempo.set(false);
    this.apelacionModalSeleccionada.set(null);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas()) {
      this.paginaActual.set(pagina);
    }
  }

  cambiarItemsPorPagina(items: number): void {
    this.itemsPorPagina.set(items);
    this.paginaActual.set(1);
  }

  readonly riesgo = computed(() => {
    const critical: QueueItem[] = [];
    for (const item of this.queueItems()) {
      const stage = this.stageFromKey(item.stageKey);
      if (stage.isResolved || stage.esperaExterna) continue;
      if (this.plazoStatus(item, stage).restantes <= 1) {
        critical.push(item);
      }
    }
    return critical;
  });

  readonly totalExpedientes = computed(() => this.queueItems().length);
  readonly resueltas = computed(() => this.queueItems().filter((item) => item.stageKey === 'resueltos'));

  readonly fundadasCount = computed(() => this.resueltas().filter((item) => this.normalizeDecision(item.resultado).startsWith('FUNDADO')).length);
  readonly infundadasCount = computed(() => this.resueltas().filter((item) => this.normalizeDecision(item.resultado).startsWith('INFUNDADO')).length);
  readonly improcedentesCount = computed(() => this.resueltas().filter((item) => this.normalizeDecision(item.resultado).includes('IMPROCEDENTE')).length);

  readonly tasaFundadas = computed(() => {
    const total = this.resueltas().length;
    if (total <= 0) return 0;
    return Math.round((this.fundadasCount() / total) * 100);
  });

  readonly donutOffset = computed(() => {
    const value = Math.max(0, Math.min(100, this.tasaFundadas()));
    return this.donutCirc - (value / 100) * this.donutCirc;
  });

  readonly topEntidades = computed(() => {
    const map = new Map<string, number>();
    for (const item of this.queueItems()) {
      map.set(item.entidad, (map.get(item.entidad) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  readonly promedioDias = computed(() => {
    const pendientes = this.queueItems().filter((item) => item.stageKey !== 'resueltos');
    if (pendientes.length <= 0) return 0;

    const total = pendientes.reduce((acc, item) => acc + item.diasHabilesEnEtapa, 0);
    return Math.round((total / pendientes.length) * 10) / 10;
  });

  get searchModel(): string {
    return this.search();
  }

  set searchModel(value: string) {
    this.search.set(value);
  }

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion?.nombre) {
      this.nombreMiembro.set(sesion.nombre);
    }

    this.cargarDashboard();
    this.tourService.checkAutoStart('saip_tour_ttaip', this.tourSteps);
  }

  get isFirstVisit(): boolean {
    return this.tourService.isFirstVisit('saip_tour_ttaip');
  }

  startTour(): void {
    this.tourService.startTour('saip_tour_ttaip', this.tourSteps);
  }

  cargarDashboard(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      calificacion1: this.ttaipService.getEnAnalisis(),
      subsanacion: this.ttaipService.getSubsanacion(),
      calificacion2: this.ttaipService.getSegundaCalificacion(),
      resolucion: this.ttaipService.getEnResolucion(),
      resueltas: this.ttaipService.getResueltas()
    }).subscribe({
      next: (data) => {
        const merged = this.mergeUnique([
          data.calificacion1,
          data.subsanacion,
          data.calificacion2,
          data.resolucion,
          data.resueltas
        ]);

        this.apelaciones.set(merged);

        if (this.focusStageFromState) {
          this.stageKey.set(this.focusStageFromState);
          this.focusStageFromState = null;
        } else {
          const firstWithData = this.stages.find((stage) => this.countByStage(merged, stage.key) > 0) ?? this.stages[0];
          this.stageKey.set(firstWithData.key);
        }
        this.loading.set(false);
      },
      error: (err) => {
        const mensaje = err.error?.mensaje || err.message || 'Error al cargar datos del tribunal';
        this.error.set(mensaje);
        this.loading.set(false);
      }
    });
  }

  formatCount(value: number): string {
    return value.toString().padStart(2, '0');
  }

  getPriorityClass(priority: Priority): string {
    if (priority === 'alta') return 'pill pill-high';
    if (priority === 'media') return 'pill pill-medium';
    return 'pill pill-low';
  }

  getResultadoBadgeClass(resultado: string | null): string {
    const decision = this.normalizeDecision(resultado);
    if (decision.startsWith('FUNDADO')) return 'badge-success';
    if (decision.startsWith('INFUNDADO')) return 'badge-muted';
    if (decision.includes('IMPROCEDENTE')) return 'badge-danger';
    if (decision === 'ESTESE_A_LO_RESUELTO' || decision === 'RESUELTO_ESTESE_A_LO_RESUELTO') return 'badge-muted';
    if (decision === 'NULIDAD_DEL_ACTO' || decision === 'RESUELTO_NULIDAD_ACTO') return 'badge-danger';
    return 'badge-in-process';
  }

  getResultadoLabel(resultado: string | null): string {
    const decision = this.normalizeDecision(resultado);

    switch (decision) {
      case 'FUNDADO':
        return 'Fundado';
      case 'FUNDADO_EN_PARTE':
        return 'Fundado en parte';
      case 'INFUNDADO':
        return 'Infundado';
      case 'INFUNDADO_EN_PARTE':
        return 'Infundado en parte';
      case 'RESUELTO_IMPROCEDENTE':
      case 'IMPROCEDENTE':
        return 'Improcedente';
      case 'CONCLUSION_SUSTRACCION_MATERIA':
        return 'Sustracción';
      case 'CONCLUSION_DESISTIMIENTO':
        return 'Desistimiento';
      case 'ESTESE_A_LO_RESUELTO':
      case 'RESUELTO_ESTESE_A_LO_RESUELTO':
        return 'Estese a lo resuelto';
      case 'NULIDAD_DEL_ACTO':
      case 'RESUELTO_NULIDAD_ACTO':
        return 'Nulidad del acto';
      case 'TENER_POR_NO_PRESENTADO':
        return 'No presentado';
      default:
        return 'Resuelto';
    }
  }

  getDiasColor(item: QueueItem): string {
    const status = this.plazoStatus(item, this.stageFromKey(item.stageKey));
    return this.toneColor(status.tone);
  }

  getDiasValor(item: QueueItem): string {
    const status = this.plazoStatus(item, this.stageFromKey(item.stageKey));
    return `${status.restantes}d`;
  }

  getProgressWidth(item: QueueItem): number {
    return this.plazoStatus(item, this.stageFromKey(item.stageKey)).pct;
  }

  getActionRoute(item: QueueItem): string[] {
    const expediente = item.apelacion.expediente || '';

    switch (item.stageKey) {
      case 'calificacion1':
        return ['/ttaip/calificar', expediente];
      case 'calificacion2':
        return ['/ttaip/segunda-calificacion', expediente];
      case 'resolucion':
        return ['/ttaip/resolver', expediente];
      case 'resueltos':
        return ['/ttaip/apelacion', expediente];
      default:
        return ['/ttaip', expediente];
    }
  }

  getActionLabel(item: QueueItem): string {
    const stage = this.stageFromKey(item.stageKey);
    return stage.actionLabel || 'Ver';
  }

  getTopEntidadWidth(count: number): number {
    const top = this.topEntidades();
    const max = top.length > 0 ? top[0].count : 1;
    return (count / max) * 100;
  }

  getResolucionPct(value: number): number {
    const total = this.resueltas().length;
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  }

  private mergeUnique(groups: Apelacion[][]): Apelacion[] {
    const byKey = new Map<string, Apelacion>();

    for (const group of groups) {
      for (const apelacion of group) {
        const key = this.apelacionKey(apelacion);
        const current = byKey.get(key);

        if (!current || this.stageRank(apelacion.estado) >= this.stageRank(current.estado)) {
          byKey.set(key, apelacion);
        }
      }
    }

    return Array.from(byKey.values());
  }

  private stageRank(estado: string): number {
    const ranks: Record<StageKey, number> = {
      calificacion1: 1,
      subsanacion: 2,
      calificacion2: 3,
      resolucion: 4,
      resueltos: 5
    };

    const stage = this.mapEstadoToStage(estado);
    return stage ? ranks[stage] : 0;
  }

  private apelacionKey(apelacion: Apelacion): string {
    if (apelacion.id) return `id-${apelacion.id}`;
    return `exp-${apelacion.expediente || 'sin-expediente'}`;
  }

  private countByStage(apelaciones: Apelacion[], key: StageKey): number {
    return apelaciones.filter((apelacion) =>
      !this.esPendienteElevacion(apelacion) && this.mapEstadoToStage(apelacion.estado) === key
    ).length;
  }

  private esPendienteElevacion(apelacion: Apelacion): boolean {
    return this.normalizeDecision(apelacion.estado) === 'PENDIENTE_ELEVACION';
  }

  private toQueueItem(apelacion: Apelacion): QueueItem {
    const ciudadano = (apelacion.ciudadanoNombre || 'Ciudadano').trim();
    const entidad = (apelacion.entidadNombre || 'Entidad pública').trim();
    const descripcion = (apelacion.solicitudAsunto || apelacion.resumenSolicitudOriginal || apelacion.fundamentos || 'Recurso en trámite').trim();
    const stageKey = this.mapEstadoToStage(apelacion.estado) ?? 'calificacion1';
    const diasHabilesEnEtapa = this.estimateDiasEtapa(apelacion, stageKey);
    const prioridad = this.estimatePriority(stageKey, diasHabilesEnEtapa);

    return {
      apelacion,
      stageKey,
      ciudadano,
      iniciales: this.obtenerIniciales(ciudadano),
      entidad,
      materia: this.inferirMateria(descripcion),
      descripcion,
      diasHabilesEnEtapa,
      prioridad,
      resultado: this.extractResultado(apelacion)
    };
  }

  private mapEstadoToStage(estadoRaw: string): StageKey | null {
    const estado = this.normalizeDecision(estadoRaw);

    if (estado === 'PENDIENTE_ELEVACION') return null;
    if (estado === 'EN_CALIFICACION_1') return 'calificacion1';
    if (estado === 'EN_SUBSANACION') return 'subsanacion';
    if (estado === 'EN_CALIFICACION_2' || estado === 'NOTIFICACION_SEGUNDA_CALIFICACION') return 'calificacion2';
    if (estado === 'EN_RESOLUCION') return 'resolucion';

    return 'resueltos';
  }

  private estimateDiasEtapa(apelacion: Apelacion, stage: StageKey): number {
    if (stage === 'subsanacion' && apelacion.fechaSubsanacion) {
      return this.diasDesde(apelacion.fechaSubsanacion);
    }

    return this.diasDesde(apelacion.fechaApelacion);
  }

  private diasDesde(fechaRaw?: string): number {
    if (!fechaRaw) return 0;

    const parsed = new Date(fechaRaw);
    if (Number.isNaN(parsed.getTime())) return 0;

    const now = new Date();
    const diff = now.getTime() - parsed.getTime();
    if (diff <= 0) return 0;

    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private estimatePriority(stage: StageKey, diasHabilesEnEtapa: number): Priority {
    const stageMeta = this.stageFromKey(stage);
    if (stageMeta.isResolved) return 'baja';

    const restantes = Math.max(0, stageMeta.plazoDias - diasHabilesEnEtapa);
    if (restantes <= 1) return 'alta';
    if (restantes <= 3) return 'media';
    return 'baja';
  }

  private extractResultado(apelacion: Apelacion): string | null {
    const raw = apelacion.resolucion?.decision || apelacion.resultado;
    const normalized = this.normalizeDecision(raw);
    return normalized || null;
  }

  private inferirMateria(texto: string): string {
    const value = texto.toLowerCase();

    if (value.includes('salud') || value.includes('hospital')) return 'Salud';
    if (value.includes('educa') || value.includes('coleg')) return 'Educacion';
    if (value.includes('presupuesto') || value.includes('financ') || value.includes('econom')) return 'Economia';
    if (value.includes('transporte') || value.includes('vial') || value.includes('obra')) return 'Transportes';
    if (value.includes('trabajo') || value.includes('personal') || value.includes('rrhh')) return 'Laboral';
    if (value.includes('seguridad') || value.includes('policial') || value.includes('interior')) return 'Seguridad';

    return 'General';
  }

  private obtenerIniciales(nombre: string): string {
    const words = nombre
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (words.length === 0) return 'TT';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  private matchesQuery(item: QueueItem, query: string): boolean {
    const expediente = (item.apelacion.expediente || '').toLowerCase();
    const ciudadano = item.ciudadano.toLowerCase();
    const entidad = item.entidad.toLowerCase();
    const materia = item.materia.toLowerCase();

    return (
      expediente.includes(query)
      || ciudadano.includes(query)
      || entidad.includes(query)
      || materia.includes(query)
    );
  }

  private plazoStatus(item: QueueItem, stage: StageMeta): PlazoStatus {
    if (stage.isResolved) {
      return { restantes: 0, pct: 100, tone: 'done' };
    }

    const restantes = Math.max(0, stage.plazoDias - item.diasHabilesEnEtapa);
    const pct = Math.min(100, (item.diasHabilesEnEtapa / stage.plazoDias) * 100);

    if (restantes <= 1) {
      return { restantes, pct, tone: 'critical' };
    }

    if (restantes <= 2) {
      return { restantes, pct, tone: 'warn' };
    }

    return { restantes, pct, tone: 'ok' };
  }

  private stageFromKey(key: StageKey): StageMeta {
    return this.stages.find((stage) => stage.key === key) ?? this.stages[0];
  }

  private toneColor(tone: Tone): string {
    if (tone === 'critical') return 'var(--brand-700)';
    if (tone === 'warn') return 'var(--warning)';
    return 'var(--success)';
  }

  private normalizeDecision(value: string | null | undefined): string {
    return (value || '').trim().toUpperCase().replaceAll(' ', '_');
  }
}



