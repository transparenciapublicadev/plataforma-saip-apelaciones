import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';
import type { ResolucionRequest } from '../../api/types';
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
import { validarDocumento } from '../../models/documento.model';
import { firstValueFrom } from 'rxjs';
import { problemDetailsMessage } from '../../utils/problem-details.util';

import { OfficialDocsSectionComponent } from './shared/official-docs-section.component';
import { OfficialPreviewComponent } from './shared/official-preview.component';
import { DocContext, CedulaVariant, cedulaVariantForStage } from './shared/official-docs.util';

type ResolverTab = 'apelacion' | 'adjuntos';
type CausalAnalisis = 'confirmar' | 'revocar';
type ResolucionDecision =
  | 'fundado'
  | 'fundado_en_parte'
  | 'infundado'
  | 'infundado_en_parte'
  | 'improcedente'
  | 'sustraccion_materia'
  | 'desistimiento'
  | 'estese_a_lo_resuelto'
  | 'nulidad_del_acto'
  | 'no_presentado';

interface DecisionOption {
  id: ResolucionDecision;
  label: string;
  description: string;
  accent: string;
}

import {
  LucideArrowLeft, LucideScale, LucideCheckCircle2, LucideFileText,
  LucideSend, LucideInfo, LucideUpload,
  LucideClock, LucideXCircle, LucideMinusCircle, LucideEye, LucideEyeOff
} from '@lucide/angular';

