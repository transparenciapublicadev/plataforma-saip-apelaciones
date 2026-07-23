import { Component, ChangeDetectionStrategy, OnInit, signal, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { Apelacion } from '../../models/apelacion.model';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';
import { parseISO } from 'date-fns';

interface DashboardAction {
  eyebrow: string;
  titulo: string;
  detalle: string;
  metricValue: string;
  metricUnit: string;
  ctaLabel: string;
  route: readonly (string | number)[];
  queryParams?: Record<string, string | number | boolean>;
  icon: 'alert' | 'scale' | 'check' | 'clock' | 'gavel';
  toneColor: string;
  toneBg: string;
  toneSoft: string;
  expediente: string;
  entidad: string;
}

interface TimelineStep {
  key: string;
  label: string;
  date?: string;
  meta?: string;
  status: 'done' | 'active' | 'pending' | 'skipped';
}

interface PlazoEntidadView {
  restantes: number;
  pct: number;
  tone: string;
  fechaLimite?: string;
}

interface SubsanacionView {
  dias: number;
  observaciones: string;
  expediente?: string;
}

interface GuideStep {
  num: string;
  titulo: string;
  desc: string;
  icon: 'send' | 'building' | 'scale' | 'gavel';
  color: string;
}

import {
  LucideScale, LucidePlus, LucideFileText, LucideClock, LucideCheckCircle2,
  LucideXCircle, LucideAlertTriangle, LucideChevronRight, LucideChevronDown,
  LucideBuilding2, LucideSend, LucideHelpCircle, LucidePhone, LucideMail, LucideMessageSquare
} from '@lucide/angular';

@Component({
  selector: 'app-ciudadano-dashboard',
  imports: [
    RouterLink, FormsModule, DatePipe,
    LucideScale, LucidePlus, LucideFileText, LucideClock, LucideCheckCircle2,
    LucideXCircle, LucideAlertTriangle, LucideChevronRight, LucideChevronDown,
    LucideBuilding2, LucideSend, LucideHelpCircle, LucidePhone, LucideMail, LucideMessageSquare
  ],
  templateUrl: './ciudadano-dashboard.component.html',
  styleUrl: './ciudadano-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CiudadanoDashboardComponent implements OnInit {
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly estadosEnProceso = new Set(['RECEPCIONADA', 'EN_REVISION', 'PENDIENTE_INFORMACION']);
  private readonly estadosApelacionActivos = new Set([
    'PENDIENTE_ELEVACION',
    'EN_CALIFICACION_1',
    'EN_SUBSANACION',
    'EN_CALIFICACION_2',
    'NOTIFICACION_SEGUNDA_CALIFICACION',
    'EN_RESOLUCION'
  ]);

  readonly pasosGuia: GuideStep[] = [
    {
      num: '01',
      titulo: 'Usted pide la informacion',
      desc: 'Llena un formulario sencillo indicando que informacion publica necesita y a que entidad.',
      icon: 'send',
      color: 'var(--brand-700)'
    },
    {
      num: '02',
      titulo: 'La entidad le responde',
      desc: 'Tiene 10 dias habiles para entregarle la informacion. Le avisamos por correo cuando responda.',
      icon: 'building',
      color: 'var(--info)'
    },
    {
      num: '03',
      titulo: 'Si no esta conforme, apela',
      desc: 'Puede recurrir al Tribunal dentro del plazo legal aplicable.',
      icon: 'scale',
      color: 'var(--gold-dark)'
    },
    {
      num: '04',
      titulo: 'El Tribunal decide',
      desc: 'Revisa su caso y emite una resolucion que la entidad debe acatar.',
      icon: 'gavel',
      color: 'var(--brand-700)'
    }
  ];

  readonly filtrosRapidos = ['En Proceso', 'Apelada', 'Denegada', 'Educacion', 'Vivienda'];

  todasSolicitudes = signal<Solicitud[]>([]);
  apelaciones = signal<Apelacion[]>([]);
  apelacionesSubsanacion = signal<Apelacion[]>([]);

  readonly apelacionesSubsanacionFiltradas = computed(() => {
    const principal = this.solicitudPrincipal();
    const list = this.apelacionesSubsanacion();
    
    // Si hay una solicitud seleccionada y su apelación está en subsanación,
    // la filtramos de la lista global de alertas superiores para evitar la duplicidad
    if (principal && (principal.apelacion?.estado || '').toUpperCase() === 'EN_SUBSANACION') {
      return list.filter((a) => a.id !== principal.apelacion?.id);
    }
    return list;
  });

  loading = signal<boolean>(true);
  error = signal<string>('');

  totalSolicitudes = signal<number>(0);
  enProceso = signal<number>(0);
  respondidas = signal<number>(0);
  denegadas = signal<number>(0);
  vencidas = signal<number>(0);

  nombreUsuario = signal<string>('Usuario');
  ciudadanoId = signal<number>(0);
  tieneApelables = signal<boolean>(false);

  busqueda = '';
  busquedaEnfocada = signal<boolean>(false);
  mostrarResultadosBusqueda = signal<boolean>(false);

  guideOpen = signal<boolean>(true);
  historicoOpen = signal<boolean>(false);
  showAllSecundarias = signal<boolean>(false);
  selectedSolicitudId = signal<number | null>(null);
  accionResaltada = signal<boolean>(false);

  readonly nombrePila = computed(() => this.nombreUsuario().trim().split(' ')[0] || 'Ciudadano');

  readonly solicitudesActivas = computed(() => {
    return this.todasSolicitudes().filter((solicitud) => {
      const estado = (solicitud.estado || '').toUpperCase();
      return this.estadosEnProceso.has(estado)
        || estado === 'DENEGADA'
        || estado === 'VENCIDA'
        || this.tieneApelacionActiva(solicitud);
    });
  });

  readonly solicitudPrincipal = computed(() => {
    const activas = [...this.solicitudesActivas()];
    if (!activas.length) return null;

    const selectedId = this.selectedSolicitudId();
    if (selectedId !== null) {
      const selected = activas.find((item) => item.id === selectedId);
      if (selected) return selected;
    }

    activas.sort((a, b) => this.calcularUrgenciaSolicitud(b) - this.calcularUrgenciaSolicitud(a));
    return activas[0];
  });

  readonly solicitudesSecundarias = computed(() => {
    const principal = this.solicitudPrincipal();
    if (!principal) return this.solicitudesActivas();
    return this.solicitudesActivas().filter((item) => item.id !== principal.id);
  });

  readonly secundariasVisibles = computed(() => {
    const secundarias = this.solicitudesSecundarias();
    if (this.showAllSecundarias()) return secundarias;
    return secundarias.slice(0, 6);
  });

  readonly historicas = computed(() => {
    return this.todasSolicitudes().filter((solicitud) => (solicitud.estado || '').toUpperCase() === 'RESPONDIDA');
  });

  readonly accionPrincipal = computed(() => this.construirAccionPrincipal(this.solicitudPrincipal()));
  readonly timelinePrincipal = computed(() => this.buildTimeline(this.solicitudPrincipal()));
  readonly timelineDisplaySteps = computed(() => this.timelinePrincipal().slice(0, 5));

  readonly timelineProgress = computed(() => {
    const steps = this.timelinePrincipal();
    if (!steps.length) return 0;

    const activeIdx = steps.findIndex((step) => step.status === 'active');
    const doneCount = steps.filter((step) => step.status === 'done').length;

    if (activeIdx >= 0) {
      return Math.round((activeIdx / Math.max(steps.length - 1, 1)) * 100);
    }

    return Math.round((doneCount / steps.length) * 100);
  });

  readonly timelineLineProgress = computed(() => {
    const steps = this.timelineDisplaySteps();
    if (steps.length <= 1) return 0;

    const doneCount = steps.filter((step) => step.status === 'done').length;
    return Math.min(100, Math.round((doneCount / Math.max(steps.length - 1, 1)) * 100));
  });

  readonly plazoEntidadPrincipal = computed<PlazoEntidadView | null>(() => {
    const solicitud = this.solicitudPrincipal();
    if (!solicitud) return null;

    const estado = (solicitud.estado || '').toUpperCase();
    if (!this.estadosEnProceso.has(estado)) return null;

    const totalDias = 10;
    const restantes = Math.max(this.diasRestantesParaEntidad(solicitud), 0);
    const consumidos = Math.max(0, totalDias - Math.min(restantes, totalDias));
    const pct = Math.min(100, Math.round((consumidos / totalDias) * 100));
    const tone = restantes <= 1 ? 'var(--brand-700)' : restantes <= 3 ? 'var(--warning)' : 'var(--success)';

    return {
      restantes,
      pct,
      tone,
      fechaLimite: this.formatDate(solicitud.fechaLimite)
    };
  });

  readonly subsanacionPrincipal = computed<SubsanacionView | null>(() => {
    const solicitud = this.solicitudPrincipal();
    if (!solicitud || (solicitud.apelacion?.estado || '').toUpperCase() !== 'EN_SUBSANACION') return null;

    return {
      dias: Math.max(this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud), 0),
      observaciones: solicitud.apelacion?.resultado || 'observaciones',
      expediente: solicitud.apelacion?.expediente
    };
  });

  readonly resumenActivasTexto = computed(() => {
    const activas = this.solicitudesActivas();
    if (!activas.length) {
      return 'Aun no tiene solicitudes activas. Cuando lo necesite, puede pedir informacion a cualquier entidad publica.';
    }

    const cantidad = activas.length;
    const base = `Aqui estan sus ${cantidad} solicitud${cantidad === 1 ? '' : 'es'} en curso`;
    return this.accionPrincipal() ? `${base}. Le mostramos lo que conviene hacer hoy.` : `${base}.`;
  });

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreUsuario.set(sesion.nombre || 'Usuario');
      this.ciudadanoId.set(sesion.ciudadanoId || 0);
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    this.cargarSolicitudes();
    this.cargarApelaciones();
  }

  cargarSolicitudes(): void {
    this.loading.set(true);
    const ciudadanoId = this.ciudadanoId();

    if (ciudadanoId === 0) {
      this.error.set('No se encontro el ID del ciudadano');
      this.loading.set(false);
      return;
    }

    this.solicitudService.findByCiudadanoId(ciudadanoId).subscribe({
      next: (data) => {
        this.todasSolicitudes.set(data);
        this.calcularEstadisticas(data);

        if (data.length > 0) {
          const activeFirst = data.find((solicitud) => {
            const estado = (solicitud.estado || '').toUpperCase();
            return this.estadosEnProceso.has(estado)
              || estado === 'DENEGADA'
              || estado === 'VENCIDA'
              || this.tieneApelacionActiva(solicitud);
          });
          if (activeFirst) {
            this.selectedSolicitudId.set(activeFirst.id);
          }
        }

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

  cargarApelaciones(): void {
    const ciudadanoId = this.ciudadanoId();
    if (ciudadanoId === 0) return;

    this.apelacionService.findByCiudadanoId(ciudadanoId).subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        this.apelacionesSubsanacion.set(data.filter((apelacion) => apelacion.estado === 'EN_SUBSANACION'));
      },
      error: (err) => {
        console.error('Error al cargar apelaciones:', err);
        const mensaje = err.error?.mensaje || err.message || 'Error desconocido';
        this.error.set(`Error al cargar apelaciones: ${mensaje} (${err.status || 'sin conexion'})`);
      }
    });
  }

  onSearchFocus(): void {
    this.busquedaEnfocada.set(true);
    this.mostrarResultadosBusqueda.set(this.busqueda.trim().length > 0);
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.busquedaEnfocada.set(false);
      this.mostrarResultadosBusqueda.set(false);
    }, 150);
  }

  onSearchInput(): void {
    this.mostrarResultadosBusqueda.set(this.busquedaEnfocada() && this.busqueda.trim().length > 0);
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.mostrarResultadosBusqueda.set(false);
  }

  private enfocarSolicitud(solicitudId: number): void {
    this.selectedSolicitudId.set(solicitudId);
    this.accionResaltada.set(true);
    this.scrollAAccionPrincipal();
    setTimeout(() => this.accionResaltada.set(false), 1800);
  }

  private scrollAAccionPrincipal(): void {
    if (typeof document === 'undefined') return;

    setTimeout(() => {
      document.getElementById('lo-que-debe-hacer-hoy')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 60);
  }

  coincidenciasBusqueda(): Solicitud[] {
    const query = this.busqueda.trim().toLowerCase();
    if (!query) return [];

    return this.todasSolicitudes().filter((solicitud) => {
      const entidad = (solicitud.entidadNombre || '').toLowerCase();
      const asunto = (solicitud.asunto || '').toLowerCase();
      const expediente = (solicitud.expediente || '').toLowerCase();
      const expedienteApelacion = (solicitud.apelacion?.expediente || '').toLowerCase();
      const estadoHumano = this.estadoHumano(solicitud).toLowerCase();

      return expediente.includes(query)
        || entidad.includes(query)
        || asunto.includes(query)
        || expedienteApelacion.includes(query)
        || estadoHumano.includes(query);
    }).slice(0, 8);
  }

  seleccionarCoincidencia(solicitud: Solicitud): void {
    this.busqueda = solicitud.expediente || '';
    this.mostrarResultadosBusqueda.set(false);

    if ((solicitud.estado || '').toUpperCase() === 'RESPONDIDA' && solicitud.expediente) {
      this.busqueda = '';
      this.router.navigate(['/ciudadano/solicitud', solicitud.expediente]);
      return;
    }

    this.enfocarSolicitud(solicitud.id);
  }

  aplicarFiltroRapido(filtro: string): void {
    this.busqueda = filtro;
    this.mostrarResultadosBusqueda.set(true);

    const first = this.coincidenciasBusqueda()[0];
    if (first) {
      this.enfocarSolicitud(first.id);
    }
  }

  seleccionarSolicitud(solicitudId: number): void {
    this.busqueda = '';
    this.mostrarResultadosBusqueda.set(false);
    this.enfocarSolicitud(solicitudId);
  }

  toggleGuide(): void {
    this.guideOpen.update((value) => !value);
  }

  toggleHistorico(): void {
    this.historicoOpen.update((value) => !value);
  }

  toggleSecundarias(): void {
    this.showAllSecundarias.update((value) => !value);
  }

  getEstadoBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'badge-warning',
      'EN_REVISION': 'badge-in-process',
      'PENDIENTE_INFORMACION': 'badge-warning',
      'RESPONDIDA': 'badge-success',
      'DENEGADA': 'badge-danger',
      'VENCIDA': 'badge-muted',
      'CONCLUIDA': 'badge-muted',
      'PENDIENTE_ELEVACION': 'badge-warning',
      'EN_CALIFICACION_1': 'badge-in-process',
      'EN_SUBSANACION': 'badge-warning',
      'EN_CALIFICACION_2': 'badge-in-process',
      'NOTIFICACION_SEGUNDA_CALIFICACION': 'badge-in-process',
      'EN_RESOLUCION': 'badge-in-process',
      'RESUELTO': 'badge-success',
      'RESUELTO_FUNDADO': 'badge-success',
      'RESUELTO_FUNDADO_EN_PARTE': 'badge-success',
      'RESUELTO_INFUNDADO': 'badge-muted',
      'RESUELTO_INFUNDADO_EN_PARTE': 'badge-muted',
      'RESUELTO_IMPROCEDENTE': 'badge-danger',
      'RESUELTO_ESTESE_A_LO_RESUELTO': 'badge-muted',
      'RESUELTO_NULIDAD_ACTO': 'badge-danger',
      'TENER_POR_NO_PRESENTADO': 'badge-danger',
      'CONCLUSION_SUSTRACCION_MATERIA': 'badge-success',
      'CONCLUSION_DESISTIMIENTO': 'badge-muted'
    };

    const estadoKey = (estado || '').toUpperCase();
    return clases[estadoKey] || 'badge-muted';
  }

  timelineDotBackground(status: TimelineStep['status']): string {
    if (status === 'done') return 'var(--success)';
    if (status === 'active' || status === 'skipped') return 'var(--brand-700)';
    return 'var(--card)';
  }

  timelineDotBorder(status: TimelineStep['status']): string {
    const color = status === 'pending' ? 'var(--border-strong)' : this.timelineDotBackground(status);
    return `1.5px solid ${color}`;
  }

  timelineDotShadow(status: TimelineStep['status']): string {
    return status === 'active' ? '0 0 0 4px var(--brand-200)' : 'none';
  }

  timelineLabelColor(status: TimelineStep['status']): string {
    return status === 'pending' ? 'var(--muted-foreground)' : 'var(--foreground)';
  }

  timelineMetaColor(status: TimelineStep['status']): string {
    return status === 'active' ? 'var(--brand-700)' : 'var(--muted-foreground)';
  }

  accionResumenSolicitud(solicitud: Solicitud): DashboardAction | null {
    return this.construirAccionPrincipal(solicitud);
  }

  formatoEstado(estado?: string): string {
    if (!estado) return 'Sin estado';
    return estado.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (value) => value.toUpperCase());
  }

  calcularDiasRestantesSubsanacion(apelacion: Apelacion): number {
    if (!apelacion.fechaSubsanacion || !apelacion.diasSubsanacion) return 0;

    const fechaSubsanacion = this.parseFecha(apelacion.fechaSubsanacion);
    if (!fechaSubsanacion) return 0;

    const fechaLimite = new Date(fechaSubsanacion);
    fechaLimite.setDate(fechaLimite.getDate() + apelacion.diasSubsanacion);

    return Math.ceil((fechaLimite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  esSilencioAdministrativo(solicitud: Solicitud): boolean {
    return isSilencioAdministrativo(solicitud);
  }

  private calcularEstadisticas(solicitudes: Solicitud[]): void {
    this.totalSolicitudes.set(solicitudes.length);
    this.enProceso.set(solicitudes.filter((solicitud) => this.estadosEnProceso.has((solicitud.estado || '').toUpperCase())).length);
    this.respondidas.set(solicitudes.filter((solicitud) => (solicitud.estado || '').toUpperCase() === 'RESPONDIDA').length);
    this.denegadas.set(solicitudes.filter((solicitud) => (solicitud.estado || '').toUpperCase() === 'DENEGADA').length);
    this.vencidas.set(solicitudes.filter((solicitud) => (solicitud.estado || '').toUpperCase() === 'VENCIDA').length);

    this.tieneApelables.set(solicitudes.some((solicitud) => {
      const estado = (solicitud.estado || '').toUpperCase();
      return estado === 'RESPONDIDA' || estado === 'DENEGADA' || estado === 'VENCIDA';
    }));
  }

  private construirAccionPrincipal(solicitud: Solicitud | null): DashboardAction | null {
    if (!solicitud) return null;

    const expediente = solicitud.expediente || 'SIN-EXPEDIENTE';
    const entidad = solicitud.entidadNombre || 'Entidad no especificada';
    const estadoApelacion = (solicitud.apelacion?.estado || '').toUpperCase();

    if (estadoApelacion === 'EN_SUBSANACION' && solicitud.apelacion?.expediente) {
      const diasSubsanacion = this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud);
      return {
        eyebrow: 'Tarea urgente - vence pronto',
        titulo: 'Complete los documentos del Tribunal',
        detalle: 'Su apelacion requiere subsanacion. Si no corrige las observaciones dentro del plazo, su recurso quedara sin efecto.',
        metricValue: `${Math.max(diasSubsanacion, 0)}`,
        metricUnit: 'dias habiles',
        ctaLabel: 'Completar subsanacion',
        route: ['/ciudadano/subsanacion', solicitud.apelacion.expediente],
        icon: 'alert',
        toneColor: 'var(--brand-700)',
        toneBg: 'linear-gradient(135deg, var(--brand-subtle), var(--card) 70%)',
        toneSoft: 'var(--brand-200)',
        expediente,
        entidad,
      };
    }

    if (estadoApelacion === 'PENDIENTE_ELEVACION') {
      const elevacion = solicitud.apelacion?.elevacion;
      return {
        eyebrow: 'Apelacion presentada ante la entidad',
        titulo: 'La entidad debe elevar su recurso al Tribunal',
        detalle: `La entidad tiene 2 dias habiles para remitir el recurso. Fecha limite: ${this.formatDate(elevacion?.fechaLimiteElevacion) || 'por confirmar'}.`,
        metricValue: '2',
        metricUnit: 'dias habiles',
        ctaLabel: 'Ver elevacion',
        route: ['/ciudadano/solicitud', expediente],
        icon: 'scale',
        toneColor: 'var(--gold-dark)',
        toneBg: 'linear-gradient(135deg, rgba(176,136,66,0.12), var(--card) 70%)',
        toneSoft: 'rgba(176,136,66,0.30)',
        expediente,
        entidad,
      };
    }

    if (this.tieneApelacionActiva(solicitud)) {
      return {
        eyebrow: 'El Tribunal esta revisando su caso',
        titulo: 'Su apelacion esta en evaluacion',
        detalle: `El expediente ${solicitud.apelacion?.expediente || expediente} se encuentra en etapa ${this.formatoEstado(solicitud.apelacion?.estado)}. Le notificaremos cualquier avance.`,
        metricValue: '·',
        metricUnit: 'en estudio',
        ctaLabel: 'Ver expediente',
        route: ['/ciudadano/solicitud', expediente],
        icon: 'gavel',
        toneColor: 'var(--info)',
        toneBg: 'linear-gradient(135deg, rgba(29,78,216,0.10), var(--card) 70%)',
        toneSoft: 'rgba(29,78,216,0.25)',
        expediente,
        entidad,
      };
    }

    const estado = (solicitud.estado || '').toUpperCase();
    if (estado === 'DENEGADA' || estado === 'VENCIDA') {
      const dias = this.calcularDiasParaApelar(solicitud);
      return {
        eyebrow: 'Puede reclamar - plazo limitado',
        titulo: 'Puede apelar ante el Tribunal',
        detalle: estado === 'VENCIDA'
          ? 'La entidad no respondio dentro del plazo legal. Puede presentar apelacion por silencio administrativo negativo.'
          : 'La entidad denego su solicitud. Puede presentar apelacion dentro del plazo legal aplicable.',
        metricValue: `${Math.max(dias, 0)}`,
        metricUnit: 'dias para apelar',
        ctaLabel: 'Apelar al Tribunal',
        route: ['/ciudadano/nueva-apelacion'],
        queryParams: { solicitudId: solicitud.id },
        icon: 'scale',
        toneColor: 'var(--gold-dark)',
        toneBg: 'linear-gradient(135deg, rgba(176,136,66,0.12), var(--card) 70%)',
        toneSoft: 'rgba(176,136,66,0.30)',
        expediente,
        entidad,
      };
    }

    if (estado === 'RESPONDIDA') {
      return {
        eyebrow: 'Respuesta disponible',
        titulo: 'Su informacion ya esta lista',
        detalle: 'La entidad envio una respuesta. Revise el contenido y descargue los documentos adjuntos desde el detalle del expediente.',
        metricValue: '✓',
        metricUnit: 'lista',
        ctaLabel: 'Ver respuesta',
        route: ['/ciudadano/solicitud', expediente],
        icon: 'check',
        toneColor: 'var(--success)',
        toneBg: 'linear-gradient(135deg, rgba(21,128,61,0.12), var(--card) 70%)',
        toneSoft: 'rgba(21,128,61,0.30)',
        expediente,
        entidad,
      };
    }

    const diasEntidad = this.diasRestantesParaEntidad(solicitud);
    return {
      eyebrow: 'Esperando respuesta de la entidad',
      titulo: 'La entidad esta preparando su respuesta',
      detalle: `${entidad} aun esta dentro del plazo de atencion. Le notificaremos por correo cuando exista una respuesta oficial.`,
      metricValue: `${Math.max(diasEntidad, 0)}`,
      metricUnit: 'dias habiles',
      ctaLabel: 'Ver mi solicitud',
      route: ['/ciudadano/solicitud', expediente],
      icon: 'clock',
      toneColor: 'var(--info)',
      toneBg: 'linear-gradient(135deg, rgba(29,78,216,0.10), var(--card) 70%)',
      toneSoft: 'rgba(29,78,216,0.25)',
      expediente,
      entidad,
    };
  }

  private buildTimeline(solicitud: Solicitud | null): TimelineStep[] {
    if (!solicitud) return [];

    const steps: TimelineStep[] = [];
    steps.push({
      key: 'presentacion',
      label: 'SAIP presentada',
      date: this.formatDate(solicitud.fechaPresentacion),
      status: 'done'
    });

    const estado = (solicitud.estado || '').toUpperCase();
    const estadoApelacion = (solicitud.apelacion?.estado || '').toUpperCase();

    if (this.estadosEnProceso.has(estado)) {
      const dias = this.diasRestantesParaEntidad(solicitud);
      const vencimiento = this.formatDate(solicitud.fechaLimite);
      steps.push({
        key: 'plazo-entidad',
        label: 'Plazo de la entidad',
        meta: `${Math.max(dias, 0)}d restantes${vencimiento ? ` - vence ${vencimiento}` : ''}`,
        status: 'active'
      });
      steps.push({ key: 'respuesta', label: 'Respuesta de la entidad', status: 'pending' });
    } else if (estado === 'RESPONDIDA') {
      const resultado = solicitud.respuesta?.tipoRespuesta ? this.formatoEstado(solicitud.respuesta.tipoRespuesta) : 'recibida';
      steps.push({ key: 'plazo-entidad', label: 'Plazo cumplido', meta: 'Atencion cerrada', status: 'done' });
      steps.push({
        key: 'respuesta',
        label: `Respuesta - ${resultado}`,
        date: this.formatDate(solicitud.respuesta?.fechaRespuesta),
        status: 'done'
      });
    } else if (estado === 'DENEGADA') {
      steps.push({ key: 'plazo-entidad', label: 'Plazo cumplido', status: 'done' });
      steps.push({ key: 'respuesta', label: 'Denegada por la entidad', date: this.formatDate(solicitud.respuesta?.fechaRespuesta), status: 'done' });
      steps.push({ key: 'apelacion', label: 'Puede apelar al Tribunal', status: this.tieneApelacionActiva(solicitud) ? 'done' : 'active' });
    } else if (estado === 'VENCIDA') {
      steps.push({ key: 'plazo-entidad', label: 'Plazo vencido - SAN', status: 'done', meta: 'Silencio administrativo negativo' });
      steps.push({ key: 'respuesta', label: 'Sin respuesta de la entidad', status: 'skipped' });
      steps.push({ key: 'apelacion', label: 'Puede apelar al Tribunal', status: this.tieneApelacionActiva(solicitud) ? 'done' : 'active' });
    }

    if (this.tieneApelacionActiva(solicitud)) {
      const elevacion = solicitud.apelacion?.elevacion;
      const pendienteElevacion = estadoApelacion === 'PENDIENTE_ELEVACION';
      steps.push({
        key: 'tribunal',
        label: pendienteElevacion
          ? 'Pendiente de elevacion por la entidad'
          : `Tribunal - ${this.formatoEstado(estadoApelacion)}`,
        meta: pendienteElevacion
          ? `Vence ${this.formatDate(elevacion?.fechaLimiteElevacion) || 'por confirmar'}`
          : solicitud.apelacion?.expediente || undefined,
        status: 'active'
      });
      steps.push({ key: 'resolucion', label: 'Resolucion final', status: 'pending' });
    } else if (estadoApelacion.startsWith('RESUELTO') || estadoApelacion === 'CONCLUSION_SUSTRACCION_MATERIA' || estadoApelacion === 'CONCLUSION_DESISTIMIENTO') {
      steps.push({
        key: 'tribunal',
        label: 'Tramite en Tribunal',
        meta: solicitud.apelacion?.expediente || undefined,
        status: 'done'
      });
      steps.push({ key: 'resolucion', label: this.formatoEstado(estadoApelacion), status: 'done' });
    }

    return steps;
  }

  private calcularUrgenciaSolicitud(solicitud: Solicitud): number {
    const estado = (solicitud.estado || '').toUpperCase();
    const estadoApelacion = (solicitud.apelacion?.estado || '').toUpperCase();

    if (estadoApelacion === 'EN_SUBSANACION') {
      return 100 + Math.max(0, 5 - this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud));
    }

    if (this.estadosApelacionActivos.has(estadoApelacion)) return 85;
    if (estado === 'VENCIDA') return 82;
    if (estado === 'DENEGADA') return 78;
    if (estado === 'RESPONDIDA') return 30;

    const dias = this.diasRestantesParaEntidad(solicitud);
    return 55 + Math.max(0, 4 - dias);
  }

  private tieneApelacionActiva(solicitud: Solicitud): boolean {
    const estadoApelacion = (solicitud.apelacion?.estado || '').toUpperCase();
    return this.estadosApelacionActivos.has(estadoApelacion);
  }

  private estadoHumano(solicitud: Solicitud): string {
    const estado = (solicitud.estado || '').toUpperCase();
    if (this.estadosEnProceso.has(estado)) return 'en proceso';
    if (this.tieneApelacionActiva(solicitud)) return 'apelada';
    if (estado === 'DENEGADA') return 'denegada';
    if (estado === 'VENCIDA') return 'vencida';
    if (estado === 'RESPONDIDA') return 'respondida';
    return estado.toLowerCase();
  }

  private diasRestantesParaEntidad(solicitud: Solicitud): number {
    if (typeof solicitud.diasRestantes === 'number') {
      return solicitud.diasRestantes;
    }

    const fechaLimite = this.parseFecha(solicitud.fechaLimite);
    if (!fechaLimite) return 0;

    return Math.ceil((fechaLimite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private calcularDiasParaApelar(solicitud: Solicitud): number {
    const base = this.parseFecha(solicitud.respuesta?.fechaRespuesta)
      || this.parseFecha(solicitud.fechaLimite)
      || this.parseFecha(solicitud.fechaPresentacion);

    if (!base) return 15;

    const fechaCaducidad = new Date(base);
    fechaCaducidad.setDate(fechaCaducidad.getDate() + 15);
    return Math.ceil((fechaCaducidad.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud: Solicitud): number {
    if (!solicitud.apelacion?.fechaSubsanacion || !solicitud.apelacion?.diasSubsanacion) return 0;

    const fechaSubsanacion = this.parseFecha(solicitud.apelacion.fechaSubsanacion);
    if (!fechaSubsanacion) return 0;

    const fechaLimite = new Date(fechaSubsanacion);
    fechaLimite.setDate(fechaLimite.getDate() + solicitud.apelacion.diasSubsanacion);

    return Math.ceil((fechaLimite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private formatDate(valor?: string): string | undefined {
    const fecha = this.parseFecha(valor);
    if (!fecha) return undefined;

    const dia = `${fecha.getDate()}`.padStart(2, '0');
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  private parseFecha(valor?: string): Date | null {
    if (!valor) return null;

    // Si tiene hora (contiene 'T' o ':'), usar constructor nativo
    if (valor.includes('T') || valor.includes(':')) {
      const fecha = new Date(valor);
      if (!Number.isNaN(fecha.getTime())) return fecha;
    }

    // Para fechas puras (YYYY-MM-DD), parseISO de date-fns las interpreta localmente
    try {
      const parsed = parseISO(valor);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    } catch (e) {
      // Fallback si falla
    }

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





