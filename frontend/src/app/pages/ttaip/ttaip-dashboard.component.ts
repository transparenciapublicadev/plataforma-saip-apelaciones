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

  getEstadoBadgeClass(estado: string): string {
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
}


