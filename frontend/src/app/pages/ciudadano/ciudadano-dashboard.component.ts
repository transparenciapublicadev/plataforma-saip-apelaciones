import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject, computed, effect, untracked, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { PanelQueryService } from '../../services/panel-query.service';
import { SolicitudService } from '../../services/solicitud.service';
import { PanelSolicitud as Solicitud, PanelPage, PanelSummary, validPanelPage } from '../../models/panel-query.model';
import { AmpliacionPlazoSolicitud } from '../../models/solicitud.model';
import { Subscription } from 'rxjs';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';
import { AuthService } from '../../services/auth.service';
import { ProfileDialogService } from '../../services/profile-dialog.service';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';
import { aISO, habilesEntre, hoyLima, sumarDias, sumarHabiles } from '../../models/calendario.model';
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
  restantes: number | null;
  tone: string;
  fechaLimite?: string;
}

interface IndicadorBandeja {
  value: string | number;
  unit: string;
  tone: string;
  nota?: string;
}

interface SubsanacionView {
  dias: number | null;
  pendiente: boolean;
  vencido: boolean;
  expediente?: string;
}

interface GuideStep {
  num: string;
  titulo: string;
  desc: string;
  icon: 'send' | 'building' | 'scale' | 'gavel';
  color: string;
}

interface PipelineStage {
  key: 'todas' | 'accion' | 'proceso' | 'respondidas' | 'apelar' | 'tribunal' | 'resueltas';
  num: string;
  iconName: string;
  color: string;
  bg: string;
  label: string;
  desc: string;
  count: number;
}

interface UbicacionTramite {
  label: string;
  instancia: string;
  tone: string;
  iconName: string;
}

import {
  LucideScale, LucidePlus, LucideFileText, LucideClock, LucideCheckCircle2,
  LucideChevronRight,
  LucideBuilding2, LucideSend, LucideHelpCircle, LucidePhone, LucideMail,
  LucideCompass, LucideSparkles, LucideBell, LucideInbox, LucideHourglass,
  LucideMailCheck, LucideGavel, LucideArrowRight, LucideMessageCircle, LucideLayers, LucideLock, LucideUser, LucideUserPen,
  LucideAlertTriangle, LucideSearch, LucideX
} from '@lucide/angular';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { PaginationComponent } from '../../shared/pagination.component';

