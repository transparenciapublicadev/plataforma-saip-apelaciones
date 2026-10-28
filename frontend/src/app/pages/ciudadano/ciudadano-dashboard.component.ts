import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SolicitudService } from '../../services/solicitud.service';
import { Subscription } from 'rxjs';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { TourStep } from '../../core/guided-tour/guided-tour.model';
import { AuthService } from '../../services/auth.service';
import { ProfileDialogService } from '../../services/profile-dialog.service';
import { Solicitud } from '../../models/solicitud.model';
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
  restantes: number | null;
  tone: string;
  fechaLimite?: string;
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
  private readonly solicitudService = inject(SolicitudService);
  private readonly tourService = inject(GuidedTourService);
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

  loading = signal<boolean>(true);
  error = signal<string>('');
  readonly errorTipo = signal<'sesion' | 'permiso' | 'validacion' | 'inexistente' | 'servidor' | 'red' | 'incompleta' | null>(null);
  private read?: Subscription;
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

  busqueda = '';
  busquedaEnfocada = signal<boolean>(false);
  mostrarResultadosBusqueda = signal<boolean>(false);

  guideOpen = signal<boolean>(true);
  historicoOpen = signal<boolean>(false);
  showAllSecundarias = signal<boolean>(false);
  selectedSolicitudId = signal<number | null>(null);
  accionResaltada = signal<boolean>(false);

  // Pipeline state
  selectedStageKey = signal<'todas' | 'accion' | 'proceso' | 'respondidas' | 'apelar' | 'tribunal' | 'resueltas'>('todas');
  stageSearch = signal<string>('');
  stagePage = signal<number>(1);
  readonly PER_PAGE = 4;

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
  readonly timelineDisplaySteps = computed(() => this.timelinePrincipal().slice(0, 5));

  readonly plazoEntidadPrincipal = computed<PlazoEntidadView | null>(() => {
    const solicitud = this.solicitudPrincipal();
    if (!solicitud) return null;

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
    const activas = this.solicitudesActivas();
    if (!activas.length) {
      return 'Aún no tiene solicitudes activas. Cuando lo necesite, puede pedir informacion a cualquier entidad publica.';
    }

    const cantidad = activas.length;
    const base = `Aquí están sus ${cantidad} solicitud${cantidad === 1 ? '' : 'es'} en curso`;
    return this.accionPrincipal() ? `${base}. Le mostramos lo que conviene hacer hoy.` : `${base}.`;
  });

  esSegundaInstancia(s: Solicitud): boolean {
    return !!s.apelacion?.expediente || !!s.apelacion?.resultado || !!s.apelacion?.estado;
  }

  requiereSubsanacionTTAIP(s: Solicitud): boolean {
    return !!s.apelacion?.expediente && (s.apelacion?.estado || '').toUpperCase() === 'EN_SUBSANACION';
  }

  requiereAccion(s: Solicitud): boolean {
    const estado = (s.estado || '').toUpperCase();
    return (estado === 'PENDIENTE_INFORMACION' && s.observaciones?.some(o => o.estado === 'PENDIENTE_SUBSANACION')) || estado === 'EN_PRECISION' || estado === 'POR_RECOGER' || estado === 'OBSERVADA' || this.requiereSubsanacionTTAIP(s);
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
          && !this.tieneApelacionActiva(s) && !this.requiereAccion(s);
      }),
      respondidas: historicos1,
      apelar: activos.filter(s => {
        const st = (s.estado || '').toUpperCase();
        return (st === 'DENEGADA' || st === 'VENCIDA') && !this.tieneApelacionActiva(s) && !this.requiereAccion(s);
      }),
      tribunal: activos.filter(s => this.tieneApelacionActiva(s) && !this.requiereSubsanacionTTAIP(s)),
      resueltas: historicos2,
    };
  });

  readonly pipeline = computed<PipelineStage[]>(() => {
    const b = this.stageBuckets();
    return [
      { key: 'todas', num: '00', iconName: 'layers', color: 'var(--foreground)', bg: 'var(--muted)', label: 'Todas', desc: 'Ver el historial completo de sus solicitudes', count: b.todas.length },
      { key: 'accion', num: '01', iconName: 'alertTriangle', color: 'var(--warning)', bg: 'var(--warning-subtle)', label: 'Requieren su acción', desc: 'Subsane ante la entidad (1ª) o el Tribunal (2ª), o recoja su información', count: b.accion.length },
      { key: 'proceso', num: '02', iconName: 'hourglass', color: 'var(--info)', bg: 'var(--info-subtle)', label: 'Pendiente en la entidad', desc: 'La entidad aún no responde su solicitud', count: b.proceso.length },
      { key: 'respondidas', num: '03', iconName: 'mailCheck', color: 'var(--success)', bg: 'var(--success-subtle)', label: 'Respondida por la entidad', desc: 'La entidad registró una respuesta', count: b.respondidas.length },
      { key: 'apelar', num: '04', iconName: 'scale', color: 'var(--gold-dark)', bg: 'rgba(176,136,66,0.10)', label: 'Consultar apelación', desc: 'Si no está conforme con la respuesta, puede llevar su caso al Tribunal', count: b.apelar.length },
      { key: 'tribunal', num: '05', iconName: 'gavel', color: 'var(--brand-700)', bg: 'var(--brand-subtle)', label: 'En revisión del Tribunal', desc: 'Usted apeló; el Tribunal evalúa el caso', count: b.tribunal.length },
      { key: 'resueltas', num: '06', iconName: 'checkCircle', color: 'var(--muted-foreground)', bg: 'var(--muted)', label: 'Resuelta por el Tribunal', desc: 'El Tribunal registró el resultado del recurso', count: b.resueltas.length },
    ];
  });

  readonly selectedStageMeta = computed(() => this.pipeline().find(s => s.key === this.selectedStageKey()) ?? this.pipeline()[0]);
  readonly stageAll = computed(() => this.stageBuckets()[this.selectedStageKey()] ?? []);

  readonly stageFiltered = computed(() => {
    const all = this.stageAll();
    const q = this.normalizeText(this.stageSearch().trim());
    if (!q) return all;
    const terms = q.split(/\s+/).filter(Boolean);
    return all.filter(s => {
      const hay = this.normalizeText([
        s.expediente || '',
        s.entidadNombre || '',
        s.asunto || '',
        s.apelacion?.expediente || '',
        this.estadoInsignia(s),
        this.estadoHumano(s)
      ].join(' '));
      return terms.every(t => hay.includes(t));
    });
  });

  readonly stageTotalPages = computed(() => Math.max(1, Math.ceil(this.stageFiltered().length / this.PER_PAGE)));
  readonly stageSafePage = computed(() => Math.min(this.stagePage(), this.stageTotalPages()));
  readonly stageVisible = computed(() => {
    const filtered = this.stageFiltered();
    const start = (this.stageSafePage() - 1) * this.PER_PAGE;
    return filtered.slice(start, start + this.PER_PAGE);
  });
  readonly stageRangeFrom = computed(() => this.stageFiltered().length === 0 ? 0 : (this.stageSafePage() - 1) * this.PER_PAGE + 1);
  readonly stageRangeTo = computed(() => Math.min(this.stageSafePage() * this.PER_PAGE, this.stageFiltered().length));

  // ── Buscador Global ───────────────────────────────────────────────────
  globalQuery = signal<string>('');
  globalIdx = signal<number>(0);

  readonly globalTerms = computed(() => {
    const q = this.normalizeText(this.globalQuery().trim());
    return q.split(/\s+/).filter(Boolean);
  });

  readonly globalOpen = computed(() => this.globalTerms().length > 0);

  readonly globalResults = computed<Solicitud[]>(() => {
    const terms = this.globalTerms();
    if (!terms.length) return [];
    const all = this.todasSolicitudes();
    return all.filter(s => {
      const hay = this.normalizeText([
        s.expediente || '',
        s.apelacion?.expediente || '',
        s.entidadNombre || '',
        s.asunto || '',
        s.estado || '',
        this.estadoInsignia(s),
        s.apelacion?.estado || '',
        s.apelacion?.resultado || '',
        this.esSegundaInstancia(s) ? '2a segunda instancia ttaip tribunal apelacion' : '1a primera instancia entidad'
      ].join(' '));
      return terms.every(t => hay.includes(t));
    });
  });

  onGlobalSearchChange(val: string): void {
    this.globalQuery.set(val);
    this.globalIdx.set(0);
  }

  clearGlobalSearch(): void {
    this.globalQuery.set('');
    this.globalIdx.set(0);
  }

  abrirExpediente(s: Solicitud): void {
    if (this.loading() || this.error() || this.sessionRevision !== this.authService.cambiosSesion()
      || !this.todasSolicitudes().some(current => current.id === s.id && current.expediente === s.expediente)) return;
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
      { selector: '[data-tour="resumen"]', title: 'Mis solicitudes de un vistazo', body: 'La cuantificación de todas sus solicitudes por etapa: en proceso, respondidas, por apelar, en el Tribunal y con fallo final. Toque una etapa para filtrar la lista de abajo.' },
    ];
    if (this.accionPrincipal()) {
      s.push({ selector: '[data-tour="accion"]', title: 'Solicitud para revisar', body: 'Un resumen para revisar de todas sus solicitudes. Si algo requiere su atención (subsanar, apelar, revisar), aparece aquí primero.' });
    }
    if (this.solicitudPrincipal()) {
      s.push({ selector: '[data-tour="detalle"]', title: 'Está viendo esta solicitud', body: 'La línea de tiempo del expediente seleccionado y su ubicación actual: "con la entidad" (1ª instancia) o "en el Tribunal" (2ª instancia). Aquí ve la trazabilidad completa.' });
    }
    s.push({ selector: '[data-tour="cola"]', title: 'La lista de la etapa', body: 'Todos los expedientes de la etapa seleccionada, ordenados y con su propio buscador. Toque cualquiera para verlo en detalle arriba, sin desplazarse de más.' });
    s.push({ selector: '[data-tour="ayuda"]', title: '¿Necesita ayuda?', body: 'Canales de orientación gratuitos. Desde aquí también puede volver a ver este tutorial cuando quiera.' });
    return s;
  });

  readonly ubicacionPrincipal = computed<UbicacionTramite | null>(() => {
    const s = this.solicitudPrincipal();
    if (!s) return null;
    const estado = (s.estado || '').toUpperCase();
    if (this.esApelacionResuelta(s)) return { label: 'Resuelto por el Tribunal', instancia: '2ª instancia · TTAIP', tone: 'var(--success)', iconName: 'gavel' };
    if (this.tieneApelacionActiva(s)) return { label: 'En manos del Tribunal', instancia: '2ª instancia · TTAIP', tone: 'var(--brand-700)', iconName: 'scale' };
    if (estado === 'RESPONDIDA') return { label: 'Resuelta por la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--success)', iconName: 'mailCheck' };
    if (estado === 'DENEGADA') return { label: 'Denegada por la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--brand-700)', iconName: 'building' };
    if (estado === 'VENCIDA') return { label: 'Sin respuesta · plazo vencido', instancia: '1ª instancia · Entidad', tone: 'var(--gold-dark)', iconName: 'clock' };
    return { label: 'En revisión de la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--info)', iconName: 'building' };
  });

  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (this.initialized && revision !== this.sessionRevision) untracked(() => this.cargarDatos());
    });
    effect(() => {
      if (this.tourService.isOpen()) {
        this.mostrarResultadosBusqueda.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    ++this.generation;
    this.read?.unsubscribe();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  cargarDatos(): void {
    const generation = ++this.generation;
    this.read?.unsubscribe();
    this.timers.forEach(timer => clearTimeout(timer)); this.timers.clear();
    this.todasSolicitudes.set([]); this.calcularEstadisticas([]);
    this.selectedSolicitudId.set(null); this.selectedStageKey.set('todas'); this.stagePage.set(1);
    this.stageSearch.set(''); this.globalQuery.set(''); this.globalIdx.set(0); this.accionResaltada.set(false);
    this.error.set(''); this.errorTipo.set(null); this.loading.set(true);
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
      this.loading.set(false); return;
    }
    const current = () => {
      try {
        return !this.destroyed && generation === this.generation && revision === this.authService.cambiosSesion()
          && token === this.authService.obtenerSesion()?.token;
      } catch { return false; }
    };
    // SolicitudDTO already includes the linked appeal and its accredited clock.
    this.read = this.solicitudService.findByCiudadanoId(citizen).subscribe({
      next: data => {
        if (!current()) return;
        if (!Array.isArray(data) || data.some(item => !item || !Number.isSafeInteger(item.id) || item.id <= 0 || !item.expediente || !item.estado || item.ciudadanoId !== citizen)) {
          this.errorTipo.set('incompleta'); this.error.set('La información recibida está incompleta o no corresponde a esta consulta. Reintente la consulta.');
          this.loading.set(false); return;
        }
        this.todasSolicitudes.set(data); this.calcularEstadisticas(data);
        const order: Array<PipelineStage['key']> = ['accion', 'proceso', 'apelar', 'tribunal', 'respondidas', 'resueltas', 'todas'];
        this.selectedStageKey.set(order.find(key => this.stageBuckets()[key].length > 0) || 'todas');
        this.loading.set(false);
        this.tourService.checkAutoStart('saip_tour_done', this.tourSteps());
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
        this.loading.set(false);
      },
    });
  }

  onSearchFocus(): void {
    this.busquedaEnfocada.set(true);
    this.mostrarResultadosBusqueda.set(this.busqueda.trim().length > 0);
  }

  onSearchBlur(): void {
    this.schedule(() => {
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

  esSolicitudAtendida(solicitud: Solicitud | null): boolean {
    if (!solicitud || solicitud.apelacion) return false;
    const estado = (solicitud.estado || '').toUpperCase();
    const estadosAtendidas = new Set([
      'RESPONDIDA',
      'CON_RESPUESTA',
      'ENTREGADA',
      'DENEGADA',
      'ENTREGA_PARCIAL',
      'ENTREGA_TOTAL',
      'PUEDE_APELAR',
      'OBSERVADA',
      'VENCIDA',
      'ATENDIDA',
      'FINALIZADA',
      'RESUELTA'
    ]);
    return estadosAtendidas.has(estado);
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
    this.selectedStageKey.set(key);
    this.stageSearch.set('');
    this.stagePage.set(1);

    this.schedule(() => {
      const element = document.getElementById('seccion-etapa-enfocada');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        document.querySelector('[data-tour="cola"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  onPrimary(s: Solicitud): void {
    if (this.loading() || this.error() || this.sessionRevision !== this.authService.cambiosSesion()
      || !this.todasSolicitudes().some(current => current.id === s.id && current.expediente === s.expediente)) return;
    const esResueltas = this.selectedStageKey() === 'resueltas';
    const esRespondidas = this.selectedStageKey() === 'respondidas';
    if (esResueltas || esRespondidas) {
      if (s.expediente) {
        this.router.navigate(['/ciudadano/solicitud', s.expediente]);
      } else {
        this.enfocarSolicitud(s.id);
      }
    } else {
      this.enfocarSolicitud(s.id);
    }
  }

  estadoInsignia(s: Solicitud): string {
    if (this.esSegundaInstancia(s)) {
      if (s.apelacion?.resultado || (s.apelacion?.estado || '').startsWith('RESUELT')) {
        return s.apelacion?.resultado || 'Resuelto';
      }
      if (s.apelacion?.estado) {
        if (s.apelacion.estado === 'EN_SUBSANACION') return 'En subsanación';
        if (s.apelacion.estado === 'EN_CALIFICACION_1') return 'En 1ra Calificación';
        if (s.apelacion.estado === 'EN_CALIFICACION_2') return 'En 2da Calificación';
        if (s.apelacion.estado === 'EN_RESOLUCION') return 'En Resolución Final';
        return this.formatoEstado(s.apelacion.estado);
      }
      return 'En 1ra Calificación';
    }
    const estado = (s.estado || '').toUpperCase();
    if (estado === 'EN_PRECISION') return 'En Precisión';
    if (estado === 'POR_RECOGER') return 'Por Recoger';
    if (estado === 'ENCAUZADA') return 'Encauzada';
    return this.formatoEstado(s.estado);
  }

  ubicacionTramite(s: Solicitud): UbicacionTramite {
    const estadoApelacion = (s.apelacion?.estado || '').toUpperCase();
    if (this.esApelacionResuelta(s)) {
      return { label: 'Resuelto por el Tribunal', instancia: '2ª instancia · TTAIP', tone: 'var(--success)', iconName: 'gavel' };
    }
    if (this.tieneApelacionActiva(s) || s.apelacion?.expediente) {
      return { label: 'En manos del Tribunal', instancia: '2ª instancia · TTAIP', tone: 'var(--brand-700)', iconName: 'scale' };
    }
    const estado = (s.estado || '').toUpperCase();
    if (estado === 'EN_PRECISION') {
      return { label: 'Debe precisar su solicitud', instancia: '1ª instancia · Entidad', tone: 'var(--brand-700)', iconName: 'alertTriangle' };
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
    if (estado === 'VENCIDA') {
      return { label: 'Sin respuesta · plazo vencido', instancia: '1ª instancia · Entidad', tone: 'var(--gold-dark)', iconName: 'clock' };
    }
    return { label: 'En revisión de la entidad', instancia: '1ª instancia · Entidad', tone: 'var(--info)', iconName: 'building' };
  }

  filaUrgencia(s: Solicitud): { value: string | number; unit: string; tone: string } | null {
    const estado = (s.estado || '').toUpperCase();
    if (this.requiereSubsanacionTTAIP(s)) {
      if (s.apelacion?.plazoSubsanacion?.estado === 'VENCIDO') return { value: 'Vencido', unit: 'plazo de subsanación', tone: 'var(--destructive)' };
      const dias = this.calcularDiasRestantesSubsanacionDesdeSolicitud(s);
      return dias === null ? { value: s.apelacion?.plazoSubsanacion?.estado === 'PENDIENTE_INICIO' ? 'Pendiente' : 'No disponible', unit: s.apelacion?.plazoSubsanacion?.estado === 'PENDIENTE_INICIO' ? 'notificación eficaz' : 'información del plazo', tone: 'var(--muted-foreground)' }
        : { value: Math.max(0, dias), unit: 'días háb. para subsanar', tone: 'var(--brand-700)' };
    }
    if (this.tieneApelacionActiva(s)) return { value: 'En trámite', unit: 'consulte la actuación registrada', tone: 'var(--info)' };
    if (estado === 'DENEGADA' || estado === 'VENCIDA') return { value: 'No disponible', unit: 'plazo de apelación no informado', tone: 'var(--muted-foreground)' };
    if (this.estadosEnProceso.has(estado)) {
      const dias = this.diasRestantesParaEntidad(s);
      return { value: dias ?? 'No disponible', unit: 'saldo de plazo informado', tone: 'var(--info)' };
    }
    return null;
  }

  goStagePage(page: number): void {
    this.stagePage.set(Math.max(1, Math.min(page, this.stageTotalPages())));
    this.schedule(() => document.querySelector('[data-section="stage-list"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }

  onStageSearchChange(value: string): void {
    this.stageSearch.set(value);
    this.stagePage.set(1);
  }

  clearStageSearch(): void {
    this.stageSearch.set('');
    this.stagePage.set(1);
  }

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
      return {
        eyebrow: 'El Tribunal esta revisando su caso',
        titulo: 'Su apelacion esta en evaluacion',
        detalle: `El expediente ${solicitud.apelacion?.expediente || expediente} se encuentra en etapa ${this.formatoEstado(solicitud.apelacion?.estado)}. Consulte las actuaciones registradas.`,
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
    if (estado === 'PENDIENTE_INFORMACION' && solicitud.observaciones?.some(o => o.estado === 'PENDIENTE_SUBSANACION')) {
      return { eyebrow: 'Observación registrada', titulo: 'Revise la precisión solicitada por la entidad',
        detalle: 'Consulte el requerimiento antes de presentar su precisión.', metricValue: 'Consultar', metricUnit: 'requerimiento',
        ctaLabel: 'Revisar precisión', route: ['/ciudadano/precision', expediente], icon: 'alert',
        toneColor: 'var(--brand-700)', toneBg: 'var(--brand-subtle)', toneSoft: 'var(--brand-200)', expediente, entidad };
    }
    if (estado === 'DENEGADA' || estado === 'VENCIDA') {
      return {
        eyebrow: 'Consulta de apelación',
        titulo: 'Revise las opciones de apelación',
        detalle: estado === 'VENCIDA'
          ? 'La entidad no respondio dentro del plazo legal. Puede presentar apelacion por silencio administrativo negativo.'
          : 'La entidad denego su solicitud. Puede presentar apelacion dentro del plazo legal aplicable.',
        metricValue: 'No disponible',
        metricUnit: 'plazo de apelación no informado',
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
    return {
      eyebrow: 'Seguimiento de solicitud',
      titulo: 'Consulte su solicitud en la entidad',
      detalle: `Consulte el estado y las actuaciones registradas por ${entidad}.`,
      metricValue: diasEntidad === null ? 'No disponible' : String(diasEntidad),
      metricUnit: 'días informados por el servidor',
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
        meta: `${dias === null ? 'Saldo de plazo no disponible' : dias + 'd informados'}${vencimiento ? ` - fecha límite ${vencimiento}` : ''}`,
        status: 'active'
      });
      steps.push({ key: 'respuesta', label: 'Respuesta de la entidad', status: 'pending' });
    } else if (estado === 'RESPONDIDA') {
      const resultado = solicitud.respuesta?.tipoRespuesta ? this.formatoEstado(solicitud.respuesta.tipoRespuesta) : 'recibida';
      steps.push({ key: 'plazo-entidad', label: 'Respuesta registrada', meta: 'Estado informado por la entidad', status: 'done' });
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
      const dias = this.calcularDiasRestantesSubsanacionDesdeSolicitud(solicitud);
      return dias === null ? 85 : 100 + Math.max(0, 5 - dias);
    }

    if (this.estadosApelacionActivos.has(estadoApelacion)) return 85;
    if (estado === 'VENCIDA') return 82;
    if (estado === 'DENEGADA') return 78;
    if (estado === 'RESPONDIDA') return 30;

    const dias = this.diasRestantesParaEntidad(solicitud);
    return 55 + Math.max(0, 4 - (dias ?? 0));
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
