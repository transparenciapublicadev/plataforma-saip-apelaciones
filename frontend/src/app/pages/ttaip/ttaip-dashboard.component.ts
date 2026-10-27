import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { StageKey, stages, positiveId, normalize, stageOf, readAppeals, recordedDate, clockText, finalDecision, actionFor } from './ttaip-dashboard.model';
import { LucideGavel, LucideCompass, LucideLayers, LucideScale, LucideHourglass, LucideCheckCircle2,
  LucideSearch, LucideInbox, LucideArrowRight, LucideBuilding2, LucideActivity, LucideClock, LucideFileText } from '@lucide/angular';

@Component({
  selector: 'app-ttaip-dashboard',
  imports: [RouterLink, FormsModule, DatePipe, StatusBadgeComponent, PaginationComponent,
    LucideGavel, LucideCompass, LucideLayers, LucideScale, LucideHourglass, LucideCheckCircle2,
    LucideSearch, LucideInbox, LucideArrowRight, LucideBuilding2, LucideActivity, LucideClock, LucideFileText],
  templateUrl: './ttaip-dashboard.component.html', styleUrl: './ttaip-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipDashboardComponent implements OnInit, OnDestroy {
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tourService = inject(GuidedTourService);
  private query = new Subscription();
  private generation = 0;
  private destroyed = false;
  private initialized = false;
  private revision = -1;
  private loadedSession = '';
  private focusStageFromState: StageKey | null = null;
  readonly stages = stages;
  readonly apelaciones = signal<Apelacion[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly reintentable = signal(false);
  readonly stageKey = signal<StageKey>('calificacion1');
  readonly search = signal('');
  readonly salaFiltro = signal<number | string>('TODAS');
  readonly estadoFiltro = signal('');
  readonly paginaActual = signal(1);
  readonly itemsPorPagina = signal(4);
  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="t-hero"]', title: 'Panel del Tribunal', body: 'Registros autorizados para la cuenta actual, sin asignación individual implícita.' },
    { selector: '[data-tour="t-tasa"]', title: 'Resultados registrados', body: 'Solo decisiones finales identificadas. Fundado y fundado en parte se cuentan por separado.' },
    { selector: '[data-tour="t-pipeline"]', title: 'Etapas registradas', body: 'Se conserva el estado del servidor, sin adelantar actuaciones ni calcular plazos.' },
    { selector: '[data-tour="t-cola"]', title: 'Registros recuperados', body: 'Búsqueda, filtros y páginas son locales al listado recibido.', align: 'start' },
  ];
  constructor() {
    const focus = (this.router.getCurrentNavigation()?.extras.state as { focusStage?: StageKey } | undefined)?.focusStage;
    if (focus && stages.some(stage => stage.key === focus)) this.focusStageFromState = focus;
    effect(() => {
      const revision = this.authService.cambiosSesion?.() ?? 0;
      if (this.initialized && revision !== this.revision) untracked(() => this.cargarDashboard());
    });
  }
  private sessionKey(): string {
    const s = this.authService.obtenerSesion();
    return JSON.stringify([s?.token, s?.usuarioId, s?.tipoUsuario, s?.miembroId]);
  }
  contextoVigente(): boolean { return !this.destroyed && this.loadedSession === this.sessionKey(); }
  readonly queueItems = computed(() => this.apelaciones().map(apelacion => ({
    apelacion, stageKey: stageOf(apelacion.estado), ciudadano: apelacion.ciudadanoNombre || 'Administrado no informado',
    entidad: apelacion.entidadNombre || apelacion.entidadExternaNombre || 'Entidad no informada',
    descripcion: apelacion.solicitudAsunto || apelacion.resumenSolicitudOriginal || apelacion.fundamentos || 'Descripción no informada',
    iniciales: apelacion.ciudadanoNombre?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '—',
    resultado: finalDecision(apelacion),
  })));
  readonly counts = computed(() => {
    const counts: Record<StageKey, number> = { todos: this.queueItems().length, elevacion: 0, calificacion1: 0, subsanacion: 0, calificacion2: 0, resolucion: 0, resueltos: 0, otras: 0 };
    for (const item of this.queueItems()) counts[item.stageKey]++;
    return counts;
  });
  readonly activeStage = computed(() => stages.find(stage => stage.key === this.stageKey())
    ?? { ...stages[0], key: 'otras' as const, label: 'Otros estados', shortLabel: 'Otros estados' });
  readonly estados = computed(() => [...new Set(this.apelaciones().map(ap => ap.estado))].sort());
  readonly salas = computed(() => {
    const values = new Map<number, string>();
    for (const ap of this.apelaciones()) {
      const sala = ap.expedienteTtaip?.sala;
      if (positiveId(sala?.id) && typeof sala?.nombre === 'string' && sala.nombre.trim()) values.set(sala.id, sala.nombre);
    }
    return [...values].map(([id, nombre]) => ({ id, nombre }));
  });
  readonly filtered = computed(() => {
    const terms = normalize(this.search().trim()).split(/\s+/).filter(Boolean);
    return this.queueItems().filter(item => {
      const sala = item.apelacion.expedienteTtaip?.sala;
      return (this.stageKey() === 'todos' || item.stageKey === this.stageKey())
        && (!this.estadoFiltro() || item.apelacion.estado === this.estadoFiltro())
        && (this.salaFiltro() === 'TODAS' || (this.salaFiltro() === 'SIN_SALA' ? !positiveId(sala?.id) : sala?.id === this.salaFiltro()))
        && terms.every(term => normalize([item.apelacion.expediente, item.apelacion.solicitudExpediente, item.ciudadano, item.entidad,
          item.descripcion, item.apelacion.estado, item.resultado].filter(Boolean).join(' ')).includes(term));
    });
  });
  readonly totalRegistros = computed(() => this.filtered().length);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalRegistros() / this.itemsPorPagina())));
  readonly paginaSegura = computed(() => Math.min(this.paginaActual(), this.totalPaginas()));
  readonly inicioRegistro = computed(() => this.totalRegistros() ? (this.paginaSegura() - 1) * this.itemsPorPagina() + 1 : 0);
  readonly finRegistro = computed(() => Math.min(this.paginaSegura() * this.itemsPorPagina(), this.totalRegistros()));
  readonly filteredVisibles = computed(() => this.filtered().slice((this.paginaSegura() - 1) * this.itemsPorPagina(), this.paginaSegura() * this.itemsPorPagina()));
  readonly totalExpedientes = computed(() => this.queueItems().length);
  readonly resueltas = computed(() => this.queueItems().filter(item => item.stageKey === 'resueltos'));
  readonly finales = computed(() => this.resueltas().filter(item => item.resultado !== null));
  readonly fundadasCount = computed(() => this.finales().filter(item => item.resultado === 'FUNDADO').length);
  readonly resultados = computed(() => {
    const groups = new Map<string, number>();
    for (const item of this.finales()) groups.set(item.resultado!, (groups.get(item.resultado!) ?? 0) + 1);
    return [...groups].map(([decision, count]) => ({ decision, count, percentage: count / this.finales().length * 100 }));
  });
  readonly tasaFundadas = computed(() => this.finales().length ? Math.round(this.fundadasCount() / this.finales().length * 100) : null);
  readonly topEntidades = computed(() => {
    const groups = new Map<number, { id: number; nombre: string; count: number }>();
    for (const item of this.queueItems()) if (positiveId(item.apelacion.entidadId)) {
      const group = groups.get(item.apelacion.entidadId) ?? { id: item.apelacion.entidadId, nombre: item.entidad, count: 0 };
      group.count++; groups.set(group.id, group);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  });
  readonly informacionIncompleta = computed(() => this.queueItems().some(item => item.stageKey === 'otras'
    || !recordedDate(item.apelacion.fechaApelacion) || !item.apelacion.ciudadanoNombre
    || (item.stageKey === 'subsanacion' && /incompleto|no informado/.test(clockText(item.apelacion)))));
  get searchModel(): string { return this.search(); }
  set searchModel(value: string) { this.search.set(value); this.paginaActual.set(1); }
  selectStage(stage: StageKey): void { this.stageKey.set(stage); this.paginaActual.set(1); }
  cambiarSala(value: number | string): void { this.salaFiltro.set(value); this.paginaActual.set(1); }
  cambiarEstado(value: string): void { this.estadoFiltro.set(value); this.paginaActual.set(1); }
  cambiarPagina(page: number): void { if (Number.isSafeInteger(page) && page >= 1 && page <= this.totalPaginas()) this.paginaActual.set(page); }
  cambiarItemsPorPagina(size: number): void { if ([4, 8, 12].includes(size)) { this.itemsPorPagina.set(size); this.paginaActual.set(1); } }
  limpiarFiltros(): void { this.search.set(''); this.salaFiltro.set('TODAS'); this.estadoFiltro.set(''); this.selectStage('todos'); }
  ngOnInit(): void { this.initialized = true; this.cargarDashboard(); }
  ngOnDestroy(): void { this.destroyed = true; this.generation++; this.query.unsubscribe(); }
  cargarDashboard(): void {
    if (this.destroyed) return;
    const revision = this.authService.cambiosSesion?.() ?? 0;
    if (this.loading() && this.generation > 0 && revision === this.revision) return;
    const changed = revision !== this.revision;
    this.revision = revision; this.query.unsubscribe(); this.query = new Subscription();
    const generation = ++this.generation, session = this.sessionKey();
    this.loadedSession = ''; this.apelaciones.set([]); this.error.set(''); this.reintentable.set(false); this.loading.set(true);
    if (changed) this.limpiarFiltros();
    const account = this.authService.obtenerSesion();
    if (!account?.token || !positiveId(account.usuarioId) || !['TTAIP', 'ADMINISTRADOR'].includes(account.tipoUsuario || '')) {
      this.error.set('La sesión no permite consultar el panel del Tribunal. Utilice el acceso interno.'); this.loading.set(false); return;
    }
    const current = () => !this.destroyed && generation === this.generation && session === this.sessionKey() && revision === (this.authService.cambiosSesion?.() ?? 0);
    this.query.add(this.apelacionService.findAll().subscribe({
      next: value => {
        if (!current()) return;
        const verified = readAppeals(value);
        if (!verified) { this.error.set('La lista está incompleta o contiene identificadores incompatibles. No se muestran cifras ni expedientes sustitutos.'); this.loading.set(false); this.reintentable.set(true); return; }
        this.loadedSession = session;
        // Ordering recorded dates is presentation, not calculation of a legal period.
        this.apelaciones.set([...verified].sort((a, b) => (recordedDate(b.fechaApelacion) ? Date.parse(b.fechaApelacion) : -Infinity) - (recordedDate(a.fechaApelacion) ? Date.parse(a.fechaApelacion) : -Infinity)));
        this.loading.set(false);
        if (this.focusStageFromState) { this.selectStage(this.focusStageFromState); this.focusStageFromState = null; }
        else if (changed) this.selectStage(stages.find(stage => stage.key !== 'todos' && this.counts()[stage.key] > 0)?.key ?? 'todos');
        this.tourService.checkAutoStart('saip_tour_ttaip', this.tourSteps);
      },
      error: err => {
        if (!current()) return;
        const messages: Record<number, string> = { 400: 'La consulta no es válida.', 401: 'La sesión no es válida. Inicie sesión de nuevo.', 403: 'No tiene autorización para el panel del Tribunal.', 404: 'No se encontró el recurso de consulta.', 422: 'Revise los datos de la consulta.' };
        this.error.set(messages[err.status] ?? (err.status === 0 ? 'No hay conexión con el servidor. Puede reintentar.' : 'No se pudo consultar el Tribunal. Puede reintentar.'));
        this.loading.set(false); this.reintentable.set(err.status === 0 || err.status >= 500);
      }
    }));
  }
  getDiasValor(item: { apelacion: Apelacion }): string { return clockText(item.apelacion); }
  getActionRoute(item: { apelacion: Apelacion }): string[] { return actionFor(item.apelacion).route; }
  getActionLabel(item: { apelacion: Apelacion }): string { return actionFor(item.apelacion).label; }
  getActionReason(item: { apelacion: Apelacion }): string { return actionFor(item.apelacion).reason; }
  getResultadoLabel(value: string | null): string { return value?.replaceAll('_', ' ') || 'Decisión final no informada'; }
  getResultadoColor(value: string): string { return value === 'FUNDADO' ? 'var(--success)' : value === 'IMPROCEDENTE' ? 'var(--gold-dark)' : 'var(--brand-700)'; }
  getTopEntidadWidth(count: number): number { return this.topEntidades().length ? count / this.topEntidades()[0].count * 100 : 0; }
  fechaVisible(value: unknown): string | null { return recordedDate(value); }
  nombreSala(apelacion: Apelacion): string { return apelacion.expedienteTtaip?.sala?.nombre || 'No informada'; }
  get isFirstVisit(): boolean { return this.tourService.isFirstVisit('saip_tour_ttaip'); }
  startTour(): void { this.tourService.startTour('saip_tour_ttaip', this.tourSteps); }
}
