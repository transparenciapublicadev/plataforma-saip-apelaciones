import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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

import { OfficialDocsSectionComponent } from './shared/official-docs-section.component';
import { OfficialPreviewComponent } from './shared/official-preview.component';
import { DocContext, CedulaVariant, cedulaVariantForStage } from './shared/official-docs.util';
import {
  LucideArrowLeft, LucideCheckCircle2, LucideUpload,
  LucideFileText, LucideXCircle, LucideClock, LucideInfo, LucideSend, LucidePlus,
  LucideEye, LucideEyeOff
} from '@lucide/angular';

type SegundaDecision = 'admitido' | 'improcedente' | 'no_presentado';
type SegundaTab = 'subsanacion' | 'adjuntos';

interface SegundaOption {
  id: SegundaDecision;
  label: string;
  description: string;
  accent: string;
}

@Component({
  selector: 'app-ttaip-segunda-calificacion',
  imports: [
    CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    OfficialDocsSectionComponent, OfficialPreviewComponent,
    LucideArrowLeft, LucideCheckCircle2, LucideUpload,
    LucideFileText, LucideXCircle, LucideClock, LucideInfo, LucideSend,
    LucideEye, LucideEyeOff
  ],
  templateUrl: './ttaip-segunda-calificacion.component.html',
  styleUrl: './ttaip-segunda-calificacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipSegundaCalificacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);
  private readonly documentoService = inject(DocumentoService);
  private readonly segundaCalificacionEstados = new Set<string>(['EN_CALIFICACION_2', 'NOTIFICACION_SEGUNDA_CALIFICACION']);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);

  activeTab = signal<SegundaTab>('subsanacion');
  selectedDecision = signal<SegundaDecision | null>(null);
  showPreview = signal<boolean>(false);

  fundamentos = '';

  readonly docCtx = computed<Partial<DocContext>>(() => {
    const ap = this.apelacion();
    return {
      expediente: ap?.expediente || '',
      recurrente: (ap?.ciudadanoNombre || 'No registrado').toUpperCase(),
      entidad: ap?.entidadNombre || 'No registrada',
      correo: (ap as any)?.ciudadanoEmail || (ap as any)?.email || '—',
      direccionEntidad: '—',
      sumilla: ap?.solicitudAsunto || ap?.resumenSolicitudOriginal || ap?.fundamentos || 'No registrada',
    };
  });

  readonly cedulaVariant = computed<CedulaVariant>(() => {
    return cedulaVariantForStage('segunda', this.selectedDecision() || undefined);
  });

  readonly tabs: ReadonlyArray<{ id: SegundaTab; label: string }> = [
    { id: 'subsanacion', label: 'Subsanacion' },
    { id: 'adjuntos', label: 'Adjuntos' }
  ];

  readonly options: ReadonlyArray<SegundaOption> = [
    {
      id: 'admitido',
      label: 'ADMITIDO A TRÁMITE',
      description: 'Subsanación aprobada · pasa a Resolución Final',
      accent: 'var(--success)'
    },
    {
      id: 'improcedente',
      label: 'IMPROCEDENTE',
      description: 'Subsanación insuficiente · proceso archivado',
      accent: 'var(--muted-foreground)'
    },
    {
      id: 'no_presentado',
      label: 'TENER POR NO PRESENTADO',
      description: 'No subsanó en el plazo de 2 días hábiles',
      accent: 'var(--warning)'
    }
  ];

  readonly selectedOption = computed<SegundaOption | undefined>(() => {
    const current = this.selectedDecision();
    return this.options.find((option) => option.id === current);
  });

  canSubmit(): boolean {
    return this.puedeEmitirSegundaCalificacion()
      && !!this.selectedDecision()
      && this.fundamentos.trim().length > 0;
  }

  readonly documentosSubsanacion = computed(() => {
    // Nota de mantenimiento: limitación conocida si se habilitan múltiples rondas de subsanación
    return this.apelacion()?.documentos?.filter(doc => doc.tipoDocumento === 'SUBSANACION') ?? [];
  });

  readonly documentosOriginales = computed(() => {
    return this.apelacion()?.documentos?.filter(doc => doc.tipoDocumento !== 'SUBSANACION') ?? [];
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

  seleccionarDecision(decision: SegundaDecision): void {
    if (!this.puedeEmitirSegundaCalificacion()) {
      return;
    }

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
      return '[DECISIÓN]';
    }

    if (decision === 'admitido') {
      return 'ADMITIDO A TRÁMITE';
    }

    if (decision === 'no_presentado') {
      return 'TENER POR NO PRESENTADO';
    }

    return 'IMPROCEDENTE';
  }

  abrirConfirmacionCalificacion(): void {
    if (!this.validarSegundaCalificacion()) {
      return;
    }

    this.confirmModalAbierto.set(true);
  }

  enviarCalificacion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!this.validarSegundaCalificacion() || !currentAppeal || !decision) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (decision === 'admitido') {
      this.ttaipService.admitirApelacion(currentAppeal.id, {
        fundamentos: this.fundamentos.trim()
      }).subscribe({
        next: (updated) => this.handleSuccess('Apelación declarada ADMITIDA A TRÁMITE.', updated),
        error: (err) => this.handleError(err)
      });
      return;
    }

    if (decision === 'no_presentado') {
      this.ttaipService.declararNoPresentado(currentAppeal.id, {
        fundamentos: this.fundamentos.trim()
      }).subscribe({
        next: (updated) => this.handleSuccess('Recurso declarado TENIDO POR NO PRESENTADO.', updated),
        error: (err) => this.handleError(err)
      });
      return;
    }

    this.ttaipService.inadmitirApelacion(currentAppeal.id, {
      fundamentos: this.fundamentos.trim()
    }).subscribe({
      next: (updated) => this.handleSuccess('Apelación declarada IMPROCEDENTE.', updated),
      error: (err) => this.handleError(err)
    });
  }

  private handleSuccess(message: string, updated?: Apelacion): void {
    const current = this.apelacion();
    if (!updated?.id || updated.id !== current?.id || updated.expediente !== current?.expediente) {
      this.loading.set(false);
      this.successModalAbierto.set(false);
      this.confirmModalAbierto.set(false);
      this.error.set('No se recibió una confirmación verificable del recurso; consulte el expediente antes de repetir la operación.');
      return;
    }
    const nextAppeal = updated;
    this.apelacion.set(nextAppeal);

    this.loading.set(false);
    this.mensaje.set(message);
    this.successModalAbierto.set(true);
    this.confirmModalAbierto.set(false);
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    this.confirmModalAbierto.set(false);
    const apiError = err as { error?: { mensaje?: string } };
    this.error.set(apiError.error?.mensaje || 'Error al procesar la segunda calificacion.');
  }

  segundaConfirmSummary(): ReferenceConfirmSummary[] {
    const selected = this.selectedOption();
    return [
      { label: 'Expediente', value: this.apelacion()?.expediente || '—', mono: true },
      { label: 'Resultado', value: selected?.label || '—' },
      { label: 'Efecto', value: selected?.description || '—' },
      { label: 'Fundamentos', value: `${this.fundamentos.trim().length} caracteres` }
    ];
  }

  segundaWarning(): ReferenceConfirmWarning {
    return {
      label: 'Decisión final',
      detail: this.selectedDecision() === 'admitido'
        ? 'El expediente pasará a etapa de Resolución Final.'
        : 'El recurso quedará archivado definitivamente conforme al Art. 34.3 del TUO de la Ley N.° 27806.'
    };
  }

  segundaSuccessTone(): ReferenceSuccessTone {
    const d = this.selectedDecision();
    if (d === 'admitido') return 'success';
    if (d === 'no_presentado') return 'warning';
    return 'brand';
  }

  segundaSuccessTitle(): string {
    const d = this.selectedDecision();
    if (d === 'admitido') return 'Subsanación ADMITIDA A TRÁMITE';
    if (d === 'no_presentado') return 'Recurso TENIDO POR NO PRESENTADO';
    return 'Recurso declarado IMPROCEDENTE';
  }

  segundaSuccessDescription(): string {
    const d = this.selectedDecision();
    if (d === 'admitido') {
      return 'La subsanación cumple los requisitos. El expediente avanza a Resolución Final donde el Tribunal se pronunciará sobre el fondo.';
    }
    if (d === 'no_presentado') {
      return 'El administrado no subsanó dentro del plazo de 2 días hábiles. El recurso se tiene por no presentado y el expediente se archiva.';
    }
    return 'La subsanación resulta insuficiente. El proceso queda archivado y se notifica al ciudadano.';
  }

  segundaPlazoDias(): number | null {
    return this.selectedDecision() === 'admitido' ? 10 : null;
  }

  segundaPlazoDescripcion(): string {
    return this.selectedDecision() === 'admitido'
      ? 'Plazo en que el Tribunal emitirá Resolución Final.'
      : '';
  }

  segundaSuccessMetadata(): ReferenceSuccessMeta[] {
    const docsCount = this.documentosSubsanacion().length;
    return [
      { label: 'Decisión', value: this.getDecisionLabel(this.selectedDecision()) },
      { label: 'Docs revisados', value: `${docsCount} archivos` },
      { label: 'Fundamentos', value: `${this.fundamentos.length} caracteres` },
      { label: 'Secretaría', value: 'TTAIP' }
    ];
  }

  segundaNextSteps(): ReferenceSuccessNextStep[] {
    const d = this.selectedDecision();
    if (d === 'admitido') {
      return [
        { label: 'Notificación al ciudadano y a la entidad emplazada.' },
        { label: 'El expediente avanza a Resolución Final.', hint: '10 días hábiles' },
        { label: 'La sala emitirá fallo: FUNDADO o INFUNDADO.' }
      ];
    }
    if (d === 'no_presentado') {
      return [
        { label: 'Se notifica al recurrente que el recurso se tiene por no presentado.' },
        { label: 'El expediente queda archivado conforme a ley.' }
      ];
    }
    return [
      { label: 'Se notifica al ciudadano la improcedencia.' },
      { label: 'El expediente queda archivado.' }
    ];
  }

  irPanelTtaip(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ttaip']);
  }

  puedeEmitirSegundaCalificacion(): boolean {
    return this.segundaCalificacionEstados.has(this.normalizeEstado(this.apelacion()?.estado));
  }

  getEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  private validarSegundaCalificacion(): boolean {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!currentAppeal) {
      this.error.set('No se encontro la apelacion para evaluar.');
      return false;
    }

    if (!this.puedeEmitirSegundaCalificacion()) {
      this.error.set(`Esta apelacion ya no se encuentra en segunda calificacion. Estado actual: ${this.getEstadoDisplay(currentAppeal.estado)}.`);
      return false;
    }

    if (!decision) {
      this.error.set('Debe seleccionar una decision de segunda calificacion.');
      return false;
    }

    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios.');
      return false;
    }

    this.error.set('');
    return true;
  }

  private normalizeEstado(value: string | undefined | null): string {
    return (value || '').trim().toUpperCase().replaceAll(' ', '_');
  }
}
