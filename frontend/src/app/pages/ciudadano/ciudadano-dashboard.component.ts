import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import { Apelacion } from '../../models/apelacion.model';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';

@Component({
  selector: 'app-ciudadano-dashboard',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './ciudadano-dashboard.component.html',
  styleUrl: './ciudadano-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CiudadanoDashboardComponent implements OnInit {
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);

  solicitudes = signal<Solicitud[]>([]);
  apelaciones = signal<Apelacion[]>([]);
  apelacionesSubsanacion = signal<Apelacion[]>([]);
  loading = signal<boolean>(true);
  error = signal<string>('');

  totalSolicitudes = signal<number>(0);
  enProceso = signal<number>(0);
  respondidas = signal<number>(0);
  denegadas = signal<number>(0);
  vencidas = signal<number>(0);

  filtroEstado = '';
  busqueda = '';

  nombreUsuario = signal<string>('Usuario');
  ciudadanoId = signal<number>(0);

  tieneApelables = signal<boolean>(false);

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreUsuario.set(sesion.nombre || 'Usuario');
      this.ciudadanoId.set(sesion.ciudadanoId || 0);
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    this.cargarSolicitudes();
    this.cargarApelaciones();
  }

  cargarSolicitudes(): void {
    this.loading.set(true);
    const ciudadanoId = this.ciudadanoId();

    if (ciudadanoId === 0) {
      this.error.set('No se encontró el ID del ciudadano');
      this.loading.set(false);
      return;
    }

    this.solicitudService.findByCiudadanoId(ciudadanoId).subscribe({
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

  cargarApelaciones(): void {
    const ciudadanoId = this.ciudadanoId();
    if (ciudadanoId === 0) return;

    this.apelacionService.findByCiudadanoId(ciudadanoId).subscribe({
      next: (data) => {
        this.apelaciones.set(data);
        const subsanacion = data.filter(a => a.estado === 'EN_SUBSANACION');
        this.apelacionesSubsanacion.set(subsanacion);
      },
      error: (err) => {
        console.error('Error al cargar apelaciones:', err);
        const mensaje = err.error?.mensaje || err.message || 'Error desconocido';
        this.error.set(`Error al cargar apelaciones: ${mensaje} (${err.status || 'sin conexión'})`);
      }
    });
  }

  private calcularEstadisticas(solicitudes: Solicitud[]): void {
    this.totalSolicitudes.set(solicitudes.length);
    this.enProceso.set(solicitudes.filter(s =>
      s.estado === 'RECEPCIONADA' || s.estado === 'EN_REVISION' || s.estado === 'PENDIENTE_INFORMACION'
    ).length);
    this.respondidas.set(solicitudes.filter(s =>
      s.estado === 'RESPONDIDA'
    ).length);
    this.denegadas.set(solicitudes.filter(s =>
      s.estado === 'DENEGADA'
    ).length);
    this.vencidas.set(solicitudes.filter(s =>
      s.estado === 'VENCIDA'
    ).length);
    this.tieneApelables.set(solicitudes.some(s =>
      s.estado === 'RESPONDIDA' || s.estado === 'DENEGADA' || s.estado === 'VENCIDA'
    ));
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    if (estado === 'todos' || estado === '') {
      this.cargarSolicitudes();
    } else {
      const ciudadanoId = this.ciudadanoId();
      this.solicitudService.findByCiudadanoId(ciudadanoId).subscribe({
        next: (data) => {
          const filtradas = data.filter(s => s.estado === estado.toUpperCase());
          this.solicitudes.set(filtradas);
        }
      });
    }
  }

  buscarSolicitudes(): void {
    if (!this.busqueda.trim()) {
      this.cargarSolicitudes();
      return;
    }
    const ciudadanoId = this.ciudadanoId();
    this.solicitudService.findByCiudadanoId(ciudadanoId).subscribe({
      next: (data) => {
        const filtradas = data.filter(s =>
          s.expediente.toLowerCase().includes(this.busqueda.toLowerCase()) ||
          s.asunto.toLowerCase().includes(this.busqueda.toLowerCase())
        );
        this.solicitudes.set(filtradas);
      }
    });
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
      'EN_CALIFICACION_1': 'bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]',
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

  calcularDiasRestantesSubsanacion(apelacion: Apelacion): number {
    if (!apelacion.fechaSubsanacion || !apelacion.diasSubsanacion) return 0;
    const fechaSubsanacion = new Date(apelacion.fechaSubsanacion);
    const fechaLimite = new Date(fechaSubsanacion);
    fechaLimite.setDate(fechaLimite.getDate() + apelacion.diasSubsanacion);
    const hoy = new Date();
    const diffTime = fechaLimite.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  logout(): void {
    this.authService.cerrarSesion();
  }

  esSilencioAdministrativo(solicitud: Solicitud): boolean {
    return isSilencioAdministrativo(solicitud);
  }
}


