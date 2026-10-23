import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';

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

interface ResolucionConProcesoDisciplinario {
  decision?: string;
  fechaResolucion?: string;
  fundamentos?: string;
  miembroTTAIPNombre?: string;
  iniciarProcesoDisciplinario?: boolean;
}

interface DisciplinaryCase {
  apelacion: Apelacion;
  resolucion: ResolucionConProcesoDisciplinario;
}

import {
  LucideArrowLeft, LucideAlertTriangle, LucideCheckCircle2, LucideClock,
  LucideFileText, LucideMail, LucideGavel, LucideScale, LucideFolderOpen
} from '@lucide/angular';

@Component({
  selector: 'app-proceso-disciplinario',
  imports: [
    CommonModule, RouterLink,
    LucideArrowLeft, LucideAlertTriangle, LucideCheckCircle2, LucideClock,
    LucideFileText, LucideMail, LucideGavel, LucideScale, LucideFolderOpen
  ],
  templateUrl: './proceso-disciplinario.component.html',
  styleUrl: './proceso-disciplinario.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcesoDisciplinarioComponent implements OnInit {
  private readonly ttaipService = inject(TtaipService);

  readonly activeTab = signal<ProcessTab>('resolucion');
  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly cases = signal<DisciplinaryCase[]>([]);

  readonly tabs = [
    { id: 'resolucion' as const, label: 'Resolucion TTAIP' },
    { id: 'notificacion' as const, label: 'Notificacion' },
    { id: 'descargos' as const, label: 'Descargos' },
    { id: 'sancion' as const, label: 'Sancion' }
  ];

  readonly sanciones = [
    'Amonestacion escrita',
    'Suspension temporal sin goce de haber (hasta 30 dias)',
    'Destitucion del cargo (casos graves)',
    'Multa administrativa (0.5 a 2 UIT)'
  ];

  readonly selectedCaseId = signal<number | string | null>(null);

  readonly selectedCase = computed(() => {
    const list = this.cases();
    if (list.length === 0) return null;
    const selId = this.selectedCaseId();
    if (selId === null) return list[0];
    return list.find((c) => (c.apelacion.id ?? c.apelacion.expediente) === selId) ?? list[0];
  });

  selectCase(c: DisciplinaryCase): void {
    this.selectedCaseId.set(c.apelacion.id ?? c.apelacion.expediente ?? null);
  }

  isCaseSelected(c: DisciplinaryCase): boolean {
    const current = this.selectedCase();
    if (!current) return false;
    return (c.apelacion.id ?? c.apelacion.expediente) === (current.apelacion.id ?? current.apelacion.expediente);
  }

  readonly timeline = computed<TimelineEvent[]>(() => {
    const item = this.selectedCase();
    if (!item) {
      return [];
    }

    const decision = this.formatDecision(item.resolucion.decision);
    const fechaResolucion = this.formatDate(item.resolucion.fechaResolucion);
    return [
      {
        title: 'Resolución TTAIP',
        desc: `${item.apelacion.expediente || 'Expediente'} · ${decision}`,
        date: fechaResolucion,
        status: 'completed',
        icon: 'file'
      },
      {
        title: 'Apertura del proceso',
        desc: 'La resolución final ordenó iniciar proceso disciplinario.',
        date: fechaResolucion,
        status: 'current',
        icon: 'gavel'
      },
      {
        title: 'Notificación y descargos',
        desc: 'Pendiente de registro por el backend.',
        date: 'Pendiente',
        status: 'pending',
        icon: 'mail'
      },
      {
        title: 'Evaluación y sanción',
        desc: 'Pendiente de resolución disciplinaria.',
        date: 'Pendiente',
        status: 'pending',
        icon: 'scale'
      }
    ];
  });

  readonly estadoNotificacion = computed<'Pendiente'>(() => 'Pendiente');

  readonly colorEstadoNotificacion = computed(() =>
    this.estadoNotificacion() === 'Pendiente' ? 'var(--warning)' : 'var(--success)'
  );

  ngOnInit(): void {
    this.cargarProcesos();
  }

  cambiarTab(tab: ProcessTab): void {
    this.activeTab.set(tab);
  }

  cargarProcesos(): void {
    this.loading.set(true);
    this.error.set('');

    this.ttaipService.getResueltas().subscribe({
      next: (apelaciones) => {
        const list = apelaciones
          .map((apelacion) => ({ apelacion, resolucion: apelacion.resolucion as ResolucionConProcesoDisciplinario | undefined }))
          .filter((item): item is DisciplinaryCase => !!item.resolucion?.iniciarProcesoDisciplinario);
        this.cases.set(list);
        if (list.length > 0 && this.selectedCaseId() === null) {
          this.selectedCaseId.set(list[0].apelacion.id ?? list[0].apelacion.expediente ?? null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.mensaje || 'Error al cargar procesos disciplinarios');
        this.loading.set(false);
      }
    });
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

  formatDecision(value?: string | null): string {
    return (value || 'RESOLUCIÓN')
      .replaceAll('_', ' ')
      .toUpperCase();
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Pendiente';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }
}
