import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject, computed, effect, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { FuncionarioService } from '../../services/funcionario.service';
import { Subscription } from 'rxjs';
import { BucketKey, QueueItem, positiveId, normalizeSearch, queueItem, readInstitutionList, canNavigateToResponse } from './funcionario-dashboard.model';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';

import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { PaginationComponent } from '../../shared/pagination.component';

interface BucketMeta {
  key: BucketKey;
  label: string;
  eyebrow: string;
  icon: 'alert' | 'flame' | 'calendar' | 'check' | 'inbox';
  color: string;
  bg: string;
}

import {
  LucideBuilding2, LucideCompass, LucideShieldAlert,
  LucideArrowRight, LucideAlertTriangle, LucideFlame, LucideCalendar,
  LucideCheckCircle2, LucideInbox, LucideSearch, LucideUser,
  LucideSend, LucideChevronRight, LucideLayers, LucideTarget
} from '@lucide/angular';

@Component({
  selector: 'app-funcionario-dashboard',
  imports: [
    RouterLink, FormsModule, DatePipe,
    StatusBadgeComponent, PaginationComponent,
    LucideBuilding2, LucideCompass, LucideShieldAlert,
    LucideArrowRight, LucideAlertTriangle, LucideFlame, LucideCalendar,
    LucideCheckCircle2, LucideInbox, LucideSearch, LucideUser,
    LucideSend, LucideChevronRight, LucideLayers, LucideTarget
  ],
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioDashboardComponent implements OnInit, OnDestroy {
  private readonly solicitudService = inject(SolicitudService);
  private readonly funcionarioService = inject(FuncionarioService);
  private readonly authService = inject(AuthService);
  private readonly tourService = inject(GuidedTourService);
  private read = new Subscription();
  private generation = 0;
  private initialized = false;
  private destroyed = false;
  private revision = -1;
  readonly revisionConsulta = signal(-1);
  readonly contextoVigente = computed(() => this.revisionConsulta() === this.authService.cambiosSesion());
  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="e-hero"]', title: 'Panel institucional', body: 'Los registros corresponden a la entidad consultada, no a la actividad individual del funcionario.' },
    { selector: '[data-tour="e-cumplimiento"]', title: 'Información no disponible', body: 'Esta consulta no aporta un indicador de atención dentro del plazo ni una comparación mensual.' },
    { selector: '[data-tour="e-buckets"]', title: 'Agrupación de registros', body: 'Use estados y saldos informados por el servidor; el panel no calcula vencimientos.' },
    { selector: '[data-tour="e-cola"]', title: 'Solicitudes recuperadas', body: 'Búsqueda y paginación se aplican localmente al listado autorizado recibido.', align: 'start' },
    { selector: '[data-tour="e-carga"]', title: 'Saldos informados', body: 'La distribución refleja los valores recibidos, no un avance porcentual del trámite.' },
    { selector: '[data-tour="e-norma"]', title: 'Actuaciones y límites', body: 'Cada expediente conserva sus comandos y comprobaciones. Registrar una respuesta no acredita entrega ni notificación eficaz.' },
  ];
  readonly buckets: BucketMeta[] = [
    { key: 'todas', label: 'Todas', eyebrow: 'Registros recibidos', icon: 'inbox', color: 'var(--brand-700)', bg: 'var(--brand-subtle)' },
    { key: 'san', label: 'Vencidas', eyebrow: 'Estado VENCIDA', icon: 'alert', color: 'var(--brand-700)', bg: 'var(--brand-subtle)' },
    { key: 'hoy', label: 'Saldo 0–1', eyebrow: 'Días informados', icon: 'flame', color: 'var(--brand-600)', bg: 'var(--brand-subtle)' },
    { key: 'semana', label: 'Saldo 2–5', eyebrow: 'Días informados', icon: 'calendar', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 10%, transparent)' },
    { key: 'plazo', label: 'Saldo >5', eyebrow: 'Días informados', icon: 'check', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 10%, transparent)' },
    { key: 'respondidas', label: 'Respuesta / denegación', eyebrow: 'Según estado registrado', icon: 'inbox', color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 8%, transparent)' },
  ];
  solicitudes = signal<Solicitud[]>([]);
  loading = signal(true);
  error = signal('');
  errorTipo = signal<'sesion' | 'validacion' | 'autenticacion' | 'autorizacion' | 'no-encontrado' | 'red' | 'servidor' | 'incompleta' | null>(null);
  informacionIncompleta = signal(false);
  selectedBucket = signal<BucketKey>('todas');
  filtroEstado = signal('');
  busqueda = signal('');
  nombreEntidad = signal('');
  nombreFuncionario = signal('');
  entidadId = signal(0);
  readonly estados = ['RECEPCIONADA', 'EN_REVISION', 'PENDIENTE_INFORMACION', 'RESPONDIDA', 'DENEGADA', 'CONCLUIDA', 'VENCIDA'];
  readonly queueItems = computed(() => this.solicitudes().map(queueItem));
  readonly counts = computed(() => {
    const counts: Record<BucketKey, number> = { todas: this.queueItems().length, san: 0, hoy: 0, semana: 0, plazo: 0, respondidas: 0, otras: 0 };
    for (const item of this.queueItems()) counts[item.bucket]++;
    return counts;
  });
  readonly bucketActivoMeta = computed(() => this.buckets.find(bucket => bucket.key === this.selectedBucket())
    ?? { key: 'otras' as const, label: 'Otros estados o sin saldo', eyebrow: 'Sin grupo temporal', icon: 'inbox', color: 'var(--muted-foreground)', bg: 'var(--card)' });
  readonly filtradas = computed(() => {
    const terms = normalizeSearch(this.busqueda().trim()).split(/\s+/).filter(Boolean);
    return this.queueItems().filter(item => (this.selectedBucket() === 'todas' || item.bucket === this.selectedBucket())
      && (!this.filtroEstado() || item.solicitud.estado === this.filtroEstado())
      && terms.every(term => normalizeSearch([item.solicitud.expediente, item.solicitud.ciudadanoNombre, item.solicitud.ciudadanoDni, item.solicitud.asunto,
        item.tema, item.solicitud.estado].filter(value => typeof value === 'string').join(' ')).includes(term)));
    // Preserve the backend's fechaPresentacion DESC order; do not reconstruct dates or urgency.
  });
  readonly distribucionDias = computed(() => {
    const groups = new Map<number, number>();
    for (const item of this.queueItems()) {
      if (['hoy', 'semana', 'plazo'].includes(item.bucket) && item.diasRestantes !== null) groups.set(item.diasRestantes, (groups.get(item.diasRestantes) ?? 0) + 1);
    }
    const max = Math.max(1, ...groups.values());
    return [...groups.entries()].sort(([a], [b]) => a - b).map(([dia, count]) => ({ dia, count, width: count / max * 100,
      color: dia <= 1 ? 'var(--brand-700)' : dia <= 5 ? 'var(--warning)' : 'var(--success)' }));
  });
  readonly topTemas = computed(() => {
    const groups = new Map<string, number>();
    for (const item of this.queueItems()) if (item.tema) groups.set(item.tema, (groups.get(item.tema) ?? 0) + 1);
    return [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  });
  readonly paginaActual = signal(1);
  readonly itemsPorPagina = signal(4);
  readonly totalRegistros = computed(() => this.filtradas().length);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalRegistros() / this.itemsPorPagina())));
  readonly paginaSegura = computed(() => Math.min(this.paginaActual(), this.totalPaginas()));
  readonly inicioRegistro = computed(() => this.totalRegistros() ? (this.paginaSegura() - 1) * this.itemsPorPagina() + 1 : 0);
  readonly finRegistro = computed(() => Math.min(this.paginaSegura() * this.itemsPorPagina(), this.totalRegistros()));
  readonly filtradasVisibles = computed(() => this.filtradas().slice((this.paginaSegura() - 1) * this.itemsPorPagina(), this.paginaSegura() * this.itemsPorPagina()));
  get busquedaModel(): string { return this.busqueda(); }
  set busquedaModel(value: string) { this.busqueda.set(value); this.paginaActual.set(1); }
  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (this.initialized && revision !== this.revision) untracked(() => this.cargarSolicitudes());
    });
  }
  ngOnInit(): void { this.initialized = true; this.cargarSolicitudes(); }
  ngOnDestroy(): void { this.destroyed = true; this.generation++; this.read.unsubscribe(); }
  selectBucket(bucket: BucketKey): void { this.selectedBucket.set(bucket); this.paginaActual.set(1); }
  cambiarEstado(value: string): void { this.filtroEstado.set(value); this.paginaActual.set(1); }
  limpiarFiltros(): void { this.busqueda.set(''); this.filtroEstado.set(''); this.selectBucket('todas'); }
  cambiarPagina(page: number): void { if (Number.isSafeInteger(page) && page >= 1 && page <= this.totalPaginas()) this.paginaActual.set(page); }
  cambiarItemsPorPagina(size: number): void { if ([4, 8, 12].includes(size)) { this.itemsPorPagina.set(size); this.paginaActual.set(1); } }
  get isFirstVisit(): boolean { return this.tourService.isFirstVisit('saip_tour_funcionario'); }
  startTour(): void { this.tourService.startTour('saip_tour_funcionario', this.tourSteps); }

  cargarSolicitudes(): void {
    const revision = this.authService.cambiosSesion();
    if (this.loading() && this.generation > 0 && revision === this.revision) return;
    const changed = revision !== this.revision;
    this.read.unsubscribe(); this.read = new Subscription();
    const generation = ++this.generation;
    this.revision = revision; this.revisionConsulta.set(revision);
    this.solicitudes.set([]); this.error.set(''); this.errorTipo.set(null); this.loading.set(true); this.informacionIncompleta.set(false);
    this.nombreEntidad.set(''); this.nombreFuncionario.set(''); this.entidadId.set(0);
    if (changed) this.limpiarFiltros();
    let session: ReturnType<AuthService['obtenerSesion']> = null;
    try { session = this.authService.obtenerSesion(); } catch { /* No query for malformed local session. */ }
    if (!session?.token || session.tipoUsuario !== 'FUNCIONARIO' || !positiveId(session.funcionarioId)
      || !positiveId(session.usuarioId) || session.usuarioId !== session.funcionarioId) {
      this.error.set('Su sesión de funcionario está incompleta. Inicie sesión mediante el acceso interno.');
      this.errorTipo.set('sesion');
      this.loading.set(false); return;
    }
    const actor = session.funcionarioId, token = session.token;
    const current = () => {
      try {
        const actual = this.authService.obtenerSesion();
        return !this.destroyed && generation === this.generation && revision === this.authService.cambiosSesion()
          && actual?.token === token && actual?.usuarioId === actor && actual?.funcionarioId === actor;
      } catch { return false; }
    };
    const failure = (err: { status?: number }) => {
      if (!current()) return;
      const messages: Record<number, string> = {
        400: 'La consulta institucional no es válida.', 422: 'Revise los datos de la consulta institucional.',
        401: 'La sesión no permite consultar. Inicie sesión nuevamente con el acceso interno.',
        403: 'No tiene autorización para consultar esta entidad o funcionario.',
        404: 'No se encontró el funcionario o recurso institucional solicitado.',
      };
      this.error.set(messages[err.status ?? 0] ?? (err.status === 0 ? 'No hay conexión con el servidor. Puede reintentar.' : 'No se pudo consultar la información institucional. Puede reintentar.'));
      this.errorTipo.set(err.status === 400 || err.status === 422 ? 'validacion' : err.status === 401 ? 'autenticacion' : err.status === 403 ? 'autorizacion' : err.status === 404 ? 'no-encontrado' : err.status === 0 ? 'red' : 'servidor');
      this.loading.set(false);
    };
    this.read.add(this.funcionarioService.findById(actor).subscribe({
      next: funcionario => {
        if (!current()) return;
        if (!funcionario || funcionario.id !== actor || !positiveId(funcionario.entidadId) || funcionario.activo !== true) {
          this.error.set('La información del funcionario o su entidad está incompleta. Reintente la consulta.');
          this.errorTipo.set('incompleta');
          this.loading.set(false); return;
        }
        const entidad = funcionario.entidadId;
        this.entidadId.set(entidad);
        this.nombreEntidad.set(typeof funcionario.entidadNombre === 'string' ? funcionario.entidadNombre.trim() : '');
        this.nombreFuncionario.set(typeof funcionario.nombreCompleto === 'string' ? funcionario.nombreCompleto.trim() : '');
        this.read.add(this.solicitudService.findByEntidadId(entidad).subscribe({
          next: data => {
            if (!current()) return;
            const verified = readInstitutionList(data, entidad);
            if (!verified) {
              this.error.set('La respuesta está incompleta o no permite verificar la entidad y los recursos solicitados.');
              this.errorTipo.set('incompleta');
              this.loading.set(false); return;
            }
            this.solicitudes.set(verified);
            this.informacionIncompleta.set(verified.some(item => !this.estados.includes(item.estado)
              || !item.asunto || !this.fechaVisible(item.fechaPresentacion) || !Number.isSafeInteger(item.diasRestantes)
              || (item.estado !== 'VENCIDA' && item.diasRestantes < 0 && ['RECEPCIONADA', 'EN_REVISION'].includes(item.estado))));
            this.loading.set(false);
            this.tourService.checkAutoStart('saip_tour_funcionario', this.tourSteps);
          },
          error: failure,
        }));
      },
      error: failure,
    }));
  }
  getEstadoDisplay(solicitud: Solicitud): string { return solicitud.estado || 'SIN_ESTADO'; }
  getPrioridadClass(priority: string | null): string {
    if (!priority) return 'pill';
    return priority === 'ALTA' || priority === 'URGENTE' ? 'pill pill-high' : priority === 'MEDIA' || priority === 'NORMAL' ? 'pill pill-medium' : 'pill pill-low';
  }
  getDiasColor(bucket: BucketKey): string { return this.buckets.find(item => item.key === bucket)?.color ?? 'var(--muted-foreground)'; }
  getMetaLabel(item: QueueItem): string {
    if (item.solicitud.estado === 'PENDIENTE_INFORMACION') return 'Requerimiento';
    if (item.solicitud.estado === 'CONCLUIDA') return 'Estado registrado';
    return item.bucket === 'respondidas' ? 'Registro de respuesta' : 'Saldo informado';
  }
  getMetaValue(item: QueueItem): string {
    if (item.solicitud.estado === 'PENDIENTE_INFORMACION') return 'Consultar detalle';
    if (item.solicitud.estado === 'CONCLUIDA') return 'CONCLUIDA';
    if (item.bucket === 'respondidas') return item.solicitud.respuesta?.fechaRespuesta || 'Fecha no informada';
    return item.diasRestantes === null ? 'No informado' : item.diasRestantes + ' días (servidor)';
  }
  canResponder(solicitud: Solicitud): boolean { return this.contextoVigente() && !this.loading() && !this.error() && canNavigateToResponse(solicitud); }
  fechaVisible(value: unknown): string | null {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  }
}
