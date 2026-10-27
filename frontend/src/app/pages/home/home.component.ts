import {
  Component, ChangeDetectionStrategy, inject, PLATFORM_ID,
  AfterViewInit, OnDestroy, OnInit, ElementRef, NgZone, ChangeDetectorRef, DestroyRef, signal,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { FAQ_CATEGORIES } from '../public/ayuda-content';
import { emptyIndicators, readPublicPortal } from './landing-data';
import {
  LucideScale, LucideZap,
  LucideBookOpen, LucideShield, LucideUsers, LucidePlus,
  LucideSearch, LucideHelpCircle, LucideChevronDown, LucidePhone,
  LucideSparkles, LucideArrowUpRight, LucideSend, LucideArrowRight,
  LucideLightbulb, LucideBuilding2, LucideLock, LucideGlobe,
  LucideCoins, LucideHammer, LucideGraduationCap, LucideStethoscope, LucideFileText,
  LucideCrown, LucideBriefcase, LucideMail, LucideAward, LucideGavel,
} from '@lucide/angular';
import { PortalMiembroTtaip, PortalPublicoService } from '../../services/portal-publico.service';

type MiembroArea = 'presidencia' | 'sala1' | 'sala2' | 'secretaria' | 'sin-asignar';
type ExampleIcon = 'coins' | 'hammer' | 'graduation-cap' | 'stethoscope' | 'file-text' | 'users';

interface MiembroTrayectoria {
  rol: string;
  lugar: string;
  anio: string;
}
interface Miembro {
  id: string;
  nombre: string;
  cargo: string;
  cargoCorto: string;
  area: MiembroArea;
  foto?: string;
  iniciales: string;
  periodo?: string;
  bio: string;
  formacion: string[];
  trayectoria: MiembroTrayectoria[];
  contacto?: string;
}


interface ApelacionDepartamento {
  d: string;
  v: number;
}

interface TendenciaMensual {
  m: string;
  s: number;
  a: number;
}

interface ChartGridLine {
  value: number;
  y: number;
}

interface DepartmentBarColumn {
  d: string;
  v: number;
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
}

interface TrendPoint {
  m: string;
  x: number;
  sY: number;
  aY: number;
}

interface ChartTooltipRow {
  label: string;
  value: string;
  color: string;
}

interface ChartTooltip {
  x: number;
  y: number;
  title: string;
  rows: ChartTooltipRow[];
}

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DecimalPipe,
    LucideScale, LucideZap,
    LucideBookOpen, LucideShield, LucideUsers, LucidePlus,
    LucideSearch, LucideHelpCircle, LucideChevronDown, LucidePhone,
    LucideSparkles, LucideArrowUpRight, LucideSend, LucideArrowRight,
    LucideLightbulb, LucideBuilding2, LucideLock, LucideGlobe,
    LucideCoins, LucideHammer, LucideGraduationCap, LucideStethoscope, LucideFileText,
    LucideCrown, LucideBriefcase, LucideMail, LucideAward, LucideGavel,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly el = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly portalPublicoService = inject(PortalPublicoService);
  private readonly route = inject(ActivatedRoute);
  private observer: IntersectionObserver | null = null;

  indicadores = emptyIndicators();
  readonly estadoPortal = signal<'cargando' | 'disponible' | 'incompleto' | 'error'>('cargando');
  private readonly destroyRef = inject(DestroyRef);
  private portalRequest?: Subscription;
  seccionesDisponibles = { entidades: false, tendencia: false, ejemplos: false, miembros: false };

  ejemplos: Array<{ icon: ExampleIcon; text: string }> = [];

  readonly faqs = FAQ_CATEGORIES.flatMap(category => category.questions)
    .filter(question => ['definicion', 'registro', 'publica', 'vinculada'].includes(question.id));

  miembros: Miembro[] = [];

  get presidente(): Miembro | null {
    return this.miembros.find((m) => m.area === 'presidencia') ?? null;
  }

  get secretarioTecnico(): Miembro | null {
    return this.miembros.find((m) => m.area === 'secretaria') ?? null;
  }

  apelacionesPorDepartamento: ApelacionDepartamento[] = [];
  tendenciaMensual: TendenciaMensual[] = [];

  readonly departmentChart = {
    width: 620,
    height: 260,
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 38,
    paddingLeft: 24,
    barGap: 10,
  };

  readonly trendChart = {
    width: 620,
    height: 260,
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 34,
    paddingLeft: 36,
  };

  departmentMaxValue = 1;
  departmentScaleMax = 1;
  departmentGridLines: ChartGridLine[] = [];
  departmentBars: DepartmentBarColumn[] = [];

  trendMaxValue = 1;
  trendScaleMax = 1;
  trendGridLines: ChartGridLine[] = [];
  trendPoints: TrendPoint[] = [];
  solicitudesLinePoints = '';
  apelacionesLinePoints = '';

  openFaq: number | null = 0;
  selectedMemberId = 'presidente';
  hoveredDepartment: string | null = null;
  hoveredMonth: string | null = null;
  departmentTooltip: ChartTooltip | null = null;
  trendTooltip: ChartTooltip | null = null;

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? null : index;
  }

  selectMember(memberId: string): void {
    if (this.miembros.some(member => member.id === memberId)) {
      this.selectedMemberId = memberId;
      this.cdr.markForCheck();
    }
  }

  showDepartmentTooltip(bar: DepartmentBarColumn): void {
    this.hoveredDepartment = bar.d;
    this.departmentTooltip = {
      x: this.clampTooltipX(bar.labelX, this.departmentChart.width),
      y: Math.max(bar.y - 70, this.departmentChart.paddingTop + 4),
      title: bar.d,
      rows: [
        { label: 'Apelaciones', value: bar.v.toLocaleString('es-PE'), color: 'var(--brand-600)' },
      ],
    };
    this.cdr.markForCheck();
  }

  hideDepartmentTooltip(): void {
    this.hoveredDepartment = null;
    this.departmentTooltip = null;
    this.cdr.markForCheck();
  }

  showTrendTooltip(point: TrendPoint): void {
    const item = this.tendenciaMensual.find((entry) => entry.m === point.m);
    if (!item) return;

    this.hoveredMonth = point.m;
    this.trendTooltip = {
      x: this.clampTooltipX(point.x, this.trendChart.width),
      y: Math.max(Math.min(point.sY, point.aY) - 86, this.trendChart.paddingTop + 4),
      title: point.m,
      rows: [
        { label: 'Solicitudes', value: item.s.toLocaleString('es-PE'), color: 'var(--brand-600)' },
        { label: 'Apelaciones', value: item.a.toLocaleString('es-PE'), color: 'var(--gold)' },
      ],
    };
    this.cdr.markForCheck();
  }

  hideTrendTooltip(): void {
    this.hoveredMonth = null;
    this.trendTooltip = null;
    this.cdr.markForCheck();
  }

  isMemberSelected(memberId: string): boolean {
    return this.selectedMemberId === memberId;
  }

  getMembersByArea(area: MiembroArea): Miembro[] {
    return this.miembros.filter((member) => member.area === area);
  }

  get selectedMemberData(): Miembro | null {
    return this.miembros.find((member) => member.id === this.selectedMemberId) ?? this.miembros[0] ?? null;
  }

  memberFirstName(member: Miembro): string {
    return member.nombre.split(' ').filter(Boolean)[0] ?? member.nombre;
  }

  memberNameRest(member: Miembro): string {
    return member.nombre.split(' ').filter(Boolean).slice(1).join(' ');
  }

  ngOnInit(): void {
    this.rebuildChartData();
    if (isPlatformBrowser(this.platformId)) {
      this.cargarPortalPublico();
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => this.initScrollReveal());
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(fragment => {
      if (fragment) this.scrollToSection(fragment);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  scrollToSection(sectionId: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const element = Array.from(this.el.nativeElement.querySelectorAll('section[id]') as NodeListOf<HTMLElement>)
        .find(section => section.id === sectionId);
      if (element) {
        const offset = 100;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        window.scrollTo({ top: offsetPosition, behavior: this.prefersReducedMotion() ? 'instant' : 'smooth' });
        element.tabIndex = -1;
        element.focus({ preventScroll: true });
      }
    }
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: this.prefersReducedMotion() ? 'instant' : 'smooth' });
    }
  }

  recargarPortal(): void {
    if (!this.portalRequest || this.portalRequest.closed) this.cargarPortalPublico();
  }

  mensajeSeccion(disponible: boolean, vacio: string): string {
    if (this.estadoPortal() === 'cargando') return 'Consultando información pública…';
    if (this.estadoPortal() === 'error') return 'Información no disponible: falló la consulta pública.';
    return disponible ? vacio : 'Información incompleta o no disponible en la respuesta del servidor.';
  }

  private cargarPortalPublico(): void {
    this.indicadores = emptyIndicators();
    this.estadoPortal.set('cargando');
    this.miembros = [];
    this.selectedMemberId = '';
    this.apelacionesPorDepartamento = [];
    this.tendenciaMensual = [];
    this.ejemplos = [];
    this.seccionesDisponibles = { entidades: false, tendencia: false, ejemplos: false, miembros: false };
    this.hideDepartmentTooltip();
    this.hideTrendTooltip();
    this.rebuildChartData();
    this.portalRequest = this.portalPublicoService.getPortal().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: payload => {
        const portal = readPublicPortal(payload);
        this.indicadores = portal.indicadores;
        this.apelacionesPorDepartamento = portal.entidades.datos;
        this.tendenciaMensual = portal.tendencia.datos;
        this.ejemplos = portal.ejemplos.datos.map(item => ({ icon: this.toExampleIcon(item.icono), text: item.texto }));
        this.miembros = portal.miembros.datos.map(miembro => this.toMiembro(miembro));
        this.selectedMemberId = this.presidente?.id ?? this.miembros[0]?.id ?? '';
        this.seccionesDisponibles = { entidades: portal.entidades.disponible, tendencia: portal.tendencia.disponible,
          ejemplos: portal.ejemplos.disponible, miembros: portal.miembros.disponible };
        this.estadoPortal.set(portal.incompleto ? 'incompleto' : 'disponible');
        this.rebuildChartData();
        this.cdr.markForCheck();
      },
      error: () => {
        this.estadoPortal.set('error');
        this.cdr.markForCheck();
      },
    });
  }

  private toMiembro(miembro: PortalMiembroTtaip): Miembro {
    const nombre = miembro.nombre?.trim() || 'Miembro TTAIP sin nombre registrado';
    const cargo = miembro.cargo?.trim() || 'Cargo no informado';
    return {
      id: String(miembro.id),
      nombre,
      cargo,
      cargoCorto: this.shortCargo(cargo),
      area: this.resolveMemberArea(cargo, miembro.sala, Boolean(miembro.presidenteTribunal)),
      iniciales: this.initials(nombre),
      periodo: this.formatMemberPeriod(miembro.periodoInicio, miembro.periodoFin),
      bio: miembro.especialidad?.trim() || 'Especialidad no informada en esta ficha.',
      formacion: [],
      trayectoria: [],
    };
  }

  private toExampleIcon(icono: string | null | undefined): ExampleIcon {
    const allowed: ExampleIcon[] = ['coins', 'hammer', 'graduation-cap', 'stethoscope', 'file-text', 'users'];
    return allowed.includes(icono as ExampleIcon) ? icono as ExampleIcon : 'file-text';
  }

  private shortCargo(cargo: string): string {
    return cargo;
  }

  private resolveMemberArea(cargo: string, sala?: string | null, presidenteTribunal = false): MiembroArea {
    if (presidenteTribunal) return 'presidencia';
    if (cargo.toLowerCase().includes('secret')) return 'secretaria';
    const value = (sala ?? '').toLowerCase();
    if (value.includes('segunda') || /^sala\s*2$/.test(value)) return 'sala2';
    if (value.includes('primera') || value.includes('sala 1')) return 'sala1';
    return 'sin-asignar';
  }

  private formatMemberPeriod(inicio?: string | null, fin?: string | null): string | undefined {
    if (!inicio && !fin) return undefined;
    return `${this.formatCompactDate(inicio)} al ${this.formatCompactDate(fin)}`;
  }

  private formatCompactDate(raw?: string | null): string {
    if (!raw) return 'No informado';
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  private initials(nombre: string): string {
    return nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  private rebuildChartData(): void {
    this.departmentMaxValue = Math.max(1, ...this.apelacionesPorDepartamento.map((item) => item.v));
    this.departmentScaleMax = Math.max(1, this.roundUpToStep(this.departmentMaxValue, 50));
    this.departmentGridLines = this.buildGridLines(
      this.departmentChart.height,
      this.departmentChart.paddingTop,
      this.departmentChart.paddingBottom,
      this.departmentScaleMax
    );
    this.departmentBars = this.buildDepartmentBars();

    this.trendMaxValue = Math.max(1, ...this.tendenciaMensual.flatMap((item) => [item.s, item.a]));
    this.trendScaleMax = Math.max(1, this.roundUpToStep(this.trendMaxValue, 20));
    this.trendGridLines = this.buildGridLines(
      this.trendChart.height,
      this.trendChart.paddingTop,
      this.trendChart.paddingBottom,
      this.trendScaleMax
    );
    this.trendPoints = this.buildTrendPoints();
    this.solicitudesLinePoints = this.trendPoints.map((p) => `${p.x},${p.sY}`).join(' ');
    this.apelacionesLinePoints = this.trendPoints.map((p) => `${p.x},${p.aY}`).join(' ');
  }

  /** Reveal [data-reveal] elements when they enter viewport (IntersectionObserver) */
  private initScrollReveal(): void {
    const targets = this.el.nativeElement.querySelectorAll('[data-reveal]');
    if (!targets.length) return;
    if (this.prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
      targets.forEach((target: HTMLElement) => target.classList.add('revealed'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('revealed');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((t: Element) => this.observer!.observe(t));
  }
  private roundUpToStep(value: number, step: number): number {
    return Math.max(step, Math.ceil(value / step) * step);
  }

  private buildGridLines(
    chartHeight: number,
    paddingTop: number,
    paddingBottom: number,
    scaleMax: number
  ): ChartGridLine[] {
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    const lines: ChartGridLine[] = [];

    for (let i = 0; i <= 4; i += 1) {
      const value = Math.round((scaleMax / 4) * i);
      const y = paddingTop + (1 - value / scaleMax) * plotHeight;
      lines.push({ value, y });
    }

    return lines;
  }

  private buildDepartmentBars(): DepartmentBarColumn[] {
    const plotWidth = this.departmentChart.width - this.departmentChart.paddingLeft - this.departmentChart.paddingRight;
    const plotHeight = this.departmentChart.height - this.departmentChart.paddingTop - this.departmentChart.paddingBottom;
    const count = this.apelacionesPorDepartamento.length;
    if (count === 0) {
      return [];
    }
    const totalGap = this.departmentChart.barGap * (count - 1);
    const barWidth = (plotWidth - totalGap) / count;

    return this.apelacionesPorDepartamento.map((item, index) => {
      const x = this.departmentChart.paddingLeft + index * (barWidth + this.departmentChart.barGap);
      const height = (item.v / this.departmentScaleMax) * plotHeight;
      const y = this.departmentChart.height - this.departmentChart.paddingBottom - height;
      return {
        d: item.d,
        v: item.v,
        x,
        y,
        width: barWidth,
        height,
        labelX: x + barWidth / 2,
      };
    });
  }

  private buildTrendPoints(): TrendPoint[] {
    const plotWidth = this.trendChart.width - this.trendChart.paddingLeft - this.trendChart.paddingRight;
    const plotHeight = this.trendChart.height - this.trendChart.paddingTop - this.trendChart.paddingBottom;
    const lastIndex = Math.max(this.tendenciaMensual.length - 1, 1);

    return this.tendenciaMensual.map((item, index) => {
      const x = this.trendChart.paddingLeft + (index / lastIndex) * plotWidth;
      const sY = this.trendChart.paddingTop + (1 - item.s / this.trendScaleMax) * plotHeight;
      const aY = this.trendChart.paddingTop + (1 - item.a / this.trendScaleMax) * plotHeight;
      return {
        m: item.m,
        x,
        sY,
        aY,
      };
    });
  }

  private clampTooltipX(x: number, chartWidth: number): number {
    const tooltipWidth = 144;
    return Math.max(8, Math.min(x - tooltipWidth / 2, chartWidth - tooltipWidth - 8));
  }

  private prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}


