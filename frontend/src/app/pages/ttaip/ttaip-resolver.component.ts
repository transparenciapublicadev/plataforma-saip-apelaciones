import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';
import type { ResolucionRequest } from '../../api/types';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ttaip-resolver.component.html',
  styleUrl: './ttaip-resolver.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolverComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

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

  readonly canSubmit = computed<boolean>(() => {
    return !!this.selectedDecision() && this.fundamentos.trim().length > 0;
  });

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
    this.causal.set(causal);
  }

  seleccionarDecision(decision: ResolucionDecision): void {
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

  enviarResolucion(): void {
    const currentAppeal = this.apelacion();
    const decision = this.selectedDecision();

    if (!currentAppeal) {
      this.error.set('No se encontro la apelacion para resolver.');
      return;
    }

    if (!decision) {
      this.error.set('Debe seleccionar una decision final.');
      return;
    }

    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const includeDisciplinary = decision === 'fundado' || decision === 'fundado_en_parte';
    const requestWithDisciplinary = this.getResolucionRequest(includeDisciplinary);
    const requestSimple: ResolucionRequest = { fundamentos: this.fundamentos.trim() };

    const serviceMap: Record<ResolucionDecision, () => void> = {
      fundado: () =>
        this.ttaipService.declararFundado(currentAppeal.id, requestWithDisciplinary).subscribe({
          next: () => this.handleSuccess('Apelacion declarada FUNDADA.'),
          error: (err) => this.handleError(err)
        }),
      fundado_en_parte: () =>
        this.ttaipService.declararFundadoEnParte(currentAppeal.id, requestWithDisciplinary).subscribe({
          next: () => this.handleSuccess('Apelacion declarada FUNDADA EN PARTE.'),
          error: (err) => this.handleError(err)
        }),
      infundado: () =>
        this.ttaipService.declararInfundado(currentAppeal.id, requestSimple).subscribe({
          next: () => this.handleSuccess('Apelacion declarada INFUNDADA.'),
          error: (err) => this.handleError(err)
        }),
      infundado_en_parte: () =>
        this.ttaipService.declararInfundadoEnParte(currentAppeal.id, requestSimple).subscribe({
          next: () => this.handleSuccess('Apelacion declarada INFUNDADA EN PARTE.'),
          error: (err) => this.handleError(err)
        }),
      improcedente: () =>
        this.ttaipService.declararImprocedente(currentAppeal.id, requestSimple).subscribe({
          next: () => this.handleSuccess('Apelacion declarada IMPROCEDENTE.'),
          error: (err) => this.handleError(err)
        }),
      sustraccion_materia: () =>
        this.ttaipService.declararSustraccionMateria(currentAppeal.id, requestSimple).subscribe({
          next: () => this.handleSuccess('Conclusión por sustraccion de la materia emitida.'),
          error: (err) => this.handleError(err)
        }),
      desistimiento: () =>
        this.ttaipService.declararDesistimiento(currentAppeal.id, requestSimple).subscribe({
          next: () => this.handleSuccess('Conclusión por desistimiento emitida.'),
          error: (err) => this.handleError(err)
        })
    };

    serviceMap[decision]();
  }

  private handleSuccess(message: string): void {
    this.loading.set(false);
    this.mensaje.set(message);
    setTimeout(() => this.router.navigate(['/ttaip']), 2000);
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    const apiError = err as { error?: { mensaje?: string } };
    this.error.set(apiError.error?.mensaje || 'Error al procesar la resolucion final.');
  }
}
