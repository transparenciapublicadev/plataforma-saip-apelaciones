import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';

type CalificacionDecision = 'admisible' | 'inadmisible' | 'improcedente';
type CalificacionTab = 'apelacion' | 'adjuntos';

interface CalificacionOption {
  id: CalificacionDecision;
  label: string;
  description: string;
  accent: string;
}

@Component({
  selector: 'app-ttaip-calificar',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ttaip-calificar.component.html',
  styleUrl: './ttaip-calificar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipCalificarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

  activeTab = signal<CalificacionTab>('apelacion');
  selectedDecision = signal<CalificacionDecision | null>(null);
  showPreview = signal<boolean>(false);

  fundamentos = '';
  observaciones = '';
  diasSubsanacion = 2;

  readonly tabs: ReadonlyArray<{ id: CalificacionTab; label: string }> = [
    { id: 'apelacion', label: 'Apelacion' },
    { id: 'adjuntos', label: 'Adjuntos' }
  ];

  readonly options: ReadonlyArray<CalificacionOption> = [
    {
      id: 'admisible',
      label: 'ADMISIBLE',
      description: 'Cumple requisitos y pasa a Resolucion Final',
      accent: 'var(--success)'
    },
    {
      id: 'inadmisible',
      label: 'INADMISIBLE',
      description: 'Requiere subsanacion en 2 dias habiles',
      accent: 'var(--warning)'
    },
    {
      id: 'improcedente',
      label: 'IMPROCEDENTE',
      description: 'No cumple requisitos y se archiva el proceso',
      accent: 'var(--muted-foreground)'
    }
  ];

  readonly selectedOption = computed<CalificacionOption | undefined>(() => {
    const current = this.selectedDecision();
    return this.options.find((option) => option.id === current);
  });

  readonly canSubmit = computed<boolean>(() => {
    const decision = this.selectedDecision();
    if (!decision || !this.fundamentos.trim()) {
      return false;
    }

    if (decision === 'inadmisible') {
      return this.observaciones.trim().length > 0;
    }

    return true;
  });

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibio expediente para calificar.');
      this.loadingApelacion.set(false);
      return;
    }

    this.cargarApelacion(expediente);
  }

  cargarApelacion(expediente: string): void {
    this.loadingApelacion.set(true);
    this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.apelacion.set(data);
        this.loadingApelacion.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la apelacion');
        this.loadingApelacion.set(false);
      }
    });
  }

  cambiarTab(tab: CalificacionTab): void {
    this.activeTab.set(tab);
  }

  seleccionarCalificacion(decision: CalificacionDecision): void {
    this.selectedDecision.set(decision);
    this.error.set('');
  }

  togglePreview(): void {
    this.showPreview.update((value) => !value);
  }

  enviarCalificacion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!currentAppeal) {
      this.error.set('No se encontro la apelacion a calificar.');
      return;
    }

    if (!decision) {
      this.error.set('Debe seleccionar una decision de calificacion.');
      return;
    }

    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios.');
      return;
    }

    if (decision === 'inadmisible' && !this.observaciones.trim()) {
      this.error.set('Las observaciones son obligatorias para una decision inadmisible.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (decision === 'admisible') {
      this.ttaipService.admitirApelacion(currentAppeal.id, {
        fundamentos: this.fundamentos.trim()
      }).subscribe({
        next: () => this.handleSuccess('Apelacion declarada ADMISIBLE.'),
        error: (err) => this.handleError(err)
      });
      return;
    }

    if (decision === 'inadmisible') {
      this.ttaipService.requerirSubsanacion(currentAppeal.id, {
        fundamentos: this.fundamentos.trim(),
        observaciones: this.observaciones.trim(),
        diasSubsanacion: this.diasSubsanacion
      }).subscribe({
        next: () => this.handleSuccess('Apelacion declarada INADMISIBLE.'),
        error: (err) => this.handleError(err)
      });
      return;
    }

    this.ttaipService.inadmitirApelacion(currentAppeal.id, {
      fundamentos: this.fundamentos.trim()
    }).subscribe({
      next: () => this.handleSuccess('Apelacion declarada IMPROCEDENTE.'),
      error: (err) => this.handleError(err)
    });
  }

  private handleSuccess(message: string): void {
    this.loading.set(false);
    this.mensaje.set(message);
    setTimeout(() => this.router.navigate(['/ttaip']), 2000);
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    const apiError = err as { error?: { mensaje?: string } };
    this.error.set(apiError.error?.mensaje || 'Error al procesar la calificacion.');
  }

  getEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getInitials(name: string | undefined): string {
    const source = (name || 'Ciudadano').trim();
    if (!source) {
      return 'CI';
    }

    return source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'CI';
  }

  getDefaultAdjuntos(): ReadonlyArray<string> {
    return ['SAIP_Original.pdf', 'Respuesta_Entidad.pdf', 'Recurso_Fundamentado.pdf'];
  }
}
