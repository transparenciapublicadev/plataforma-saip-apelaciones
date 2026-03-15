import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

@Component({
  selector: 'app-funcionario-dashboard',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioDashboardComponent implements OnInit {
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);

  solicitudes = signal<Solicitud[]>([]);
  loading = signal<boolean>(true);
  error = signal<string>('');

  pendientes = signal<number>(0);
  vencidas = signal<number>(0);
  respondidas = signal<number>(0);
  urgentes = signal<number>(0);

  filtroEstado = '';
  busqueda = '';

  nombreEntidad = signal<string>('');
  nombreFuncionario = signal<string>('');
  entidadId = signal<number>(0);

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreFuncionario.set(sesion.nombre || 'Funcionario');
      this.nombreEntidad.set(sesion.entidadNombre || 'Entidad');
      this.entidadId.set(sesion.entidadId || 0);
      this.cargarSolicitudes();
    }
  }

  cargarSolicitudes(): void {
    this.loading.set(true);
    const entidadId = this.entidadId();

    if (entidadId === 0) {
      this.error.set('No se encontró la entidad');
      this.loading.set(false);
      return;
    }

    this.solicitudService.findByEntidadId(entidadId).subscribe({
      next: (data) => {
        this.solicitudes.set(data);
        this.calcularEstadisticas(data);
        this.loading.set(false);
      },
      error: (err) => {
        const mensaje = err.error?.mensaje || err.message || 'Error desconocido';
        this.error.set(`Error al cargar solicitudes: ${mensaje} (${err.status || 'sin conexión'})`);
        this.loading.set(false);
        console.error('Error al cargar solicitudes:', err);
      }
    });
  }

  private calcularEstadisticas(solicitudes: Solicitud[]): void {
    this.pendientes.set(solicitudes.filter(s => s.estado === 'RECEPCIONADA' || s.estado === 'EN_REVISION' || s.estado === 'PENDIENTE_INFORMACION').length);
    this.vencidas.set(solicitudes.filter(s => s.estado === 'VENCIDA').length);
    this.respondidas.set(solicitudes.filter(s => s.estado === 'RESPONDIDA').length);
    this.urgentes.set(solicitudes.filter(s =>
      s.diasRestantes !== undefined && s.diasRestantes >= 0 && s.diasRestantes <= 3
    ).length);
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    if (estado === 'todas' || estado === '') {
      this.cargarSolicitudes();
    } else {
      const entidadId = this.entidadId();
      this.solicitudService.findByEntidadId(entidadId).subscribe({
        next: (data) => {
          const filtradas = data.filter(s => s.estado === estado.toUpperCase());
          this.solicitudes.set(filtradas);
        }
      });
    }
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

  getPrioridadClass(sol: Solicitud): string {
    if (sol.diasRestantes !== undefined && sol.diasRestantes <= 3 && sol.diasRestantes >= 0) {
      return 'border-l-4 border-red-500';
    }
    return '';
  }

  isSilencioAdministrativoSolicitud(solicitud: Solicitud): boolean {
    return isSilencioAdministrativo(solicitud);
  }

  getEstadoDisplay(solicitud: Solicitud): string {
    return this.isSilencioAdministrativoSolicitud(solicitud)
      ? 'SILENCIO_ADMINISTRATIVO'
      : solicitud.estado;
  }

  canResponder(solicitud: Solicitud): boolean {
    if (!canSendManualResponse(solicitud)) {
      return false;
    }

    return solicitud.estado === 'RECEPCIONADA' || solicitud.estado === 'EN_REVISION' || solicitud.estado === 'PENDIENTE_INFORMACION';
  }

  logout(): void {
    this.authService.cerrarSesion();
  }
}

