import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideArchive,
  LucideArrowRight,
  LucideBuilding2,
  LucideCalendar,
  LucideCheckCircle2,
  LucideClock,
  LucideEye,
  LucideFileCheck,
  LucideFileText,
  LucideGavel,
  LucideMail,
  LucideScale,
  LucideSearch,
  LucideShield,
  LucideXCircle,
} from '@lucide/angular';

interface TimelineEvent {
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'current' | 'pending';
  icon: 'mail' | 'search' | 'filecheck' | 'gavel' | 'scale' | 'check';
}

interface ConsultaResultado {
  expediente: string;
  ciudadano: string;
  entidad: string;
  fechaPresentacion: string;
  estado: 'EN_PROCESO' | 'RESPONDIDA' | 'APELADA' | 'DENEGADA' | 'VENCIDA' | 'ARCHIVADA';
  diasTranscurridos: number;
  asunto: string;
  timeline: TimelineEvent[];
}

const RESULTADOS_MOCK: Record<string, ConsultaResultado> = {
  'SAIP-2025-00847': {
    expediente: 'SAIP-2025-00847',
    ciudadano: 'J*** C*** P*** M***',
    entidad: 'Ministerio de Salud',
    fechaPresentacion: '15/10/2025',
    estado: 'EN_PROCESO',
    diasTranscurridos: 3,
    asunto: 'Solicitud de informacion sobre contratos de servicios de salud 2024-2025',
    timeline: [
      {
        title: 'Solicitud presentada',
        description: 'La SAIP fue registrada exitosamente.',
        date: '15/10/2025',
        status: 'completed',
        icon: 'mail',
      },
      {
        title: 'En evaluacion',
        description: 'La entidad evalua la solicitud (10 dias hab.).',
        date: '16/10/2025',
        status: 'current',
        icon: 'search',
      },
      {
        title: 'Respuesta',
        description: 'Pendiente de respuesta de la entidad.',
        date: 'Pendiente',
        status: 'pending',
        icon: 'filecheck',
      },
    ],
  },
  'SAIP-2025-00723': {
    expediente: 'SAIP-2025-00723',
    ciudadano: 'M*** E*** V*** T***',
    entidad: 'Municipalidad de Lima',
    fechaPresentacion: '02/10/2025',
    estado: 'RESPONDIDA',
    diasTranscurridos: 16,
    asunto: 'Acceso a registro de obras publicas del distrito de Miraflores',
    timeline: [
      {
        title: 'Solicitud presentada',
        description: 'La SAIP fue registrada.',
        date: '02/10/2025',
        status: 'completed',
        icon: 'mail',
      },
      {
        title: 'En evaluacion',
        description: 'La entidad evaluo la solicitud y preparo respuesta formal.',
        date: '03/10/2025',
        status: 'completed',
        icon: 'search',
      },
      {
        title: 'Respuesta emitida',
        description: 'La entidad respondio con la informacion.',
        date: '12/10/2025',
        status: 'completed',
        icon: 'filecheck',
      },
    ],
  },
  'SAIP-2025-00654': {
    expediente: 'SAIP-2025-00654',
    ciudadano: 'R*** S*** C***',
    entidad: 'SUNAT',
    fechaPresentacion: '15/09/2025',
    estado: 'APELADA',
    diasTranscurridos: 33,
    asunto: 'Informacion sobre recaudacion tributaria por departamento 2023',
    timeline: [
      {
        title: 'Solicitud presentada',
        description: 'La SAIP fue registrada.',
        date: '15/09/2025',
        status: 'completed',
        icon: 'mail',
      },
      {
        title: 'Solicitud denegada',
        description: 'Excepcion de confidencialidad tributaria.',
        date: '25/09/2025',
        status: 'completed',
        icon: 'search',
      },
      {
        title: 'Apelacion presentada',
        description: 'El ciudadano presento recurso de apelacion ante TTAIP.',
        date: '02/10/2025',
        status: 'completed',
        icon: 'gavel',
      },
      {
        title: 'En evaluacion TTAIP',
        description: 'El tribunal esta evaluando la apelacion presentada.',
        date: '05/10/2025',
        status: 'current',
        icon: 'scale',
      },
      {
        title: 'Resolucion',
        description: 'Pendiente de emision de resolucion por parte del tribunal.',
        date: 'Pendiente',
        status: 'pending',
        icon: 'check',
      },
    ],
  },
};

