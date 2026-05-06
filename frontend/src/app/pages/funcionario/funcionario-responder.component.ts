import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { RespuestaService } from '../../services/respuesta.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

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

  decision = 'aceptar';
  contenido = '';
  formatoEntrega = 'digital';
  plazoEntrega = 5;
  causalDenegatoria = '';
  fundamentoLegal = '';

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (expediente) {
      this.cargarSolicitud(expediente);
    }
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
      error: () => console.log('Error cargando causales')
    });
  }

  getEstadoClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'EN_REVISION': 'bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]',
      'PENDIENTE_INFORMACION': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'RESPONDIDA': 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'DENEGADA': 'bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]',
      'VENCIDA': 'bg-[var(--nieve)] text-[var(--carbon-suave)]'
    };
    return clases[estado] || 'bg-[var(--nieve)] text-[var(--carbon-suave)]';
  }

  enviarRespuesta(): void {
    const sesion = this.authService.obtenerSesion();
    const sol = this.solicitud();
    if (!sesion?.funcionarioId || !sol) {
      this.error.set('Error de sesión');
      return;
    }

    if (!this.contenido.trim()) {
      this.error.set('El contenido de la respuesta es obligatorio');
      return;
    }

    if (this.esSilencioAdministrativoAutomatico()) {
      this.error.set('La solicitud venció y aplica SILENCIO_ADMINISTRATIVO automáticamente. No se permite registrar respuesta manual.');
      return;
    }

    if (this.decision === 'denegar' && !this.causalDenegatoria) {
      this.error.set('Debe seleccionar una causal de denegación');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (this.decision === 'aceptar') {
      this.respuestaService.aceptarSolicitud({
        solicitudId: sol.id,
        funcionarioId: sesion.funcionarioId,
        tipoRespuesta: 'ENTREGA_TOTAL',
        contenido: this.contenido,
        formatoEntrega: this.formatoEntrega,
        plazoEntrega: this.plazoEntrega
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.mensaje.set('Respuesta enviada correctamente');
          setTimeout(() => this.router.navigate(['/funcionario']), 2000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.mensaje || 'Error al enviar respuesta');
        }
      });
    } else {
      this.respuestaService.denegarSolicitud({
        solicitudId: sol.id,
        funcionarioId: sesion.funcionarioId,
        tipoRespuesta: 'DENEGACION_TOTAL',
        contenido: this.contenido,
        causalDenegatoria: this.causalDenegatoria,
        fundamentoLegal: this.fundamentoLegal
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.mensaje.set('Respuesta enviada correctamente');
          setTimeout(() => this.router.navigate(['/funcionario']), 2000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.mensaje || 'Error al enviar respuesta');
        }
      });
    }
  }

  esSilencioAdministrativoAutomatico(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  puedeRegistrarRespuestaManual(): boolean {
    return canSendManualResponse(this.solicitud());
  }
}


