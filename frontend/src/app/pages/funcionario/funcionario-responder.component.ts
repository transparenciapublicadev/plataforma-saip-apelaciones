import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { RespuestaService } from '../../services/respuesta.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

type ResponseTabId = 'responder' | 'solicitud' | 'ciudadano' | 'adjuntos';
type DecisionId = 'entrega_total' | 'entrega_parcial' | 'denegacion_total';

interface ResponseDecision {
  id: DecisionId;
  title: string;
  description: string;
  accent: string;
}

@Component({
  selector: 'app-funcionario-responder',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './funcionario-responder.component.html',
  styleUrl: './funcionario-responder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioResponderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudService = inject(SolicitudService);
  private readonly respuestaService = inject(RespuestaService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  causales = signal<string[]>([]);
  loading = signal<boolean>(false);
  loadingSolicitud = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

  activeTab = signal<ResponseTabId>('responder');
  decision = signal<DecisionId | null>(null);

  descripcionAceptacion = '';
  descripcionDenegacion = '';
  formatoEntrega = 'digital';
  plazoEntrega = 5;
  causalDenegatoria = '';
  fundamentoLegal = '';

  documentosEntrega = signal<File | null>(null);
  evidenciaDenegatoria = signal<File | null>(null);

  readonly tabs: ReadonlyArray<{ id: ResponseTabId; label: string }> = [
    { id: 'responder', label: 'Responder' },
    { id: 'solicitud', label: 'Solicitud' },
    { id: 'ciudadano', label: 'Ciudadano' },
    { id: 'adjuntos', label: 'Adjuntos' }
  ];
  readonly decisions: ResponseDecision[] = [
    {
      id: 'entrega_total',
      title: 'Entrega total',
      description: 'La información se entrega íntegramente al ciudadano.',
      accent: 'var(--success)'
    },
    {
      id: 'entrega_parcial',
      title: 'Entrega parcial',
      description: 'Se entrega parte y el resto se justifica legalmente.',
      accent: 'var(--warning)'
    },
    {
      id: 'denegacion_total',
      title: 'Denegación total',
      description: 'Requiere causal legal y evidencia documental.',
      accent: 'var(--brand-700)'
    }
  ];

  readonly canSubmit = computed<boolean>(() => {
    const currentDecision = this.decision();
    if (!currentDecision || this.esSilencioAdministrativoAutomatico()) {
      return false;
    }

    if (currentDecision === 'entrega_total' || currentDecision === 'entrega_parcial') {
      return this.descripcionAceptacion.trim().length > 0 && !!this.documentosEntrega();
    }

    return this.causalDenegatoria.length > 0
      && this.descripcionDenegacion.trim().length > 0
      && this.fundamentoLegal.trim().length > 0
      && !!this.evidenciaDenegatoria();
  });

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (!expediente) {
      this.error.set('No se recibió el expediente para registrar la respuesta.');
      this.loadingSolicitud.set(false);
      return;
    }

    this.cargarSolicitud(expediente);
    this.cargarCausales();
  }

  cargarSolicitud(expediente: string): void {
    this.loadingSolicitud.set(true);
    this.solicitudService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        this.loadingSolicitud.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la solicitud');
        this.loadingSolicitud.set(false);
      }
    });
  }

  cargarCausales(): void {
    this.respuestaService.getCausalesDenegacion().subscribe({
      next: (data) => this.causales.set(data),
      error: () => this.error.set('No se pudieron cargar las causales de denegación.')
    });
  }

  cambiarTab(tab: ResponseTabId): void {
    this.activeTab.set(tab);
  }

  seleccionarDecision(value: DecisionId): void {
    this.decision.set(value);
    this.error.set('');
  }

  onDocumentosEntregaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.documentosEntrega.set(input.files?.[0] || null);
  }

  onEvidenciaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.evidenciaDenegatoria.set(input.files?.[0] || null);
  }

  enviarRespuesta(): void {
    const sesion = this.authService.obtenerSesion();
    const sol = this.solicitud();
    const currentDecision = this.decision();

    if (!sesion?.funcionarioId || !sol) {
      this.error.set('Error de sesión');
      return;
    }

    if (!currentDecision) {
      this.error.set('Debe seleccionar el tipo de respuesta institucional.');
      return;
    }

    if (this.esSilencioAdministrativoAutomatico()) {
      this.error.set('La solicitud venció y aplica SILENCIO_ADMINISTRATIVO automáticamente. No se permite registrar respuesta manual.');
      return;
    }

    if (!this.canSubmit()) {
      this.error.set('Complete todos los campos obligatorios antes de enviar.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (currentDecision === 'entrega_total' || currentDecision === 'entrega_parcial') {
      const tipoRespuesta = currentDecision === 'entrega_total' ? 'ENTREGA_TOTAL' : 'ENTREGA_PARCIAL';

      this.respuestaService.aceptarSolicitud({
        solicitudId: sol.id,
        funcionarioId: sesion.funcionarioId,
        tipoRespuesta,
        contenido: this.descripcionAceptacion.trim(),
        formatoEntrega: this.formatoEntrega,
        plazoEntrega: this.plazoEntrega
      }).subscribe({
        next: () => this.handleSuccess('Respuesta enviada correctamente. El ciudadano fue notificado.'),
        error: (err) => this.handleError(err)
      });

      return;
    }

    this.respuestaService.denegarSolicitud({
      solicitudId: sol.id,
      funcionarioId: sesion.funcionarioId,
      tipoRespuesta: 'DENEGACION_TOTAL',
      contenido: this.descripcionDenegacion.trim(),
      causalDenegatoria: this.causalDenegatoria,
      fundamentoLegal: this.fundamentoLegal.trim()
    }).subscribe({
      next: () => this.handleSuccess('Denegatoria registrada y notificada al ciudadano.'),
      error: (err) => this.handleError(err)
    });
  }

  private handleSuccess(message: string): void {
    this.loading.set(false);
    this.mensaje.set(message);
    setTimeout(() => this.router.navigate(['/funcionario']), 2000);
  }

  private handleError(err: { error?: { mensaje?: string } }): void {
    this.loading.set(false);
    this.error.set(err.error?.mensaje || 'Error al enviar respuesta');
  }

  getEstadoClass(estado: string): string {
    const clases: Record<string, string> = {
      RECEPCIONADA: 'pill pill-medium',
      EN_REVISION: 'pill pill-medium',
      PENDIENTE_INFORMACION: 'pill pill-medium',
      RESPONDIDA: 'pill pill-low',
      DENEGADA: 'pill pill-high',
      VENCIDA: 'pill pill-high'
    };

    return clases[estado] || 'pill';
  }

  getEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getDiasRestantes(): number | null {
    const value = this.solicitud()?.diasRestantes;
    return typeof value === 'number' ? value : null;
  }

  getDiasRestantesColor(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) {
      return 'var(--muted-foreground)';
    }
    if (dias < 0) {
      return 'var(--brand-700)';
    }
    if (dias <= 3) {
      return 'var(--warning)';
    }
    return 'var(--success)';
  }

  getDiasRestantesDisplay(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) {
      return 'Sin dato';
    }
    if (dias < 0) {
      return `${Math.abs(dias)} días retraso`;
    }
    return `${dias} días`;
  }

  esUrgente(): boolean {
    const dias = this.getDiasRestantes();
    return dias !== null && dias >= 0 && dias <= 3;
  }

  esSilencioAdministrativoAutomatico(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  puedeRegistrarRespuestaManual(): boolean {
    return canSendManualResponse(this.solicitud());
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
}

