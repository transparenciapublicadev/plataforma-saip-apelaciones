import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type ProcessTab = 'resolucion' | 'notificacion' | 'descargos' | 'sancion';
type TimelineState = 'completed' | 'current' | 'pending';
type TimelineIcon = 'file' | 'mail' | 'gavel' | 'scale';

interface TimelineEvent {
  title: string;
  desc: string;
  date: string;
  status: TimelineState;
  icon: TimelineIcon;
}

@Component({
  selector: 'app-proceso-disciplinario',
  imports: [CommonModule, RouterLink],
  templateUrl: './proceso-disciplinario.component.html',
  styleUrl: './proceso-disciplinario.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcesoDisciplinarioComponent {
  readonly activeTab = signal<ProcessTab>('resolucion');

  readonly tabs = [
    { id: 'resolucion' as const, label: 'Resolucion TTAIP' },
    { id: 'notificacion' as const, label: 'Notificacion' },
    { id: 'descargos' as const, label: 'Descargos' },
    { id: 'sancion' as const, label: 'Sancion' }
  ];

  readonly timeline = signal<TimelineEvent[]>([
    {
      title: 'Apertura del proceso',
      desc: 'Iniciado por incumplimiento de resolucion TTAIP.',
      date: '15 Sep 2025',
      status: 'completed',
      icon: 'file'
    },
    {
      title: 'Notificacion al funcionario',
      desc: 'Dra. Maria Elena Vega Torres notificada.',
      date: '16 Sep 2025',
      status: 'completed',
      icon: 'mail'
    },
    {
      title: 'Plazo para descargos',
      desc: 'Quedan 8 dias habiles para presentar descargos.',
      date: '30 Sep 2025',
      status: 'current',
      icon: 'gavel'
    },
    {
      title: 'Evaluacion y resolucion',
      desc: 'Pendiente de evaluacion por el Tribunal.',
      date: 'Pendiente',
      status: 'pending',
      icon: 'scale'
    }
  ]);

  readonly sanciones = [
    'Amonestacion escrita',
    'Suspension temporal sin goce de haber (hasta 30 dias)',
    'Destitucion del cargo (casos graves)',
    'Multa administrativa (0.5 a 2 UIT)'
  ];

  readonly diasRestantes = signal<number>(8);

  readonly estadoNotificacion = signal<'Recibida' | 'Pendiente'>('Recibida');

  readonly fechaVencimiento = signal<string>('30 Sep 2025');

  readonly colorEstadoNotificacion = computed(() =>
    this.estadoNotificacion() === 'Recibida' ? 'var(--success)' : 'var(--warning)'
  );

  cambiarTab(tab: ProcessTab): void {
    this.activeTab.set(tab);
  }

  timelineColor(status: TimelineState): string {
    if (status === 'completed') return 'var(--success)';
    if (status === 'current') return 'var(--brand-700)';
    return 'var(--muted-foreground)';
  }

  timelineBackground(status: TimelineState): string {
    if (status === 'pending') return 'var(--card)';
    return this.timelineColor(status);
  }

  timelineBorder(status: TimelineState): string {
    if (status === 'pending') return '1.5px dashed var(--border)';
    return 'none';
  }

  timelineShadow(status: TimelineState): string {
    if (status === 'pending') return 'none';
    return '0 0 0 4px var(--brand-50)';
  }
}
