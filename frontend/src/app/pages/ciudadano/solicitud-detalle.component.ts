import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

@Component({
  selector: 'app-solicitud-detalle',
  imports: [CommonModule, RouterLink],
  templateUrl: './solicitud-detalle.component.html',
  styleUrl: './solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<string>('solicitud');

  ngOnInit(): void {
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
      error: (err) => {
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
      'RECEPCIONADA': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'EN_REVISION': 'bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]',
      'PENDIENTE_INFORMACION': 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]',
      'RESPONDIDA': 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]',
      'DENEGADA': 'bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]',
      'VENCIDA': 'bg-[var(--nieve)] text-[var(--carbon-suave)]',
      'CONCLUIDA': 'bg-[var(--nieve)] text-[var(--carbon-suave)]'
    };
    return clases[estado] || 'bg-[var(--nieve)] text-[var(--carbon-suave)]';
  }

  getEstadoBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'RECEPCIONADA': 'badge-warning',
      'EN_REVISION': 'badge-in-process',
      'PENDIENTE_INFORMACION': 'badge-warning',
      'RESPONDIDA': 'badge-success',
      'DENEGADA': 'badge-danger',
      'VENCIDA': 'badge-muted',
      'CONCLUIDA': 'badge-muted'
    };
    return clases[estado] || 'badge-muted';
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

  getApelacionBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'PENDIENTE_ELEVACION': 'badge-warning',
      'EN_CALIFICACION_1': 'badge-warning',
      'EN_CALIFICACION_2': 'badge-warning',
      'EN_SUBSANACION': 'badge-warning',
      'NOTIFICACION_SEGUNDA_CALIFICACION': 'badge-in-process',
      'EN_RESOLUCION': 'badge-in-process',
      'RESUELTO': 'badge-success',
      'RESUELTO_FUNDADO': 'badge-success',
      'RESUELTO_FUNDADO_EN_PARTE': 'badge-success',
      'RESUELTO_INFUNDADO': 'badge-muted',
      'RESUELTO_INFUNDADO_EN_PARTE': 'badge-muted',
      'RESUELTO_IMPROCEDENTE': 'badge-danger',
      'TENER_POR_NO_PRESENTADO': 'badge-danger',
      'CONCLUSION_SUSTRACCION_MATERIA': 'badge-success',
      'CONCLUSION_DESISTIMIENTO': 'badge-muted'
    };
    return clases[estado] || 'badge-muted';
  }

  puedeApelar(): boolean {
    const sol = this.solicitud();
    return sol !== null && (sol.estado === 'RESPONDIDA' || sol.estado === 'DENEGADA' || sol.estado === 'VENCIDA') && !sol.apelacion;
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
}


