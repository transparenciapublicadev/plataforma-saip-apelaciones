import { LucideEye } from '@lucide/angular';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { PanelQueryService } from '../../services/panel-query.service';
import { PanelApelacion as Apelacion, PanelPage, PanelSummary, validPanelPage } from '../../models/panel-query.model';
import { AuthService } from '../../services/auth.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { PaginationComponent } from '../../shared/pagination.component';
import {
  StageKey, StageMeta, stages, positiveId, stageOf, readAppeals, recordedDate,
  computePlazoStatus, PlazoStatusResult, actionFor, finalDecision, clockText,
  decisionLista, decisionLabels, plazoPendiente, stagesConPlazos,
  habilesEntreFechas, finalStates
} from './ttaip-dashboard.model';
import { CalendarioConfig, hoyLima, normalizarCalendario } from '../../models/calendario.model';
import { environment } from '../../../environments/environment';
import {
  LucideGavel, LucideCompass, LucideLayers, LucideScale, LucideHourglass, LucideCheckCircle2,
  LucideSearch, LucideInbox, LucideArrowRight, LucideBuilding2, LucideActivity, LucideClock,
  LucideFileText, LucidePauseCircle, LucideShieldAlert, LucideAlertTriangle, LucideTrendingUp,
  LucideChevronRight
} from '@lucide/angular';

