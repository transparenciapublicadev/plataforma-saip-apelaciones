import {
  Component, ChangeDetectionStrategy, inject, PLATFORM_ID,
  AfterViewInit, OnDestroy, ElementRef, NgZone, ChangeDetectorRef,
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

type MiembroArea = 'presidencia' | 'sala1' | 'sala2' | 'secretaria';

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
  foto: string;
  iniciales: string;
  periodo: string;
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
export class HomeComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly el = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private observer: IntersectionObserver | null = null;

  readonly indicadores = {
    saipPresentadas: 2847,
    respondidas: 1923,
    apelaciones: 412,
    entidades: 156,
  };

  readonly ejemplos: Array<{
    icon: 'coins' | 'hammer' | 'graduation-cap' | 'stethoscope' | 'file-text' | 'users';
    text: string;
  }> = [
    { icon: 'coins', text: '¿En qué se gastó el presupuesto de mi municipalidad?' },
    { icon: 'hammer', text: '¿Por qué se paralizó la obra de mi distrito?' },
    { icon: 'graduation-cap', text: '¿Cuántos docentes contrató mi colegio público?' },
    { icon: 'stethoscope', text: '¿Qué medicamentos tiene mi hospital del barrio?' },
    { icon: 'file-text', text: '¿Qué contratos firmó la entidad este año?' },
    { icon: 'users', text: '¿Cuántos funcionarios trabajan en mi municipio?' },
  ];

  readonly faqs = [
    { q: '¿Tengo que pagar algo para pedir información?', a: 'No. Es completamente gratis. La Constitución y la Ley N° 27806 garantizan su derecho de acceso a la información pública sin costo.' },
    { q: '¿Necesito un abogado para presentar mi solicitud?', a: 'No. La plataforma está diseñada para que cualquier persona pueda usarla. Si necesita ayuda, tiene un asistente, una línea gratuita y correo de soporte.' },
    { q: '¿Cuánto demora la respuesta?', a: 'La entidad tiene 10 días hábiles para responderle. Si no responde en ese plazo, usted puede reclamar al Tribunal.' },
    { q: '¿Pueden negarme la información?', a: 'Solo en casos puntuales que indica la ley (información clasificada, datos personales protegidos). Si le niegan información que considera pública, puede apelar al Tribunal en 15 días calendario.' },
    { q: '¿Qué pasa si la entidad no me responde?', a: 'Aplica el silencio administrativo negativo: se entiende que su solicitud fue denegada y usted puede reclamar al Tribunal de inmediato.' },
    { q: '¿Mis datos están seguros?', a: 'Sí. La plataforma usa conexión cifrada (SSL), almacenamiento seguro y cumple los estándares del Estado peruano para datos personales.' },
  ];

  readonly miembros: Miembro[] = [
    {
      id: 'presidente',
      nombre: 'Dr. Ricardo Quispe Mendoza',
      cargo: 'Presidente del Tribunal',
      cargoCorto: 'Presidencia',
      area: 'presidencia',
      foto: 'https://images.unsplash.com/photo-1775181316283-e57d3447184f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'RQ',
      periodo: '2024 — 2027',
      bio: 'Conduce la mesa plenaria del Tribunal y representa institucionalmente al órgano colegiado. Vela por la independencia, la coherencia jurisprudencial y la calidad del servicio al ciudadano.',
      formacion: [
        'Doctor en Derecho Constitucional · Pontificia Universidad Católica del Perú',
        'Maestría en Derecho Administrativo · Universidad de Salamanca, España',
        'Especialización en Transparencia y Anticorrupción · CEPAL',
      ],
      trayectoria: [
        { rol: 'Magistrado del Tribunal Constitucional', lugar: 'TC del Perú', anio: '2018 — 2023' },
        { rol: 'Procurador Público Anticorrupción', lugar: 'MINJUSDH', anio: '2014 — 2018' },
        { rol: 'Catedrático de Derecho Administrativo', lugar: 'PUCP / UNMSM', anio: '2008 — actual' },
      ],
      contacto: 'presidencia@ttaip.gob.pe',
    },
    {
      id: 'vocal-1-sala-1',
      nombre: 'Dra. María Elena Vargas Soto',
      cargo: 'Vocal Vicepresidenta · Sala 1',
      cargoCorto: 'Vicepresidenta',
      area: 'sala1',
      foto: 'https://images.unsplash.com/photo-1763757321139-e7e4de128cd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'MV',
      periodo: '2023 — 2026',
      bio: 'Preside la Sala 1 y reemplaza al Presidente en su ausencia. Especialista en acceso a la información y protección de datos personales.',
      formacion: [
        'Maestría en Derecho de la Información · Universidad de Lima',
        'Doctorado (c) en Gestión Pública · Universidad del Pacífico',
      ],
      trayectoria: [
        { rol: 'Directora General de Transparencia', lugar: 'PCM', anio: '2019 — 2023' },
        { rol: 'Asesora del Defensor del Pueblo', lugar: 'Defensoría del Pueblo', anio: '2015 — 2019' },
      ],
      contacto: 'mvargas@ttaip.gob.pe',
    },
    {
      id: 'vocal-2-sala-1',
      nombre: 'Dr. Hugo Salinas Cárdenas',
      cargo: 'Vocal Titular · Sala 1',
      cargoCorto: 'Vocal',
      area: 'sala1',
      foto: 'https://images.unsplash.com/photo-1769636929231-3cd7f853d038?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'HS',
      periodo: '2024 — 2027',
      bio: 'Vocal con especialización en derecho administrativo sancionador y procedimientos disciplinarios.',
      formacion: [
        'Magíster en Derecho Administrativo · Universidad Nacional Mayor de San Marcos',
      ],
      trayectoria: [
        { rol: 'Procurador Público Adjunto', lugar: 'Ministerio del Interior', anio: '2017 — 2023' },
        { rol: 'Asesor Jurídico', lugar: 'Contraloría General', anio: '2012 — 2017' },
      ],
    },
    {
      id: 'vocal-3-sala-1',
      nombre: 'Dr. Jorge Aliaga Ramírez',
      cargo: 'Vocal Titular · Sala 1',
      cargoCorto: 'Vocal',
      area: 'sala1',
      foto: 'https://images.unsplash.com/photo-1773645056335-8d17a12f16a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'JA',
      periodo: '2025 — 2028',
      bio: 'Especialista en gobierno digital, datos abiertos e interoperabilidad estatal. Aporta visión técnica al pleno.',
      formacion: [
        'Magíster en Políticas Públicas · Universidad de Chile',
        'Ingeniero Informático · Universidad Nacional de Ingeniería',
      ],
      trayectoria: [
        { rol: 'Subsecretario de Gobierno Digital', lugar: 'PCM', anio: '2020 — 2024' },
        { rol: 'Consultor Senior', lugar: 'Banco Mundial', anio: '2015 — 2020' },
      ],
    },
    {
      id: 'vocal-1-sala-2',
      nombre: 'Dra. Carmen Rosa Díaz Flores',
      cargo: 'Vocal Presidenta · Sala 2',
      cargoCorto: 'Presidenta Sala 2',
      area: 'sala2',
      foto: 'https://images.unsplash.com/photo-1765005204227-bf58bcdd4449?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'CD',
      periodo: '2023 — 2026',
      bio: 'Conduce la Sala 2, especializada en materias de gobierno regional y local. Reconocida por su jurisprudencia en obras públicas.',
      formacion: [
        'Doctorado en Derecho Constitucional · Universidad Complutense de Madrid',
        'Especialización en Contrataciones del Estado · OSCE',
      ],
      trayectoria: [
        { rol: 'Magistrada Supernumeraria', lugar: 'Corte Superior de Lima', anio: '2016 — 2023' },
        { rol: 'Asesora del Congreso', lugar: 'Comisión de Fiscalización', anio: '2011 — 2016' },
      ],
      contacto: 'cdiaz@ttaip.gob.pe',
    },
    {
      id: 'vocal-2-sala-2',
      nombre: 'Dr. Luis Alberto Mendoza Ruiz',
      cargo: 'Vocal Titular · Sala 2',
      cargoCorto: 'Vocal',
      area: 'sala2',
      foto: 'https://images.unsplash.com/photo-1762810211495-d79a02ba7d0d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'LM',
      periodo: '2024 — 2027',
      bio: 'Investigador en derecho a la información y libertad de expresión. Autor de libros de referencia sobre transparencia.',
      formacion: [
        'Doctor en Derecho · Universidad de Buenos Aires',
        'Posdoctorado en Derechos Humanos · Universidad de Heidelberg',
      ],
      trayectoria: [
        { rol: 'Catedrático Principal', lugar: 'PUCP', anio: '2010 — actual' },
        { rol: 'Relator Especial (consulta)', lugar: 'CIDH', anio: '2018 — 2022' },
      ],
    },
    {
      id: 'vocal-3-sala-2',
      nombre: 'Dra. Ana Patricia Torres León',
      cargo: 'Vocal Titular · Sala 2',
      cargoCorto: 'Vocal',
      area: 'sala2',
      foto: 'https://images.unsplash.com/photo-1765005204058-10418f5123c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'AT',
      periodo: '2025 — 2028',
      bio: 'Vocal más joven del pleno. Especialista en gobierno abierto, participación ciudadana y datos personales.',
      formacion: [
        'Maestría en Open Government · Sciences Po Paris',
        'Abogada · Universidad de Lima',
      ],
      trayectoria: [
        { rol: 'Directora de Gobierno Abierto', lugar: 'Municipalidad de Lima', anio: '2021 — 2025' },
        { rol: 'Investigadora', lugar: 'Hiperderecho', anio: '2017 — 2021' },
      ],
    },
    {
      id: 'secretario-tecnico',
      nombre: 'Dr. Eduardo Castillo Bermúdez',
      cargo: 'Secretario Técnico',
      cargoCorto: 'Secretaría Técnica',
      area: 'secretaria',
      foto: 'https://images.unsplash.com/photo-1769636929261-e913ed023c83?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
      iniciales: 'EC',
      periodo: '2022 — actual',
      bio: 'Conduce el órgano de apoyo administrativo del Tribunal. Coordina la mesa de partes, las notificaciones y la gestión de expedientes.',
      formacion: [
        'Maestría en Gestión Pública · Universidad ESAN',
        'Abogado · Pontificia Universidad Católica del Perú',
      ],
      trayectoria: [
        { rol: 'Secretario General', lugar: 'INDECOPI', anio: '2017 — 2022' },
        { rol: 'Jefe de Asesoría Jurídica', lugar: 'SUNAT', anio: '2013 — 2017' },
      ],
      contacto: 'secretariatecnica@ttaip.gob.pe',
    },
  ];

  readonly presidente = this.miembros.find((m) => m.id === 'presidente') ?? null;
  readonly secretarioTecnico = this.miembros.find((m) => m.id === 'secretario-tecnico') ?? null;
  readonly apelacionesPorDepartamento: ApelacionDepartamento[] = [
    { d: 'Lima', v: 245 },
    { d: 'Arequipa', v: 87 },
    { d: 'Cusco', v: 65 },
    { d: 'La Libertad', v: 58 },
    { d: 'Piura', v: 52 },
    { d: 'Junín', v: 43 },
    { d: 'Lambayeque', v: 38 },
    { d: 'Áncash', v: 32 },
    { d: 'Ica', v: 28 },
  ];

  readonly tendenciaMensual: TendenciaMensual[] = [
    { m: 'Ene', s: 85, a: 22 },
    { m: 'Feb', s: 92, a: 28 },
    { m: 'Mar', s: 108, a: 35 },
    { m: 'Abr', s: 95, a: 30 },
    { m: 'May', s: 115, a: 38 },
    { m: 'Jun', s: 125, a: 42 },
    { m: 'Jul', s: 130, a: 40 },
    { m: 'Ago', s: 142, a: 45 },
    { m: 'Sep', s: 135, a: 38 },
  ];

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

  readonly departmentMaxValue = Math.max(...this.apelacionesPorDepartamento.map((item) => item.v));
  readonly departmentScaleMax = this.roundUpToStep(this.departmentMaxValue, 50);
  readonly departmentGridLines = this.buildGridLines(
    this.departmentChart.height,
    this.departmentChart.paddingTop,
    this.departmentChart.paddingBottom,
    this.departmentScaleMax
  );
  readonly departmentBars = this.buildDepartmentBars();

  readonly trendMaxValue = Math.max(
    ...this.tendenciaMensual.flatMap((item) => [item.s, item.a])
  );
  readonly trendScaleMax = this.roundUpToStep(this.trendMaxValue, 20);
  readonly trendGridLines = this.buildGridLines(
    this.trendChart.height,
    this.trendChart.paddingTop,
    this.trendChart.paddingBottom,
    this.trendScaleMax
  );
  readonly trendPoints = this.buildTrendPoints();
  readonly solicitudesLinePoints = this.trendPoints.map((p) => `${p.x},${p.sY}`).join(' ');
  readonly apelacionesLinePoints = this.trendPoints.map((p) => `${p.x},${p.aY}`).join(' ');

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
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-8px)' },
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
              { opacity: 0, transform: 'translateY(16px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            {
              duration: 420,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
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

  get selectedMemberData(): Miembro {
    return this.miembros.find((member) => member.id === this.selectedMemberId) ?? this.miembros[0];
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
    return Math.ceil(value / step) * step;
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


