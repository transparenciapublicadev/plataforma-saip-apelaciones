import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';

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
      'RECEPCIONADA': 'bg-yellow-100 text-yellow-800',
      'EN_REVISION': 'bg-blue-100 text-blue-800',
      'PENDIENTE_INFORMACION': 'bg-orange-100 text-orange-800',
      'RESPONDIDA': 'bg-green-100 text-green-800',
      'DENEGADA': 'bg-red-100 text-red-800',
      'VENCIDA': 'bg-gray-100 text-gray-800',
      'CONCLUIDA': 'bg-gray-100 text-gray-800'
    };
    return clases[estado] || 'bg-gray-100 text-gray-800';
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
      'PENDIENTE': 'bg-yellow-100 text-yellow-800',
      'EN_CALIFICACION': 'bg-yellow-100 text-yellow-800',
      'SEGUNDA_RESOLUCION': 'bg-blue-100 text-blue-800',
      'PRIMERA_RESOLUCION': 'bg-blue-100 text-blue-800',
      'EN_SUBSANACION': 'bg-orange-100 text-orange-800',
      'SUBSANACION_PRESENTADA': 'bg-orange-100 text-orange-800',
      'RESUELTO_INADMISIBLE': 'bg-red-100 text-red-800',
      'RESUELTO_IMPROCEDENTE': 'bg-red-100 text-red-800',
      'RESUELTO_FUNDADO': 'bg-green-100 text-green-800',
      'RESUELTO_INFUNDADO': 'bg-green-100 text-green-800'
    };
    return clases[estado] || 'bg-gray-100 text-gray-800';
  }

  getApelacionBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'PENDIENTE': 'badge-warning',
      'EN_CALIFICACION': 'badge-warning',
      'SEGUNDA_RESOLUCION': 'badge-in-process',
      'PRIMERA_RESOLUCION': 'badge-in-process',
      'EN_SUBSANACION': 'badge-warning',
      'SUBSANACION_PRESENTADA': 'badge-warning',
      'RESUELTO_INADMISIBLE': 'badge-danger',
      'RESUELTO_IMPROCEDENTE': 'badge-danger',
      'RESUELTO_FUNDADO': 'badge-success',
      'RESUELTO_INFUNDADO': 'badge-success'
    };
    return clases[estado] || 'badge-muted';
  }

  puedeApelar(): boolean {
    const sol = this.solicitud();
    return sol !== null && sol.estado === 'DENEGADA' && !sol.apelacion;
  }
}

