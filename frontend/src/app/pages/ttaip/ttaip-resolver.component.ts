import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { LocalStateOverrideService } from '../../services/local-state-override.service';
import { Apelacion, EstadoApelacion } from '../../models/apelacion.model';
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

type ResolverTab = 'apelacion' | 'adjuntos';
type CausalAnalisis = 'confirmar' | 'revocar';
type ResolucionDecision =
  | 'fundado'
  | 'fundado_en_parte'
  | 'infundado'
  | 'infundado_en_parte'
  | 'improcedente'
  | 'sustraccion_materia'
  | 'desistimiento';

interface DecisionOption {
  id: ResolucionDecision;
  label: string;
  description: string;
  accent: string;
}

@Component({
  selector: 'app-ttaip-resolver',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent],
  templateUrl: './ttaip-resolver.component.html',
  styleUrl: './ttaip-resolver.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolverComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);
  private readonly localStateOverride = inject(LocalStateOverrideService);
  private readonly resolucionEstados = new Set<string>(['EN_RESOLUCION']);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);

  activeTab = signal<ResolverTab>('apelacion');
  selectedDecision = signal<ResolucionDecision | null>(null);
  causal = signal<CausalAnalisis | null>(null);
  showPreview = signal<boolean>(false);

  fundamentos = '';
  ordenarEntrega = false;
  plazoDias = '10';
  iniciarProcesoDisciplinario = false;

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

  canSubmit(): boolean {
    return this.puedeEmitirResolucion()
      && !!this.selectedDecision()
      && this.fundamentos.trim().length > 0;
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
        this.apelacion.set(this.applyLocalEstado(data));
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
      desistimiento: 'CONCLUSION POR DESISTIMIENTO'
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
        'Procede la conclusion por desistimiento expreso del ciudadano recurrente.'
    };

    return summaries[decision];
  }

  getFallbackAdjuntos(): ReadonlyArray<string> {
    return [
      'SAIP_Original.pdf',
      'Respuesta_Entidad.pdf',
      'Recurso_Fundamentado.pdf',
      'Calificacion_Admisible.pdf'
    ];
  }

  private getResolucionRequest(includeDisciplinary: boolean): ResolucionRequest {
    return {
      fundamentos: this.fundamentos.trim(),
      iniciarProcesoDisciplinario: includeDisciplinary ? this.iniciarProcesoDisciplinario : undefined
    };
  }

  abrirConfirmacionResolucion(): void {
    if (!this.validarResolucion()) {
      return;
    }

    this.confirmModalAbierto.set(true);
  }

  enviarResolucion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!this.validarResolucion() || !currentAppeal || !decision) {
      return;
    }

    this.confirmModalAbierto.set(false);
    this.loading.set(true);
    this.error.set('');

    const includeDisciplinary = decision === 'fundado' || decision === 'fundado_en_parte';
    const requestWithDisciplinary = this.getResolucionRequest(includeDisciplinary);
    const requestSimple: ResolucionRequest = { fundamentos: this.fundamentos.trim() };

    const serviceMap: Record<ResolucionDecision, () => void> = {
      fundado: () =>
        this.ttaipService.declararFundado(currentAppeal.id, requestWithDisciplinary).subscribe({
          next: (updated) => this.handleSuccess('Apelacion declarada FUNDADA.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        }),
      fundado_en_parte: () =>
        this.ttaipService.declararFundadoEnParte(currentAppeal.id, requestWithDisciplinary).subscribe({
          next: (updated) => this.handleSuccess('Apelacion declarada FUNDADA EN PARTE.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        }),
      infundado: () =>
        this.ttaipService.declararInfundado(currentAppeal.id, requestSimple).subscribe({
          next: (updated) => this.handleSuccess('Apelacion declarada INFUNDADA.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        }),
      infundado_en_parte: () =>
        this.ttaipService.declararInfundadoEnParte(currentAppeal.id, requestSimple).subscribe({
          next: (updated) => this.handleSuccess('Apelacion declarada INFUNDADA EN PARTE.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        }),
      improcedente: () =>
        this.ttaipService.declararImprocedente(currentAppeal.id, requestSimple).subscribe({
          next: (updated) => this.handleSuccess('Apelacion declarada IMPROCEDENTE.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        }),
      sustraccion_materia: () =>
        this.ttaipService.declararSustraccionMateria(currentAppeal.id, requestSimple).subscribe({
          next: (updated) => this.handleSuccess('Conclusión por sustraccion de la materia emitida.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        }),
      desistimiento: () =>
        this.ttaipService.declararDesistimiento(currentAppeal.id, requestSimple).subscribe({
          next: (updated) => this.handleSuccess('Conclusión por desistimiento emitida.', updated, this.getNextEstado(decision)),
          error: (err) => this.handleError(err)
        })
    };

    serviceMap[decision]();
  }

  private handleSuccess(message: string, updated?: Apelacion, nextEstado?: EstadoApelacion): void {
    const nextAppeal = updated ?? this.apelacion();
    if (nextAppeal) {
      const resolved = nextEstado ? { ...nextAppeal, estado: nextEstado } : nextAppeal;
      this.apelacion.set(resolved);
      this.localStateOverride.setApelacionEstado(resolved, resolved.estado);
    }

    this.loading.set(false);
    this.mensaje.set(message);
    this.successModalAbierto.set(true);
  }

  private applyLocalEstado(apelacion: Apelacion): Apelacion {
    if (this.isEstadoResuelto(apelacion.estado)) {
      return apelacion;
    }

    const overridden = this.localStateOverride.getApelacionEstado(apelacion);
    if (!overridden || this.estadoRank(overridden) < this.estadoRank(apelacion.estado)) {
      return apelacion;
    }

    return { ...apelacion, estado: overridden as EstadoApelacion };
  }

  private isEstadoResuelto(estado?: string): boolean {
    const normalized = this.normalizeEstado(estado);
    return normalized.startsWith('RESUELTO')
      || normalized.startsWith('CONCLUSION')
      || normalized === 'TENER_POR_NO_PRESENTADO';
  }

  private estadoRank(estado?: string): number {
    const normalized = this.normalizeEstado(estado);
    const ranks: Record<string, number> = {
      PENDIENTE_ELEVACION: 0,
      EN_CALIFICACION_1: 1,
      EN_SUBSANACION: 2,
      EN_CALIFICACION_2: 3,
      NOTIFICACION_SEGUNDA_CALIFICACION: 4,
      EN_RESOLUCION: 5
    };

    return this.isEstadoResuelto(normalized) ? 6 : ranks[normalized] ?? 0;
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
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
    return [
      { label: 'Fallo', value: this.getDecisionLabel(this.selectedDecision()) },
      { label: 'Causal', value: this.causal() === 'confirmar' ? 'Confirmada' : this.causal() === 'revocar' ? 'Revocada' : '—' },
      { label: 'Mandato', value: this.showOrden() && this.ordenarEntrega ? `Entrega en ${this.plazoDias} días` : 'Sin mandato' },
      { label: 'Fundamentos', value: `${this.fundamentos.length} caracteres` }
    ];
  }

  resolucionNextSteps(): ReferenceSuccessNextStep[] {
    const steps: ReferenceSuccessNextStep[] = [
      { label: 'Notificación al ciudadano y a la entidad emplazada.' }
    ];

    if (this.showOrden() && this.ordenarEntrega) {
      steps.push({
        label: 'La entidad debe cumplir el mandato de entrega.',
        hint: `${this.plazoDias} días hábiles`
      });
    }

    steps.push({
      label: 'La resolución agota la vía administrativa. Solo cabe acción contencioso-administrativa.'
    });

    return steps;
  }

  irPanelTtaip(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ttaip']);
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

    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios.');
      return false;
    }

    this.error.set('');
    return true;
  }

  private getNextEstado(decision: ResolucionDecision): EstadoApelacion {
    const estados: Record<ResolucionDecision, EstadoApelacion> = {
      fundado: 'RESUELTO_FUNDADO',
      fundado_en_parte: 'RESUELTO_FUNDADO_EN_PARTE',
      infundado: 'RESUELTO_INFUNDADO',
      infundado_en_parte: 'RESUELTO_INFUNDADO_EN_PARTE',
      improcedente: 'RESUELTO_IMPROCEDENTE',
      sustraccion_materia: 'CONCLUSION_SUSTRACCION_MATERIA',
      desistimiento: 'CONCLUSION_DESISTIMIENTO'
    };

    return estados[decision];
  }

  private normalizeEstado(value: string | undefined | null): string {
    return (value || '').trim().toUpperCase().replaceAll(' ', '_');
  }
}