@Component({
  selector: 'app-ciudadano-dashboard',
  imports: [
    RouterLink, FormsModule, DatePipe,
    StatusBadgeComponent, PaginationComponent,
    LucideScale, LucidePlus, LucideFileText, LucideClock, LucideCheckCircle2,
    LucideChevronRight,
    LucideBuilding2, LucideSend, LucideHelpCircle, LucidePhone, LucideMail,
    LucideCompass, LucideSparkles, LucideBell, LucideInbox, LucideHourglass,
    LucideMailCheck, LucideGavel, LucideArrowRight, LucideMessageCircle, LucideLayers, LucideLock, LucideUser, LucideUserPen,
    LucideAlertTriangle, LucideSearch, LucideX
  ],
  templateUrl: './ciudadano-dashboard.component.html',
  styleUrl: './ciudadano-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CiudadanoDashboardComponent implements OnInit, OnDestroy {
  readonly profileDialog = inject(ProfileDialogService);
  private readonly elementRef = inject(ElementRef);
  private readonly panelService = inject(PanelQueryService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly tourService = inject(GuidedTourService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly estadosEnProceso = new Set(['RECEPCIONADA', 'EN_PROCESO', 'EN_REVISION', 'PENDIENTE_INFORMACION']);
  private readonly estadosActivos = new Set([
    'RECEPCIONADA',
    'EN_PROCESO',
    'EN_REVISION',
    'PENDIENTE_INFORMACION',
    'DENEGADA',
    'VENCIDA',
    'EN_PRECISION',
    'POR_RECOGER',
    'ENCAUZADA',
    'OBSERVADA'
  ]);
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
      desc: 'Revise el plazo informado, la respuesta y sus documentos en el detalle autorizado.',
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

  loading = signal<boolean>(true);
  error = signal<string>('');
  readonly errorTipo = signal<'sesion' | 'permiso' | 'validacion' | 'inexistente' | 'servidor' | 'red' | 'incompleta' | null>(null);
  private read?: Subscription;
  private globalRead?: Subscription;
  private globalGeneration = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private globalTimer?: ReturnType<typeof setTimeout>;
  readonly pagina = signal<PanelPage<Solicitud> | null>(null);
  readonly resumen = signal<PanelSummary | null>(null);
  readonly queryLoading = signal(false);
  readonly globalLoading = signal(false);
  readonly globalError = signal('');
  readonly globalTotal = signal(0);

  private generation = 0;
  private initialized = false;
  private destroyed = false;
  private sessionRevision = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  totalSolicitudes = signal<number>(0);
  enProceso = signal<number>(0);
  respondidas = signal<number>(0);
  denegadas = signal<number>(0);
  vencidas = signal<number>(0);

  nombreUsuario = signal<string>('');
  ciudadanoId = signal<number>(0);
  tieneApelables = signal<boolean>(false);

  tipoPersona = signal<'NATURAL' | 'JURIDICA'>('NATURAL');
  dni = signal<string>('');
  ruc = signal<string>('');
  razonSocial = signal<string>('');
  representanteDni = signal<string>('');
  representanteNombreCompleto = signal<string>('');
  nombreCompleto = signal<string>('');

  guideOpen = signal<boolean>(true);
  historicoOpen = signal<boolean>(false);
  showAllSecundarias = signal<boolean>(false);
  selectedSolicitudId = signal<number | null>(null);
  accionResaltada = signal<boolean>(false);
  private readonly ampliacionVista = signal<AmpliacionPlazoSolicitud | null>(null);
  private readonly ampliacionSolicitudId = signal<number | null>(null);

  // Pipeline state
  selectedStageKey = signal<'todas' | 'accion' | 'proceso' | 'respondidas' | 'apelar' | 'tribunal' | 'resueltas'>('todas');
  stageSearch = signal<string>('');
  stagePage = signal<number>(1);
  private scrollEtapaPendiente = false;
  readonly PER_PAGE = 4;

  readonly nombrePila = computed(() => this.nombreUsuario().trim().split(' ')[0] || 'Ciudadano');

  readonly solicitudesActivas = computed(() => {
    return this.todasSolicitudes().filter((solicitud) => {
      if (this.esApelacionResuelta(solicitud)) return false;
      const estado = (solicitud.estado || '').toUpperCase();
      return this.estadosActivos.has(estado)
        || this.tieneApelacionActiva(solicitud);
    });
  });

  readonly solicitudPrincipal = computed(() => {
    const todas = this.todasSolicitudes();
    if (!todas.length) return null;

    const selectedId = this.selectedSolicitudId();
    if (selectedId !== null) {
      const selected = todas.find((item) => item.id === selectedId);
      if (selected) return selected;
    }

    const activas = [...this.solicitudesActivas()];
    if (activas.length) {
      activas.sort((a, b) => this.calcularUrgenciaSolicitud(b) - this.calcularUrgenciaSolicitud(a));
      return activas[0];
    }

    return todas[0];
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

  readonly accionPrincipal = computed(() => {
    const principalAction = this.construirAccionPrincipal(this.solicitudPrincipal());
    if (principalAction) return principalAction;

    for (const solicitud of this.todasSolicitudes()) {
      const action = this.construirAccionPrincipal(solicitud);
      if (action) return action;
    }
    return null;
  });
  readonly timelinePrincipal = computed(() => this.buildTimeline(this.solicitudPrincipal()));
  readonly precisionPrincipal = computed(() => {
    const solicitud = this.solicitudPrincipal();
    if (!solicitud || !this.enPrecision(solicitud)) return null;
    const observacion = this.observacionPendiente(solicitud);
    return {
      fechaRegistrada: this.formatDate(observacion?.fechaLimiteSubsanacion),
      expediente: observacion ? solicitud.expediente : null,
      indicador: this.indicadorPrecision(solicitud),
    };
  });

  readonly plazoEntidadPrincipal = computed<PlazoEntidadView | null>(() => {
    const solicitud = this.solicitudPrincipal();
    if (!solicitud || this.enPrecision(solicitud) || this.esSilencioAdministrativo(solicitud)) return null;

    const estado = (solicitud.estado || '').toUpperCase();
    if (!this.estadosEnProceso.has(estado)) return null;

    const restantes = this.diasRestantesParaEntidad(solicitud);
    return {
      restantes,
      tone: restantes === null ? 'var(--muted-foreground)' : 'var(--info)',
      fechaLimite: this.formatDate(solicitud.fechaLimite),
    };
  });

  readonly subsanacionPrincipal = computed<SubsanacionView | null>(() => {
    const solicitud = this.solicitudPrincipal();
    if (!solicitud || (solicitud.apelacion?.estado || '').toUpperCase() !== 'EN_SUBSANACION') return null;

    const rawDias = this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud);
    return {
      dias: rawDias === null ? null : Math.max(rawDias, 0),
      pendiente: solicitud.apelacion?.plazoSubsanacion?.estado === 'PENDIENTE_INICIO',
      vencido: solicitud.apelacion?.plazoSubsanacion?.estado === 'VENCIDO',
      expediente: solicitud.apelacion?.expediente
    };
  });

  readonly resumenActivasTexto = computed(() => {
    const total = this.resumen()?.total;
    if (total == null) return 'La información de sus solicitudes todavía no está disponible.';
    if (total === 0) return 'Aún no ha presentado solicitudes. Puede pedir información a una entidad pública.';
    return `Aquí puede consultar sus ${total} solicitud${total === 1 ? '' : 'es'}. Seleccione una etapa y revise cada expediente.`;
  });

  esSegundaInstancia(s: Solicitud): boolean {
    return !!s.apelacion?.expediente || !!s.apelacion?.resultado || !!s.apelacion?.estado;
  }

  requiereSubsanacionTTAIP(s: Solicitud): boolean {
    return !!s.apelacion?.expediente && (s.apelacion?.estado || '').toUpperCase() === 'EN_SUBSANACION';
  }

  requiereAccion(s: Solicitud): boolean {
    const estado = (s.estado || '').toUpperCase();
    return (this.enPrecision(s) && this.observacionPendiente(s) !== undefined)
      || estado === 'EN_PRECISION' || estado === 'POR_RECOGER' || estado === 'OBSERVADA' || this.requiereSubsanacionTTAIP(s);
  }

  // ── Pipeline computed properties ──────────────────────────────────────
  readonly stageBuckets = computed(() => {
    const all = this.todasSolicitudes();
    const ranked = [...all].sort((a, b) => {
      const msA = a.fechaPresentacion ? new Date(a.fechaPresentacion).getTime() : 0;
      const msB = b.fechaPresentacion ? new Date(b.fechaPresentacion).getTime() : 0;
      return msB - msA;
    });

    const activos = ranked.filter(s =>
      !this.esApelacionResuelta(s) &&
      (this.estadosEnProceso.has((s.estado || '').toUpperCase())
        || (s.estado || '').toUpperCase() === 'RECEPCIONADA'
        || (s.estado || '').toUpperCase() === 'EN_PROCESO'
        || (s.estado || '').toUpperCase() === 'EN_REVISION'
        || (s.estado || '').toUpperCase() === 'PENDIENTE_INFORMACION'
        || this.tieneApelacionActiva(s)
        || (s.estado || '').toUpperCase() === 'DENEGADA'
        || (s.estado || '').toUpperCase() === 'VENCIDA'
        || (s.estado || '').toUpperCase() === 'EN_PRECISION'
        || (s.estado || '').toUpperCase() === 'POR_RECOGER'
        || (s.estado || '').toUpperCase() === 'ENCAUZADA'
        || (s.estado || '').toUpperCase() === 'OBSERVADA')
    );

    const historicos1 = ranked.filter(s => (s.estado || '').toUpperCase() === 'RESPONDIDA' && !s.apelacion?.expediente);
    const historicos2 = ranked.filter(s => this.esApelacionResuelta(s));

    return {
      todas: ranked,
      accion: activos.filter(s => this.requiereAccion(s)),
      proceso: activos.filter(s => {
        const st = (s.estado || '').toUpperCase();
        return (st === 'RECEPCIONADA' || st === 'EN_PROCESO' || st === 'EN_REVISION' || st === 'PENDIENTE_INFORMACION' || st === 'ENCAUZADA')
          && !this.tieneApelacionActiva(s) && !this.requiereAccion(s) && !this.esSilencioAdministrativo(s);
      }),
      respondidas: historicos1,
      apelar: activos.filter(s => {
        const st = (s.estado || '').toUpperCase();
        return (st === 'DENEGADA' || st === 'VENCIDA' || this.esSilencioAdministrativo(s)) && !this.tieneApelacionActiva(s) && !this.requiereAccion(s);
      }),
      tribunal: activos.filter(s => this.tieneApelacionActiva(s) && !this.requiereSubsanacionTTAIP(s)),
      resueltas: historicos2,
    };
  });

  readonly pipeline = computed<PipelineStage[]>(() => {
    const resumen = this.resumen();
    const b = resumen?.porEtapa ?? {};
    const buckets = this.stageBuckets();
    const countFor = (key: keyof typeof buckets) => {
      if (key === 'todas') return resumen?.total ?? buckets.todas.length;
      return (b[key] !== undefined && b[key] > 0) ? b[key] : (buckets[key]?.length ?? b[key] ?? 0);
    };
    return [
      { key: 'todas', num: '00', iconName: 'layers', color: 'var(--foreground)', bg: 'var(--muted)', label: 'Todas', desc: 'Ver el historial completo de sus solicitudes', count: countFor('todas') },
      { key: 'accion', num: '01', iconName: 'alertTriangle', color: 'var(--warning)', bg: 'var(--warning-subtle)', label: 'Requieren su acción', desc: 'Subsane ante la entidad (1ª) o el Tribunal (2ª), o recoja su información', count: countFor('accion') },
      { key: 'proceso', num: '02', iconName: 'hourglass', color: 'var(--info)', bg: 'var(--info-subtle)', label: 'Pendiente en la entidad', desc: 'La entidad aún no responde su solicitud', count: countFor('proceso') },
      { key: 'respondidas', num: '03', iconName: 'mailCheck', color: 'var(--success)', bg: 'var(--success-subtle)', label: 'Respondida por la entidad', desc: 'La entidad ya entregó su respuesta', count: countFor('respondidas') },
      { key: 'apelar', num: '04', iconName: 'scale', color: 'var(--gold-dark)', bg: 'rgba(176,136,66,0.10)', label: 'Puede apelar al Tribunal', desc: 'Si no está conforme con la respuesta, puede llevar su caso al Tribunal', count: countFor('apelar') },
      { key: 'tribunal', num: '05', iconName: 'gavel', color: 'var(--brand-700)', bg: 'var(--brand-subtle)', label: 'En revisión del Tribunal', desc: 'Usted apeló; el Tribunal evalúa el caso', count: countFor('tribunal') },
      { key: 'resueltas', num: '06', iconName: 'checkCircle', color: 'var(--muted-foreground)', bg: 'var(--muted)', label: 'Resuelta por el Tribunal', desc: 'El Tribunal ya emitió el fallo final', count: countFor('resueltas') },
    ];
  });

  readonly selectedStageMeta = computed(() => this.pipeline().find(s => s.key === this.selectedStageKey()) ?? this.pipeline()[0]);
  readonly stageAll = computed(() => this.todasSolicitudes());
  readonly stageFiltered = computed(() => this.todasSolicitudes());
  readonly stageTotal = computed(() => this.pagina()?.totalElementos ?? 0);
  readonly stageCount = computed(() => this.selectedStageKey() === 'todas' ? (this.resumen()?.total ?? 0) : (this.resumen()?.porEtapa[this.selectedStageKey()] ?? 0));
  readonly stageTotalPages = computed(() => Math.max(1, this.pagina()?.totalPaginas ?? 1));
  readonly stageSafePage = computed(() => Math.min(this.stagePage(), this.stageTotalPages()));
  readonly stageVisible = computed(() => this.todasSolicitudes());
  readonly stageRangeFrom = computed(() => this.stageTotal() === 0 ? 0 : (this.stageSafePage() - 1) * this.PER_PAGE + 1);
  readonly stageRangeTo = computed(() => Math.min(this.stageSafePage() * this.PER_PAGE, this.stageTotal()));

  // ── Buscador Global ───────────────────────────────────────────────────
  globalQuery = signal<string>('');
  globalIdx = signal<number>(0);

  readonly globalTerms = computed(() => {
    const q = this.normalizeText(this.globalQuery().trim());
    return q.split(/\s+/).filter(Boolean);
  });

  readonly globalOpen = computed(() => this.globalTerms().length > 0);

  readonly globalResults = signal<Solicitud[]>([]);

  onGlobalSearchChange(val: string): void {
    this.globalQuery.set(val.slice(0, 120)); this.globalIdx.set(0);
    clearTimeout(this.globalTimer); this.globalRead?.unsubscribe(); ++this.globalGeneration;
    const terms = this.normalizeText(val.trim()).split(/\s+/).filter(Boolean);
    const local = terms.length ? this.todasSolicitudes().filter(sol => {
      const text = this.normalizeText(`${sol.expediente || ''} ${sol.asunto || ''} ${sol.entidadNombre || ''} ${sol.descripcion || ''}`);
      return terms.every(t => text.includes(t));
    }) : [];
    this.globalResults.set(local); this.globalTotal.set(local.length); this.globalError.set('');
    this.globalLoading.set(!!this.globalQuery().trim());
    if (this.globalLoading()) this.globalTimer = setTimeout(() => this.buscarGlobal(), 250);
  }

  private buscarGlobal(): void {
    const revision = this.sessionRevision, generation = ++this.globalGeneration;
    const session = this.authService.obtenerSesion();
    if (this.destroyed || revision !== this.authService.cambiosSesion() || !session?.token || session.tipoUsuario !== 'CIUDADANO') { this.clearGlobalSearch(); return; }
    const token = session.token, citizen = session.ciudadanoId;
    const current = () => !this.destroyed && generation === this.globalGeneration && revision === this.authService.cambiosSesion() && token === this.authService.obtenerSesion()?.token;
    this.globalRead = this.panelService.solicitudes({ pagina: 0, tamano: 8, busqueda: this.globalQuery().trim(), etapa: 'todas', orden: 'recientes' }).subscribe({
      next: data => {
        if (!current()) return;
        if (!validPanelPage<Solicitud>(data, 0, 8) || !this.validarSolicitudes(data.contenido, citizen)) {
          this.globalError.set('La respuesta de búsqueda está incompleta. Reintente.'); this.globalLoading.set(false); return;
        }
        this.globalResults.set(data.contenido); this.globalTotal.set(data.totalElementos); this.globalLoading.set(false);
      },
      error: () => { if (current()) { this.globalError.set('No se pudo consultar la búsqueda. Vuelva a intentarlo.'); this.globalLoading.set(false); } }
    });
  }

  clearGlobalSearch(): void {
    clearTimeout(this.globalTimer); this.globalRead?.unsubscribe(); ++this.globalGeneration;
    this.globalQuery.set(''); this.globalIdx.set(0); this.globalResults.set([]); this.globalTotal.set(0);
    this.globalLoading.set(false); this.globalError.set('');
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.globalOpen()) return;
    const target = ev.target as Node | null;
    const box = this.elementRef.nativeElement.querySelector('#buscador-global-container');
    if (box && target && !box.contains(target)) {
      this.clearGlobalSearch();
    }
  }

  abrirExpediente(s: Solicitud): void {
    if (this.loading() || this.error() || this.sessionRevision !== this.authService.cambiosSesion()
      || ![...this.todasSolicitudes(), ...this.globalResults()].some(current => current.id === s.id && current.expediente === s.expediente)) return;
    this.clearGlobalSearch();
    if (s.expediente) {
      this.router.navigate(['/ciudadano/solicitud', s.expediente]);
    } else {
      this.enfocarSolicitud(s.id);
    }
  }

  onGlobalKeyDown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.clearGlobalSearch();
      return;
    }
    const results = this.globalResults();
    if (!results.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.globalIdx.update(i => (i + 1) % results.length);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.globalIdx.update(i => (i - 1 + results.length) % results.length);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const current = results[Math.min(this.globalIdx(), results.length - 1)];
      if (current) this.abrirExpediente(current);
    }
  }

  readonly tourSteps = computed<TourStep[]>(() => {
    const s: TourStep[] = [
      { selector: '[data-tour="nueva"]', title: 'Pedir información', body: 'Aquí presenta una nueva solicitud de acceso a la información (SAIP). Es su punto de partida en la 1ª instancia, ante la entidad pública.' },
      { selector: '[data-tour="resumen"]', title: 'Mis solicitudes de un vistazo', body: 'Agrupación de sus solicitudes recuperadas por etapa. Seleccione una etapa para filtrar el listado; una consulta fallida no confirma un total de cero.' },
    ];
    if (this.accionPrincipal()) {
      s.push({ selector: '[data-tour="accion"]', title: 'Solicitud para revisar', body: 'Acción disponible para una solicitud identificada. Revise su requerimiento y los datos del servidor antes de presentar una precisión o subsanación.' });
    }
    if (this.solicitudPrincipal()) {
      s.push({ selector: '[data-tour="detalle"]', title: 'Está viendo esta solicitud', body: 'Resumen del recurso seleccionado con sus datos registrados. Consulte el detalle autorizado para revisar actuaciones y documentos; la información ausente no se completa con hitos supuestos.' });
    }
    s.push({ selector: '[data-tour="cola"]', title: 'La lista de la etapa', body: 'Todos los expedientes de la etapa seleccionada, ordenados y con su propio buscador. Toque cualquiera para verlo en detalle arriba, sin desplazarse de más.' });
    s.push({ selector: '[data-tour="ayuda"]', title: '¿Necesita ayuda?', body: 'Abra la guía de ayuda disponible. Los canales de contacto o asistencia no configurados se identifican como no disponibles. Puede volver a iniciar este tutorial desde su botón.' });
    return s;
  });

  readonly ubicacionPrincipal = computed<UbicacionTramite | null>(() => {
    const s = this.solicitudPrincipal();
    return s ? this.ubicacionTramite(s) : null;
  });

  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (this.initialized && revision !== this.sessionRevision) untracked(() => this.cargarDatos());
    });
    effect(() => {
      if (this.tourService.isOpen()) {
        this.clearGlobalSearch();
      }
    });
    effect(onCleanup => {
      const id = this.solicitudPrincipal()?.id ?? null;
      if (id == null || !Number.isSafeInteger(id) || id <= 0) {
        untracked(() => {
          this.ampliacionVista.set(null);
          this.ampliacionSolicitudId.set(null);
        });
        return;
      }
      untracked(() => {
        if (this.ampliacionSolicitudId() !== id) this.ampliacionVista.set(null);
      });
      const sub = this.solicitudService.findById(id).subscribe({
        next: detalle => this.aplicarAmpliacion(id, detalle.ampliacionesPlazo),
        error: () => this.aplicarAmpliacion(id, null),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.tourService.endTourFor('saip_tour_done');
    this.destroyed = true;
    ++this.generation;
    this.read?.unsubscribe(); this.clearGlobalSearch(); clearTimeout(this.searchTimer);
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  cargarDatos(resetFilters = true): void {
    clearTimeout(this.searchTimer);
    if (this.destroyed) return;
    this.tourService.endTourFor('saip_tour_done');
    const generation = ++this.generation;
    this.read?.unsubscribe(); this.clearGlobalSearch(); clearTimeout(this.searchTimer);
    this.timers.forEach(timer => clearTimeout(timer)); this.timers.clear();
    this.selectedSolicitudId.set(null); this.accionResaltada.set(false);
    const changed = this.sessionRevision !== this.authService.cambiosSesion();
    if (resetFilters || changed) {
      this.todasSolicitudes.set([]); this.pagina.set(null); this.scrollEtapaPendiente = false;
      this.selectedStageKey.set('todas'); this.stagePage.set(1); this.stageSearch.set(''); this.clearGlobalSearch();
    }
    if (changed) this.resumen.set(null);
    this.error.set(''); this.errorTipo.set(null); this.loading.set(changed || !this.resumen()); this.queryLoading.set(true);
    this.sessionRevision = this.authService.cambiosSesion();
    let session: ReturnType<AuthService['obtenerSesion']> = null;
    try { session = this.authService.obtenerSesion(); } catch { /* Invalid local session: no request. */ }
    this.nombreUsuario.set(session?.nombreCompleto || session?.nombre || '');
    this.nombreCompleto.set(session?.nombreCompleto || session?.nombre || '');
    this.ciudadanoId.set(session?.ciudadanoId || 0);
    this.tipoPersona.set(session?.tipoPersona || 'NATURAL'); this.dni.set(session?.dni || '');
    this.ruc.set(session?.ruc || ''); this.razonSocial.set(session?.razonSocial || '');
    this.representanteDni.set(session?.representanteDni || '');
    this.representanteNombreCompleto.set(session?.representanteNombreCompleto || '');
    const citizen = this.ciudadanoId(), revision = this.sessionRevision, token = session?.token;
    if (!token || session?.tipoUsuario !== 'CIUDADANO' || !Number.isSafeInteger(citizen) || citizen <= 0) {
      this.nombreUsuario.set(''); this.nombreCompleto.set(''); this.ciudadanoId.set(0);
      this.dni.set(''); this.ruc.set(''); this.razonSocial.set(''); this.representanteDni.set(''); this.representanteNombreCompleto.set('');
      this.errorTipo.set('sesion'); this.error.set('Su sesión no es válida. Inicie sesión nuevamente.');
      this.loading.set(false); this.queryLoading.set(false); this.resumen.set(null); this.scrollEtapaPendiente = false; return;
    }
    const current = () => {
      try {
        return !this.destroyed && generation === this.generation && revision === this.authService.cambiosSesion()
          && token === this.authService.obtenerSesion()?.token;
      } catch { return false; }
    };
    const page = this.stagePage() - 1;
    this.read = this.panelService.solicitudes({ pagina: page, tamano: this.PER_PAGE, etapa: this.selectedStageKey(),
      busqueda: this.stageSearch().trim() }).subscribe({
      next: data => {
        if (!current()) return;
        if (!validPanelPage<Solicitud>(data, page, this.PER_PAGE) || !this.validarSolicitudes(data.contenido, citizen)) {
          this.errorTipo.set('incompleta'); this.error.set('La información recibida está incompleta o no corresponde a esta consulta. Reintente la consulta.');
          this.resumen.set(null); this.loading.set(false); this.queryLoading.set(false); this.scrollEtapaPendiente = false; return;
        }
        this.todasSolicitudes.set(data.contenido); this.pagina.set(data); this.resumen.set(data.resumen);
        this.calcularEstadisticas(); this.loading.set(false); this.queryLoading.set(false);
        if (this.scrollEtapaPendiente) { this.scrollEtapaPendiente = false; this.scrollToStageList(); }
      },
      error: failure => {
        if (!current()) return;
        const status = failure?.status;
        this.errorTipo.set(status === 401 ? 'sesion' : status === 403 ? 'permiso' : status === 400 ? 'validacion' : status === 404 ? 'inexistente' : status === 0 ? 'red' : 'servidor');
        this.error.set(status === 401 ? 'Su sesión no es válida. Inicie sesión nuevamente.'
          : status === 403 ? 'No tiene permiso para consultar estas solicitudes.'
          : status === 400 ? 'No se pudo validar la consulta de solicitudes.'
          : status === 404 ? 'El recurso solicitado no fue encontrado.'
          : status === 0 ? 'No se pudo conectar con el servidor. Revise su conexión y reintente.'
          : 'El servidor no pudo completar la consulta. Reintente más tarde.');
        this.loading.set(false); this.queryLoading.set(false); this.resumen.set(null); this.scrollEtapaPendiente = false;
      },
    });
  }

  private enfocarSolicitud(solicitudId: number): void {
    this.selectedSolicitudId.set(solicitudId);
    this.accionResaltada.set(true);
    this.scrollToTimelineSection();
    this.schedule(() => this.accionResaltada.set(false), 1800);
  }

  private scrollToTimelineSection(): void {
    if (typeof document === 'undefined') return;

    this.schedule(() => {
      const element = document.getElementById('seccion-timeline');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } else {
        document.getElementById('lo-que-debe-hacer-hoy')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 50);
  }

  puedePresentarApelacion(solicitud: Solicitud | null): boolean {
    if (!solicitud) return false;
    if (this.tieneApelacionActiva(solicitud) || this.esApelacionResuelta(solicitud) || !!solicitud.apelacion?.expediente || !!solicitud.apelacion?.id) {
      return false;
    }
    const estado = (solicitud.estado || '').toUpperCase();
    return estado === 'DENEGADA' || estado === 'VENCIDA' || this.esSilencioAdministrativo(solicitud);
  }

  esSolicitudAtendida(solicitud: Solicitud | null): boolean {
    return this.puedePresentarApelacion(solicitud);
  }

  apelarSolicitud(solicitud: Solicitud): void {
    if (!solicitud) return;
    this.router.navigate(['/ciudadano/nueva-apelacion'], {
      queryParams: { solicitudId: solicitud.id }
    });
  }

  esSubsanacionVencida(solicitud: Solicitud | null): boolean {
    if (!solicitud) return false;
    if ((solicitud.apelacion?.estado || '').toUpperCase() === 'EN_SUBSANACION') {
      return solicitud.apelacion?.plazoSubsanacion?.estado === 'VENCIDO';
    }
    return false;
  }

  get isFirstVisit(): boolean {
    return this.tourService.isFirstVisit('saip_tour_done');
  }

  startTour(): void {
    this.tourService.startTour('saip_tour_done', this.tourSteps());
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

  // ── Pipeline methods ────────────────────────────────────────────
  selectStage(key: 'todas' | 'accion' | 'proceso' | 'respondidas' | 'apelar' | 'tribunal' | 'resueltas'): void {
    const misma = this.selectedStageKey() === key && this.stageSearch() === '' && this.stagePage() === 1 && !this.queryLoading();
    this.selectedStageKey.set(key);
    this.stageSearch.set('');
    this.stagePage.set(1);
    if (misma) {
      this.scrollToStageList();
      return;
    }
    this.scrollEtapaPendiente = true;
    this.cargarDatos(false);
  }

  private scrollToStageList(): void {
    if (typeof document === 'undefined') return;
    this.schedule(() => {
      document.querySelector('[data-tour="cola"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  onPrimary(s: Solicitud): void {
    if (this.loading() || this.error() || this.sessionRevision !== this.authService.cambiosSesion()
      || !this.todasSolicitudes().some(current => current.id === s.id && current.expediente === s.expediente)) return;
    if (this.selectedStageKey() === 'resueltas' && s.expediente) {
      this.router.navigate(['/ciudadano/solicitud', s.expediente]);
      return;
    }
    this.enfocarSolicitud(s.id);
  }

  estadoInsignia(s: Solicitud): string {
    if (this.esSegundaInstancia(s)) {
      if (s.apelacion?.resultado || (s.apelacion?.estado || '').startsWith('RESUELT')) {
        return s.apelacion?.resultado || 'Resuelto';
      }
      if (s.apelacion?.estado) {
        if (s.apelacion.estado === 'EN_SUBSANACION') return 'En subsanación';
        if (s.apelacion.estado === 'EN_CALIFICACION_1') return 'En primera calificación';
        if (s.apelacion.estado === 'EN_CALIFICACION_2') return 'En 2da Calificación';
        if (s.apelacion.estado === 'EN_RESOLUCION') return 'En Resolución Final';
        return this.formatoEstado(s.apelacion.estado);
      }
      return 'Etapa por confirmar';
    }
    const estado = (s.estado || '').toUpperCase();
    if (estado === 'RECEPCIONADA') return 'Recepcionada';
    if (estado === 'EN_REVISION') return 'En revisión';
    if (this.enPrecision(s)) return 'En precisión';
    if (estado === 'POR_RECOGER') return 'Por Recoger';
    if (estado === 'ENCAUZADA') return 'Encauzada';
    return this.formatoEstado(s.estado);
  }

  ubicacionTramite(s: Solicitud): UbicacionTramite {
    const estadoApelacion = (s.apelacion?.estado || '').toUpperCase();
    if (estadoApelacion === 'PENDIENTE_ELEVACION') {
      return { label: 'Pendiente de remisión al Tribunal', instancia: 'Ante la entidad', tone: 'var(--gold-dark)', iconName: 'scale' };
    }
    if (this.esApelacionResuelta(s)) {
      return { label: 'Resuelto por el Tribunal', instancia: '2ª instancia · TTAIP', tone: 'var(--success)', iconName: 'gavel' };
    }
    if (this.tieneApelacionActiva(s) || s.apelacion?.expediente) {
      return { label: 'En manos del Tribunal', instancia: '2ª instancia · TTAIP', tone: 'var(--brand-700)', iconName: 'scale' };
    }
    const estado = (s.estado || '').toUpperCase();
    if (this.enPrecision(s)) {
      const label = this.observacionPendiente(s) ? 'Debe precisar su solicitud' : 'En precisión';
      return { label, instancia: '1ª instancia · Entidad', tone: 'var(--warning)', iconName: 'alertTriangle' };
    }
    if (this.archivadaSinPrecision(s)) {
      return { label: 'Archivada por falta de precisión', instancia: '1ª instancia · Entidad', tone: 'var(--muted-foreground)', iconName: 'clock' };
    }
    if (estado === 'POR_RECOGER') {
      return { label: 'Lista para recoger en la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--gold-dark)', iconName: 'mailCheck' };
    }
    if (estado === 'ENCAUZADA') {
      return { label: 'Encauzada a la entidad competente', instancia: '1ª instancia · Entidad', tone: 'var(--info)', iconName: 'scale' };
    }
    if (estado === 'RESPONDIDA') {
      return { label: 'Resuelta por la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--success)', iconName: 'mailCheck' };
    }
    if (estado === 'DENEGADA') {
      return { label: 'Denegada por la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--brand-700)', iconName: 'building' };
    }
    if (estado === 'VENCIDA' || this.esSilencioAdministrativo(s)) {
      return { label: 'Sin respuesta · plazo vencido', instancia: '1ª instancia · Entidad', tone: 'var(--gold-dark)', iconName: 'clock' };
    }
    return { label: 'En revisión de la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--info)', iconName: 'building' };
  }

  filaUrgencia(s: Solicitud): IndicadorBandeja | null {
    const estado = (s.estado || '').toUpperCase();
    if (this.requiereSubsanacionTTAIP(s)) {
      if (s.apelacion?.plazoSubsanacion?.estado === 'VENCIDO') return { value: 'Vencido', unit: 'plazo de subsanación', tone: 'var(--destructive)' };
      const dias = this.calcularDiasRestantesSubsanacionDesdeSolicitud(s);
      return dias === null ? { value: s.apelacion?.plazoSubsanacion?.estado === 'PENDIENTE_INICIO' ? 'Pendiente' : 'No disponible', unit: s.apelacion?.plazoSubsanacion?.estado === 'PENDIENTE_INICIO' ? 'notificación eficaz' : 'información del plazo', tone: 'var(--muted-foreground)' }
        : { value: Math.max(0, dias), unit: 'días háb. para subsanar', tone: 'var(--brand-700)' };
    }
    const estadoApelacion = s.apelacion?.estado;
    if (estadoApelacion === 'PENDIENTE_ELEVACION') {
      return { value: 'Pendiente', unit: 'remisión al Tribunal', tone: 'var(--gold-dark)' };
    }
    if (estadoApelacion === 'EN_CALIFICACION_1' && !s.apelacion?.resolucionPrimeraCalificacion && !s.apelacion?.calificacionPrimera) {
      const plazo = s.apelacion?.plazoPrimeraCalificacion;
      if (!plazo || typeof plazo.vencido !== 'boolean' || !Number.isSafeInteger(plazo.diasRestantes)
        || plazo.diasRestantes < 0 || plazo.vencido !== (plazo.diasRestantes === 0)) {
        return { value: 'Por confirmar', unit: 'plazo de primera calificación', tone: 'var(--muted-foreground)' };
      }
      if (plazo.vencido) return { value: 'Plazo vencido', unit: 'primera calificación pendiente', tone: 'var(--warning)' };
      const dias = plazo.diasRestantes;
      return {
        value: dias,
        unit: dias === 1 ? 'día hábil para la primera calificación' : 'días hábiles para la primera calificación',
        tone: dias <= 1 ? 'var(--brand-700)' : dias <= 3 ? 'var(--warning)' : 'var(--info)'
      };
    }
    if (this.tieneApelacionActiva(s)) return { value: 'En revisión', unit: 'por el Tribunal', tone: 'var(--info)' };
    if (this.enPrecision(s)) return this.indicadorPrecision(s);
    if (this.archivadaSinPrecision(s)) {
      return { value: 'Archivada', unit: 'sin precisión presentada', tone: 'var(--muted-foreground)' };
    }
    if (this.esSilencioAdministrativo(s)) {
      return { value: 'Plazo vencido', unit: 'silencio administrativo negativo', tone: 'var(--brand-700)' };
    }
    if (estado === 'DENEGADA') {
      return this.indicadorApelacion(s);
    }
    if (this.estadosEnProceso.has(estado)) {
      const dias = this.diasRestantesParaEntidad(s);
      if (dias === null) {
        return { value: 'No disponible', unit: 'días háb. para que la entidad responda', tone: 'var(--info)' };
      }
      if (dias === 0) return { value: 'Último día', unit: 'para que la entidad responda', tone: 'var(--brand-700)' };
      return {
        value: dias,
        unit: dias === 1 ? 'día háb. para que la entidad responda' : 'días háb. para que la entidad responda',
        tone: dias <= 2 ? 'var(--brand-700)' : 'var(--info)'
      };
    }
    return null;
  }

  goStagePage(page: number): void {
    const next = Math.max(1, Math.min(page, this.stageTotalPages()));
    if (next === this.stagePage()) return;
    this.stagePage.set(next);
    this.scrollEtapaPendiente = true;
    this.cargarDatos(false);
  }

  onStageSearchChange(value: string): void {
    this.stageSearch.set(value.slice(0, 120)); this.stagePage.set(1);
    clearTimeout(this.searchTimer); this.read?.unsubscribe(); this.generation++; this.todasSolicitudes.set([]); this.queryLoading.set(true);
    this.searchTimer = setTimeout(() => this.cargarDatos(false), 250);
  }

  clearStageSearch(): void { this.stageSearch.set(''); this.stagePage.set(1); this.cargarDatos(false); }
  padCount(count: number): string {
    return String(count).padStart(2, '0');
  }

  esApelacionResuelta(solicitud: Solicitud): boolean {
    const estadoApelacion = (solicitud.apelacion?.estado || '').toUpperCase();
    return estadoApelacion.startsWith('RESUELTO')
      || estadoApelacion === 'CONCLUSION_SUSTRACCION_MATERIA'
      || estadoApelacion === 'CONCLUSION_DESISTIMIENTO'
      || estadoApelacion === 'TENER_POR_NO_PRESENTADO';
  }

  private normalizeText(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

  esSilencioAdministrativo(solicitud: Solicitud): boolean {
    if (solicitud.respuesta && solicitud.respuesta.tipoRespuesta !== 'SILENCIO_ADMINISTRATIVO') return false;
    const estado = (solicitud.estado || '').toUpperCase();
    return !this.enPrecision(solicitud) && (this.estadosEnProceso.has(estado) || estado === 'VENCIDA')
      && isSilencioAdministrativo(solicitud);
  }

  private validarSolicitudes(data: Solicitud[], citizen: number | undefined): boolean {
    const ids = new Set<number>();
    return data.every(item => {
      if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || !item.expediente || !item.estado || item.ciudadanoId !== citizen || ids.has(item.id)) return false;
      ids.add(item.id); return true;
    });
  }

  private calcularEstadisticas(): void {
    const summary = this.resumen();
    this.totalSolicitudes.set(summary?.total ?? 0);
    this.enProceso.set(summary?.porEtapa['proceso'] ?? 0);
    this.respondidas.set(summary?.porEstado['RESPONDIDA'] ?? 0);
    this.denegadas.set(summary?.porEstado['DENEGADA'] ?? 0);
    this.vencidas.set(summary?.porEstado['VENCIDA'] ?? 0);
    this.tieneApelables.set((summary?.porEtapa['apelar'] ?? 0) > 0);
  }

  private construirAccionPrincipal(solicitud: Solicitud | null): DashboardAction | null {
    if (!solicitud) return null;

    const expediente = solicitud.expediente;
    if (!expediente) return null;
    const entidad = solicitud.entidadNombre || 'Entidad no especificada';
    const estadoApelacion = (solicitud.apelacion?.estado || '').toUpperCase();

    if (estadoApelacion === 'EN_SUBSANACION' && solicitud.apelacion?.expediente) {
      const diasSubsanacion = this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud);
      const inicioPendiente = solicitud.apelacion.plazoSubsanacion?.estado === 'PENDIENTE_INICIO';
      if (solicitud.apelacion.plazoSubsanacion?.estado === 'VENCIDO') {
        // Expired subsanación cannot be acted upon today -> do not display in "Lo que debe hacer hoy"
        return null;
      }
      return {
        eyebrow: inicioPendiente ? 'Plazo pendiente de inicio' : diasSubsanacion === null ? 'Plazo no disponible' : 'Subsanación ante el Tribunal',
        titulo: 'Revise las observaciones del Tribunal',
        detalle: 'Consulte el requerimiento y, si corresponde, presente su subsanación. El inicio y vencimiento del plazo se muestran según la evidencia registrada.',
        metricValue: inicioPendiente ? 'Pendiente' : diasSubsanacion === null ? 'No disponible' : `${diasSubsanacion}`,
        metricUnit: inicioPendiente ? 'notificación eficaz' : diasSubsanacion === null ? 'información del plazo' : 'días hábiles',
        ctaLabel: 'Completar subsanación',
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
        detalle: `Consulte la elevación registrada. Fecha límite informada: ${this.formatDate(elevacion?.fechaLimiteElevacion) || 'no disponible'}.`,
        metricValue: 'Pendiente',
        metricUnit: 'elevación',
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
      const primeraCalificacion = estadoApelacion === 'EN_CALIFICACION_1' && !solicitud.apelacion?.resolucionPrimeraCalificacion
        && !solicitud.apelacion?.calificacionPrimera;
      const plazo = primeraCalificacion ? this.filaUrgencia(solicitud) : null;
      return {
        eyebrow: 'En revisión del Tribunal',
        titulo: primeraCalificacion ? 'Su apelación está en primera calificación' : 'El Tribunal está revisando su apelación',
        detalle: primeraCalificacion ? 'El Tribunal revisará si su recurso cumple los requisitos. Puede seguir el resultado en el detalle de la solicitud.'
          : 'Abra el expediente para ver la etapa de su apelación y las decisiones disponibles.',
        metricValue: plazo ? String(plazo.value) : '·',
        metricUnit: plazo?.unit ?? 'en estudio',
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
    if (this.enPrecision(solicitud)) {
      if (!this.observacionPendiente(solicitud)) return null;
      const indicador = this.indicadorPrecision(solicitud);
      return {
        eyebrow: 'Subsanación · 1ª instancia (entidad)',
        titulo: 'Revise la precisión solicitada por la entidad',
        detalle: `${entidad} necesita que precise su solicitud. Consulte el requerimiento antes de presentar su precisión.`,
        metricValue: String(indicador.value),
        metricUnit: indicador.nota ? `${indicador.unit} · ${indicador.nota}` : indicador.unit,
        ctaLabel: 'Revisar precisión',
        route: ['/ciudadano/precision', expediente],
        icon: 'alert',
        toneColor: 'var(--brand-700)',
        toneBg: 'linear-gradient(135deg, var(--brand-subtle), var(--card) 70%)',
        toneSoft: 'var(--brand-200)',
        expediente,
        entidad,
      };
    }

    if (estado === 'POR_RECOGER') {
      const diasCalendario = typeof solicitud.diasRestantes === 'number' ? Math.max(0, solicitud.diasRestantes) : null;
      return {
        eyebrow: 'Listo para recoger · entrega física',
        titulo: 'Recoja su información en la entidad',
        detalle: `Su información está lista. Presente su comprobante de pago y documento de identidad en ${entidad} para el recojo presencial.`,
        metricValue: diasCalendario !== null ? `${diasCalendario}` : 'Consultar',
        metricUnit: diasCalendario !== null ? 'días calendario' : 'plazo no informado',
        ctaLabel: 'Ver cupón de pago',
        route: ['/ciudadano/solicitud', expediente],
        icon: 'check',
        toneColor: 'var(--gold-dark)',
        toneBg: 'linear-gradient(135deg, rgba(176,136,66,0.12), var(--card) 70%)',
        toneSoft: 'rgba(176,136,66,0.30)',
        expediente,
        entidad,
      };
    }

    if (solicitud.encauzamientoAlcance === 'TOTAL' && (estado === 'RECEPCIONADA' || estado === 'EN_REVISION') && !solicitud.respuesta) {
      return {
        eyebrow: 'Solicitud encauzada a otra entidad',
        titulo: 'Su solicitud fue derivada',
        detalle: `El expediente ${expediente} sigue siendo el mismo. Ahora lo atiende ${entidad}. No se creó otra solicitud ni se registró una denegatoria.`,
        metricValue: '→',
        metricUnit: 'derivada',
        ctaLabel: 'Ver encauzamiento',
        route: ['/ciudadano/solicitud', expediente],
        icon: 'scale',
        toneColor: 'var(--info)',
        toneBg: 'linear-gradient(135deg, rgba(29,78,216,0.10), var(--card) 70%)',
        toneSoft: 'rgba(29,78,216,0.25)',
        expediente,
        entidad,
      };
    }

    if (estado === 'ENCAUZADA') {
      return {
        eyebrow: 'Solicitud encauzada a otra entidad',
        titulo: 'Su solicitud fue derivada',
        detalle: `${entidad} no era la entidad competente y derivó su solicitud a la entidad correspondiente, que la atenderá según su competencia.`,
        metricValue: '→',
        metricUnit: 'derivada',
        ctaLabel: 'Ver encauzamiento',
        route: ['/ciudadano/solicitud', expediente],
        icon: 'scale',
        toneColor: 'var(--info)',
        toneBg: 'linear-gradient(135deg, rgba(29,78,216,0.10), var(--card) 70%)',
        toneSoft: 'rgba(29,78,216,0.25)',
        expediente,
        entidad,
      };
    }

    if (estado === 'DENEGADA' || estado === 'VENCIDA' || this.esSilencioAdministrativo(solicitud)) {
      const esSilencio = estado === 'VENCIDA' || this.esSilencioAdministrativo(solicitud);
      const apelacion = this.indicadorApelacion(solicitud);
      return {
        eyebrow: esSilencio ? 'Silencio administrativo · puede apelar' : 'Consulta de apelación',
        titulo: 'Revise las opciones de apelación',
        detalle: esSilencio
          ? 'La entidad no respondió dentro del plazo legal. Puede presentar apelación por silencio administrativo negativo.'
          : 'La entidad denegó su solicitud. Puede presentar apelación dentro de 15 días hábiles desde el día siguiente a la respuesta registrada.',
        metricValue: String(apelacion.value),
        metricUnit: apelacion.unit,
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
        titulo: 'La entidad registró una respuesta',
        detalle: 'Consulte la respuesta registrada y los documentos que existan en el detalle. Este estado no acredita entrega ni notificación eficaz.',
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

    if (!this.estadosEnProceso.has(estado)) return null;
    const diasEntidad = this.diasRestantesParaEntidad(solicitud);
    const diasVal = diasEntidad === null ? 'No disponible' : diasEntidad === 0 ? 'Último día' : String(diasEntidad);
    return {
      eyebrow: 'Seguimiento de solicitud',
      titulo: 'Consulte su solicitud en la entidad',
      detalle: `Consulte el estado y las actuaciones registradas por ${entidad}.`,
      metricValue: diasVal,
      metricUnit: diasEntidad === 0 ? 'para que la entidad responda' : diasVal === '1' ? 'día hábil para responder' : 'días hábiles para responder',
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

    const observaciones = this.observacionesDeSolicitud(solicitud).sort((a, b) =>
      (a.fechaObservacion ?? '').localeCompare(b.fechaObservacion ?? ''));
    for (const obs of observaciones) {
      const pendiente = this.enPrecision(solicitud) && obs.estado === 'PENDIENTE_SUBSANACION';
      steps.push({
        key: `precision-${obs.id}`, label: 'Solicitud de precisión', date: this.formatDate(obs.fechaObservacion),
        meta: pendiente ? 'En espera de su precisión' : undefined, status: pendiente ? 'active' : 'done',
      });
      if (obs.estado === 'SUBSANADA') {
        steps.push({
          key: `precision-registrada-${obs.id}`, label: 'Precisión registrada',
          date: this.formatDate(obs.fechaSubsanacion), status: 'done',
        });
      }
    }

    if (solicitud.encauzamientoAlcance === 'TOTAL' || solicitud.encauzamientoAlcance === 'PARCIAL') {
      steps.push({
        key: 'encauzamiento',
        label: solicitud.encauzamientoAlcance === 'TOTAL' ? 'Encauzada a otra entidad' : 'Encauzamiento parcial',
        status: 'done',
      });
    }

    const ampliacion = this.ampliacionCoincidente(solicitud);
    const atiendePlazo = this.estadosEnProceso.has(estado)
      && !this.enPrecision(solicitud)
      && !this.archivadaSinPrecision(solicitud)
      && !this.esSilencioAdministrativo(solicitud);
    if (ampliacion && !atiendePlazo) {
      const original = this.formatDate(ampliacion.fechaLimiteOriginal);
      const ampliada = this.formatDate(ampliacion.fechaLimiteAmpliada);
      steps.push({
        key: 'plazo-prolongado',
        label: 'Plazo prolongado',
        date: this.formatDate(ampliacion.fechaNotificacionAmpliacion),
        meta: original && ampliada ? `De ${original} a ${ampliada}` : undefined,
        status: 'done',
      });
    }

    if (this.enPrecision(solicitud)) {
      steps.push({ key: 'respuesta', label: 'Respuesta de la entidad', status: 'pending' });
    } else if (this.archivadaSinPrecision(solicitud)) {
      steps.push({ key: 'archivo', label: 'Archivada sin precisión', status: 'done' });
    } else if (this.esSilencioAdministrativo(solicitud)) {
      steps.push({ key: 'plazo-entidad', label: 'Plazo vencido - SAN', status: 'done', meta: 'Silencio administrativo negativo' });
      steps.push({ key: 'respuesta', label: 'Sin respuesta de la entidad', status: 'skipped' });
      steps.push({ key: 'apelacion', label: 'Puede apelar al Tribunal', status: this.tieneApelacionActiva(solicitud) ? 'done' : 'active' });
    } else if (this.estadosEnProceso.has(estado)) {
      const dias = this.diasRestantesParaEntidad(solicitud);
      const vencimiento = this.formatDate(solicitud.fechaLimite);
      const diasLabel = dias === null ? 'Plazo en evaluación' : dias === 0 ? 'Último día para responder'
        : `${dias} ${dias === 1 ? 'día hábil' : 'días hábiles'}`;
      const original = ampliacion ? this.formatDate(ampliacion.fechaLimiteOriginal) : '';
      const ampliada = ampliacion ? this.formatDate(ampliacion.fechaLimiteAmpliada) : '';
      const meta = original && ampliada
        ? `${diasLabel} - prolongado de ${original} a ${ampliada}`
        : `${diasLabel}${vencimiento ? ` - fecha límite ${vencimiento}` : ''}`;
      steps.push({
        key: 'plazo-entidad',
        label: 'Plazo de la entidad',
        meta,
        status: 'active'
      });
      steps.push({ key: 'respuesta', label: 'Respuesta de la entidad', status: 'pending' });
    } else if (estado === 'RESPONDIDA') {
      const resultado = solicitud.respuesta?.tipoRespuesta ? this.formatoEstado(solicitud.respuesta.tipoRespuesta) : 'Recibida';
      steps.push({
        key: 'respuesta',
        label: `Respuesta - ${resultado}`,
        date: this.formatDate(solicitud.respuesta?.fechaRespuesta),
        status: 'done'
      });
    } else if (estado === 'DENEGADA') {
      steps.push({ key: 'plazo-entidad', label: 'Denegatoria registrada', status: 'done' });
      steps.push({ key: 'respuesta', label: 'Denegada por la entidad', date: this.formatDate(solicitud.respuesta?.fechaRespuesta), status: 'done' });
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

    if (this.enPrecision(solicitud)) {
      return 110;
    }

    if (estadoApelacion === 'EN_SUBSANACION') {
      if (solicitud.apelacion?.plazoSubsanacion?.estado === 'VENCIDO') return 0;
      const dias = this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud);
      return dias === null ? 85 : Math.max(1, 100 - dias * 8);
    }

    if (estado === 'DENEGADA' && !this.esSilencioAdministrativo(solicitud)) {
      const d = typeof solicitud.diasRestantes === 'number' ? solicitud.diasRestantes : null;
      return d !== null && d > 0 ? Math.max(1, 80 - d) : 78;
    }

    if (estado === 'VENCIDA' || this.esSilencioAdministrativo(solicitud)) {
      return 75;
    }

    if (estado === 'POR_RECOGER') {
      return 70;
    }

    if (this.estadosEnProceso.has(estado)) {
      const dias = this.diasRestantesParaEntidad(solicitud);
      return dias !== null && dias <= 2 ? 60 : 20;
    }

    if (estado === 'RESPONDIDA') {
      return 30;
    }

    if (this.tieneApelacionActiva(solicitud)) {
      return 25;
    }

    if (estado === 'ENCAUZADA') {
      return 15;
    }

    return 0;
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

  private enPrecision(solicitud: Solicitud): boolean {
    return ['PENDIENTE_INFORMACION', 'EN_PRECISION', 'OBSERVADA'].includes((solicitud.estado || '').toUpperCase());
  }

  private observacionesDeSolicitud(solicitud: Solicitud) {
    return (solicitud.observaciones ?? []).filter(obs => obs?.id != null && Number.isSafeInteger(obs.id)
      && obs.id > 0 && obs.solicitudId === solicitud.id);
  }

  private observacionPendiente(solicitud: Solicitud) {
    return this.observacionesDeSolicitud(solicitud).find(obs => obs.estado === 'PENDIENTE_SUBSANACION');
  }

  private archivadaSinPrecision(solicitud: Solicitud): boolean {
    return ['CONCLUIDA', 'ARCHIVADA'].includes((solicitud.estado || '').toUpperCase())
      && this.observacionesDeSolicitud(solicitud).some(obs => obs.estado === 'NO_SUBSANADA' || obs.estado === 'ARCHIVADA');
  }

  private indicadorPrecision(solicitud: Solicitud): IndicadorBandeja {
    const dias = this.observacionPendiente(solicitud)?.diasRestantes;
    const tone = 'var(--warning)';
    if (dias == null || !Number.isSafeInteger(dias)) {
      return { value: 'Plazo no disponible', unit: 'solicitud de precisión', tone };
    }
    if (dias < 0) return { value: 'Fecha registrada vencida', unit: 'precisión pendiente', tone };
    const nota = 'Según la fecha registrada';
    if (dias === 0) return { value: 'Último día', unit: 'para precisar', tone, nota };
    return { value: dias, unit: dias === 1 ? 'día hábil para precisar' : 'días hábiles para precisar', tone, nota };
  }

  private aplicarAmpliacion(id: number, lista: AmpliacionPlazoSolicitud[] | null): void {
    if (this.destroyed || this.solicitudPrincipal()?.id !== id) return;
    const ampliacion = lista?.find(item => item.solicitudId === id && item.estadoAmpliacion !== 'CANCELADA') ?? null;
    this.ampliacionSolicitudId.set(id);
    this.ampliacionVista.set(ampliacion);
  }

  private ampliacionCoincidente(solicitud: Solicitud | null): AmpliacionPlazoSolicitud | null {
    const ampliacion = this.ampliacionVista();
    if (!solicitud || !ampliacion || ampliacion.solicitudId !== solicitud.id || ampliacion.estadoAmpliacion === 'CANCELADA') return null;
    return ampliacion;
  }

  private indicadorApelacion(solicitud: Solicitud): IndicadorBandeja {
    if ((solicitud.estado || '').toUpperCase() === 'VENCIDA' || this.esSilencioAdministrativo(solicitud)) {
      return { value: 'Sin', unit: 'plazo perentorio', tone: 'var(--gold-dark)' };
    }
    const dias = this.diasParaApelar(solicitud);
    if (dias === null) return { value: 'No disponible', unit: 'días para apelar', tone: 'var(--gold-dark)' };
    if (dias < 0) return { value: 'Vencido', unit: 'plazo para apelar', tone: 'var(--brand-700)' };
    if (dias === 0) return { value: 'Último día', unit: 'para apelar', tone: 'var(--brand-700)' };
    return {
      value: dias,
      unit: dias === 1 ? 'día hábil para apelar' : 'días hábiles para apelar',
      tone: dias <= 3 ? 'var(--brand-700)' : 'var(--gold-dark)',
    };
  }

  /** 15 días hábiles del mapa, contados desde el día siguiente a la respuesta registrada. */
  private diasParaApelar(solicitud: Solicitud): number | null {
    const ancla = aISO(solicitud.respuesta?.fechaRespuesta);
    if (!ancla) return null;
    const limite = sumarHabiles(ancla, 15);
    const hoy = hoyLima();
    if (hoy > limite) return -1;
    const desde = hoy <= ancla ? ancla : sumarDias(hoy, -1);
    return habilesEntre(desde, limite);
  }

  private diasRestantesParaEntidad(solicitud: Solicitud): number | null {
    return typeof solicitud.diasRestantes === 'number' && Number.isFinite(solicitud.diasRestantes) ? solicitud.diasRestantes : null;
  }

  private calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud: Solicitud): number | null {
    const plazo = solicitud.apelacion?.plazoSubsanacion;
    return !plazo || plazo.estado === 'PENDIENTE_INICIO' ? null : plazo.diasHabilesRestantes ?? null;
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
  private schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const generation = this.generation, revision = this.sessionRevision;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.destroyed && generation === this.generation && revision === this.authService.cambiosSesion()) callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

}