@Component({
  selector: 'app-ttaip-resolver',
  imports: [
    CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    OfficialDocsSectionComponent, OfficialPreviewComponent,
    LucideArrowLeft, LucideScale, LucideCheckCircle2, LucideFileText,
    LucideSend, LucideInfo, LucideUpload,
    LucideClock, LucideXCircle, LucideMinusCircle, LucideEye, LucideEyeOff
  ],
  templateUrl: './ttaip-resolver.component.html',
  styleUrl: './ttaip-resolver.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolverComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);
  private readonly documentoService = inject(DocumentoService);
  private readonly resolucionEstados = new Set<string>(['EN_RESOLUCION']);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);
  documentosSeleccionados = signal<File[]>([]);

  activeTab = signal<ResolverTab>('apelacion');
  selectedDecision = signal<ResolucionDecision | null>(null);
  causal = signal<CausalAnalisis | null>(null);
  showPreview = signal<boolean>(false);

  fundamentos = '';
  observacionesResolucion = '';
  ordenarEntrega = false;
  plazoDias = '10';
  iniciarProcesoDisciplinario = false;
  momentoVicio = '';
  actuacionOrdenada = '';

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
    return cedulaVariantForStage('final', this.selectedDecision() || undefined);
  });

  readonly tabs: ReadonlyArray<{ id: ResolverTab; label: string }> = [
    { id: 'apelacion', label: 'Apelacion' },
    { id: 'adjuntos', label: 'Adjuntos' }
  ];

  readonly causales: ReadonlyArray<{ id: CausalAnalisis; label: string; description: string; accent: string }> = [
    {
      id: 'confirmar',
      label: 'Confirmar',
      description: 'La causal esta correctamente aplicada',
      accent: 'var(--success)'
    },
    {
      id: 'revocar',
      label: 'Revocar',
      description: 'La causal no corresponde al caso',
      accent: 'var(--brand-700)'
    }
  ];

  readonly options: ReadonlyArray<DecisionOption> = [
    {
      id: 'fundado',
      label: 'FUNDADO',
      description: 'Se ampara el recurso y se ordena entregar la informacion',
      accent: 'var(--success)'
    },
    {
      id: 'fundado_en_parte',
      label: 'FUNDADO EN PARTE',
      description: 'Amparo parcial con entrega parcial de informacion',
      accent: 'var(--gold-dark)'
    },
    {
      id: 'infundado',
      label: 'INFUNDADO',
      description: 'Se desestima el recurso y se confirma la conducta de la entidad',
      accent: 'var(--brand-700)'
    },
    {
      id: 'infundado_en_parte',
      label: 'INFUNDADO EN PARTE',
      description: 'Se desestima parcialmente y se confirma parte de la conducta',
      accent: 'var(--warning)'
    },
    {
      id: 'improcedente',
      label: 'IMPROCEDENTE',
      description: 'No cumple requisitos formales o de fondo',
      accent: 'var(--muted-foreground)'
    },
    {
      id: 'sustraccion_materia',
      label: 'CONCLUSION POR SUSTRACCION',
      description: 'La entidad entrego la informacion durante el tramite',
      accent: 'var(--info)'
    },
    {
      id: 'desistimiento',
      label: 'CONCLUSION POR DESISTIMIENTO',
      description: 'El ciudadano desiste voluntariamente del recurso',
      accent: 'var(--muted-foreground)'
    },
    {
      id: 'estese_a_lo_resuelto',
      label: 'ESTESE A LO RESUELTO',
      description: 'Existe pronunciamiento previo aplicable al mismo asunto',
      accent: 'var(--info)'
    },
    {
      id: 'nulidad_del_acto',
      label: 'NULIDAD DEL ACTO',
      description: 'Se invalida la respuesta o procedimiento por vicios graves',
      accent: 'var(--warning)'
    },
    {
      id: 'no_presentado',
      label: 'TENER POR NO PRESENTADO',
      description: 'No se subsanó en plazo · el recurso se tiene por no presentado',
      accent: 'var(--muted-foreground)'
    }
  ];

  readonly selectedOption = computed<DecisionOption | undefined>(() => {
    const current = this.selectedDecision();
    return this.options.find((option) => option.id === current);
  });

  readonly showOrden = computed<boolean>(() => {
    const decision = this.selectedDecision();
    return decision === 'fundado' || decision === 'fundado_en_parte';
  });

  readonly showNulidad = computed<boolean>(() => {
    return this.selectedDecision() === 'nulidad_del_acto';
  });

  canSubmit(): boolean {
    if (!this.puedeEmitirResolucion() || !this.selectedDecision() || !this.fundamentos.trim()) {
      return false;
    }
    if (this.selectedDecision() === 'nulidad_del_acto') {
      return this.momentoVicio.trim().length > 0 && this.actuacionOrdenada.trim().length > 0;
    }
    return true;
  }

  readonly documentosAdjuntos = computed(() => {
    return this.apelacion()?.documentos ?? [];
  });

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibio expediente para resolver.');
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

  cambiarTab(tab: ResolverTab): void {
    this.activeTab.set(tab);
  }

  seleccionarCausal(causal: CausalAnalisis): void {
    if (!this.puedeEmitirResolucion()) {
      return;
    }

    this.causal.set(causal);
  }

  seleccionarDecision(decision: ResolucionDecision): void {
    if (!this.puedeEmitirResolucion()) {
      return;
    }

    this.selectedDecision.set(decision);
    this.error.set('');

    if (decision !== 'fundado' && decision !== 'fundado_en_parte') {
      this.ordenarEntrega = false;
      this.plazoDias = '10';
      this.iniciarProcesoDisciplinario = false;
    }
  }

  togglePreview(): void {
    this.showPreview.update((value) => !value);
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

  getDecisionLabel(decision: string | null): string {
    const labels: Record<string, string> = {
      fundado: 'FUNDADO',
      fundado_en_parte: 'FUNDADO EN PARTE',
      infundado: 'INFUNDADO',
      infundado_en_parte: 'INFUNDADO EN PARTE',
      improcedente: 'IMPROCEDENTE',
      sustraccion_materia: 'CONCLUSION POR SUSTRACCION DE LA MATERIA',
      desistimiento: 'CONCLUSION POR DESISTIMIENTO',
      estese_a_lo_resuelto: 'ESTESE A LO RESUELTO',
      nulidad_del_acto: 'NULIDAD DEL ACTO',
      no_presentado: 'TENER POR NO PRESENTADO'
    };

    if (!decision) {
      return '[DECISION]';
    }

    return labels[decision] || '[DECISION]';
  }

  getDecisionSummary(decision: ResolucionDecision): string {
    const summaries: Record<ResolucionDecision, string> = {
      fundado:
        'Se ampara totalmente el recurso y se ordena a la entidad la entrega de informacion en el plazo establecido.',
      fundado_en_parte:
        'Se ampara parcialmente el recurso y se ordena la entrega de la informacion que corresponde.',
      infundado:
        'Se desestima el recurso y se confirma la actuacion de la entidad emplazada.',
      infundado_en_parte:
        'Se desestima parcialmente el recurso y se confirma parte de la actuacion de la entidad.',
      improcedente:
        'El recurso no cumple los requisitos formales o de fondo para emitir pronunciamiento.',
      sustraccion_materia:
        'Procede la conclusion por sustraccion de la materia al haberse entregado la informacion durante el tramite.',
      desistimiento:
        'Procede la conclusion por desistimiento expreso del ciudadano recurrente.',
      estese_a_lo_resuelto:
        'Existe pronunciamiento previo aplicable al mismo asunto, pedido reiterado o caso sustancialmente equivalente.',
      nulidad_del_acto:
        'Se invalida la respuesta o procedimiento por vicios graves y se ordena retrotraer o emitir nuevo pronunciamiento.',
      no_presentado:
        'El recurso no fue subsanado dentro del plazo legal; se tiene por no presentado y el expediente queda archivado.'
    };

    return summaries[decision];
  }

  private getResolucionRequest(includeDisciplinary: boolean): ResolucionRequest {
    const request: ResolucionRequest = {
      fundamentos: this.fundamentos.trim(),
      iniciarProcesoDisciplinario: includeDisciplinary ? this.iniciarProcesoDisciplinario : undefined
    };

    if (this.selectedDecision() === 'nulidad_del_acto' && this.momentoVicio.trim()) {
      const nulidadDetalle = `Momento del vicio: ${this.momentoVicio.trim()}; Actuación ordenada: ${this.actuacionOrdenada.trim()}`;
      request.observaciones = this.observacionesResolucion.trim()
        ? `${this.observacionesResolucion.trim()} | ${nulidadDetalle}`
        : nulidadDetalle;
    } else if (this.observacionesResolucion.trim()) {
      request.observaciones = this.observacionesResolucion.trim();
    }

    return request;
  }

  abrirConfirmacionResolucion(): void {
    if (!this.validarResolucion()) {
      return;
    }

    this.confirmModalAbierto.set(true);
  }

  seleccionarDocumento(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const filesToAdd: File[] = [];
      let lastError = '';
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const errorMsg = validarDocumento(file);
        if (errorMsg) {
          lastError = errorMsg;
        } else {
          filesToAdd.push(file);
        }
      }
      if (lastError) {
        this.error.set(lastError);
      } else {
        this.error.set('');
      }
      if (filesToAdd.length > 0) {
        this.documentosSeleccionados.update(prev => [...prev, ...filesToAdd]);
      }
    }
    input.value = '';
  }

  removerDocumento(index: number): void {
    this.documentosSeleccionados.update(prev => prev.filter((_, i) => i !== index));
    this.error.set('');
  }

  formatFileSize(size: number): string {
    return (size / 1024).toFixed(1);
  }

  enviarResolucion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!this.validarResolucion() || !currentAppeal || !decision) {
      return;
    }

    // Parche pragmático: mantener el confirm modal abierto durante la carga (submitting)
    // para evitar el parpadeo del overlay y prevenir interacciones adicionales.
    this.loading.set(true);
    this.error.set('');

    const includeDisciplinary = decision === 'fundado' || decision === 'fundado_en_parte';
    const requestWithDisciplinary = this.getResolucionRequest(includeDisciplinary);
    const requestSimple = this.getResolucionRequest(false);

    const serviceMap: Record<ResolucionDecision, () => void> = {
      fundado: () =>
        this.ttaipService.declararFundado(currentAppeal.id, requestWithDisciplinary).subscribe({
          next: async (updated) => await this.handleSuccess('Apelacion declarada FUNDADA.', updated),
          error: (err) => this.handleError(err)
        }),
      fundado_en_parte: () =>
        this.ttaipService.declararFundadoEnParte(currentAppeal.id, requestWithDisciplinary).subscribe({
          next: async (updated) => await this.handleSuccess('Apelacion declarada FUNDADA EN PARTE.', updated),
          error: (err) => this.handleError(err)
        }),
      infundado: () =>
        this.ttaipService.declararInfundado(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Apelacion declarada INFUNDADA.', updated),
          error: (err) => this.handleError(err)
        }),
      infundado_en_parte: () =>
        this.ttaipService.declararInfundadoEnParte(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Apelacion declarada INFUNDADA EN PARTE.', updated),
          error: (err) => this.handleError(err)
        }),
      improcedente: () =>
        this.ttaipService.declararImprocedente(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Apelacion declarada IMPROCEDENTE.', updated),
          error: (err) => this.handleError(err)
        }),
      sustraccion_materia: () =>
        this.ttaipService.declararSustraccionMateria(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Conclusión por sustraccion de la materia emitida.', updated),
          error: (err) => this.handleError(err)
        }),
      desistimiento: () =>
        this.ttaipService.declararDesistimiento(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Conclusión por desistimiento emitida.', updated),
          error: (err) => this.handleError(err)
        }),
      estese_a_lo_resuelto: () =>
        this.ttaipService.declararEsteseALoResuelto(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Estese a lo resuelto emitido.', updated),
          error: (err) => this.handleError(err)
        }),
      nulidad_del_acto: () =>
        this.ttaipService.declararNulidadDelActo(currentAppeal.id, requestSimple).subscribe({
          next: async (updated) => await this.handleSuccess('Nulidad del acto emitida.', updated),
          error: (err) => this.handleError(err)
        }),
      no_presentado: () =>
        this.ttaipService.declararNoPresentado(currentAppeal.id, {
          fundamentos: this.fundamentos.trim()
        }).subscribe({
          next: async (updated) => await this.handleSuccess('Recurso declarado TENIDO POR NO PRESENTADO.', updated),
          error: (err) => this.handleError(err)
        })
    };

    serviceMap[decision]();
  }

  private async handleSuccess(message: string, updated?: Apelacion): Promise<void> {
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

    const files = this.documentosSeleccionados();
    const resolucionId = nextAppeal?.resolucion?.id;

    if (files.length > 0 && resolucionId) {
      let exitos = 0;
      const errores: string[] = [];

      for (const file of files) {
        try {
          await firstValueFrom(
            this.documentoService.upload(file, 'RESOLUCION_TTAIP', { resolucionId })
          );
          exitos++;
        } catch (uploadErr: any) {
          const msg = problemDetailsMessage(uploadErr, 'Error en el servidor');
          errores.push(`El archivo ${file.name} no pudo subirse: ${msg}`);
        }
      }

      this.loading.set(false);
      if (errores.length > 0) {
        this.mensaje.set(`${message} Se subieron ${exitos} de ${files.length} documentos correctamente. Errores: ${errores.join(' | ')}`);
      } else {
        this.mensaje.set(`${message} Todos los documentos de resolución (${files.length}) fueron subidos correctamente.`);
      }
      this.successModalAbierto.set(true);
      this.confirmModalAbierto.set(false);
    } else {
      this.loading.set(false);
      this.mensaje.set(files.length > 0
        ? `${message} Los archivos seleccionados no se subieron: falta el identificador de resolución. Consulte el expediente.`
        : message);
      this.successModalAbierto.set(true);
      this.confirmModalAbierto.set(false);
    }
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    this.confirmModalAbierto.set(false);
    const apiError = err as { error?: { mensaje?: string } };
    this.error.set(apiError.error?.mensaje || 'Error al procesar la resolucion final.');
  }

  resolucionConfirmSummary(): ReferenceConfirmSummary[] {
    const selected = this.selectedOption();
    const summary: ReferenceConfirmSummary[] = [
      { label: 'Expediente', value: this.apelacion()?.expediente || '—', mono: true },
      { label: 'Sentido', value: selected?.label || '—' },
      { label: 'Efecto', value: selected?.description || '—' }
    ];

    if (this.showOrden() && this.ordenarEntrega) {
      summary.push({ label: 'Plazo entrega', value: `${this.plazoDias} días hábiles` });
    }

    summary.push({ label: 'Fundamentos', value: `${this.fundamentos.trim().length} caracteres` });
    if (this.observacionesResolucion.trim()) {
      summary.push({ label: 'Sustento específico', value: `${this.observacionesResolucion.trim().length} caracteres` });
    }
    const files = this.documentosSeleccionados();
    if (files.length > 0) {
      summary.push({ label: 'Resolución PDF', value: files.map(f => f.name).join(', ') });
    }
    return summary;
  }

  resolucionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Última instancia administrativa',
      detail: 'La resolución pone fin a la vía administrativa y será notificada a todas las partes.'
    };
  }

  resolucionSuccessTone(): ReferenceSuccessTone {
    const decision = this.selectedDecision();
    if (decision === 'fundado' || decision === 'fundado_en_parte') {
      return 'success';
    }
    if (decision === 'sustraccion_materia') {
      return 'gold';
    }
    if (decision === 'nulidad_del_acto') {
      return 'gold';
    }
    return 'brand';
  }

  resolucionSuccessTitle(): string {
    return `Recurso declarado ${this.getDecisionLabel(this.selectedDecision())}`;
  }

  resolucionSuccessDescription(): string {
    const decision = this.selectedDecision();
    if (decision === 'fundado') {
      return 'Se ampara el recurso. La entidad emplazada deberá entregar la información en el plazo ordenado.';
    }
    if (decision === 'fundado_en_parte') {
      return 'Se ampara parcialmente el recurso. La entidad entregará la parte de información que corresponde.';
    }
    if (decision === 'infundado') {
      return 'Se desestima el recurso. La conducta de la entidad queda confirmada.';
    }
    if (decision === 'infundado_en_parte') {
      return 'Se desestima parcialmente. Se confirma parte de la conducta de la entidad.';
    }
    if (decision === 'improcedente') {
      return 'El recurso resulta improcedente. El expediente queda archivado.';
    }
    if (decision === 'sustraccion_materia') {
      return 'Se concluye por sustracción de la materia: la entidad ya entregó la información durante el trámite.';
    }
    if (decision === 'estese_a_lo_resuelto') {
      return 'Se aplica un pronunciamiento previo al mismo asunto o pedido reiterado. El expediente queda cerrado.';
    }
    if (decision === 'nulidad_del_acto') {
      return 'Se declara la nulidad por vicios graves y se ordena retrotraer o emitir nuevo pronunciamiento.';
    }
    if (decision === 'no_presentado') {
      return 'El recurso no fue subsanado dentro del plazo legal; se tiene por no presentado y el expediente queda archivado.';
    }
    return 'Se concluye por desistimiento expreso del ciudadano.';
  }

  resolucionPlazoDias(): number | null {
    return this.showOrden() && this.ordenarEntrega ? Number.parseInt(this.plazoDias, 10) || 10 : null;
  }

  resolucionPlazoDescripcion(): string {
    return this.showOrden() && this.ordenarEntrega
      ? 'Plazo en que la entidad emplazada deberá entregar la información al ciudadano.'
      : '';
  }

  resolucionSuccessMetadata(): ReferenceSuccessMeta[] {
    const metadata: ReferenceSuccessMeta[] = [
      { label: 'Fallo', value: this.getDecisionLabel(this.selectedDecision()) },
      { label: 'Causal', value: this.causal() === 'confirmar' ? 'Confirmada' : this.causal() === 'revocar' ? 'Revocada' : '—' },
      { label: 'Mandato y plazo', value: 'Consultar el acto registrado' },
      { label: 'Fundamentos', value: `${this.fundamentos.length} caracteres` }
    ];
    const files = this.documentosSeleccionados();
    if (files.length > 0) {
      metadata.push({ label: 'Archivos seleccionados (verificar recepción)', value: files.map(f => f.name).join(', ') });
    }
    return metadata;
  }

  resolucionNextSteps(): ReferenceSuccessNextStep[] {
    const steps: ReferenceSuccessNextStep[] = [
      { label: 'Notificación al ciudadano y a la entidad emplazada.' }
    ];

    if (this.showOrden() && this.ordenarEntrega) {
      steps.push({
        label: 'La entidad debe cumplir el mandato de entrega.',
        hint: 'Consultar el mandato y su notificación en el expediente.'
      });
    }

    if (this.selectedDecision() === 'nulidad_del_acto') {
      steps.push({
        label: 'La entidad deberá atender la orden de retrotraer o emitir nuevo pronunciamiento.'
      });
    }

    steps.push({
      label: 'La resolución agota la vía administrativa. Solo cabe acción contencioso-administrativa.'
    });

    return steps;
  }

  irPanelTtaip(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ttaip'], { state: { focusStage: 'resueltos' } });
  }

  puedeEmitirResolucion(): boolean {
    return this.resolucionEstados.has(this.normalizeEstado(this.apelacion()?.estado));
  }

  getEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  private validarResolucion(): boolean {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!currentAppeal) {
      this.error.set('No se encontro la apelacion para resolver.');
      return false;
    }

    if (!this.puedeEmitirResolucion()) {
      this.error.set(`Esta apelacion ya no se encuentra en resolucion final. Estado actual: ${this.getEstadoDisplay(currentAppeal.estado)}.`);
      return false;
    }

    if (!decision) {
      this.error.set('Debe seleccionar una decision final.');
      return false;
    }

    if (decision === 'nulidad_del_acto' && (!this.momentoVicio.trim() || !this.actuacionOrdenada.trim())) {
      this.error.set('Indique el momento del vicio al que se retrotrae y la actuación ordenada.');
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
