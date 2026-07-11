import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';
import {
  ReferenceConfirmModalComponent,
  ReferenceConfirmSummary,
  ReferenceConfirmWarning
} from '../../shared/reference-confirm-modal.component';
import {
  ReferenceSuccessMeta,
  ReferenceSuccessModalComponent,
  ReferenceSuccessNextStep,
  ReferenceSuccessTone
} from '../../shared/reference-success-modal.component';
import { DocumentoService } from '../../services/documento.service';

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
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent],
  templateUrl: './ttaip-calificar.component.html',
  styleUrl: './ttaip-calificar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipCalificarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);
  private readonly documentoService = inject(DocumentoService);
  private readonly primeraCalificacionEstados = new Set<string>(['EN_CALIFICACION_1']);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);

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

  canSubmit(): boolean {
    if (!this.puedeCalificar()) {
      return false;
    }

    const decision = this.selectedDecision();
    if (!decision || !this.fundamentos.trim()) {
      return false;
    }

    if (decision === 'inadmisible') {
      return this.observaciones.trim().length > 0;
    }

    return true;
  }

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

  descargarDocumento(doc: any): void {
    if (!doc.id) {
      this.error.set('No se puede descargar un documento sin ID.');
      return;
    }
    this.error.set('');
    this.documentoService.download(doc.id, doc.nombreArchivo || 'documento').subscribe({
      next: ({ blob, filename }) => {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (err) => {
        this.error.set('Error al descargar el documento.');
      }
    });
  }

  seleccionarCalificacion(decision: CalificacionDecision): void {
    if (!this.puedeCalificar()) {
      return;
    }

    this.selectedDecision.set(decision);
    this.error.set('');
  }

  togglePreview(): void {
    this.showPreview.update((value) => !value);
  }

  abrirConfirmacionCalificacion(): void {
    if (!this.validarCalificacion()) {
      return;
    }

    this.confirmModalAbierto.set(true);
  }

  enviarCalificacion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!this.validarCalificacion() || !currentAppeal || !decision) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (decision === 'admisible') {
      this.ttaipService.admitirApelacion(currentAppeal.id, {
        fundamentos: this.fundamentos.trim()
      }).subscribe({
        next: (updated) => this.handleSuccess('Apelacion declarada ADMISIBLE.', updated),
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
        next: (updated) => this.handleSuccess('Apelacion declarada INADMISIBLE.', updated),
        error: (err) => this.handleError(err)
      });
      return;
    }

    this.ttaipService.inadmitirApelacion(currentAppeal.id, {
      fundamentos: this.fundamentos.trim()
    }).subscribe({
      next: (updated) => this.handleSuccess('Apelacion declarada IMPROCEDENTE.', updated),
      error: (err) => this.handleError(err)
    });
  }

  private handleSuccess(message: string, updated?: Apelacion): void {
    const nextAppeal = updated ?? this.apelacion();
    if (nextAppeal) {
      this.apelacion.set(nextAppeal);
    }

    this.loading.set(false);
    this.mensaje.set(message);
    this.successModalAbierto.set(true);
    this.confirmModalAbierto.set(false);
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    this.confirmModalAbierto.set(false);
    const apiError = err as { error?: { mensaje?: string } };
    this.error.set(apiError.error?.mensaje || 'Error al procesar la calificacion.');
  }

  getEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  puedeCalificar(): boolean {
    return this.primeraCalificacionEstados.has(this.normalizeEstado(this.apelacion()?.estado));
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

  calificacionConfirmSummary(): ReferenceConfirmSummary[] {
    const selected = this.selectedOption();
    return [
      { label: 'Expediente', value: this.apelacion()?.expediente || '—', mono: true },
      { label: 'Calificación', value: selected?.label || '—' },
      { label: 'Efecto', value: selected?.description || '—' },
      { label: 'Fundamentos', value: `${this.fundamentos.trim().length} caracteres` }
    ];
  }

  calificacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Resolución firme',
      detail: 'La calificación se notificará a la entidad y al recurrente conforme a ley.'
    };
  }

  calificacionSuccessTone(): ReferenceSuccessTone {
    const decision = this.selectedDecision();
    if (decision === 'admisible') {
      return 'success';
    }
    if (decision === 'inadmisible') {
      return 'warning';
    }
    return 'brand';
  }

  calificacionSuccessTitle(): string {
    const decision = this.selectedDecision();
    if (decision === 'admisible') {
      return 'Apelación declarada ADMISIBLE';
    }
    if (decision === 'inadmisible') {
      return 'Apelación declarada INADMISIBLE';
    }
    return 'Apelación declarada IMPROCEDENTE';
  }

  calificacionSuccessDescription(): string {
    const decision = this.selectedDecision();
    if (decision === 'admisible') {
      return 'El recurso cumple los requisitos formales y pasa a etapa de Resolución Final donde el Tribunal se pronunciará sobre el fondo.';
    }
    if (decision === 'inadmisible') {
      return 'Se ha notificado al ciudadano para que subsane las observaciones en el plazo legal. Si no subsana, se tendrá por no presentado.';
    }
    return 'El recurso no cumple los requisitos legales. El proceso queda archivado.';
  }

  calificacionPlazoDias(): number | null {
    const decision = this.selectedDecision();
    if (decision === 'admisible') {
      return 10;
    }
    if (decision === 'inadmisible') {
      return this.diasSubsanacion;
    }
    return null;
  }

  calificacionPlazoDescripcion(): string {
    const decision = this.selectedDecision();
    if (decision === 'admisible') {
      return 'Plazo en que el Tribunal emitirá Resolución Final sobre el fondo del recurso.';
    }
    if (decision === 'inadmisible') {
      return 'Plazo en que el ciudadano debe subsanar las observaciones. Vencido el plazo se tendrá por no presentado.';
    }
    return '';
  }

  calificacionSuccessMetadata(): ReferenceSuccessMeta[] {
    return [
      { label: 'Calificación', value: this.selectedDecision()?.toUpperCase() || '—' },
      { label: 'Fundamentos', value: `${this.fundamentos.length} caracteres` },
      { label: 'SAIP origen', value: this.apelacion()?.solicitudExpediente || this.apelacion()?.numeroSolicitudExterna || '—', mono: true },
      { label: 'Secretaría', value: 'TTAIP' }
    ];
  }

  calificacionNextSteps(): ReferenceSuccessNextStep[] {
    const decision = this.selectedDecision();
    if (decision === 'admisible') {
      return [
        { label: 'Notificación al ciudadano y a la entidad emplazada.' },
        { label: 'El expediente avanza a Resolución Final.', hint: '10 días hábiles' },
        { label: 'El fallo de fondo será emitido por la sala colegiada.' }
      ];
    }
    if (decision === 'inadmisible') {
      return [
        { label: 'El ciudadano será notificado con las observaciones.' },
        { label: `Tendrá ${this.diasSubsanacion} días hábiles para subsanar.`, hint: 'Caso contrario: TENER POR NO PRESENTADO' },
        { label: 'Tras la subsanación se emite la 2da calificación.' }
      ];
    }
    return [
      { label: 'Se notifica al ciudadano la improcedencia y los fundamentos.' },
      { label: 'El expediente queda archivado.' }
    ];
  }

  irPanelTtaip(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ttaip']);
  }

  private validarCalificacion(): boolean {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!currentAppeal) {
      this.error.set('No se encontro la apelacion a calificar.');
      return false;
    }

    if (!this.puedeCalificar()) {
      this.error.set(`Esta apelacion ya no se encuentra en primera calificacion. Estado actual: ${this.getEstadoDisplay(currentAppeal.estado)}.`);
      return false;
    }

    if (!decision) {
      this.error.set('Debe seleccionar una decision de calificacion.');
      return false;
    }

    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios.');
      return false;
    }

    if (decision === 'inadmisible' && !this.observaciones.trim()) {
      this.error.set('Las observaciones son obligatorias para una decision inadmisible.');
      return false;
    }

    this.error.set('');
    return true;
  }

  private normalizeEstado(value: string | undefined | null): string {
    return (value || '').trim().toUpperCase().replaceAll(' ', '_');
  }
}
