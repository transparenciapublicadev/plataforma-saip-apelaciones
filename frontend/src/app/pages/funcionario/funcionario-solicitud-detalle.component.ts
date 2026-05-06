import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

@Component({
  selector: 'app-funcionario-solicitud-detalle',
  imports: [CommonModule, RouterLink],
  templateUrl: './funcionario-solicitud-detalle.component.html',
  styleUrl: './funcionario-solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioSolicitudDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<string>('solicitud');

  nombreFuncionario = signal<string>('');
  nombreEntidad = signal<string>('');

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreFuncionario.set(sesion.nombre || 'Funcionario');
      this.nombreEntidad.set(sesion.entidadNombre || 'Entidad');
    }

    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (expediente) {
      this.cargarSolicitud(expediente);
    }
  }

  cargarSolicitud(expediente: string): void {
    this.loading.set(true);
    this.solicitudService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la solicitud');
        this.loading.set(false);
      }
    });
  }

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
  }

  getEstadoClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'bg-[var(--estado-ambar)] text-white',
      'EN_REVISION': 'bg-[var(--estado-azul)] text-white',
      'PENDIENTE_INFORMACION': 'bg-[var(--estado-ambar)] text-white',
      'RESPONDIDA': 'bg-[var(--estado-verde)] text-white',
      'DENEGADA': 'bg-[var(--estado-rojo)] text-white',
      'VENCIDA': 'bg-[var(--niebla)] text-white',
      'CONCLUIDA': 'bg-[var(--niebla)] text-white'
    };
    return clases[estado] || 'bg-[var(--niebla)] text-white';
  }

  getApelacionEstadoClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'PENDIENTE_ELEVACION': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'EN_CALIFICACION_1': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'EN_CALIFICACION_2': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'EN_SUBSANACION': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'NOTIFICACION_SEGUNDA_CALIFICACION': 'bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]',
      'EN_RESOLUCION': 'bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]',
      'RESUELTO': 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'RESUELTO_FUNDADO': 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'RESUELTO_FUNDADO_EN_PARTE': 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'RESUELTO_INFUNDADO': 'bg-[var(--nieve)] text-[var(--carbon-suave)]',
      'RESUELTO_INFUNDADO_EN_PARTE': 'bg-[var(--nieve)] text-[var(--carbon-suave)]',
      'RESUELTO_IMPROCEDENTE': 'bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]',
      'TENER_POR_NO_PRESENTADO': 'bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]',
      'CONCLUSION_SUSTRACCION_MATERIA': 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'CONCLUSION_DESISTIMIENTO': 'bg-[var(--nieve)] text-[var(--carbon-suave)]'
    };
    return clases[estado] || 'bg-[var(--nieve)] text-[var(--carbon-suave)]';
  }

  puedeResponder(): boolean {
    const sol = this.solicitud();
    if (!sol) {
      return false;
    }

    if (!canSendManualResponse(sol)) {
      return false;
    }

    return sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION' || sol.estado === 'PENDIENTE_INFORMACION';
  }

  esSilencioAdministrativo(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  getTipoRespuestaDisplay(): string {
    const sol = this.solicitud();
    if (!sol) {
      return '';
    }

    return sol.respuesta?.tipoRespuesta || (this.esSilencioAdministrativo() ? 'SILENCIO_ADMINISTRATIVO' : '');
  }

  getTituloRespuesta(): string {
    const tipo = this.getTipoRespuestaDisplay();

    if (tipo === 'SILENCIO_ADMINISTRATIVO') {
      return 'Silencio Administrativo';
    }

    if (tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL') {
      return 'Solicitud Aceptada';
    }

    return 'Solicitud Denegada';
  }

  esRespuestaEntrega(): boolean {
    const tipo = this.getTipoRespuestaDisplay();
    return tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL';
  }
}