@Component({
  selector: 'app-ttaip-dashboard',
  imports: [LucideEye,
    RouterLink, FormsModule, DatePipe, DecimalPipe, StatusBadgeComponent, PaginationComponent,
    LucideGavel, LucideCompass, LucideLayers, LucideScale, LucideHourglass, LucideCheckCircle2,
    LucideSearch, LucideInbox, LucideArrowRight, LucideBuilding2, LucideActivity, LucideClock,
    LucideFileText, LucidePauseCircle, LucideShieldAlert, LucideAlertTriangle, LucideTrendingUp,
    LucideChevronRight
  ],
  templateUrl: './ttaip-dashboard.component.html',
  styleUrl: './ttaip-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipDashboardComponent implements OnInit, OnDestroy {
  private readonly panelService = inject(PanelQueryService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tourService = inject(GuidedTourService);

  private query = new Subscription();
  private calendarQuery = new Subscription();
  private generation = 0;
  private calendarGeneration = 0;
  private destroyed = false;
  private initialized = false;
  private revision = -1;
  private loadedSession = '';
  private focusStageFromState: StageKey | null = null;

  readonly stageCatalog = signal<StageMeta[]>(stagesConPlazos(null));
  readonly filtrosEtapa = computed(() => this.stageCatalog().filter(stage => stage.key !== 'elevacion' && stage.key !== 'notificaciones'));
  private readonly calendario = signal<CalendarioConfig | null>(null);
  readonly apelaciones = signal<Apelacion[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly reintentable = signal(false);
  readonly stageKey = signal<StageKey>('todos');
  readonly descargosPresentados = signal(false);
  readonly pagina = signal<PanelPage<Apelacion> | null>(null);
  readonly resumen = signal<PanelSummary | null>(null);
  readonly queryLoading = signal(false);

  private searchTimer?: ReturnType<typeof setTimeout>;
  readonly search = signal('');
  private readonly pageSize = 4;
  readonly paginaActual = signal(1);

  alternarFiltroDescargos(): void {
    this.descargosPresentados.update(valor => !valor);
    this.paginaActual.set(1);
    this.cargarDashboard();
  }

  readonly hoyISO = signal(hoyLima());
  readonly fechaHoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="t-hero"]', title: 'Mesa del Secretario Técnico', body: 'Fecha, total de expedientes en el pipeline y expedientes con riesgo crítico conforme al Reglamento.' },
    { selector: '[data-tour="t-tasa"]', title: 'Tasa de fundadas', body: 'Proporción de resoluciones emitidas que dieron la razón al ciudadano.' },
    { selector: '[data-tour="t-pipeline"]', title: 'Etapas del proceso', body: 'El flujo completo de una apelación, etapa por etapa. Seleccione una etapa para filtrar su cola.' },
    { selector: '[data-tour="t-cola"]', title: 'Cola de expedientes', body: 'Expedientes de la etapa seleccionada con contador de días hábiles, días suspendidos y accesos directos de calificación y resolución.', align: 'start' },
    { selector: '[data-tour="t-estadistica"]', title: 'Estadística institucional', body: 'Distribución de los fallos emitidos: fundados, infundados e improcedentes.' },
    { selector: '[data-tour="t-concentracion"]', title: 'Entidades más apeladas', body: 'Concentración de apelaciones para identificar patrones de denegación.' },
  ];

  constructor() {
    const focus = (this.router.getCurrentNavigation()?.extras.state as { focusStage?: StageKey } | undefined)?.focusStage;
    if (focus && this.filtrosEtapa().some(stage => stage.key === focus)) this.focusStageFromState = focus;
    effect(() => {
      const rev = this.authService.cambiosSesion?.() ?? 0;
      if (this.initialized && rev !== this.revision) untracked(() => this.cargarDashboard());
    });
  }

  private sessionKey(): string {
    const s = this.authService.obtenerSesion();
    return JSON.stringify([s?.token, s?.usuarioId, s?.tipoUsuario, s?.miembroId]);
  }

  contextoVigente(): boolean { return !this.destroyed && this.loadedSession === this.sessionKey(); }

  readonly queueItems = computed(() => this.apelaciones().map(apelacion => {
    const catalog = this.stageCatalog();
    const stageKey = apelacion.etapa === 'notificaciones' || apelacion.etapa === 'resolucion' ? apelacion.etapa : stageOf(apelacion.estado);
    const stage = catalog.find(s => s.key === stageKey) ?? catalog[0];
    const status = computePlazoStatus(apelacion, stage, this.hoyISO(), this.calendario());
    return {
      apelacion,
      stageKey,
      stage,
      status,
      ciudadano: apelacion.ciudadanoNombre || 'Administrado no informado',
      entidad: apelacion.entidadNombre || apelacion.entidadExternaNombre || 'Entidad no informada',
      descripcion: apelacion.solicitudAsunto || apelacion.resumenSolicitudOriginal || apelacion.fundamentos || 'Sin descripción informada',
      iniciales: apelacion.ciudadanoNombre?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '—',
      resultado: finalDecision(apelacion),
      decision: decisionLista(apelacion),
      action: actionFor(apelacion)
    };
  }));

  readonly counts = computed<Record<StageKey, number>>(() => ({
    todos: this.resumen()?.total ?? 0,
    elevacion: this.resumen()?.porEtapa['elevacion'] ?? 0,
    calificacion1: this.resumen()?.porEtapa['calificacion1'] ?? 0,
    subsanacion: this.resumen()?.porEtapa['subsanacion'] ?? 0,
    calificacion2: this.resumen()?.porEtapa['calificacion2'] ?? 0,
    resolucion: this.resumen()?.porEtapa['resolucion'] ?? 0,
    notificaciones: this.resumen()?.porEtapa['notificaciones'] ?? 0,
    cumplimiento: this.resumen()?.porEtapa['cumplimiento'] ?? 0,
    resueltos: this.resumen()?.porEtapa['resueltos'] ?? 0,
    otras: this.resumen()?.porEtapa['otras'] ?? 0
  }));

  readonly activeStage = computed<StageMeta>(() => this.stageCatalog().find(s => s.key === this.stageKey())
    ?? { ...stages[0], key: 'otras' as const, label: 'Otros estados', shortLabel: 'Otros' });
  readonly filtered = computed(() => this.queueItems());
  readonly filteredVisibles = computed(() => this.filtered());
  readonly totalRegistros = computed(() => this.pagina()?.totalElementos ?? 0);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalRegistros() / this.pageSize)));
  readonly paginaSegura = computed(() => Math.min(this.paginaActual(), this.totalPaginas()));
  readonly inicioRegistro = computed(() => this.totalRegistros() ? (this.paginaSegura() - 1) * this.pageSize + 1 : 0);
  readonly finRegistro = computed(() => Math.min(this.paginaSegura() * this.pageSize, this.totalRegistros()));
  readonly totalExpedientes = computed(() => this.resumen()?.total ?? 0);
  readonly totalResueltas = computed(() => this.counts().resueltos);
  readonly totalFinales = computed(() => Object.values(this.resumen()?.porResultado ?? {}).reduce((sum, n) => sum + n, 0));

  readonly resoluciones = computed(() => this.apelaciones().filter(a =>
    !a.actosNotificacionPendientes && (a.resuelta === true || stageOf(a.estado) === 'resueltos' || finalStates.has(a.estado))
  ));

  readonly tiempoPromedio = computed(() => {
    const tiempos = this.resoluciones().flatMap(r => {
      const ini = recordedDate(r.fechaApelacion ?? (r as any).fechaIngreso)?.slice(0, 10);
      const fin = recordedDate(r.resolucion?.fechaResolucion ?? (r as any).fechaResolucion ?? (r.expedienteTtaip as any)?.fechaResolucionFinal)?.slice(0, 10);
      return ini && fin && fin >= ini ? [habilesEntreFechas(ini, fin)] : [];
    });
    if (!tiempos.length) return '—';
    const promedio = tiempos.reduce((sum, n) => sum + n, 0) / tiempos.length;
    return `${promedio.toFixed(1)}d`;
  });

  readonly resolucionesMes = computed(() => {
    const mesActual = this.hoyISO().slice(0, 7);
    return this.resoluciones().filter(r => {
      const fin = recordedDate(r.resolucion?.fechaResolucion ?? (r as any).fechaResolucion ?? (r.expedienteTtaip as any)?.fechaResolucionFinal)?.slice(0, 10);
      return fin != null && fin.startsWith(mesActual);
    }).length;
  });
  readonly fundadasCount = computed(() => this.resumen()?.porResultado?.['FUNDADO'] ?? 0);

  readonly tasaFundadas = computed(() => this.totalFinales() ? Math.round(this.fundadasCount() / this.totalFinales() * 100) : null);

  readonly riesgo = computed(() => this.queueItems().filter(item => {
    if (item.stage.isResolved || item.stage.esperaExterna) return false;
    return item.status.informado && item.status.restantes <= 1;
  }));

  readonly resultados = computed(() => Object.entries(this.resumen()?.porResultado ?? {})
    .map(([decision, count]) => ({
      decision,
      count,
      percentage: this.totalFinales() ? (count / this.totalFinales()) * 100 : 0
    })));

  readonly topEntidades = computed(() => Object.entries(this.resumen()?.porEntidad ?? {}).map(([key, count]) => ({
    id: Number(key), count, nombre: this.pagina()?.entidades.find(e => e.id === Number(key))?.nombre || 'Entidad registrada'
  })).sort((a, b) => b.count - a.count).slice(0, 5));

  readonly informacionIncompleta = computed(() => this.queueItems().some(item => item.stageKey === 'otras'
    || !recordedDate(item.apelacion.fechaApelacion) || !item.apelacion.ciudadanoNombre
    || (item.stageKey === 'subsanacion' && /incompleto|no informado/.test(clockText(item.apelacion)))));

  get searchModel(): string { return this.search(); }
  set searchModel(value: string) {
    this.search.set(value.slice(0, 120));
    this.paginaActual.set(1);
    clearTimeout(this.searchTimer);
    this.query.unsubscribe();
    this.generation++;
    this.apelaciones.set([]);
    this.queryLoading.set(true);
    this.searchTimer = setTimeout(() => this.cargarDashboard(), 250);
  }

  selectStage(stage: StageKey): void {
    if ((this.counts()[stage] ?? 0) === 0 || this.stageKey() === stage) return;
    this.stageKey.set(stage);
    this.paginaActual.set(1);
    this.cargarDashboard();
  }

  cambiarPagina(page: number): void {
    if (Number.isSafeInteger(page) && page >= 1 && page <= this.totalPaginas() && page !== this.paginaActual()) {
      this.paginaActual.set(page);
      this.cargarDashboard();
    }
  }

  ngOnInit(): void { this.initialized = true; this.cargarDashboard(); }

  ngOnDestroy(): void {
    this.tourService.endTourFor('saip_tour_ttaip');
    this.destroyed = true;
    this.generation++;
    this.calendarGeneration++;
    this.query.unsubscribe();
    this.calendarQuery.unsubscribe();
    clearTimeout(this.searchTimer);
  }

  private cargarPlazos(): void {
    this.calendarQuery.unsubscribe();
    this.calendario.set(null);
    this.stageCatalog.set(stagesConPlazos(null));
    const gen = ++this.calendarGeneration;
    this.calendarQuery = this.http.get<unknown>(`${environment.apiUrl}/calendario`).subscribe({
      next: body => {
        if (this.destroyed || gen !== this.calendarGeneration) return;
        const cfg = body && typeof body === 'object' ? normalizarCalendario(body as Partial<CalendarioConfig>) : null;
        this.calendario.set(cfg);
        this.stageCatalog.set(stagesConPlazos(cfg ? cfg.plazos as Record<string, unknown> : null));
      },
      error: () => {
        if (!this.destroyed && gen === this.calendarGeneration) {
          this.calendario.set(null);
          this.stageCatalog.set(stagesConPlazos(null));
        }
      }
    });
  }

  cargarDashboard(): void {
    clearTimeout(this.searchTimer);
    this.tourService.endTourFor('saip_tour_ttaip');
    if (this.destroyed) return;
    const revision = this.authService.cambiosSesion?.() ?? 0;
    const changed = revision !== this.revision;
    this.revision = revision;
    this.query.unsubscribe();
    this.query = new Subscription();
    const gen = ++this.generation, session = this.sessionKey();
    this.apelaciones.set([]);
    this.error.set('');
    this.reintentable.set(false);
    this.loading.set(changed || !this.resumen());
    this.queryLoading.set(true);

    if (changed) {
      this.loadedSession = '';
      this.pagina.set(null);
      this.resumen.set(null);
      this.search.set('');
      this.stageKey.set(this.focusStageFromState ?? 'todos');
      this.descargosPresentados.set(false);
      this.focusStageFromState = null;
      this.paginaActual.set(1);
    }

    const account = this.authService.obtenerSesion();
    if (!account?.token || !positiveId(account.usuarioId) || !['TTAIP', 'ADMINISTRADOR'].includes(account.tipoUsuario || '')) {
      this.error.set('La sesión no permite consultar el panel del Tribunal. Utilice el acceso interno.');
      this.loading.set(false);
      this.queryLoading.set(false);
      return;
    }
    if (changed) this.cargarPlazos();

    const current = () => !this.destroyed && gen === this.generation && session === this.sessionKey() && revision === (this.authService.cambiosSesion?.() ?? 0);
    const page = this.paginaActual() - 1, size = this.pageSize;

    this.query.add(this.panelService.apelaciones({
      pagina: page,
      tamano: size,
      busqueda: this.search().trim(),
      etapa: this.stageKey(),
      ...(this.descargosPresentados() ? { descargosPresentados: true } : {})
    }).subscribe({
      next: value => {
        if (!current()) return;
        const verified = validPanelPage<Apelacion>(value, page, size) ? readAppeals(value.contenido) : null;
        if (!verified) {
          this.error.set('La lista está incompleta o contiene identificadores incompatibles. No se muestran cifras ni expedientes sustitutos.');
          this.loading.set(false);
          this.queryLoading.set(false);
          this.resumen.set(null);
          this.pagina.set(null);
          this.reintentable.set(true);
          return;
        }
        this.loadedSession = session;
        this.apelaciones.set(verified);
        this.pagina.set(value);
        this.resumen.set(value.resumen);
        this.loading.set(false);
        this.queryLoading.set(false);
      },
      error: err => {
        if (!current()) return;
        const messages: Record<number, string> = {
          400: 'La consulta no es válida.',
          401: 'La sesión no es válida. Inicie sesión de nuevo.',
          403: 'No tiene autorización para el panel del Tribunal.',
          404: 'No se encontró el recurso de consulta.',
          422: 'Revise los datos de la consulta.'
        };
        this.error.set(messages[err.status] ?? (err.status === 0 ? 'No hay conexión con el servidor. Puede reintentar.' : 'No se pudo consultar el Tribunal. Puede reintentar.'));
        this.loading.set(false);
        this.queryLoading.set(false);
        this.resumen.set(null);
        this.pagina.set(null);
        this.reintentable.set(err.status === 0 || err.status >= 500);
      }
    }));
  }

  toneColor(tone: 'critical' | 'warn' | 'ok' | 'done'): string {
    const map = { critical: 'var(--brand-700)', warn: 'var(--warning)', ok: 'var(--success)', done: 'var(--success)' };
    return map[tone] || 'var(--foreground)';
  }

  getDiasValor(item: { apelacion: Apelacion }): string { return clockText(item.apelacion); }
  plazoLista(item: { status: PlazoStatusResult; apelacion: Apelacion; stage: StageMeta }): string {
    if (!item.status.informado) {
      const { dias } = plazoPendiente(item.apelacion, item.stage);
      return dias ? `${dias} días háb.` : 'Pendiente';
    }
    if (item.status.vencido) return 'Vencido';
    return item.status.restantes === 0 ? 'Hoy' : `${item.status.restantes}d`;
  }
  plazoListaCaption(item: { status: PlazoStatusResult; apelacion: Apelacion; stage: StageMeta }): string {
    if (!item.status.informado) return plazoPendiente(item.apelacion, item.stage).motivo;
    if (item.status.vencido) return 'plazo vencido';
    if (item.status.restantes === 0) return 'vence hoy';
    return item.status.suspendido > 0 ? 'efectivos' : 'restantes';
  }
  fechaLimiteVisible(item: { status: PlazoStatusResult; apelacion: Apelacion }): string | null {
    return item.status.limite ? this.formatearFecha(item.status.limite) : null;
  }
  private formatearFecha(value: string): string {
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  getActionRoute(item: { apelacion: Apelacion }): string[] { return actionFor(item.apelacion).route; }
  getActionLabel(item: { apelacion: Apelacion }): string { return actionFor(item.apelacion).label; }
  getActionReason(item: { apelacion: Apelacion }): string { return actionFor(item.apelacion).reason; }
  getResultadoLabel(value: string | null): string { return value ? (decisionLabels[value] ?? 'Decisión no informada') : 'Decisión no informada'; }
  getResultadoColor(value: string): string { return value === 'FUNDADO' ? 'var(--success)' : value === 'IMPROCEDENTE' ? 'var(--gold-dark)' : 'var(--brand-700)'; }
  getTopEntidadWidth(count: number): number { return this.topEntidades().length ? (count / this.topEntidades()[0].count) * 100 : 0; }
  fechaVisible(value: unknown): string | null { return recordedDate(value); }
  nombreSala(apelacion: Apelacion): string { return apelacion.expedienteTtaip?.sala?.nombre || 'No informada'; }
  get isFirstVisit(): boolean { return this.tourService.isFirstVisit('saip_tour_ttaip'); }
  startTour(): void { this.tourService.startTour('saip_tour_ttaip', this.tourSteps); }
}
