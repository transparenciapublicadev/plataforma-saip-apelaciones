import { AdminUserCreateFormComponent } from './admin-user-create-form.component';
import { Component, ChangeDetectionStrategy, DestroyRef, OnInit, OnDestroy, computed, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize } from 'rxjs';
import { ModalFocusDirective } from '../../shared/modal-focus.directive';
import { FormsModule } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { UsuarioAdmin, UsuarioService } from '../../services/usuario.service';
import { SystemConfigService, PLAZO_DEFS } from '../../services/system-config.service';
import { EstadisticasService, EstadisticasGenerales, RankingEntidadItem, ApelacionesEstadisticas, TtaipEstadisticas, ActividadRecienteItem } from '../../services/estadisticas.service';
import { ReportesService } from '../../services/reportes.service';
import { Entidad } from '../../models/entidad.model';
import { Solicitud } from '../../models/solicitud.model';
import { Apelacion } from '../../models/apelacion.model';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';
import { PaginationComponent } from '../../shared/pagination.component';
import { csvOf, downloadFile, pdfPro, xlsxOf } from './admin-report-files';
import {
  LucideShield, LucideFileText, LucideUsers, LucideBuilding2, LucideAward,
  LucideClock, LucideCheckCircle, LucideCheckCircle2, LucideAlertTriangle,
  LucideScale, LucideBarChart, LucideBarChart3, LucideDownload, LucideSettings,
  LucideActivity, LucideSearch, LucideFilter, LucideEye, LucideEdit, LucideTrash2,
  LucideUserPlus, LucideCalendar, LucideChevronRight, LucideChevronLeft,
  LucideCompass, LucideSliders, LucideGavel, LucideSave, LucidePlus, LucideX,
  LucideArrowRight, LucideInfo, LucideTrendingUp
} from '@lucide/angular';

export interface EntityRow {
  id: string;
  nombre: string;
  acronimo: string;
  solicitudesAsignadas: number;
  pendientes: number;
  respondidas: number;
  vencidas: number;
  tasaCumplimiento: number;
  estado: 'Activa' | 'Inactiva';
}

export interface UserRow {
  id: string;
  nombre: string;
  email: string;
  tipo: string;
  entidad?: string;
  solicitudes: number | null;
  solicitudesGestionadas: number | null;
  apelacionesResueltas: number | null;
  fechaRegistro: string;
  estado: 'Activo' | 'Inactivo';
}

export interface ReportItem {
  title: string;
  desc: string;
  iconName: 'file' | 'building' | 'users' | 'activity' | 'clock' | 'bar';
  accent: string;
  pdf: () => void;
  xlsx: () => void;
  csv: () => void;
}

export interface CustomReportSchemaField {
  key: string;
  label: string;
}

export interface CustomReportSchema {
  label: string;
  estados: string[];
  fields: CustomReportSchemaField[];
  rows: any[];
}

export const ETAPA_LABEL: Record<string, string> = {
  RECEPCIONADA: 'Recepcionada',
  EN_REVISION: 'En revisión',
  PENDIENTE_INFORMACION: 'Pendiente de información',
  RESPONDIDA: 'Respondida',
  DENEGADA: 'Denegada',
  CONCLUIDA: 'Concluida',
  VENCIDA: 'Vencida',
  PENDIENTE_ELEVACION: 'Pendiente de elevación',
  EN_CALIFICACION_1: 'En 1ª calificación',
  EN_SUBSANACION: 'En subsanación',
  EN_CALIFICACION_2: 'En 2ª calificación',
  NOTIFICACION_SEGUNDA_CALIFICACION: 'Notificación 2ª calificación',
  EN_RESOLUCION: 'En resolución',
  RESUELTO: 'Resuelto',
  TENER_POR_NO_PRESENTADO: 'Tener por no presentado',
  CONCLUSION_SUSTRACCION_MATERIA: 'Sustracción de materia',
  CONCLUSION_DESISTIMIENTO: 'Desistimiento',
  RESUELTO_FUNDADO: 'Resuelto fundado',
  RESUELTO_FUNDADO_EN_PARTE: 'Resuelto fundado en parte',
  RESUELTO_INFUNDADO: 'Resuelto infundado',
  RESUELTO_INFUNDADO_EN_PARTE: 'Resuelto infundado en parte',
  RESUELTO_IMPROCEDENTE: 'Resuelto improcedente',
  RESUELTO_ESTESE_A_LO_RESUELTO: 'Estése a lo resuelto',
  RESUELTO_NULIDAD_ACTO: 'Nulidad de acto',
  'Pendiente de Elevacion': 'Pendiente de elevación',
  'En 1ra Calificacion': 'En 1ª calificación',
  'En Subsanacion': 'En subsanación',
  'En 2da Calificacion': 'En 2ª calificación',
  'En Resolucion': 'En resolución',
  'Resuelto': 'Resuelto',
};

export const ETAPA_ORDEN = [
  'Pendiente de Elevacion',
  'En 1ra Calificacion',
  'En Subsanacion',
  'En 2da Calificacion',
  'En Resolucion',
  'Resuelto',
];

function parseFechaTs(f?: string): number {
  if (!f) return 0;
  const iso = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
  const m = f.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return 0;
  const yr = m[3].length === 2 ? +('20' + m[3]) : +m[3];
  return new Date(yr, +m[2] - 1, +m[1]).getTime();
}