@Component({
  selector: 'app-consultar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAlertTriangle,
    LucideArchive,
    LucideArrowRight,
    LucideBuilding2,
    LucideCalendar,
    LucideCheckCircle2,
    LucideClock,
    LucideEye,
    LucideFileCheck,
    LucideFileText,
    LucideGavel,
    LucideMail,
    LucideScale,
    LucideSearch,
    LucideShield,
    LucideXCircle,
  ],
  templateUrl: './consultar.component.html',
})
export class ConsultarComponent {
  readonly query = signal('');
  readonly buscando = signal(false);
  readonly resultado = signal<ConsultaResultado | null>(null);
  readonly noEncontrado = signal(false);

  onQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.query.set(value);
    this.noEncontrado.set(false);
  }

  buscar(): void {
    const normalizedQuery = this.query().trim().toUpperCase();
    if (!normalizedQuery) {
      return;
    }

    this.buscando.set(true);
    this.noEncontrado.set(false);
    this.resultado.set(null);

    setTimeout(() => {
      const match = RESULTADOS_MOCK[normalizedQuery];
      this.resultado.set(match ?? null);
      this.noEncontrado.set(!match);
      this.buscando.set(false);
    }, 700);
  }

  limpiarBusqueda(): void {
    this.query.set('');
    this.noEncontrado.set(false);
    this.resultado.set(null);
  }

  estadoEtiqueta(estado: ConsultaResultado['estado']): string {
    if (estado === 'EN_PROCESO') {
      return 'En Proceso';
    }
    if (estado === 'RESPONDIDA') {
      return 'Respondida';
    }
    if (estado === 'APELADA') {
      return 'Apelada';
    }
    if (estado === 'DENEGADA') {
      return 'Denegada';
    }
    if (estado === 'VENCIDA') {
      return 'Vencida';
    }
    return 'Archivada';
  }

  estadoBadgeClass(estado: ConsultaResultado['estado']): string {
    if (estado === 'EN_PROCESO') {
      return 'badge bg-[var(--estado-azul-suave)] text-[var(--estado-azul)] border border-[var(--estado-azul-borde)]';
    }
    if (estado === 'RESPONDIDA') {
      return 'badge bg-[var(--estado-verde-suave)] text-[var(--estado-verde)] border border-[var(--estado-verde-borde)]';
    }
    if (estado === 'APELADA') {
      return 'badge bg-[var(--accent-violet-soft)] text-[var(--accent-violet)] border border-[var(--accent-violet-border)]';
    }
    if (estado === 'DENEGADA') {
      return 'badge bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)] border border-[var(--estado-rojo-borde)]';
    }
    if (estado === 'VENCIDA') {
      return 'badge bg-[var(--humo)] text-white border border-[var(--humo)]';
    }
    return 'badge bg-[var(--muted)] text-[var(--niebla)] border border-[var(--ceniza-claro)]';
  }

  statusIconColor(estado: ConsultaResultado['estado']): string {
    if (estado === 'EN_PROCESO') {
      return 'var(--info)';
    }
    if (estado === 'RESPONDIDA') {
      return 'var(--success)';
    }
    if (estado === 'APELADA') {
      return 'var(--gold)';
    }
    if (estado === 'DENEGADA') {
      return 'var(--brand-700)';
    }
    return 'var(--muted-foreground)';
  }

  timelineIconShellClass(item: TimelineEvent): string {
    return `reference-timeline-icon ${item.status} icon-${item.icon}`;
  }

  timelineCardClass(status: TimelineEvent['status']): string {
    return `reference-timeline-card ${status}`;
  }

  timelineDateClass(status: TimelineEvent['status']): string {
    return `reference-timeline-date ${status}`;
  }

  timelineLineClass(status: TimelineEvent['status']): string {
    return status === 'completed'
      ? 'reference-timeline-line completed'
      : 'reference-timeline-line';
  }
}
