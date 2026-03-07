import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';

@Component({
  selector: 'app-ttaip-dashboard',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './ttaip-dashboard.component.html',
  styleUrl: './ttaip-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipDashboardComponent implements OnInit {
  private readonly ttaipService = inject(TtaipService);
  private readonly authService = inject(AuthService);

  apelaciones = signal<Apelacion[]>([]);
  loading = signal<boolean>(true);
  error = signal<string>('');

  pendientesAdmision = signal<number>(0);
  enSegundaCalificacion = signal<number>(0);
  enProceso = signal<number>(0);
  enSubsanacion = signal<number>(0);
  resueltos = signal<number>(0);

  filtroActual = signal<string>('pendientes');
  nombreMiembro = signal<string>('');

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreMiembro.set(sesion.nombre || 'Miembro TTAIP');
    }
    this.cargarEstadisticas();
    this.cargarPendientes();
  }

  cargarEstadisticas(): void {
    this.ttaipService.getEstadisticas().subscribe({
      next: (data) => {
        this.pendientesAdmision.set(data.pendientesAdmision || 0);
        this.enProceso.set(data.enProceso || 0);
        this.enSubsanacion.set(data.enSubsanacion || 0);
        this.resueltos.set(data.resueltas || 0);
      }
    });
    this.ttaipService.getSegundaCalificacion().subscribe({
      next: (data) => this.enSegundaCalificacion.set(data.length)
    });
  }

  cargarPendientes(): void {
    this.loading.set(true);
    this.error.set('');
    this.filtroActual.set('pendientes');
    this.ttaipService.getPendientes().subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        this.loading.set(false);
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.mensaje || 'Error al cargar pendientes'); }
    });
  }

  cargarEnAnalisis(): void {
    this.loading.set(true);
    this.error.set('');
    this.filtroActual.set('analisis');
    this.ttaipService.getEnAnalisis().subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        this.loading.set(false);
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.mensaje || 'Error al cargar apelaciones en análisis'); }
    });
  }

  cargarSubsanacion(): void {
    this.loading.set(true);
    this.error.set('');
    this.filtroActual.set('subsanacion');
    this.ttaipService.getSubsanacion().subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        this.loading.set(false);
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.mensaje || 'Error al cargar subsanaciones'); }
    });
  }

  cargarSegundaCalificacion(): void {
    this.loading.set(true);
    this.error.set('');
    this.filtroActual.set('segunda');
    this.ttaipService.getSegundaCalificacion().subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        this.loading.set(false);
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.mensaje || 'Error al cargar segunda calificación'); }
    });
  }

  cargarResueltas(): void {
    this.loading.set(true);
    this.error.set('');
    this.filtroActual.set('resueltas');
    this.ttaipService.getResueltas().subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        this.loading.set(false);
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.mensaje || 'Error al cargar resueltas'); }
    });
  }

  getEstadoClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'PENDIENTE': 'bg-yellow-100 text-yellow-800',
      'EN_CALIFICACION': 'bg-yellow-100 text-yellow-800',
      'PRIMERA_RESOLUCION': 'bg-blue-100 text-blue-800',
      'EN_SUBSANACION': 'bg-orange-100 text-orange-800',
      'SUBSANACION_PRESENTADA': 'bg-orange-100 text-orange-800',
      'RESUELTO_FUNDADO': 'bg-green-100 text-green-800',
      'RESUELTO_INFUNDADO': 'bg-green-100 text-green-800',
      'RESUELTO_INADMISIBLE': 'bg-red-100 text-red-800',
      'RESUELTO_IMPROCEDENTE': 'bg-red-100 text-red-800'
    };
    return clases[estado] || 'bg-gray-100 text-gray-800';
  }

  getEstadoBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'PENDIENTE': 'badge-warning',
      'EN_CALIFICACION': 'badge-warning',
      'PRIMERA_RESOLUCION': 'badge-in-process',
      'EN_SUBSANACION': 'badge-warning',
      'SUBSANACION_PRESENTADA': 'badge-warning',
      'RESUELTO_FUNDADO': 'badge-success',
      'RESUELTO_INFUNDADO': 'badge-success',
      'RESUELTO_INADMISIBLE': 'badge-danger',
      'RESUELTO_IMPROCEDENTE': 'badge-danger'
    };
    return clases[estado] || 'badge-muted';
  }
}

