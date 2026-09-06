import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { ConsultaPublicaSolicitud, SolicitudService } from '../../services/solicitud.service';

import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TimelineComponent } from '../../shared/timeline.component';

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
  tipoPersona: string;
  timeline: TimelineEvent[];
}

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
    LucideFileText,
    LucideSearch,
    LucideShield,
    LucideXCircle,
    StatusBadgeComponent,
    TimelineComponent,
  ],
  templateUrl: './consultar.component.html',
})
export class ConsultarComponent {
  private readonly solicitudService = inject(SolicitudService);

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

    this.solicitudService.consultarPublicamente(normalizedQuery).subscribe({
      next: (data) => {
        this.resultado.set(this.toConsultaResultado(data));
        this.noEncontrado.set(false);
        this.buscando.set(false);
      },
      error: () => {
        this.resultado.set(null);
        this.noEncontrado.set(true);
        this.buscando.set(false);
      }
    });
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

  private toConsultaResultado(data: ConsultaPublicaSolicitud): ConsultaResultado {
    const isRuc = /(?:RUC|S\.A\.C|E\.I\.R\.L|S\.A|20\d{9})/i.test(data.ciudadano || '');
    return {
      expediente: data.expediente,
      ciudadano: data.ciudadano,
      entidad: data.entidad,
      fechaPresentacion: this.formatDate(data.fechaPresentacion),
      estado: data.estado,
      diasTranscurridos: data.diasTranscurridos ?? 0,
      asunto: data.asunto,
      tipoPersona: isRuc ? 'Persona Jurídica (RUC)' : 'Persona Natural (DNI)',
      timeline: this.buildTimeline(data)
    };
  }

  private buildTimeline(data: ConsultaPublicaSolicitud): TimelineEvent[] {
    const events: TimelineEvent[] = [
      {
        title: 'Solicitud presentada',
        description: 'La SAIP fue registrada exitosamente.',
        date: this.formatDate(data.fechaPresentacion),
        status: 'completed',
        icon: 'mail'
      }
    ];

    if (data.respuestaFecha) {
      events.push({
        title: data.estado === 'DENEGADA' ? 'Solicitud denegada' : 'Respuesta emitida',
        description: data.estado === 'DENEGADA'
          ? 'La entidad emitió una denegatoria formal.'
          : 'La entidad emitió respuesta a la solicitud.',
        date: this.formatDate(data.respuestaFecha),
        status: 'completed',
        icon: 'filecheck'
      });
    } else if (data.estado === 'VENCIDA') {
      events.push({
        title: 'Plazo vencido',
        description: 'La solicitud excedió el plazo legal de respuesta.',
        date: this.formatDate(data.fechaLimite),
        status: 'current',
        icon: 'filecheck'
      });
    } else {
      events.push({
        title: 'En evaluación',
        description: 'La entidad evalúa la solicitud dentro del plazo legal.',
        date: this.formatDate(data.fechaPresentacion),
        status: 'current',
        icon: 'search'
      });
    }

    if (data.apelacionExpediente) {
      events.push({
        title: 'Apelación presentada',
        description: `Expediente ${data.apelacionExpediente} ante el TTAIP.`,
        date: this.formatDate(data.apelacionFecha),
        status: 'completed',
        icon: 'gavel'
      });

      events.push({
        title: data.resolucionFecha ? 'Resolución TTAIP' : 'En evaluación TTAIP',
        description: data.resolucionResultado
          ? `Resultado: ${data.resolucionResultado.replaceAll('_', ' ')}.`
          : `Estado: ${(data.apelacionEstado || 'EN_TRAMITE').replaceAll('_', ' ')}.`,
        date: this.formatDate(data.resolucionFecha) || 'Pendiente',
        status: data.resolucionFecha ? 'completed' : 'current',
        icon: data.resolucionFecha ? 'check' : 'scale'
      });
    } else if (!data.respuestaFecha && data.estado !== 'VENCIDA') {
      events.push({
        title: 'Respuesta',
        description: 'Pendiente de respuesta de la entidad.',
        date: 'Pendiente',
        status: 'pending',
        icon: 'filecheck'
      });
    }

    return events;
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(parsed);
  }
}
