import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TimelineEvent {
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'current' | 'pending';
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
        description: 'La solicitud SAIP fue registrada correctamente en el sistema.',
        date: '15/10/2025',
        status: 'completed',
      },
      {
        title: 'En evaluacion',
        description: 'La entidad esta evaluando la solicitud dentro del plazo legal.',
        date: '16/10/2025',
        status: 'current',
      },
      {
        title: 'Respuesta de entidad',
        description: 'Pendiente de respuesta por parte de la entidad.',
        date: 'Pendiente',
        status: 'pending',
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
        description: 'La solicitud SAIP fue registrada correctamente en el sistema.',
        date: '02/10/2025',
        status: 'completed',
      },
      {
        title: 'En evaluacion',
        description: 'La entidad evaluo la solicitud y preparo respuesta formal.',
        date: '03/10/2025',
        status: 'completed',
      },
      {
        title: 'Respuesta emitida',
        description: 'La entidad entrego la informacion solicitada.',
        date: '12/10/2025',
        status: 'completed',
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
        description: 'La solicitud SAIP fue registrada correctamente en el sistema.',
        date: '15/09/2025',
        status: 'completed',
      },
      {
        title: 'Denegatoria de entidad',
        description: 'La entidad denego el acceso invocando excepcion legal.',
        date: '25/09/2025',
        status: 'completed',
      },
      {
        title: 'Apelacion presentada',
        description: 'El ciudadano presento recurso de apelacion ante TTAIP.',
        date: '02/10/2025',
        status: 'completed',
      },
      {
        title: 'En evaluacion por TTAIP',
        description: 'El tribunal esta evaluando la apelacion presentada.',
        date: '05/10/2025',
        status: 'current',
      },
    ],
  },
};

@Component({
  selector: 'app-consultar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
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

  estadoEtiqueta(estado: ConsultaResultado['estado']): string {
    if (estado === 'EN_PROCESO') {
      return 'En proceso';
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

  timelineClass(status: TimelineEvent['status']): string {
    if (status === 'completed') {
      return 'bg-[var(--estado-verde)]';
    }
    if (status === 'current') {
      return 'bg-[var(--peru-rojo)] animate-pulse';
    }
    return 'bg-[var(--ceniza)]';
  }
}