function hasNumbers(value: unknown, keys: string[]): boolean {
  return !!value && keys.every(key => {
    const field = (value as Record<string, unknown>)[key];
    return typeof field === 'number' && Number.isFinite(field);
  });
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    AdminUserCreateFormComponent, CommonModule, FormsModule, DecimalPipe, PaginationComponent, ModalFocusDirective,
    LucideShield, LucideFileText, LucideUsers, LucideBuilding2, LucideAward,
    LucideClock, LucideCheckCircle, LucideAlertTriangle,
    LucideScale, LucideBarChart3, LucideDownload, LucideSettings,
    LucideActivity, LucideSearch, LucideFilter, LucideEye, LucideEdit, LucideTrash2,
    LucideUserPlus, LucideCalendar, LucideChevronRight,
    LucideCompass, LucideSliders, LucideGavel, LucideSave, LucidePlus, LucideX,
    LucideArrowRight, LucideInfo, LucideTrendingUp
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly entidadService = inject(EntidadService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly estadisticasService = inject(EstadisticasService);
  private readonly reportesService = inject(ReportesService);
  private readonly tourService = inject(GuidedTourService);
  readonly configService = inject(SystemConfigService);

  readonly plazoDefs = PLAZO_DEFS;
  readonly etapaOrden = ETAPA_ORDEN;
  readonly etapaLabels = ETAPA_LABEL;

  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="a-kpis"]', title: 'Indicadores principales', body: 'Totales y tasas informados por las consultas administrativas. Revise su alcance y los estados de carga, error o información no disponible.' },
    { selector: '[data-tour="a-status"]', title: 'Estado de las solicitudes', body: 'Desglose de los estados registrados por el servidor. No acredita entrega, notificación eficaz ni sanción.' },
    { selector: '[data-tour="a-tabs"]', title: 'Áreas de administración', body: 'Navega entre Resumen, Entidades, Usuarios, Reportes y Configuración. Te mostraremos cada una.' },
    { selector: '[data-tour="a-overview"]', title: 'Resumen operativo', body: 'Ranking y actividad recuperados del servidor. Cada sección indica si su consulta está disponible; el tutorial no inventa registros.', align: 'start', onEnter: () => this.activeTab.set('overview') },
    { selector: '[data-tour="a-entities"]', title: 'Entidades públicas', body: 'Listado y operaciones administrativas disponibles según sus permisos. Resaltar esta sección no crea, modifica ni desactiva una entidad.', align: 'start', onEnter: () => this.activeTab.set('entities') },
    { selector: '[data-tour="a-users"]', title: 'Usuarios del sistema', body: 'Consulta y gestión autorizadas de cuentas. El alta exige una contraseña explícita; el tutorial no crea cuentas ni cambia sus credenciales.', align: 'start', onEnter: () => this.activeTab.set('users') },
    { selector: '[data-tour="a-reports"]', title: 'Reportes disponibles', body: 'Revise los datos, filtros y formatos habilitados. Los reportes no disponibles se indican como tales; una exportación no equivale a emisión documental oficial.', align: 'start', onEnter: () => this.activeTab.set('reports') },
    { selector: '[data-tour="a-settings"]', title: 'Configuración consultada', body: 'Consulte los valores recuperados del servidor y las limitaciones indicadas en pantalla. Abrir esta sección no guarda cambios ni acredita el inicio de un plazo.', align: 'start', onEnter: () => this.activeTab.set('settings') },
  ];

  readonly pageSize = 8;
  readonly resourceStates = signal<Record<string, 'loading' | 'ready' | 'error' | 'unavailable'>>({});
  readonly loadErrors = signal<Record<string, string>>({});
  readonly saving = signal(false);
  readonly exporting = signal(false);
  private reads = new Subscription();
  private writes = new Subscription();
  private generation = 0;
  private pendingReads = 0;
  private messageTimer?: ReturnType<typeof setTimeout>;

  ready(...keys: string[]): boolean {
    return keys.every(key => this.resourceStates()[key] === 'ready');
  }

  readonly overviewReady = computed(() => this.ready('general', 'solicitudes', 'apelaciones', 'entidades', 'actividad', 'apelStats', 'ttaipStats', 'ranking', 'distribution'));
  readonly customReady = computed(() => this.crDataset() === 'entidades'
    ? this.ready('entidades', 'solicitudes') : this.ready(this.crDataset()));

  private request<T>(key: string, source: Observable<T>, apply: (value: T) => void, valid: (value: T) => boolean): void {
    const generation = this.generation;
    this.reads.add(source.pipe(finalize(() => {
      if (generation === this.generation && --this.pendingReads === 0) this.loading.set(false);
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        if (generation !== this.generation) return;
        this.resourceStates.update(states => ({ ...states, [key]: valid(value) ? 'ready' : 'unavailable' }));
        if (valid(value)) apply(value);
        else this.loadErrors.update(errors => ({ ...errors, [key]: 'Información incompleta o no disponible en la respuesta del servidor.' }));
      },
      error: error => {
        if (generation !== this.generation) return;
        this.resourceStates.update(states => ({ ...states, [key]: 'error' }));
        this.loadErrors.update(errors => ({ ...errors, [key]: this.failureMessage(error) }));
      },
    }));
  }

  failureMessage(error: { status?: number }): string {
    return error?.status === 401 ? 'Su sesión no es válida. Inicie sesión nuevamente.'
      : error?.status === 403 ? 'No tiene permiso para consultar o modificar estos datos.'
      : error?.status === 404 ? 'El recurso solicitado no está disponible.'
      : error?.status === 400 ? 'Revise los datos e inténtelo nuevamente.'
      : error?.status === 0 ? 'No se pudo confirmar la operación por un problema de conexión. Consulte el listado antes de repetir una escritura.'
      : 'No se pudo completar la operación en el servidor. Consulte el listado antes de reintentar.';
  }

  ngOnDestroy(): void {
    this.tourService.endTourFor('saip_tour_admin');
    ++this.generation;
    this.reads.unsubscribe();
    this.writes.unsubscribe();
    clearTimeout(this.messageTimer);
  }
  activeTab = signal<string>('overview');
  loading = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

  // Colecciones raw sincronizadas con el backend
  solicitudes = signal<Solicitud[]>([]);
  apelaciones = signal<Apelacion[]>([]);
  entidadesRaw = signal<Entidad[]>([]);
  usuariosRaw = signal<UsuarioAdmin[]>([]);
  actividadReciente = signal<ActividadRecienteItem[]>([]);
  apelacionesStatsBackend = signal<ApelacionesEstadisticas | null>(null);
  ttaipStatsBackend = signal<TtaipEstadisticas | null>(null);
  estadisticasGenerales = signal<EstadisticasGenerales | null>(null);
  distribucionEstados = signal<Record<string, number> | null>(null);
  rankingEntidadesApi = signal<RankingEntidadItem[] | null>(null);

  // Búsqueda y paginación
  searchTerm = signal<string>('');
  filterUserType = signal<string>('todos');
  entPage = signal<number>(1);
  userPage = signal<number>(1);

  // Modales
  entModal = signal<{ mode: 'create' | 'edit' | 'view'; data: EntityRow | null } | null>(null);
  entFormNombre = signal<string>('');
  entFormAcronimo = signal<string>('');
  entFormEstado = signal<'Activa' | 'Inactiva'>('Activa');

  userModal = signal<{ mode: 'create' | 'edit' | 'view'; data: UserRow | null } | null>(null);
  userFormNombre = signal<string>('');
  userFormEmail = signal<string>('');
  userFormTipo = signal<string>('Ciudadano');
  userFormEntidad = signal<string>('');
  userFormEstado = signal<'Activo' | 'Inactivo'>('Activo');

  confirm = signal<{ titulo: string; detalle: string; onOk: () => void } | null>(null);

  // Constructor de reportes personalizados
  crDataset = signal<'solicitudes' | 'apelaciones' | 'entidades' | 'usuarios'>('solicitudes');
  crCols = signal<Record<string, boolean>>({});
  crEstado = signal<string>('todos');
  crEntidad = signal<string>('todas');
  crDesde = signal<string>('');
  crHasta = signal<string>('');
  crFormato = signal<'pdf' | 'xlsx' | 'csv'>('pdf');

  // ── Estadísticas por entidad calculadas en vivo con respaldo del backend ─
  readonly statsPorEntidad = computed(() => {
    const agg = new Map<string, { asignadas: number; pendientes: number; respondidas: number; vencidas: number }>();
    for (const s of this.solicitudes()) {
      const key = String(s.entidadId);
      if (!s.entidadId) continue;
      const g = agg.get(key) ?? { asignadas: 0, pendientes: 0, respondidas: 0, vencidas: 0 };
      g.asignadas++;
      const est = (s.estado || '').toUpperCase();
      if (est === 'PENDIENTE' || est === 'RECEPCIONADA' || est === 'EN_REVISION' || est === 'PENDIENTE_INFORMACION' || est === 'EN_PROCESO' || est === 'EN PROCESO') {
        g.pendientes++;
      } else if (est === 'RESPONDIDA') {
        g.respondidas++;
      } else if (est === 'VENCIDA') {
        g.vencidas++;
      }
      agg.set(key, g);
    }

    return agg;
  });

  // ── Entidades unificadas basadas exclusivamente en EntidadService ─────────
  readonly entidades = computed<EntityRow[]>(() => {
    const stats = this.statsPorEntidad();
    return this.entidadesRaw().map((e) => {
      const key = String(e.id);
      const stat = stats.get(key) ?? { asignadas: 0, pendientes: 0, respondidas: 0, vencidas: 0 };
      const asignadas = stat.asignadas;
      const pendientes = stat.pendientes;
      const respondidas = stat.respondidas;
      const vencidas = stat.vencidas;
      const tasaCumplimiento = asignadas ? Math.round((respondidas / asignadas) * 100) : 0;

      return {
        id: String(e.id),
        nombre: e.nombre,
        acronimo: e.acronimo || e.nombre,
        solicitudesAsignadas: asignadas,
        pendientes,
        respondidas,
        vencidas,
        tasaCumplimiento,
        estado: (e.activa !== false && e.estado !== 'Inactiva' ? 'Activa' : 'Inactiva') as 'Activa' | 'Inactiva',
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  // ── Ranking y Entidades con Vencidas para Resumen (Overview) ─────────────
  readonly rankingEntidades = computed<EntityRow[]>(() => {
    const apiRanking = this.rankingEntidadesApi();
    if (apiRanking) {
      return apiRanking.slice(0, 5).map((item) => {
        const match = this.entidadesRaw().find((e) => e.id === item.entidadId || e.nombre === item.entidadNombre);
        const tasa = item.totalSolicitudes > 0 ? Math.round((item.respondidas / item.totalSolicitudes) * 100) : 0;
        return {
          id: String(item.entidadId),
          nombre: item.entidadNombre,
          acronimo: item.acronimo || item.entidadNombre,
          solicitudesAsignadas: item.totalSolicitudes,
          pendientes: item.pendientes,
          respondidas: item.respondidas,
          vencidas: this.entidades().find(e => e.id === String(item.entidadId))?.vencidas ?? 0,
          tasaCumplimiento: tasa,
          estado: (match?.activa !== false && match?.estado !== 'Inactiva' ? 'Activa' : 'Inactiva') as 'Activa' | 'Inactiva',
        };
      });
    }
    return [...this.entidades()].sort((a, b) => b.tasaCumplimiento - a.tasaCumplimiento).slice(0, 5);
  });

  readonly entidadesConVencidas = computed<EntityRow[]>(() => {
    return this.entidades().filter((e) => e.vencidas > 0).sort((a, b) => b.vencidas - a.vencidas);
  });

  // ── Usuarios unificados con estadísticas reales ─────────────────────────
  readonly usuarios = computed<UserRow[]>(() => {
    return this.usuariosRaw().map((u) => {
      let tipoStr = 'Ciudadano';
      if (u.tipoUsuario === 'FUNCIONARIO') tipoStr = 'Funcionario';
      else if (u.tipoUsuario === 'TTAIP') tipoStr = 'TTAIP';
      else if (u.tipoUsuario === 'ADMINISTRADOR') tipoStr = 'Administrador';

      // Ciudadano.getId() aliases the inherited Usuario.idUsuario; names are not identities.
      const solicitudesCount = u.tipoUsuario === 'CIUDADANO' && this.ready('solicitudes')
        ? this.solicitudes().filter(s => s.ciudadanoId === u.id).length : null;
      const gestionadasCount = null;
      const resueltasCount = null;

      const entidadNombre = (u as any).entidad || (u as any).entidadNombre || (u.entidadId ? this.entidadesRaw().find((e) => e.id === u.entidadId)?.nombre : undefined);

      return {
        id: String(u.id),
        nombre: u.nombre || u.email.split('@')[0],
        email: u.email,
        tipo: tipoStr,
        entidad: entidadNombre,
        solicitudes: solicitudesCount,
        solicitudesGestionadas: gestionadasCount,
        apelacionesResueltas: resueltasCount,
        fechaRegistro: u.fechaRegistro ? new Date(u.fechaRegistro).toLocaleDateString('es-PE') : '—',
        estado: u.activo !== false ? 'Activo' : 'Inactivo',
      };
    });
  });

  // Values are displayed only after the corresponding server query is ready.
  readonly totalSolicitudes = computed(() => this.estadisticasGenerales()?.totalSolicitudes ?? 0);
  readonly enProceso = computed(() => this.estadisticasGenerales()?.solicitudesPendientes ?? 0);
  readonly respondidas = computed(() => this.estadisticasGenerales()?.solicitudesRespondidas ?? 0);
  readonly vencidas = computed(() => this.estadisticasGenerales()?.solicitudesVencidas ?? 0);
  readonly totalApelaciones = computed(() => this.estadisticasGenerales()?.totalApelaciones ?? 0);
  readonly apelacionesResueltas = computed(() => this.estadisticasGenerales()?.apelacionesResueltas ?? 0);
  readonly totalEntidades = computed(() => this.estadisticasGenerales()?.totalEntidades ?? 0);
  readonly totalUsuarios = computed(() => this.estadisticasGenerales()?.totalUsuarios ?? 0);

  readonly tasaCumplimientoPromedio = computed(() => {
    const list = this.entidades();
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, e) => sum + e.tasaCumplimiento, 0) / list.length);
  });

  readonly promedioDias = computed(() => this.estadisticasGenerales()?.tiempoPromedioRespuestaDias ?? null);

  // ── Estadísticas de 2ª instancia (Tribunal TTAIP) ───────────────────────
  readonly ttaipStats = computed(() => {
    const etapas: Record<string, number> = {};
    const resultados: Record<string, number> = {};
    for (const a of this.apelaciones()) {
      let etapaNorm = 'Estado no disponible';
      const raw = (a.estado || (a as any).etapa || '').toUpperCase();
      if (raw.includes('ELEVACION') || raw.includes('PENDIENTE_ELEVACION')) etapaNorm = 'Pendiente de Elevacion';
      else if (raw.includes('SUB') || raw.includes('SUBSANACION')) etapaNorm = 'En Subsanacion';
      else if (raw.includes('SEGUNDA') || raw.includes('2DA') || raw.includes('CALIFICACION_2')) etapaNorm = 'En 2da Calificacion';
      else if (raw.includes('RESOLUCION') || raw.includes('ANALISIS')) etapaNorm = 'En Resolucion';
      else if (raw.includes('RESUELT') || raw.includes('CONCLUSION') || raw.includes('NO_PRESENTADO') || raw.includes('IMPROCEDENTE')) etapaNorm = 'Resuelto';
      else if (raw.includes('CALIFICACION') || raw.includes('1RA')) etapaNorm = 'En 1ra Calificacion';

      etapas[etapaNorm] = (etapas[etapaNorm] ?? 0) + 1;

      const res = (a as any).resultado || (a as any).decision || (a as any).sentido || (a.estado?.startsWith('RESUELTO_') ? a.estado : undefined);
      if (res) {
        resultados[res] = (resultados[res] ?? 0) + 1;
      }
    }

    const apelStats = this.apelacionesStatsBackend();
    const ttaipStats = this.ttaipStatsBackend();

    const resueltas = apelStats ? (
      (apelStats.resueltosFundado || 0) +
      (apelStats.resueltosInfundado || 0) +
      (apelStats.resueltosFundadoEnParte || 0) +
      (apelStats.resueltosInfundadoEnParte || 0) +
      (apelStats.resueltosImprocedente || 0) +
      (apelStats.resueltosEsteseALoResuelto || 0) +
      (apelStats.resueltosNulidadActo || 0) +
      (apelStats.tenerPorNoPresentado || 0) +
      (apelStats.conclusionSustraccion || 0) +
      (apelStats.conclusionDesistimiento || 0)
    ) : (etapas['Resuelto'] ?? 0);

    const enTramite = ttaipStats ? (
      (ttaipStats.pendientesAdmision || 0) +
      (ttaipStats.pendientesElevacion || 0) +
      (ttaipStats.enProceso || 0) +
      (ttaipStats.enSubsanacion || 0)
    ) : Math.max(0, this.totalApelaciones() - resueltas);

    const fundadas = apelStats ? (
      (apelStats.resueltosFundado || 0) + (apelStats.resueltosFundadoEnParte || 0)
    ) : (
      (resultados['Fundado'] ?? 0) + (resultados['Fundado en parte'] ?? 0) +
      (resultados['FUNDADA'] ?? 0) + (resultados['FUNDADA_EN_PARTE'] ?? 0) +
      (resultados['RESUELTO_FUNDADO'] ?? 0) + (resultados['RESUELTO_FUNDADO_EN_PARTE'] ?? 0)
    );

    const infundadas = apelStats ? (
      (apelStats.resueltosInfundado || 0) + (apelStats.resueltosInfundadoEnParte || 0)
    ) : (
      (resultados['Infundado'] ?? 0) + (resultados['Infundado en parte'] ?? 0) +
      (resultados['INFUNDADA'] ?? 0) + (resultados['INFUNDADA_EN_PARTE'] ?? 0) +
      (resultados['RESUELTO_INFUNDADO'] ?? 0) + (resultados['RESUELTO_INFUNDADO_EN_PARTE'] ?? 0)
    );

    return {
      etapas,
      resultados,
      resueltas,
      enTramite: Math.max(0, enTramite),
      fundadas,
      infundadas,
    };
  });

  // ── Resultados de 1ª instancia (respuesta de la entidad) ────────────────
  readonly resultadosEntidad = computed(() => {
    const r = { Total: 0, Parcial: 0, Denegada: 0 };
    for (const s of this.solicitudes()) {
      const tipo = (s.respuesta as any)?.tipoRespuesta || (s as any).resultadoEntidad || (s as any).resultado;
      const est = (s.estado || '').toUpperCase();

      if (tipo === 'ENTREGA_TOTAL' || tipo === 'Total' || tipo === 'TOTAL') {
        r.Total++;
      } else if (tipo === 'ENTREGA_PARCIAL' || tipo === 'Parcial' || tipo === 'PARCIAL') {
        r.Parcial++;
      } else if (tipo === 'DENEGATORIA_TOTAL' || tipo === 'DENEGACION_TOTAL' || tipo === 'Denegada' || tipo === 'DENEGADA' || est === 'DENEGADA') {
        r.Denegada++;
      }
    }
    return r;
  });

  readonly tasaApelacion = computed(() => {
    const tot = this.totalSolicitudes();
    return tot ? Math.round((this.totalApelaciones() / tot) * 100) : 0;
  });

  // ── Actividad reciente (consumida directamente del backend) ─────────────
  readonly activityLog = computed(() => this.actividadReciente());

  // ── Filtros y paginación de entidades ───────────────────────────────────
  readonly filteredEntities = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.entidades();
    return this.entidades().filter(
      (e) => e.nombre.toLowerCase().includes(q) || e.acronimo.toLowerCase().includes(q)
    );
  });

  readonly pagedEntities = computed(() => {
    const start = (this.entPage() - 1) * this.pageSize;
    return this.filteredEntities().slice(start, start + this.pageSize);
  });

  readonly totalPagesEntidades = computed(() => Math.max(1, Math.ceil(this.filteredEntities().length / this.pageSize)));
  readonly rangeFromEntidades = computed(() => this.filteredEntities().length === 0 ? 0 : (this.entPage() - 1) * this.pageSize + 1);
  readonly rangeToEntidades = computed(() => Math.min(this.entPage() * this.pageSize, this.filteredEntities().length));

  // ── Filtros y paginación de usuarios ────────────────────────────────────
  readonly filteredUsers = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const t = this.filterUserType();
    return this.usuarios().filter((u) => {
      const matchText = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchType = t === 'todos' || u.tipo === t;
      return matchText && matchType;
    });
  });

  readonly pagedUsers = computed(() => {
    const start = (this.userPage() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  readonly totalPagesUsuarios = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize)));
  readonly rangeFromUsuarios = computed(() => this.filteredUsers().length === 0 ? 0 : (this.userPage() - 1) * this.pageSize + 1);
  readonly rangeToUsuarios = computed(() => Math.min(this.userPage() * this.pageSize, this.filteredUsers().length));

  // ── Esquemas para el generador de reportes personalizados ───────────────
  readonly crSchemas = computed<Record<string, CustomReportSchema>>(() => ({
    solicitudes: {
      label: 'Solicitudes (1ª instancia · SAIP)',
      estados: ['RECEPCIONADA', 'EN_REVISION', 'PENDIENTE_INFORMACION', 'RESPONDIDA', 'DENEGADA', 'CONCLUIDA', 'VENCIDA'],
      fields: [
        { key: 'expediente', label: 'Expediente' },
        { key: 'ciudadano', label: 'Administrado' },
        { key: 'entidad', label: 'Entidad' },
        { key: 'estado', label: 'Estado' },
        { key: 'resultado', label: 'Resultado entidad' },
        { key: 'fecha', label: 'F. presentación' },
        { key: 'plazo', label: 'Plazo' },
      ],
      rows: this.solicitudes().map((s) => ({
        expediente: s.expediente || 'SAIP',
        ciudadano: s.ciudadanoNombre || (s as any).ciudadano || 'Administrado',
        entidad: s.entidadNombre || s.entidadAcronimo || (s as any).entidad || '—',
        estado: s.estado,
        _estadoRaw: s.estado,
        resultado: (s.respuesta as any)?.tipoRespuesta || (s as any).resultadoEntidad || (s as any).resultado || '—',
        fecha: s.fechaPresentacion || '—',
        plazo: (s as any).fechaLimite || 'No disponible',
        _entidad: s.entidadNombre || s.entidadAcronimo || '—',
        _ts: parseFechaTs(s.fechaPresentacion),
      })),
    },
    apelaciones: {
      label: 'Apelaciones (2ª instancia · TTAIP)',
      estados: ETAPA_ORDEN,
      fields: [
        { key: 'expediente', label: 'Expediente TTAIP' },
        { key: 'saip', label: 'SAIP de origen' },
        { key: 'ciudadano', label: 'Administrado' },
        { key: 'entidad', label: 'Entidad' },
        { key: 'estado', label: 'Etapa' },
        { key: 'resultado', label: 'Resultado' },
        { key: 'fecha', label: 'F. ingreso' },
      ],
      rows: this.apelaciones().map((a) => {
        let etapaNorm = 'Estado no disponible';
        const raw = (a.estado || (a as any).etapa || '').toUpperCase();
        if (raw.includes('ELEVACION') || raw.includes('PENDIENTE_ELEVACION')) etapaNorm = 'Pendiente de Elevacion';
        else if (raw.includes('SUB') || raw.includes('SUBSANACION')) etapaNorm = 'En Subsanacion';
        else if (raw.includes('SEGUNDA') || raw.includes('2DA') || raw.includes('CALIFICACION_2')) etapaNorm = 'En 2da Calificacion';
        else if (raw.includes('RESOLUCION') || raw.includes('ANALISIS')) etapaNorm = 'En Resolucion';
        else if (raw.includes('RESUELT') || raw.includes('CONCLUSION') || raw.includes('NO_PRESENTADO') || raw.includes('IMPROCEDENTE')) etapaNorm = 'Resuelto';
        else if (raw.includes('CALIFICACION') || raw.includes('1RA')) etapaNorm = 'En 1ra Calificacion';

        return {
          expediente: a.expediente || '—',
          saip: a.solicitudExpediente || (a as any).expedienteSAIP || '—',
          ciudadano: (a as any).ciudadanoNombre || (a as any).ciudadano || 'Administrado',
          entidad: a.entidadNombre || (a as any).entidad || '—',
          estado: ETAPA_LABEL[a.estado] || ETAPA_LABEL[etapaNorm] || a.estado,
          _etapaNorm: etapaNorm,
          _estadoRaw: a.estado,
          resultado: (a as any).resultado || '—',
          fecha: a.fechaApelacion || (a as any).fechaIngreso || '—',
          _entidad: a.entidadNombre || '—',
          _ts: parseFechaTs(a.fechaApelacion || (a as any).fechaIngreso),
        };
      }),
    },
    entidades: {
      label: 'Entidades públicas',
      estados: [],
      fields: [
        { key: 'nombre', label: 'Entidad' },
        { key: 'acronimo', label: 'Acrónimo' },
        { key: 'solicitudesAsignadas', label: 'Asignadas' },
        { key: 'pendientes', label: 'Pendientes' },
        { key: 'respondidas', label: 'Respondidas' },
        { key: 'vencidas', label: 'Vencidas' },
        { key: 'tasaCumplimiento', label: 'Respuesta %' },
      ],
      rows: this.entidades().map((e) => ({ ...e, _entidad: e.nombre, _ts: 0 })),
    },
    usuarios: {
      label: 'Usuarios del sistema',
      estados: ['Activo', 'Inactivo'],
      fields: [
        { key: 'nombre', label: 'Nombre' },
        { key: 'email', label: 'Correo' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'entidad', label: 'Entidad / Área' },
        { key: 'estado', label: 'Estado' },
        { key: 'fechaRegistro', label: 'Registro' },
      ],
      rows: this.usuarios().map((u) => ({
        ...u,
        entidad: u.entidad || '—',
        _entidad: u.entidad || '—',
        _ts: parseFechaTs(u.fechaRegistro),
      })),
    },
  }));

  readonly crBuild = computed(() => {
    const ds = this.crDataset();
    const schema = this.crSchemas()[ds];
    const cols = this.crCols();
    const selCols = schema.fields.filter((f) => cols[f.key] !== false);
    let rows = schema.rows;

    const est = this.crEstado();
    if (schema.estados.length && est !== 'todos') {
      rows = rows.filter((r) => r._estadoRaw === est || r._etapaNorm === est || r.estado === est || ETAPA_LABEL[r._estadoRaw] === est);
    }

    const ent = this.crEntidad();
    if (ent !== 'todas') {
      rows = rows.filter((r) => r._entidad === ent);
    }

    const dz = this.crDesde() ? parseFechaTs(this.crDesde()) : 0;
    const hz = this.crHasta() ? parseFechaTs(this.crHasta()) : 0;
    if (dz) rows = rows.filter((r) => r._ts && r._ts >= dz);
    if (hz) rows = rows.filter((r) => r._ts && r._ts <= hz);

    return { schema, selCols, rows };
  });

  readonly crPreviewCount = computed(() => this.crBuild().rows.length);

  ngOnInit(): void {
    this.cargarDatos();
    this.tourService.checkAutoStart('saip_tour_admin', this.tourSteps);
  }

  cargarDatos(): void {
    this.tourService.endTourFor('saip_tour_admin');
    if (this.saving()) return;
    ++this.generation;
    this.reads.unsubscribe();
    this.reads = new Subscription();
    this.loading.set(true);
    this.loadErrors.set({});
    this.resourceStates.set(Object.fromEntries(['entidades', 'solicitudes', 'apelaciones', 'usuarios', 'actividad', 'apelStats', 'ttaipStats', 'general', 'ranking', 'distribution'].map(key => [key, 'loading'])));
    this.entidadesRaw.set([]); this.solicitudes.set([]); this.apelaciones.set([]); this.usuariosRaw.set([]);
    this.actividadReciente.set([]); this.estadisticasGenerales.set(null); this.rankingEntidadesApi.set(null);
    this.apelacionesStatsBackend.set(null); this.ttaipStatsBackend.set(null); this.distribucionEstados.set(null);
    this.entPage.set(1); this.userPage.set(1);
    this.pendingReads = 10;
    this.request('entidades', this.entidadService.findAll(), data => this.entidadesRaw.set(data), data => Array.isArray(data) && data.every(e => e && Number.isSafeInteger(e.id) && typeof e.nombre === 'string' && typeof e.activa === 'boolean'));
    this.request('solicitudes', this.solicitudService.findAll(), data => this.solicitudes.set(data), Array.isArray);
    this.request('apelaciones', this.apelacionService.findAll(), data => this.apelaciones.set(data), Array.isArray);
    this.request('usuarios', this.usuarioService.findAll(), data => this.usuariosRaw.set(data), data => Array.isArray(data) && data.every(u => u && Number.isSafeInteger(u.id) && typeof u.email === 'string' && typeof u.activo === 'boolean' && ['CIUDADANO', 'FUNCIONARIO', 'TTAIP', 'ADMINISTRADOR'].includes(u.tipoUsuario)));
    this.request('actividad', this.estadisticasService.getActividadReciente(15), data => this.actividadReciente.set(data), Array.isArray);
    this.request('apelStats', this.estadisticasService.getApelacionesEstadisticas(), data => this.apelacionesStatsBackend.set(data), data => hasNumbers(data, ['resueltosFundado', 'resueltosInfundado', 'resueltosFundadoEnParte', 'resueltosInfundadoEnParte', 'resueltosImprocedente', 'resueltosEsteseALoResuelto', 'resueltosNulidadActo', 'tenerPorNoPresentado', 'conclusionSustraccion', 'conclusionDesistimiento']));
    this.request('ttaipStats', this.estadisticasService.getTtaipEstadisticas(), data => this.ttaipStatsBackend.set(data), data => hasNumbers(data, ['pendientesAdmision', 'pendientesElevacion', 'enProceso', 'enSubsanacion', 'resueltas']));
    this.request('general', this.estadisticasService.getGeneral(), data => this.estadisticasGenerales.set(data), data => hasNumbers(data, ['totalSolicitudes', 'totalUsuarios', 'totalEntidades', 'totalApelaciones', 'apelacionesResueltas', 'solicitudesPendientes', 'solicitudesRespondidas', 'solicitudesVencidas']));
    this.request('ranking', this.estadisticasService.getRankingEntidades(), data => this.rankingEntidadesApi.set(data), Array.isArray);
    this.request('distribution', this.estadisticasService.getDistribucionEstados(), data => this.distribucionEstados.set(data), data => !!data && typeof data === 'object');
  }

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
    this.searchTerm.set(''); this.entPage.set(1); this.userPage.set(1);
  }

  startTour(): void {
    this.tourService.startTour('saip_tour_admin', this.tourSteps);
  }

  get isFirstVisit(): boolean {
    return this.tourService.isFirstVisit('saip_tour_admin');
  }

  mostrarMensaje(msg: string): void {
    clearTimeout(this.messageTimer);
    this.mensaje.set(msg);
    this.messageTimer = setTimeout(() => this.mensaje.set(''), 4000);
  }

  // ── Modales y operaciones de Entidades ──────────────────────────────────
  abrirModalEntidad(mode: 'create' | 'edit' | 'view', data: EntityRow | null = null): void {
    if (this.saving()) return;
    this.error.set('');
    if (mode === 'create') {
      this.entFormNombre.set('');
      this.entFormAcronimo.set('');
      this.entFormEstado.set('Activa');
    } else if (data) {
      this.entFormNombre.set(data.nombre);
      this.entFormAcronimo.set(data.acronimo);
      this.entFormEstado.set(data.estado);
    }
    this.entModal.set({ mode, data });
  }

  cerrarModalEntidad(confirmed = false): void {
    if (this.saving() && !confirmed) return;
    this.entModal.set(null);
  }

  guardarEntidad(): void {
    const modal = this.entModal();
    if (!modal || modal.mode === 'view' || this.saving()) return;
    const nombre = this.entFormNombre().trim();
    const acronimo = this.entFormAcronimo().trim().toUpperCase();
    const estado = this.entFormEstado();

    if (nombre.length < 3 || !acronimo) {
      this.error.set('Complete el nombre y acrónimo de la entidad');
      return;
    }

    this.error.set(''); this.mensaje.set('');
    this.saving.set(true);
    if (modal.mode === 'create') {
      this.writes.add(this.entidadService.crear({ nombre, acronimo, estado }).pipe(finalize(() => this.saving.set(false))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (created) => {
          if (!Number.isSafeInteger(created?.id) || created.id <= 0 || created.acronimo !== acronimo) { this.error.set('No se pudo confirmar el alta. Consulte el listado antes de reintentar.'); return; }
          this.cerrarModalEntidad(true);
          this.entidadesRaw.update((prev) => [...prev, created]);
          this.mostrarMensaje('Entidad creada correctamente');
        },
        error: (err) => {
          const detail = this.failureMessage(err);
          this.error.set(detail);
        }
      }));
    } else if (modal.data) {
      const numId = Number(modal.data.id);
      if (!isNaN(numId)) {
        this.writes.add(this.entidadService.actualizar(numId, { nombre, acronimo, estado }).pipe(finalize(() => this.saving.set(false))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (updated) => {
            if (updated?.id !== numId) { this.error.set('No se pudo confirmar la actualización. Consulte el listado antes de reintentar.'); return; }
            this.cerrarModalEntidad(true);
            this.entidadesRaw.update((prev) => prev.map((e) => (e.id === numId ? updated : e)));
            this.mostrarMensaje('Entidad actualizada en el sistema');
          },
          error: (err) => {
            const detail = this.failureMessage(err);
            this.error.set(detail);
          }
        }));
      }
    }
  }

  eliminarEntidad(e: EntityRow): void {
    if (this.saving()) return;
    this.confirm.set({
      titulo: 'Dar de baja la entidad',
      detalle: `¿Confirma dar de baja a «${e.nombre}»? La baja es lógica y preserva el histórico del sistema.`,
      onOk: () => {
        if (this.saving()) return;
        this.confirm.set(null);
        const numId = Number(e.id);
        if (!isNaN(numId)) {
          this.saving.set(true);
          this.entidadService.cambiarEstado(numId, 'Inactiva').pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
            next: updated => {
              if (updated?.id !== numId || updated.activa !== false) { this.error.set('No se pudo confirmar la baja. Consulte el listado.'); return; }
              this.entidadesRaw.update(prev => prev.map(item => item.id === numId ? updated : item));
              this.mostrarMensaje('Entidad dada de baja');
            },
            error: (err) => {
              const detail = this.failureMessage(err);
              this.error.set(detail);
            }
          });
        }
      }
    });
  }

  // ── Modales y operaciones de Usuarios ───────────────────────────────────
  abrirModalUsuario(mode: 'create' | 'edit' | 'view', data: UserRow | null = null): void {
    if (this.saving()) return;
    this.error.set('');
    if (mode === 'create') {
      this.userFormNombre.set('');
      this.userFormEmail.set('');
      this.userFormTipo.set('Ciudadano');
      this.userFormEntidad.set('');
      this.userFormEstado.set('Activo');
    } else if (data) {
      this.userFormNombre.set(data.nombre);
      this.userFormEmail.set(data.email);
      this.userFormTipo.set(data.tipo);
      this.userFormEntidad.set(String(this.usuariosRaw().find(u => u.id === Number(data.id))?.entidadId ?? ''));
      this.userFormEstado.set(data.estado);
    }
    this.userModal.set({ mode, data });
  }

  cerrarModalUsuario(confirmed = false): void {
    if (this.saving() && !confirmed) return;
    this.userModal.set(null);
  }

  usuarioCreado(created: UsuarioAdmin): void {
    this.usuariosRaw.update((users) => [...users, created]);
    this.mostrarMensaje('Usuario creado correctamente en el sistema');
    this.cerrarModalUsuario();
  }

  guardarUsuario(): void {
    const modal = this.userModal();
    if (!modal || modal.mode !== 'edit' || this.saving()) return;
    const nombre = this.userFormNombre().trim();
    const email = this.userFormEmail().trim();
    const tipo = this.userFormTipo();
    const entidad = this.userFormEntidad().trim() || undefined;
    const estado = this.userFormEstado();

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (nombre.length < 2 || !emailValid) {
      this.error.set('Complete un nombre válido y un correo electrónico formal');
      return;
    }

    const tipoBackend: UsuarioAdmin['tipoUsuario'] =
      tipo === 'Funcionario' ? 'FUNCIONARIO' :
      tipo === 'TTAIP' ? 'TTAIP' :
      tipo === 'Administrador' ? 'ADMINISTRADOR' : 'CIUDADANO';

    let entidadId: number | undefined = undefined;
    if (entidad) {
      const matchEnt = this.entidadesRaw().find(e => String(e.id) === entidad);
      if (matchEnt?.id) {
        entidadId = matchEnt.id;
      }
    }

    if (tipoBackend === 'FUNCIONARIO' && entidad && !entidadId) {
      this.error.set('Seleccione una entidad registrada.'); return;
    }
    if (modal.data) {
      const numId = Number(modal.data.id);
      if (!isNaN(numId)) {
        this.error.set('');
        this.saving.set(true);
        this.writes.add(this.usuarioService.actualizar(numId, {
          email,
          nombre,
          tipoUsuario: tipoBackend,
          activo: estado === 'Activo',
          entidadId
        }).pipe(finalize(() => this.saving.set(false))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (updated) => {
            if (updated?.id !== numId) { this.error.set('No se pudo confirmar la actualización. Consulte el listado antes de reintentar.'); return; }
            this.cerrarModalUsuario(true);
            this.usuariosRaw.update((prev) => prev.map((u) => (u.id === numId ? updated : u)));
            this.mostrarMensaje('Usuario actualizado en el sistema');
          },
          error: (err) => {
            const detail = this.failureMessage(err);
            this.error.set(detail);
          }
        }));
      }
    }
  }

  eliminarUsuario(u: UserRow): void {
    if (this.saving()) return;
    this.confirm.set({
      titulo: 'Eliminar usuario',
      detalle: `¿Confirma eliminar a «${u.nombre}»? Perderá el acceso y sus credenciales serán revocadas.`,
      onOk: () => {
        if (this.saving()) return;
        this.confirm.set(null);
        const numId = Number(u.id);
        if (!isNaN(numId)) {
          this.saving.set(true);
          this.usuarioService.eliminar(numId).pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.usuariosRaw.update((prev) => prev.filter((x) => x.id !== numId));
              this.mostrarMensaje('Usuario eliminado del sistema');
            },
            error: (err) => {
              const detail = this.failureMessage(err);
              this.error.set(detail);
            }
          });
        }
      }
    });
  }

  userInitials(nombre: string): string {
    if (!nombre) return 'US';
    const parts = nombre.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0]?.slice(0, 2) || 'US').toUpperCase();
  }

  // ── Motores de exportación (CSV, XLSX, PDF profesional) ─────────────────
  downloadFile(content: string, name: string, mime: string): void { downloadFile(content, name, mime); }
  csvOf(rows: any[][]): string { return csvOf(rows); }
  xlsxOf(rows: any[], sheet: string, file: string): void { xlsxOf(rows, sheet, file); }
  pdfPro(options: Parameters<typeof pdfPro>[0]): void { pdfPro(options); }

  pdfInforme(): void { this.exportarReporte('consolidado', 'pdf'); }

  // ── 6 Reportes Estándar (Consumo oficial de ReportesService) ───────────
  private requestReport<T>(source: Observable<T>, receive: (data: T) => void): void {
    this.exporting.set(true);
    source.pipe(finalize(() => this.exporting.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: receive,
      error: () => this.error.set('No se pudo recuperar el reporte del servidor. No se generó ningún archivo.'),
    });
  }

  exportarReporte(tipo: string, formato: 'pdf' | 'xlsx' | 'csv'): void {
    if (this.exporting()) return;
    this.error.set(''); this.mensaje.set('');
    const subtitle = 'Datos recuperados del servidor · exportación de consulta';
    const receiveRows = (build: (rows: any[], format: typeof formato, subtitle: string) => void) => (res: { datos?: unknown }) => {
      if (!Array.isArray(res?.datos)) { this.error.set('Información del reporte no disponible.'); return; }
      build.call(this, res.datos, formato, subtitle);
    };
    if (tipo === 'solicitudes') {
      this.requestReport(this.reportesService.getReporteSolicitudes(), receiveRows(this.procesarReporteSolicitudes));
    } else if (tipo === 'entidades') {
      this.requestReport(this.reportesService.getReporteEntidades(), receiveRows(this.procesarReporteEntidades));
    } else if (tipo === 'apelaciones') {
      this.requestReport(this.reportesService.getReporteApelaciones(), receiveRows(this.procesarReporteApelaciones));
    } else if (tipo === 'tiempos') {
      this.procesarReporteTiempos(formato);
    } else if (tipo === 'consolidado') {
      this.requestReport(this.reportesService.getResumenEjecutivo(), res => {
        if (!res?.solicitudes || !res?.apelaciones || !res?.usuarios) { this.error.set('Información del reporte no disponible.'); return; }
        this.procesarReporteConsolidado(res, formato, subtitle);
      });
    } else if (tipo === 'usuarios') {
      // /usuarios includes every account role. Profile reports alone omit administrators and TTAIP.
      this.requestReport(this.usuarioService.findAll(), users => this.procesarReporteUsuarios(users, formato));
    }
  }

  private procesarReporteSolicitudes(apiData: any[] | null, formato: 'pdf' | 'xlsx' | 'csv', subtitle: string): void {
    const list = apiData ?? [];
    const rows = list.map((s: any) => [
      s.expediente || 'SAIP',
      s.ciudadano || s.ciudadanoNombre || 'Administrado',
      s.entidad || s.entidadNombre || s.entidadAcronimo || '—',
      ETAPA_LABEL[s.estado] || s.estado || '—',
      s.fechaSolicitud || s.fechaPresentacion || '—',
      s.fechaLimite || 'No disponible'
    ]);
    const head = [['Expediente', 'Ciudadano', 'Entidad', 'Estado', 'F. Presentación', 'Plazo']];
    if (formato === 'pdf') {
      this.pdfPro({ title: 'Reporte de Solicitudes SAIP', subtitle: `${rows.length} solicitudes`, head, body: rows, foot: [[{ content: `Total: ${rows.length} solicitudes`, colSpan: 6 }]], file: 'reporte-solicitudes.pdf' });
    } else if (formato === 'xlsx') {
      this.xlsxOf(list.map((s: any) => ({
        Expediente: s.expediente || 'SAIP',
        Ciudadano: s.ciudadano || s.ciudadanoNombre || 'Administrado',
        Entidad: s.entidad || s.entidadNombre || s.entidadAcronimo || '—',
        Estado: ETAPA_LABEL[s.estado] || s.estado || '—',
        Fecha: s.fechaSolicitud || s.fechaPresentacion || '—'
      })), 'Solicitudes', 'reporte-solicitudes.xlsx');
    } else {
      this.downloadFile(this.csvOf([head[0], ...rows]), 'reporte-solicitudes.csv', 'text/csv');
    }
    this.mostrarMensaje(`Reporte de solicitudes (${formato.toUpperCase()}) generado con éxito`);
  }

  private procesarReporteEntidades(apiData: any[] | null, formato: 'pdf' | 'xlsx' | 'csv', subtitle: string): void {
    const list = apiData ?? [];
    const rows = list.map((e: any) => [
      e.nombre,
      e.acronimo || e.nombre,
      e.totalSolicitudes ?? e.solicitudesAsignadas ?? 0,
      e.solicitudesPendientes ?? e.pendientes ?? 0,
      e.solicitudesRespondidas ?? e.respondidas ?? 0,
      e.vencidas ?? 'No disponible',
      (e.totalSolicitudes ? Math.round(((e.solicitudesRespondidas ?? 0) / e.totalSolicitudes) * 100) : 0) + '%'
    ]);
    const head = [['Entidad', 'Acrónimo', 'Asignadas', 'Pendientes', 'Respondidas', 'Vencidas', 'Respuesta %']];
    if (formato === 'pdf') {
      const totAsig = list.reduce((s: number, e: any) => s + (e.totalSolicitudes ?? e.solicitudesAsignadas ?? 0), 0);
      const totPend = list.reduce((s: number, e: any) => s + (e.solicitudesPendientes ?? e.pendientes ?? 0), 0);
      const totResp = list.reduce((s: number, e: any) => s + (e.solicitudesRespondidas ?? e.respondidas ?? 0), 0);
      const totVenc = 'No disponible';
      this.pdfPro({
        title: 'Reporte de Entidades', subtitle, head, body: rows,
        foot: [[{ content: 'Totales', colSpan: 2 }, totAsig, totPend, totResp, totVenc, (totAsig ? Math.round(totResp / totAsig * 100) : 0) + '%']],
        file: 'reporte-entidades.pdf'
      });
    } else if (formato === 'xlsx') {
      this.xlsxOf(list.map((e: any) => ({
        Entidad: e.nombre,
        Acronimo: e.acronimo || e.nombre,
        Asignadas: e.totalSolicitudes ?? e.solicitudesAsignadas ?? 0,
        Pendientes: e.solicitudesPendientes ?? e.pendientes ?? 0,
        Respondidas: e.solicitudesRespondidas ?? e.respondidas ?? 0,
        Vencidas: e.vencidas ?? 'No disponible',
        'Respuesta %': e.tasaCumplimiento !== undefined ? e.tasaCumplimiento : (e.totalSolicitudes ? Math.round(((e.solicitudesRespondidas ?? 0) / e.totalSolicitudes) * 100) : 0)
      })), 'Entidades', 'reporte-entidades.xlsx');
    } else {
      this.downloadFile(this.csvOf([head[0], ...rows]), 'reporte-entidades.csv', 'text/csv');
    }
    this.mostrarMensaje(`Reporte de entidades (${formato.toUpperCase()}) generado con éxito`);
  }

  private procesarReporteApelaciones(apiData: any[] | null, formato: 'pdf' | 'xlsx' | 'csv', subtitle: string): void {
    const list = apiData ?? [];
    const rows = list.map((a: any) => [
      a.expediente || '—',
      a.solicitudExpediente || (a as any).saip || '—',
      a.ciudadano || (a as any).ciudadanoNombre || 'Administrado',
      ETAPA_LABEL[a.estado] || a.estado || '—',
      a.fechaApelacion || (a as any).fecha || '—'
    ]);
    const head = [['Expediente', 'SAIP Original', 'Ciudadano', 'Estado', 'F. Presentación']];
    if (formato === 'pdf') {
      this.pdfPro({
        title: 'Reporte de Apelaciones (TTAIP)',
        subtitle: `${rows.length} apelaciones recuperadas`,
        head, body: rows,
        foot: [[{ content: `Total: ${rows.length}`, colSpan: 5 }]],
        file: 'reporte-apelaciones.pdf'
      });
    } else if (formato === 'xlsx') {
      this.xlsxOf(list.map((a: any) => ({
        Expediente: a.expediente,
        SAIP: a.solicitudExpediente || (a as any).saip || '—',
        Estado: ETAPA_LABEL[a.estado] || a.estado || '—',
        Fecha: a.fechaApelacion || (a as any).fecha || '—'
      })), 'Apelaciones', 'reporte-apelaciones.xlsx');
    } else {
      this.downloadFile(this.csvOf([head[0], ...rows]), 'reporte-apelaciones.csv', 'text/csv');
    }
    this.mostrarMensaje(`Reporte de apelaciones (${formato.toUpperCase()}) generado con éxito`);
  }

  private procesarReporteTiempos(_formato: 'pdf' | 'xlsx' | 'csv'): void {
    this.error.set('No disponible: el contrato actual no proporciona tiempos de respuesta por entidad para este reporte.');
  }

  private procesarReporteConsolidado(res: any | null, formato: 'pdf' | 'xlsx' | 'csv', subtitle: string): void {
    const totSol = res?.solicitudes?.total ?? 'No disponible';
    const enProc = res?.solicitudes?.pendientes ?? 'No disponible';
    const resp = res?.solicitudes?.respondidas ?? 'No disponible';
    const venc = res?.solicitudes?.vencidas ?? 'No disponible';
    const totApel = res?.apelaciones?.total ?? 'No disponible';
    const resApel = res?.apelaciones?.resueltas ?? 'No disponible';
    const totEnt = res?.usuarios?.entidades ?? 'No disponible';
    const totUsr = res?.usuarios?.total ?? 'No disponible';

    const rows = [
      ['Total de solicitudes', totSol],
      ['En proceso', enProc],
      ['Respondidas', resp],
      ['Vencidas', venc],
      ['Apelaciones', totApel],
      ['Apelaciones resueltas', resApel],
      ['Entidades registradas', totEnt],
      ['Usuarios registrados', totUsr]
    ];
    const head = [['Métrica', 'Valor']];
    if (formato === 'pdf') {
      this.pdfPro({ title: 'Reporte Consolidado del Sistema', subtitle, head, body: rows, file: 'reporte-consolidado.pdf' });
    } else if (formato === 'xlsx') {
      this.xlsxOf([{ Total: totSol, EnProceso: enProc, Respondidas: resp, Vencidas: venc, Apelaciones: totApel, Resueltas: resApel, Entidades: totEnt, Usuarios: totUsr }], 'Consolidado', 'reporte-consolidado.xlsx');
    } else {
      this.downloadFile(this.csvOf([head[0], ...rows]), 'reporte-consolidado.csv', 'text/csv');
    }
    this.mostrarMensaje(`Reporte consolidado (${formato.toUpperCase()}) generado con éxito`);
  }

  private procesarReporteUsuarios(users: UsuarioAdmin[], formato: 'pdf' | 'xlsx' | 'csv'): void {
    if (!Array.isArray(users)) { this.error.set('Información del reporte de usuarios no disponible.'); return; }
    const rows = users.map(u => [u.nombre || 'No disponible', u.email, u.tipoUsuario, u.fechaRegistro || 'No disponible', u.activo ? 'Activo' : 'Inactivo']);
    const head = [['Nombre', 'Email', 'Tipo', 'Registro', 'Estado']];
    if (formato === 'pdf') {
      this.pdfPro({ title: 'Reporte de usuarios registrados', subtitle: rows.length + ' cuentas', head, body: rows, file: 'reporte-usuarios.pdf' });
    } else if (formato === 'xlsx') {
      this.xlsxOf(rows.map(row => Object.fromEntries(head[0].map((key, i) => [key, row[i]]))), 'Usuarios', 'reporte-usuarios.xlsx');
    } else {
      this.downloadFile(this.csvOf([head[0], ...rows]), 'reporte-usuarios.csv', 'text/csv');
    }
    this.mostrarMensaje('Reporte de usuarios generado con datos del servidor');
  }

  exportEntidadesCSV(): void {
    if (!this.ready('entidades', 'solicitudes')) return;
    const head = ['Entidad', 'Acrónimo', 'Asignadas', 'Pendientes', 'Vencidas', 'Respuesta %', 'Estado'];
    const rows = this.filteredEntities().map((e) => [e.nombre, e.acronimo, e.solicitudesAsignadas, e.pendientes, e.vencidas, e.tasaCumplimiento + '%', e.estado]);
    this.downloadFile(this.csvOf([head, ...rows]), 'entidades.csv', 'text/csv');
    this.mostrarMensaje('Listado de entidades exportado en CSV');
  }

  exportUsuariosCSV(): void {
    if (!this.ready('usuarios')) return;
    const head = ['Nombre', 'Email', 'Tipo', 'Registro', 'Estado'];
    const rows = this.filteredUsers().map((u) => [u.nombre, u.email, u.tipo, u.fechaRegistro, u.estado]);
    this.downloadFile(this.csvOf([head, ...rows]), 'usuarios.csv', 'text/csv');
    this.mostrarMensaje('Listado de usuarios exportado en CSV');
  }

  // ── Generador personalizado ─────────────────────────────────────────────
  toggleCrCol(key: string): void {
    const current = this.crCols()[key] !== false;
    this.crCols.update((m) => ({ ...m, [key]: !current }));
  }

  isCrColActive(key: string): boolean {
    return this.crCols()[key] !== false;
  }

  generateCustom(): void {
    if (!this.customReady()) { this.error.set('Los datos de este reporte no están disponibles. Reintente la consulta.'); return; }
    const dz = this.crDesde() ? parseFechaTs(this.crDesde()) : 0;
    const hz = this.crHasta() ? parseFechaTs(this.crHasta()) : 0;
    if (dz && hz && dz > hz) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final');
      return;
    }

    const { schema, selCols, rows } = this.crBuild();
    if (!selCols.length) {
      this.error.set('Seleccione al menos una columna para exportar');
      return;
    }

    if (!rows.length) {
      this.error.set('No hay registros coincidentes con los filtros seleccionados');
      return;
    }

    const head = selCols.map((f) => f.label);
    const body = rows.map((r) => selCols.map((f) => r[f.key] ?? '—'));
    const fmt = this.crFormato();

    if (fmt === 'pdf') {
      this.pdfPro({
        title: `Reporte personalizado · ${schema.label}`,
        subtitle: `${rows.length} registros · ${selCols.length} columnas`,
        head: [head],
        body,
        foot: [[{ content: `Total: ${rows.length} registros`, colSpan: head.length }]],
        file: 'reporte-personalizado.pdf'
      });
    } else if (fmt === 'xlsx') {
      this.xlsxOf(rows.map((r) => Object.fromEntries(selCols.map((f) => [f.label, r[f.key] ?? '']))), 'Personalizado', 'reporte-personalizado.xlsx');
    } else {
      this.downloadFile(this.csvOf([head, ...body]), 'reporte-personalizado.csv', 'text/csv');
    }

    this.mostrarMensaje(`Reporte personalizado generado (${rows.length} registros)`);
  }

  // ── Configuración operativa ─────────────────────────────────────────────
  guardarConfiguracion(): void {
    if (this.configService.loadState() !== 'ready') return;
    this.configService.save().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ok) => {
        if (ok) {
          this.mostrarMensaje('Configuración guardada en el servidor.');
        } else {
          this.error.set('No se pudo guardar la configuración en el servidor');
        }
      },
      error: (err) => {
        const detail = this.failureMessage(err);
        this.error.set(detail);
      }
    });
  }

  cancelarConfiguracion(): void {
    this.configService.cancel();
    this.mostrarMensaje('Cambios descartados');
  }
}
