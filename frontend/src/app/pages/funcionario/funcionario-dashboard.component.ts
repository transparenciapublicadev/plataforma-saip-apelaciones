import { Component, ChangeDetectionStrategy, OnInit, signal, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { EstadoSolicitud, Solicitud } from '../../models/solicitud.model';
import { ElevacionApelacionTtaip } from '../../models/apelacion.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';

import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { PaginationComponent } from '../../shared/pagination.component';

type BucketKey = 'todas' | 'san' | 'hoy' | 'semana' | 'plazo' | 'respondidas';

interface BucketMeta {
  key: BucketKey;
  label: string;
  eyebrow: string;
  icon: 'alert' | 'flame' | 'calendar' | 'check' | 'inbox';
  color: string;
  bg: string;
}

interface QueueItem {
  solicitud: Solicitud;
  bucket: Exclude<BucketKey, 'todas'>;
  diasRestantes: number;
  iniciales: string;
  prioridad: 'alta' | 'media' | 'baja';
  tema: string;
}

interface DistribucionDia {
  dia: number;
  count: number;
  width: number;
  color: string;
}

import {
  LucideBuilding2, LucideCompass, LucideTrendingUp, LucideShieldAlert,
  LucideArrowRight, LucideAlertTriangle, LucideFlame, LucideCalendar,
  LucideCheckCircle2, LucideInbox, LucideSearch, LucideUser,
  LucideSend, LucideChevronRight, LucideLayers, LucideTarget
} from '@lucide/angular';

@Component({
  selector: 'app-funcionario-dashboard',
  imports: [
    RouterLink, FormsModule, DatePipe,
    StatusBadgeComponent, PaginationComponent,
    LucideBuilding2, LucideCompass, LucideTrendingUp, LucideShieldAlert,
    LucideArrowRight, LucideAlertTriangle, LucideFlame, LucideCalendar,
    LucideCheckCircle2, LucideInbox, LucideSearch, LucideUser,
    LucideSend, LucideChevronRight, LucideLayers, LucideTarget
  ],
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioDashboardComponent implements OnInit {
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);
  private readonly tourService = inject(GuidedTourService);

  readonly tourSteps: TourStep[] = [
    { selector: '[data-tour="e-hero"]', title: 'Tu día de un vistazo', body: 'Aquí ves la fecha, cuántas solicitudes tienes en bandeja y cuántas están en silencio administrativo (SAN) o vencen hoy.' },
    { selector: '[data-tour="e-cumplimiento"]', title: 'Cumplimiento del plazo legal', body: 'Tu porcentaje de solicitudes respondidas dentro de los 10 días hábiles de ley, comparado con el mes anterior.' },
    { selector: '[data-tour="e-buckets"]', title: 'Bandeja por SLA', body: 'El corazón de tu trabajo: cada columna agrupa las solicitudes por urgencia de plazo. Toca una para enfocar esa cola.' },
    { selector: '[data-tour="e-cola"]', title: 'Cola enfocada', body: 'La lista de solicitudes de la bandeja seleccionada, ordenadas por vencimiento. Desde aquí respondes o revisas cada expediente.', align: 'start', onEnter: () => this.selectBucket('san') },
    { selector: '[data-tour="e-carga"]', title: 'Distribución de carga', body: 'Un vistazo a cuántas solicitudes vencen en cada día hábil restante, para anticipar tu semana.' },
    { selector: '[data-tour="e-batch"]', title: 'Oportunidad de batch', body: 'Temas que se repiten entre las solicitudes pendientes: te conviene preparar respuestas tipo para resolver en lote.' },
    { selector: '[data-tour="e-norma"]', title: 'Norma aplicable', body: 'Recordatorio de los plazos legales clave (Ley N° 27806) y qué ocurre si vencen: silencio negativo y derecho de apelación.' },
  ];

  private readonly plazoLegal = 10;

  readonly buckets: BucketMeta[] = [
    {
      key: 'todas',
      label: 'Todas las solicitudes',
      eyebrow: 'Vista general · sin filtro de plazo',
      icon: 'inbox',
      color: 'var(--brand-700)',
      bg: 'var(--brand-subtle)'
    },
    {
      key: 'san',
      label: 'Vencidas (SAN)',
      eyebrow: 'Silencio negativo · acción urgente',
      icon: 'alert',
      color: 'var(--brand-700)',
      bg: 'var(--brand-subtle)'
    },
    {
      key: 'hoy',
      label: 'Hoy o mañana',
      eyebrow: 'Vencen en ≤1 día háb.',
      icon: 'flame',
      color: 'var(--brand-600)',
      bg: 'rgba(200,16,46,0.06)'
    },
    {
      key: 'semana',
      label: 'Esta semana',
      eyebrow: '2 a 5 días hábiles',
      icon: 'calendar',
      color: 'var(--warning)',
      bg: 'rgba(217,119,6,0.10)'
    },
    {
      key: 'plazo',
      label: 'Cómodo en plazo',
      eyebrow: 'Más de 5 días háb.',
      icon: 'check',
      color: 'var(--success)',
      bg: 'rgba(5,150,105,0.10)'
    },
    {
      key: 'respondidas',
      label: 'Respondidas',
      eyebrow: 'Cerradas este periodo',
      icon: 'inbox',
      color: 'var(--info)',
      bg: 'rgba(29,78,216,0.08)'
    }
  ];

  solicitudes = signal<Solicitud[]>([]);
  loading = signal<boolean>(true);
  error = signal<string>('');
  elevacionesPendientes = signal<ElevacionApelacionTtaip[]>([]);
  elevacionEnProceso = signal<number | null>(null);
  referenciasElevacion: Record<number, string> = {};

  selectedBucket = signal<BucketKey>('san');
  busqueda = signal<string>('');

  nombreEntidad = signal<string>('');
  nombreFuncionario = signal<string>('');
  entidadId = signal<number>(0);

  readonly donutRadius = 26;
  readonly donutCirc = 2 * Math.PI * this.donutRadius;

  readonly fechaHoy = computed(() => {
    return new Date().toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  });

  readonly queueItems = computed(() => this.solicitudes().map((solicitud) => this.mapSolicitud(solicitud)));

  readonly counts = computed<Record<BucketKey, number>>(() => {
    const base: Record<BucketKey, number> = {
      todas: this.queueItems().length,
      san: 0,
      hoy: 0,
      semana: 0,
      plazo: 0,
      respondidas: 0
    };

    for (const item of this.queueItems()) {
      base[item.bucket] += 1;
    }

    return base;
  });

  readonly totalActivas = computed(() => {
    const c = this.counts();
    return c.san + c.hoy + c.semana + c.plazo;
  });

  readonly cumplimiento = computed(() => {
    const c = this.counts();
    const cerradas = c.respondidas + c.san;
    if (cerradas <= 0) return 100;
    return Math.round((c.respondidas / cerradas) * 100);
  });

  readonly donutAccent = computed(() => {
    const val = this.cumplimiento();
    if (val >= 80) return 'var(--success)';
    if (val >= 60) return 'var(--warning)';
    return 'var(--brand-700)';
  });

  readonly donutOffset = computed(() => {
    const value = Math.max(0, Math.min(100, this.cumplimiento()));
    return this.donutCirc - (value / 100) * this.donutCirc;
  });

  readonly bucketActivoMeta = computed(() => {
    const selected = this.selectedBucket();
    return this.buckets.find((bucket) => bucket.key === selected) ?? this.buckets[0];
  });

  readonly filtradas = computed(() => {
    const bucket = this.selectedBucket();
    const query = this.busqueda().trim().toLowerCase();

    const list = bucket === 'todas'
      ? this.queueItems()
      : this.queueItems().filter((item) => item.bucket === bucket);

    const byQuery = query
      ? list.filter((item) => {
          const expediente = (item.solicitud.expediente || '').toLowerCase();
          const ciudadano = (item.solicitud.ciudadanoNombre || '').toLowerCase();
          const asunto = (item.solicitud.asunto || '').toLowerCase();
          return expediente.includes(query) || ciudadano.includes(query) || asunto.includes(query);
        })
      : list;

    return [...byQuery].sort((a, b) => this.prioridadSortValue(a) - this.prioridadSortValue(b));
  });

  readonly distribucionDias = computed<DistribucionDia[]>(() => {
    const bins = new Map<number, number>();
    for (let day = 0; day <= this.plazoLegal; day += 1) {
      bins.set(day, 0);
    }

    for (const item of this.queueItems()) {
      if (item.bucket === 'hoy' || item.bucket === 'semana' || item.bucket === 'plazo') {
        const day = Math.max(0, Math.min(this.plazoLegal, item.diasRestantes));
        bins.set(day, (bins.get(day) || 0) + 1);
      }
    }

    const max = Math.max(...Array.from(bins.values()), 1);

    const result: DistribucionDia[] = [];
    for (let day = 0; day <= this.plazoLegal; day += 1) {
      const count = bins.get(day) || 0;
      const danger = day <= 1;
      const warn = day <= 5 && day > 1;
      const color = danger ? 'var(--brand-700)' : warn ? 'var(--warning)' : 'var(--success)';
      result.push({
        dia: day,
        count,
        width: count === 0 ? 4 : (count / max) * 100,
        color
      });
    }

    return result;
  });

  readonly topTemas = computed(() => {
    const temasMap = new Map<string, number>();

    for (const item of this.queueItems()) {
      if (item.bucket === 'respondidas') continue;
      temasMap.set(item.tema, (temasMap.get(item.tema) || 0) + 1);
    }

    return Array.from(temasMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  });

  get busquedaModel(): string {
    return this.busqueda();
  }

  set busquedaModel(value: string) {
    this.busqueda.set(value);
  }

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreFuncionario.set(sesion.nombre || 'Funcionario');
      this.nombreEntidad.set(sesion.entidadNombre || 'Entidad');
      this.entidadId.set(sesion.entidadId || 0);
      this.cargarSolicitudes();
      this.cargarElevacionesPendientes();
      this.tourService.checkAutoStart('saip_tour_funcionario', this.tourSteps);
    }
  }

  readonly paginaActual = signal<number>(1);
  readonly itemsPorPagina = signal<number>(10);

  readonly totalRegistros = computed(() => this.filtradas().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.itemsPorPagina()) || 1);
  readonly inicioRegistro = computed(() => this.totalRegistros() === 0 ? 0 : (this.paginaActual() - 1) * this.itemsPorPagina() + 1);
  readonly finRegistro = computed(() => Math.min(this.paginaActual() * this.itemsPorPagina(), this.totalRegistros()));
  readonly filtradasVisibles = computed(() => {
    const start = (this.paginaActual() - 1) * this.itemsPorPagina();
    return this.filtradas().slice(start, start + this.itemsPorPagina());
  });

  selectBucket(bucket: BucketKey): void {
    this.selectedBucket.set(bucket);
    this.paginaActual.set(1);
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

  get isFirstVisit(): boolean {
    return this.tourService.isFirstVisit('saip_tour_funcionario');
  }

  startTour(): void {
    this.tourService.startTour('saip_tour_funcionario', this.tourSteps);
  }

  cargarSolicitudes(): void {
    this.loading.set(true);
    const entidadId = this.entidadId();

    if (entidadId === 0) {
      this.error.set('No se encontró la entidad');
      this.loading.set(false);
      return;
    }

    this.solicitudService.findByEntidadId(entidadId).subscribe({
      next: (data) => {
        this.solicitudes.set(data.map((solicitud) => this.normalizeSolicitudEstado(solicitud)));
        this.loading.set(false);
      },
      error: (err) => {
        const mensaje = err.error?.mensaje || err.message || 'Error desconocido';
        this.error.set(`Error al cargar solicitudes: ${mensaje} (${err.status || 'sin conexion'})`);
        this.loading.set(false);
        console.error('Error al cargar solicitudes:', err);
      }
    });
  }

  getEstadoBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'badge-warning',
      'EN_REVISION': 'badge-in-process',
      'PENDIENTE_INFORMACION': 'badge-warning',
      'RESPONDIDA': 'badge-success',
      'DENEGADA': 'badge-danger',
      'VENCIDA': 'badge-danger',
      'CONCLUIDA': 'badge-muted'
    };

    return clases[(estado || '').toUpperCase()] || 'badge-muted';
  }

  getEstadoDisplay(solicitud: Solicitud): string {
    if (isSilencioAdministrativo(solicitud)) {
      return 'SILENCIO_ADMINISTRATIVO';
    }

    return (solicitud.estado || 'SIN_ESTADO').replaceAll('_', ' ');
  }

  getPrioridadClass(prioridad: QueueItem['prioridad']): string {
    if (prioridad === 'alta') return 'pill pill-high';
    if (prioridad === 'media') return 'pill pill-medium';
    return 'pill pill-low';
  }

  getDiasColor(bucket: BucketKey): string {
    return this.buckets.find((item) => item.key === bucket)?.color ?? 'var(--brand-600)';
  }

  cargarElevacionesPendientes(): void {
    const entidadId = this.entidadId();
    if (entidadId === 0) return;

    this.apelacionService.findPendientesElevacionByEntidadId(entidadId).subscribe({
      next: (elevaciones) => this.elevacionesPendientes.set(elevaciones),
      error: (err) => {
        const mensaje = err.error?.detail || err.error?.mensaje || 'No se pudo consultar la bandeja de elevaciones';
        this.error.set(mensaje);
      }
    });
  }

  elevarApelacion(elevacion: ElevacionApelacionTtaip): void {
    const referencia = (this.referenciasElevacion[elevacion.apelacionId] || '').trim();
    if (!referencia) {
      this.error.set('Ingrese la referencia documental del expediente elevado al TTAIP');
      return;
    }

    this.elevacionEnProceso.set(elevacion.apelacionId);
    this.error.set('');
    this.apelacionService.elevar(elevacion.apelacionId, {
      responsableEntidad: this.nombreFuncionario(),
      referenciaExpedienteElevado: referencia
    }).subscribe({
      next: () => {
        delete this.referenciasElevacion[elevacion.apelacionId];
        this.elevacionEnProceso.set(null);
        this.cargarElevacionesPendientes();
      },
      error: (err) => {
        this.elevacionEnProceso.set(null);
        this.error.set(err.error?.detail || err.error?.mensaje || 'No se pudo elevar la apelación al TTAIP');
      }
    });
  }

  getDiasValor(item: QueueItem): string {
    if (item.bucket === 'san') {
      return `+${Math.abs(item.diasRestantes)}d`;
    }

    return `${item.diasRestantes}d`;
  }

  canResponder(solicitud: Solicitud): boolean {
    if (!canSendManualResponse(solicitud)) {
      return false;
    }

    const estado = (solicitud.estado || '').toUpperCase();
    return estado === 'RECEPCIONADA' || estado === 'EN_REVISION' || estado === 'PENDIENTE_INFORMACION';
  }

  logout(): void {
    this.authService.cerrarSesion();
  }

  private mapSolicitud(solicitud: Solicitud): QueueItem {
    const normalized = this.normalizeSolicitudEstado(solicitud);
    const diasRestantes = this.calcularDiasRestantes(normalized);
    const bucket = this.obtenerBucket(normalized, diasRestantes);

    return {
      solicitud: normalized,
      bucket,
      diasRestantes,
      iniciales: this.obtenerIniciales(normalized.ciudadanoNombre || 'Ciudadano'),
      prioridad: this.obtenerPrioridad(normalized, diasRestantes),
      tema: this.inferirTema(normalized.asunto || '')
    };
  }

  private normalizeSolicitudEstado(solicitud: Solicitud): Solicitud {
    const currentEstado = (solicitud.estado || '').toUpperCase();
    if (this.isSolicitudTerminal(currentEstado)) {
      return solicitud;
    }

    const respuesta = solicitud.respuesta;
    if (!respuesta?.tipoRespuesta) {
      return solicitud;
    }

    const tipoRespuesta = respuesta.tipoRespuesta.toUpperCase();
    const estado: EstadoSolicitud = tipoRespuesta.includes('DENEGACION') ? 'DENEGADA' : 'RESPONDIDA';
    return { ...solicitud, estado };
  }

  private isSolicitudTerminal(estado: string): boolean {
    return estado === 'RESPONDIDA' || estado === 'DENEGADA' || estado === 'CONCLUIDA';
  }

  private obtenerBucket(solicitud: Solicitud, diasRestantes: number): Exclude<BucketKey, 'todas'> {
    const estado = (solicitud.estado || '').toUpperCase();

    if (this.isSolicitudTerminal(estado)) {
      return 'respondidas';
    }

    if (estado === 'VENCIDA' || isSilencioAdministrativo(solicitud) || diasRestantes < 0) {
      return 'san';
    }

    if (diasRestantes <= 1) return 'hoy';
    if (diasRestantes <= 5) return 'semana';
    return 'plazo';
  }

  private obtenerPrioridad(solicitud: Solicitud, diasRestantes: number): QueueItem['prioridad'] {
    const estado = (solicitud.estado || '').toUpperCase();

    if (estado === 'VENCIDA' || isSilencioAdministrativo(solicitud) || diasRestantes <= 1) {
      return 'alta';
    }

    if (diasRestantes <= 5) {
      return 'media';
    }

    return 'baja';
  }

  private prioridadSortValue(item: QueueItem): number {
    if (item.bucket === 'san') {
      return item.diasRestantes;
    }

    if (item.bucket === 'respondidas') {
      return 1000 + item.diasRestantes;
    }

    return item.diasRestantes;
  }

  private calcularDiasRestantes(solicitud: Solicitud): number {
    if (typeof solicitud.diasRestantes === 'number') {
      return solicitud.diasRestantes;
    }

    const fechaLimite = this.parseFecha(solicitud.fechaLimite);
    if (!fechaLimite) return 0;

    return Math.ceil((fechaLimite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private obtenerIniciales(nombreCompleto: string): string {
    return nombreCompleto
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'CI';
  }

  private inferirTema(asunto: string): string {
    const texto = asunto.toLowerCase();

    if (texto.includes('presupuesto') || texto.includes('financ') || texto.includes('gasto')) return 'Presupuesto';
    if (texto.includes('contrato') || texto.includes('licitación') || texto.includes('licitacion') || texto.includes('adenda')) return 'Contratos';
    if (texto.includes('convenio')) return 'Convenios';
    if (texto.includes('planilla') || texto.includes('personal') || texto.includes('servir')) return 'Personal';
    if (texto.includes('acta') || texto.includes('sesión') || texto.includes('sesion') || texto.includes('directorio')) return 'Actas';

    return 'General';
  }

  private parseFecha(valor?: string): Date | null {
    if (!valor) return null;

    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) return fecha;

    const partes = valor.split(/[\/\-]/).map((item) => Number(item));
    if (partes.length !== 3 || partes.some((item) => Number.isNaN(item))) return null;

    if (valor.includes('/')) {
      const [dia, mes, anio] = partes;
      return new Date(anio, mes - 1, dia);
    }

    const [anio, mes, dia] = partes;
    return new Date(anio, mes - 1, dia);
  }
}
