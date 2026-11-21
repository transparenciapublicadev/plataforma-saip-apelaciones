import { BandejaTribunalComponent } from '../ttaip/shared/bandeja-tribunal.component';
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject, computed, effect, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { PanelQueryService } from '../../services/panel-query.service';
import { PanelSolicitud as Solicitud, PanelPage, PanelSummary, validPanelPage } from '../../models/panel-query.model';
import { AuthService } from '../../services/auth.service';
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
  LucideSend, LucideChevronRight, LucideLayers, LucideTarget,
  LucideFileChartColumn
} from '@lucide/angular';

@Component({
  selector: 'app-funcionario-dashboard',
  imports: [BandejaTribunalComponent,
    RouterLink, FormsModule, DatePipe,
    StatusBadgeComponent, PaginationComponent,
    LucideBuilding2, LucideCompass, LucideShieldAlert,
    LucideArrowRight, LucideAlertTriangle, LucideFlame, LucideCalendar,
    LucideCheckCircle2, LucideInbox, LucideSearch, LucideUser,
    LucideSend, LucideChevronRight, LucideLayers, LucideTarget,
    LucideFileChartColumn
  ],
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioDashboardComponent implements OnInit, OnDestroy {
  private readonly panelService = inject(PanelQueryService);
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
    { selector: '[data-tour="e-hero"]', title: 'Tu día de un vistazo', body: 'Aquí ves la fecha, cuántas solicitudes tienes en bandeja y cuántas están en silencio administrativo o vencen hoy.' },
    { selector: '[data-tour="e-cumplimiento"]', title: 'Respuestas registradas en plazo', body: 'El indicador compara la fecha de la respuesta con el plazo registrado. Incluye solicitudes vencidas sin respuesta y muestra por separado las que aún están pendientes.' },
    { selector: '[data-tour="e-buckets"]', title: 'Bandeja por plazo', body: 'El corazón de tu trabajo: cada columna agrupa las solicitudes por urgencia de plazo. Toca una para enfocar esa cola.' },
    { selector: '[data-tour="e-cola"]', title: 'Solicitudes de la bandeja', body: 'La lista de solicitudes de la bandeja seleccionada, ordenadas por vencimiento. Desde aquí respondes o revisas cada expediente.', align: 'start' },
    { selector: '[data-tour="e-carga"]', title: 'Vencimientos de la semana', body: 'Un vistazo a cuántas solicitudes vencen en cada día hábil restante, para anticipar tu semana.' },
    { selector: '[data-tour="e-norma"]', title: 'Norma aplicable', body: 'Recordatorio de los plazos legales clave (Ley N° 27806) y qué ocurre si vencen: silencio negativo y derecho de apelación.' },
  ];
  readonly buckets: BucketMeta[] = [
    { key: 'todas', label: 'Todas las solicitudes', eyebrow: 'Vista general · sin filtro de plazo', icon: 'inbox', color: 'var(--brand-700)', bg: 'var(--brand-subtle)' },
    { key: 'san', label: 'Vencidas', eyebrow: 'Silencio negativo · acción urgente', icon: 'alert', color: 'var(--brand-700)', bg: 'var(--brand-subtle)' },
    { key: 'hoy', label: 'Hoy o mañana', eyebrow: 'Vencen en ≤1 día háb.', icon: 'flame', color: 'var(--brand-600)', bg: 'color-mix(in srgb, var(--brand-600) 8%, transparent)' },
    { key: 'semana', label: 'Esta semana', eyebrow: '2 a 5 días hábiles', icon: 'calendar', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 10%, transparent)' },
    { key: 'plazo', label: 'Cómodo en plazo', eyebrow: 'Más de 5 días háb.', icon: 'check', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 10%, transparent)' },
    { key: 'precision', label: 'En precisión', eyebrow: 'En espera del administrado', icon: 'alert', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 10%, transparent)' },
    { key: 'respondidas', label: 'Respondidas', eyebrow: 'Con respuesta registrada', icon: 'inbox', color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 8%, transparent)' },
    { key: 'derivadas', label: 'Derivadas', eyebrow: 'Mismo expediente · otra entidad', icon: 'inbox', color: 'var(--brand-700)', bg: 'var(--brand-subtle)' },
  ];
  solicitudes = signal<Solicitud[]>([]);
  loading = signal(true);
  readonly queryLoading = signal(false);
  readonly pagina = signal<PanelPage<Solicitud> | null>(null);
  readonly resumen = signal<PanelSummary | null>(null);
  private searchTimer?: ReturnType<typeof setTimeout>;
  error = signal('');
  errorTipo = signal<'sesion' | 'validacion' | 'autenticacion' | 'autorizacion' | 'no-encontrado' | 'red' | 'servidor' | 'incompleta' | null>(null);
  informacionIncompleta = signal(false);
  selectedBucket = signal<BucketKey>('todas');
  busqueda = signal('');
  nombreEntidad = signal('');
  nombreFuncionario = signal('');
  entidadId = signal(0);
  readonly estados = ['RECEPCIONADA', 'EN_REVISION', 'PENDIENTE_INFORMACION', 'RESPONDIDA', 'DENEGADA', 'CONCLUIDA', 'VENCIDA'];
  readonly queueItems = computed(() => this.solicitudes().map(queueItem));
  readonly counts = computed(() => ({ todas: this.resumen()?.total ?? 0,
    san: this.resumen()?.porEtapa['san'] ?? 0, hoy: this.resumen()?.porEtapa['hoy'] ?? 0,
    semana: this.resumen()?.porEtapa['semana'] ?? 0, plazo: this.resumen()?.porEtapa['plazo'] ?? 0,
    precision: this.resumen()?.porEtapa['precision'] ?? 0,
    respondidas: this.resumen()?.porEtapa['respondidas'] ?? 0,
    derivadas: this.resumen()?.porEtapa['derivada'] ?? 0 }));
  readonly bucketActivoMeta = computed(() => this.buckets.find(bucket => bucket.key === this.selectedBucket()) ?? this.buckets[0]);
  readonly totalActivas = computed(() => Math.max(0, ['RECEPCIONADA', 'EN_REVISION', 'PENDIENTE_INFORMACION', 'VENCIDA']
    .reduce((n, state) => n + (this.resumen()?.porEstado[state] ?? 0), 0) - (this.resumen()?.porEtapa['derivada'] ?? 0)));
  readonly registroRespuestas = computed(() => {
    if (!this.contextoVigente()) return null;
    const resumen = this.resumen();
    const registro = resumen?.registroRespuestas;
    if (!registro) return null;
    const cantidades = [registro.enPlazo, registro.fueraDePlazo, registro.pendientes, registro.noEvaluadas];
    return cantidades.every(n => Number.isSafeInteger(n) && n >= 0)
      && cantidades.reduce((total, n) => total + n, 0) === resumen.total ? registro : null;
  });
  readonly evaluadas = computed(() => {
    const registro = this.registroRespuestas();
    return registro ? registro.enPlazo + registro.fueraDePlazo : 0;
  });
  readonly cumplimiento = computed<number | null>(() => {
    const registro = this.registroRespuestas(), evaluadas = this.evaluadas();
    if (!registro) return null;
    return evaluadas > 0 ? Math.round((registro.enPlazo / evaluadas) * 100) : 0;
  });
  readonly donutCircunferencia = 2 * Math.PI * 26;
  private readonly donutDibujado = signal(false);
  private donutFrame = 0;
  readonly donutDashOffset = computed(() => {
    const val = this.donutDibujado() ? (this.cumplimiento() ?? 0) : 0;
    return this.donutCircunferencia - (val / 100) * this.donutCircunferencia;
  });
  readonly donutAccent = computed(() => {
    const val = this.cumplimiento();
    if (val === null) return 'var(--muted-foreground)';
    return val >= 80 ? 'var(--success)' : val >= 60 ? 'var(--warning)' : 'var(--brand-700)';
  });
  readonly fechaHoy = computed(() => new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }));
  readonly filtradas = computed(() => this.queueItems());
  readonly distribucionDias = computed(() => {
    const counts = this.resumen()?.porDiasRestantes;
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return null;
    const groups = Object.entries(counts);
    if (groups.some(([day, count]) => !/^\d+$/.test(day) || String(Number(day)) !== day
      || !Number.isSafeInteger(Number(day)) || !Number.isSafeInteger(count) || count < 0)) return null;
    if (!groups.length) return [];
    const dias = Array.from({ length: 11 }, (_, dia) => dia);
    for (const key of Object.keys(counts)) {
      const dia = Number(key);
      if (Number.isSafeInteger(dia) && dia > 10) dias.push(dia);
    }
    const valores = dias.map(dia => Number(counts[String(dia)] ?? 0));
    const max = Math.max(1, ...valores);
    return dias.sort((a, b) => a - b).map(dia => {
      const count = Number(counts[String(dia)] ?? 0);
      return { dia, count, width: count / max * 100, color: dia <= 1 ? 'var(--brand-700)' : dia <= 5 ? 'var(--warning)' : 'var(--success)' };
    });
  });
  readonly topTemas = computed(() => Object.entries(this.resumen()?.porTipoInformacion ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4));
  readonly paginaActual = signal(1);
  private readonly pageSize = 4;
  readonly totalRegistros = computed(() => this.pagina()?.totalElementos ?? 0);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalRegistros() / this.pageSize)));
  readonly paginaSegura = computed(() => Math.min(this.paginaActual(), this.totalPaginas()));
  readonly inicioRegistro = computed(() => this.totalRegistros() ? (this.paginaSegura() - 1) * this.pageSize + 1 : 0);
  readonly finRegistro = computed(() => Math.min(this.paginaSegura() * this.pageSize, this.totalRegistros()));
  readonly filtradasVisibles = computed(() => this.filtradas());
  get busquedaModel(): string { return this.busqueda(); }
  set busquedaModel(value: string) { this.busqueda.set(value.slice(0, 120)); this.paginaActual.set(1); clearTimeout(this.searchTimer); this.read.unsubscribe(); this.generation++; this.solicitudes.set([]); this.queryLoading.set(true); this.searchTimer = setTimeout(() => this.cargarSolicitudes(false), 250); }
  limpiarBusqueda(): void {
    if (this.busqueda()) {
      this.busqueda.set('');
      this.paginaActual.set(1);
      this.cargarSolicitudes(false);
    }
  }

  getAreaLabel(solicitud: { areaResponsable?: string | null; encargadoArea?: string | null }): string {
    const area = solicitud.areaResponsable?.trim();
    if (!area) return 'Sin asignar';
    const encargado = solicitud.encargadoArea?.trim();
    return encargado ? `${area} · ${encargado}` : area;
  }

  private programarDonut(valor: number | null): void {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.donutFrame);
    this.donutDibujado.set(false);
    if (valor === null) return;
    const dibujar = () => this.donutDibujado.set(true);
    if (typeof requestAnimationFrame !== 'function') {
      dibujar();
      return;
    }
    this.donutFrame = requestAnimationFrame(() => {
      this.donutFrame = requestAnimationFrame(dibujar);
    });
  }

  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (this.initialized && revision !== this.revision) untracked(() => this.cargarSolicitudes());
    });
    effect(() => {
      const valor = this.cumplimiento();
      untracked(() => this.programarDonut(valor));
    });
  }
  ngOnInit(): void {
    this.initialized = true;
    this.cargarSolicitudes();
  }
  ngOnDestroy(): void {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.donutFrame);
    this.tourService.endTourFor('saip_tour_funcionario');
    this.destroyed = true;
    this.generation++;
    this.read.unsubscribe();
    clearTimeout(this.searchTimer);
  }
  selectBucket(bucket: BucketKey): void {
    if (this.selectedBucket() === bucket) return;
    if (bucket !== 'todas' && this.counts()[bucket] === 0) return;
    this.selectedBucket.set(bucket);
    this.paginaActual.set(1);
    this.cargarSolicitudes(false);
  }
  cambiarPagina(page: number): void { if (Number.isSafeInteger(page) && page >= 1 && page <= this.totalPaginas() && page !== this.paginaActual()) { this.paginaActual.set(page); this.cargarSolicitudes(false); } }
  get isFirstVisit(): boolean { return this.tourService.isFirstVisit('saip_tour_funcionario'); }
  startTour(): void { this.tourService.startTour('saip_tour_funcionario', this.tourSteps); }

  cargarSolicitudes(reloadContext = true): void {
    clearTimeout(this.searchTimer);
    if (this.destroyed) return;
    this.tourService.endTourFor('saip_tour_funcionario');
    const revision = this.authService.cambiosSesion();
    const changed = revision !== this.revision;
    this.read.unsubscribe(); this.read = new Subscription();
    const generation = ++this.generation;
    this.revision = revision; this.revisionConsulta.set(revision);
    this.solicitudes.set([]); this.pagina.set(null); this.error.set(''); this.errorTipo.set(null); this.loading.set(changed || !this.resumen()); this.queryLoading.set(true); this.informacionIncompleta.set(false);
    if (changed) { this.nombreEntidad.set(''); this.nombreFuncionario.set(''); this.entidadId.set(0); this.resumen.set(null); this.busqueda.set(''); this.selectedBucket.set('todas'); this.paginaActual.set(1); }
    let session: ReturnType<AuthService['obtenerSesion']> = null;
    try { session = this.authService.obtenerSesion(); } catch { /* No query for malformed local session. */ }
    if (!session?.token || session.tipoUsuario !== 'FUNCIONARIO' || !positiveId(session.funcionarioId)
      || !positiveId(session.usuarioId) || session.usuarioId !== session.funcionarioId) {
      this.error.set('Su sesión de funcionario está incompleta. Inicie sesión mediante el acceso interno.');
      this.errorTipo.set('sesion');
      this.loading.set(false); this.queryLoading.set(false); this.resumen.set(null); return;
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
      this.error.set(messages[err.status ?? 0] ?? (err.status === 0 ? 'No hay conexión. Puede reintentar.' : 'No se pudo consultar la información institucional. Puede reintentar.'));
      this.errorTipo.set(err.status === 400 || err.status === 422 ? 'validacion' : err.status === 401 ? 'autenticacion' : err.status === 403 ? 'autorizacion' : err.status === 404 ? 'no-encontrado' : err.status === 0 ? 'red' : 'servidor');
      this.loading.set(false); this.queryLoading.set(false); this.resumen.set(null);
    };
    const loadPage = (entidad: number) => {
      const page = this.paginaActual() - 1, size = this.pageSize;
      const etapa = this.selectedBucket() === 'derivadas' ? 'derivada' : this.selectedBucket();
      this.read.add(this.panelService.solicitudes({ pagina: page, tamano: size, busqueda: this.busqueda().trim(),
        etapa }).subscribe({
        next: data => {
          if (!current()) return;
          const verified = validPanelPage<Solicitud>(data, page, size) ? readInstitutionList(data.contenido, entidad) : null;
          if (!verified) { this.error.set('La respuesta está incompleta o no permite verificar la entidad y los recursos solicitados.');
            this.errorTipo.set('incompleta'); this.resumen.set(null); this.loading.set(false); this.queryLoading.set(false); return; }
          this.pagina.set(data); this.resumen.set(data.resumen); this.solicitudes.set(verified);
          this.informacionIncompleta.set(verified.some(item => !this.estados.includes(item.estado)
            || !item.asunto || !this.fechaVisible(item.fechaPresentacion) || !Number.isSafeInteger(item.diasRestantes)));
          this.loading.set(false); this.queryLoading.set(false);
        }, error: failure,
      }));
    };
    if (!reloadContext && !changed && positiveId(this.entidadId())) { loadPage(this.entidadId()); return; }
    this.read.add(this.funcionarioService.findById(actor).subscribe({
      next: funcionario => {
        if (!current()) return;
        if (!funcionario || funcionario.id !== actor || !positiveId(funcionario.entidadId) || funcionario.activo !== true) {
          this.error.set('La información del funcionario o su entidad está incompleta. Reintente la consulta.');
          this.errorTipo.set('incompleta'); this.loading.set(false); this.queryLoading.set(false); this.resumen.set(null); return;
        }
        this.entidadId.set(funcionario.entidadId);
        this.nombreEntidad.set(typeof funcionario.entidadNombre === 'string' ? funcionario.entidadNombre.trim() : '');
        this.nombreFuncionario.set(typeof funcionario.nombreCompleto === 'string' ? funcionario.nombreCompleto.trim() : '');
        loadPage(funcionario.entidadId);
      }, error: failure,
    }));
  }

  getEstadoDisplay(solicitud: Solicitud): string { return solicitud.estado || 'SIN_ESTADO'; }
  getPrioridadClass(priority: string | null): string {
    if (!priority) return 'pill';
    return priority === 'ALTA' || priority === 'URGENTE' ? 'pill pill-high' : priority === 'MEDIA' || priority === 'NORMAL' ? 'pill pill-medium' : 'pill pill-low';
  }
  getDiasColor(bucket: BucketKey): string { return this.buckets.find(item => item.key === bucket)?.color ?? 'var(--muted-foreground)'; }
  getMetaLabel(item: QueueItem): string {
    const isResp = ['RESPONDIDA', 'DENEGADA', 'CONCLUIDA'].includes(item.solicitud.estado) || item.solicitud.respuesta != null;
    if (isResp) return 'Respondida el';
    const enPrecision = item.solicitud.estado === 'PENDIENTE_INFORMACION'
      || (Array.isArray(item.solicitud.observaciones) && item.solicitud.observaciones.some(o => o && o.estado === 'PENDIENTE_SUBSANACION'));
    if (enPrecision) return 'Plazo p/ precisar';
    if (item.solicitud.estado === 'VENCIDA' || (item.diasRestantes !== null && item.diasRestantes < 0)) return 'En silencio administrativo';
    return 'Plazo p/ responder';
  }
  getMetaValue(item: QueueItem): string {
    const isResp = ['RESPONDIDA', 'DENEGADA', 'CONCLUIDA'].includes(item.solicitud.estado) || item.solicitud.respuesta != null;
    if (isResp) {
      const fecha = item.solicitud.respuesta?.fechaRespuesta;
      if (fecha && this.fechaVisible(fecha)) {
        const [y, m, d] = fecha.substring(0, 10).split('-');
        return `${d}/${m}/${y}`;
      }
      return fecha || '—';
    }
    const enPrecision = item.solicitud.estado === 'PENDIENTE_INFORMACION'
      || (Array.isArray(item.solicitud.observaciones) && item.solicitud.observaciones.some(o => o && o.estado === 'PENDIENTE_SUBSANACION'));
    if (enPrecision) {
      const obs = Array.isArray(item.solicitud.observaciones) ? item.solicitud.observaciones.find(o => o && o.estado === 'PENDIENTE_SUBSANACION') : null;
      const fecha = obs?.fechaLimiteSubsanacion;
      if (fecha && this.fechaVisible(fecha)) {
        const [y, m, d] = fecha.substring(0, 10).split('-');
        return `${d}/${m}/${y}`;
      }
      return fecha || '—';
    }
    if (item.solicitud.estado === 'VENCIDA' || (item.diasRestantes !== null && item.diasRestantes < 0)) {
      if (item.diasRestantes === null) return 'Días no informados';
      const diasVencidos = Math.abs(item.diasRestantes);
      return `+${diasVencidos} ${diasVencidos === 1 ? 'día háb.' : 'días háb.'}`;
    }
    if (item.diasRestantes === null) return 'Plazo no informado';
    const d = item.diasRestantes;
    if (d === 0) return 'Vence hoy';
    return `${d} ${d === 1 ? 'día háb.' : 'días háb.'}`;
  }
  canResponder(solicitud: Solicitud): boolean { return this.contextoVigente() && !this.loading() && !this.error() && canNavigateToResponse(solicitud); }
  fechaVisible(value: unknown): string | null {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  }
}
