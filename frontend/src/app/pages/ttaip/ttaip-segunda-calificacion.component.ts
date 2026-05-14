import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';

type SegundaDecision = 'admitido' | 'improcedente';
type SegundaTab = 'subsanacion' | 'adjuntos';

interface SegundaOption {
  id: SegundaDecision;
  label: string;
  description: string;
  accent: string;
}

@Component({
  selector: 'app-ttaip-segunda-calificacion',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ttaip-segunda-calificacion.component.html',
  styleUrl: './ttaip-segunda-calificacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipSegundaCalificacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

  activeTab = signal<SegundaTab>('subsanacion');
  selectedDecision = signal<SegundaDecision | null>(null);
  showPreview = signal<boolean>(false);

  fundamentos = '';

  readonly tabs: ReadonlyArray<{ id: SegundaTab; label: string }> = [
    { id: 'subsanacion', label: 'Subsanacion' },
    { id: 'adjuntos', label: 'Adjuntos' }
  ];

  readonly options: ReadonlyArray<SegundaOption> = [
    {
      id: 'admitido',
      label: 'ADMITIDO A TRAMITE',
      description: 'Subsanacion aprobada y paso a Resolucion Final',
      accent: 'var(--success)'
    },
    {
      id: 'improcedente',
      label: 'IMPROCEDENTE',
      description: 'Subsanacion insuficiente y archivo del proceso',
      accent: 'var(--muted-foreground)'
    }
  ];

  readonly selectedOption = computed<SegundaOption | undefined>(() => {
    const current = this.selectedDecision();
    return this.options.find((option) => option.id === current);
  });

  readonly canSubmit = computed<boolean>(() => {
    return !!this.selectedDecision() && this.fundamentos.trim().length > 0;
  });

  readonly documentosSubsanacion = computed(() => {
    return this.apelacion()?.documentosSubsanacion ?? [];
  });

  readonly documentosOriginales = computed(() => {
    return this.apelacion()?.documentos ?? [];
  });

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibio expediente para segunda calificacion.');
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
        this.error.set('Error al cargar la apelacion.');
        this.loadingApelacion.set(false);
      }
    });
  }

  cambiarTab(tab: SegundaTab): void {
    this.activeTab.set(tab);
  }

  seleccionarDecision(decision: SegundaDecision): void {
    this.selectedDecision.set(decision);
    this.error.set('');
  }

  togglePreview(): void {
    this.showPreview.update((value) => !value);
  }

  getObservaciones(): string[] {
    const observaciones = this.apelacion()?.resolucionPrimeraCalificacion?.observaciones?.trim();
    if (!observaciones) {
      return [];
    }

    return observaciones
      .split(';')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  getSubsanacionFromFundamentos(): string {
    const fundamentos = this.apelacion()?.fundamentos || '';
    if (!fundamentos.includes('--- SUBSANACIÓN ---')) {
      return '';
    }

    const parts = fundamentos.split('--- SUBSANACIÓN ---');
    return parts.length > 1 ? parts[1].trim() : '';
  }

  getOriginalFundamentos(): string {
    const fundamentos = this.apelacion()?.fundamentos || '';
    if (!fundamentos) {
      return '';
    }

    if (!fundamentos.includes('--- SUBSANACIÓN ---')) {
      return fundamentos;
    }

    return fundamentos.split('--- SUBSANACIÓN ---')[0]?.trim() || '';
  }

  getDecisionLabel(decision: string | null): string {
    if (!decision) {
      return '[DECISION]';
    }

    if (decision === 'admitido') {
      return 'ADMITIDO A TRAMITE';
    }

    return 'IMPROCEDENTE';
  }

  getFallbackSubsanacionDocs(): ReadonlyArray<{ nombre: string; size: string }> {
    return [
      { nombre: 'Escrito_Fundamentado.pdf', size: '450 KB' },
      { nombre: 'Respuesta_Denegatoria.pdf', size: '320 KB' },
      { nombre: 'Declaracion_Domicilio.pdf', size: '180 KB' }
    ];
  }

  enviarCalificacion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!currentAppeal) {
      this.error.set('No se encontro la apelacion para evaluar.');
      return;
    }

    if (!decision) {
      this.error.set('Debe seleccionar una decision de segunda calificacion.');
      return;
    }

    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (decision === 'admitido') {
      this.ttaipService.admitirApelacion(currentAppeal.id, {
        fundamentos: this.fundamentos.trim()
      }).subscribe({
        next: () => this.handleSuccess('Apelacion declarada ADMITIDA A TRAMITE.'),
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
    this.error.set(apiError.error?.mensaje || 'Error al procesar la segunda calificacion.');
  }
}
