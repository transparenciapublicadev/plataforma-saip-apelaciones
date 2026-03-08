import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';

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
      'RECEPCIONADA': 'bg-yellow-500 text-white',
      'EN_REVISION': 'bg-blue-500 text-white',
      'PENDIENTE_INFORMACION': 'bg-orange-500 text-white',
      'RESPONDIDA': 'bg-green-500 text-white',
      'DENEGADA': 'bg-red-500 text-white',
      'VENCIDA': 'bg-gray-500 text-white',
      'CONCLUIDA': 'bg-gray-500 text-white'
    };
    return clases[estado] || 'bg-gray-500 text-white';
  }

  getApelacionEstadoClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'PENDIENTE_ELEVACION': 'bg-yellow-100 text-yellow-800',
      'EN_CALIFICACION_1': 'bg-yellow-100 text-yellow-800',
      'EN_CALIFICACION_2': 'bg-orange-100 text-orange-800',
      'EN_SUBSANACION': 'bg-orange-100 text-orange-800',
      'NOTIFICACION_SEGUNDA_CALIFICACION': 'bg-blue-100 text-blue-800',
      'EN_RESOLUCION': 'bg-purple-100 text-purple-800',
      'RESUELTO': 'bg-green-100 text-green-800',
      'RESUELTO_FUNDADO': 'bg-green-100 text-green-800',
      'RESUELTO_FUNDADO_EN_PARTE': 'bg-green-100 text-green-800',
      'RESUELTO_INFUNDADO': 'bg-gray-100 text-gray-800',
      'RESUELTO_INFUNDADO_EN_PARTE': 'bg-gray-100 text-gray-800',
      'RESUELTO_IMPROCEDENTE': 'bg-red-100 text-red-800',
      'TENER_POR_NO_PRESENTADO': 'bg-red-100 text-red-800',
      'CONCLUSION_SUSTRACCION_MATERIA': 'bg-green-100 text-green-800',
      'CONCLUSION_DESISTIMIENTO': 'bg-gray-100 text-gray-800'
    };
    return clases[estado] || 'bg-gray-100 text-gray-800';
  }

  puedeResponder(): boolean {
    const sol = this.solicitud();
    return sol !== null && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION' || sol.estado === 'PENDIENTE_INFORMACION');
  }
}

