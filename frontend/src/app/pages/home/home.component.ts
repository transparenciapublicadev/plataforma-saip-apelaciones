import {
  Component, ChangeDetectionStrategy, inject, PLATFORM_ID,
  AfterViewInit, OnDestroy, OnInit, ElementRef, NgZone, ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
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

type MiembroArea = 'presidencia' | 'sala1' | 'sala2' | 'secretaria';
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
  private observer: IntersectionObserver | null = null;

  indicadores = {
    saipPresentadas: 0,
    respondidas: 0,
    apelaciones: 0,
    entidades: 0,
    personasApelantes: 0,
    tasaResolucion: 0,
  };

  ejemplos: Array<{ icon: ExampleIcon; text: string }> = [];

  faqs: Array<{ q: string; a: string }> = [];

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
    if (this.selectedMemberId === memberId) return;
    if (!isPlatformBrowser(this.platformId)) {
      this.selectedMemberId = memberId;
      return;
    }

    this.zone.runOutsideAngular(() => {
      const detail = this.el.nativeElement.querySelector('[data-member-detail]') as HTMLElement | null;
      const reduceMotion = this.prefersReducedMotion();

      if (!detail || reduceMotion) {
        this.zone.run(() => {
          this.selectedMemberId = memberId;
          this.cdr.markForCheck();
        });
        return;
      }

      const exitAnimation = detail.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-8px) scale(0.992)' },
        ],
        {
          duration: 150,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        }
      );

      void exitAnimation.finished.catch(() => undefined).then(() => {
        this.zone.run(() => {
          this.selectedMemberId = memberId;
          this.cdr.detectChanges();
        });

        window.requestAnimationFrame(() => {
          const nextDetail = this.el.nativeElement.querySelector('[data-member-detail]') as HTMLElement | null;
          nextDetail?.animate(
            [
              { opacity: 0, transform: 'translateY(16px) scale(0.985)' },
              { opacity: 1, transform: 'translateY(-2px) scale(1.003)', offset: 0.72 },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            {
              duration: 420,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              fill: 'both',
            }
          );
        });
      });
    });
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
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  scrollToSection(sectionId: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const element = document.getElementById(sectionId);
      if (element) {
        const offset = 100;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    }
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private cargarPortalPublico(): void {
    this.portalPublicoService.getPortal().subscribe({
      next: (portal) => {
        this.indicadores = {
          saipPresentadas: portal.metricas.saipPresentadas,
          respondidas: portal.metricas.respondidas,
          apelaciones: portal.metricas.apelaciones,
          entidades: portal.metricas.entidades,
          personasApelantes: portal.metricas.personasApelantes,
          tasaResolucion: portal.metricas.tasaResolucion,
        };
        this.apelacionesPorDepartamento = portal.apelacionesPorEntidad.map((item) => ({
          d: item.etiqueta,
          v: item.valor,
        }));
        this.tendenciaMensual = portal.tendenciaMensual.map((item) => ({
          m: item.etiqueta,
          s: item.solicitudes,
          a: item.apelaciones,
        }));
        this.ejemplos = (portal.ejemplosSolicitud ?? []).map((item) => ({
          icon: this.toExampleIcon(item.icono),
          text: item.texto,
        }));
        this.faqs = (portal.preguntasFrecuentes ?? []).map((item) => ({
          q: item.pregunta,
          a: item.respuesta,
        }));
        this.openFaq = this.faqs.length > 0 ? 0 : null;
        this.miembros = portal.miembrosTTAIP.map((miembro) => this.toMiembro(miembro));
        this.selectedMemberId = this.presidente?.id ?? this.miembros[0]?.id ?? '';
        this.rebuildChartData();
        this.cdr.markForCheck();
      },
      error: () => {
        this.rebuildChartData();
        this.cdr.markForCheck();
      },
    });
  }

  private toMiembro(miembro: PortalMiembroTtaip): Miembro {
    const nombre = miembro.nombre?.trim() || 'Miembro TTAIP sin nombre registrado';
    const cargo = miembro.cargo?.trim() || 'Miembro del Tribunal';
    return {
      id: String(miembro.id ?? nombre),
      nombre,
      cargo,
      cargoCorto: this.shortCargo(cargo),
      area: this.resolveMemberArea(cargo, miembro.sala, Boolean(miembro.presidenteTribunal)),
      iniciales: this.initials(nombre),
      periodo: this.formatMemberPeriod(miembro.periodoInicio, miembro.periodoFin),
      bio: miembro.especialidad?.trim() || 'Especialidad no registrada por el backend.',
      formacion: [],
      trayectoria: [],
      contacto: miembro.email ?? undefined,
    };
  }

  private toExampleIcon(icono: string | null | undefined): ExampleIcon {
    const allowed: ExampleIcon[] = ['coins', 'hammer', 'graduation-cap', 'stethoscope', 'file-text', 'users'];
    return allowed.includes(icono as ExampleIcon) ? icono as ExampleIcon : 'file-text';
  }

  private shortCargo(cargo: string): string {
    if (cargo.toLowerCase().includes('presidente')) return 'Presidencia de sala';
    if (cargo.toLowerCase().includes('secret')) return 'Secretaría Técnica';
    return cargo.replace('Vocal ', '').replace('Titular ', '').trim() || cargo;
  }

  private resolveMemberArea(cargo: string, sala?: string | null, presidenteTribunal = false): MiembroArea {
    if (presidenteTribunal) return 'presidencia';
    const value = `${cargo} ${sala ?? ''}`.toLowerCase();
    if (value.includes('secret')) return 'secretaria';
    if (value.includes('segunda') || value.includes('sala 2') || value.includes('2')) return 'sala2';
    return 'sala1';
  }

  private formatMemberPeriod(inicio?: string | null, fin?: string | null): string | undefined {
    if (!inicio && !fin) return undefined;
    return `${this.formatCompactDate(inicio)} al ${this.formatCompactDate(fin)}`;
  }

  private formatCompactDate(raw?: string | null): string {
    if (!raw) return 'vigente';
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


