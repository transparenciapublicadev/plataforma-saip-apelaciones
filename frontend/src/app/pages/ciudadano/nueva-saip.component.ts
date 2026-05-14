import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { Entidad } from '../../models/entidad.model';
import { SolicitudCreate } from '../../models/solicitud.model';

interface SesionVisual {
  nombre: string;
  dni: string;
  email: string;
}

@Component({
  selector: 'app-nueva-saip',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nueva-saip.component.html',
  styleUrl: './nueva-saip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaSaipComponent implements OnInit {
  private readonly solicitudService = inject(SolicitudService);
  private readonly entidadService = inject(EntidadService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  entidades = signal<Entidad[]>([]);
  loading = signal<boolean>(false);
  error = signal<string>('');
  mensaje = signal<string>('');
  sesionVisual = signal<SesionVisual>({
    nombre: 'Ciudadano autenticado',
    dni: 'No disponible',
    email: 'No disponible'
  });

  asunto = '';
  descripcion = '';
  entidadId: number | null = null;
  tipoInformacion = '';
  formatoDigital = true;
  formatoFisico = false;
  copiaSimple = true;
  copiaCertificada = false;

  ngOnInit(): void {
    this.cargarSesionVisual();
    this.cargarEntidades();
  }

  private cargarSesionVisual(): void {
    const sesion = this.authService.obtenerSesion();
    this.sesionVisual.set({
      nombre: sesion?.nombre?.trim() || 'Ciudadano autenticado',
      dni: sesion?.dni?.trim() || 'No disponible',
      email: sesion?.email?.trim() || 'No disponible'
    });
  }

  guardarBorrador(): void {
    const sesion = this.authService.obtenerSesion();
    const payload = {
      asunto: this.asunto,
      descripcion: this.descripcion,
      entidadId: this.entidadId,
      tipoInformacion: this.tipoInformacion,
      formatoDigital: this.formatoDigital,
      formatoFisico: this.formatoFisico,
      copiaSimple: this.copiaSimple,
      copiaCertificada: this.copiaCertificada,
      ciudadanoId: sesion?.ciudadanoId ?? null,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('saip.borrador', JSON.stringify(payload));
    this.error.set('');
    this.mensaje.set('Borrador guardado correctamente.');
  }
  cargarEntidades(): void {
    this.entidadService.findActivas().subscribe({
      next: (data) => {
        this.entidades.set(data);
      },
      error: (err) => {
        this.error.set('Error al cargar entidades');
      }
    });
  }

  crearSolicitud(): void {
    if (!this.asunto.trim()) {
      this.error.set('El asunto es obligatorio');
      return;
    }
    if (!this.descripcion.trim()) {
      this.error.set('La descripción es obligatoria');
      return;
    }
    if (!this.entidadId) {
      this.error.set('Debe seleccionar una entidad');
      return;
    }
    if (!this.formatoDigital && !this.formatoFisico && !this.copiaSimple && !this.copiaCertificada) {
      this.error.set('Seleccione al menos un formato de respuesta');
      return;
    }

    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('No se encontró el ciudadano en sesión');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const solicitud: SolicitudCreate = {
      asunto: this.asunto,
      descripcion: this.descripcion,
      ciudadanoId: sesion.ciudadanoId,
      entidadId: this.entidadId,
      tipoInformacion: this.tipoInformacion,
      formatoDigital: this.formatoDigital,
      formatoFisico: this.formatoFisico,
      copiaSimple: this.copiaSimple,
      copiaCertificada: this.copiaCertificada
    };

    this.solicitudService.crear(solicitud).subscribe({
      next: (respuesta) => {
        this.loading.set(false);
        this.mensaje.set(`SAIP creada correctamente. Expediente: ${respuesta.expediente}`);
        setTimeout(() => {
          this.router.navigate(['/ciudadano']);
        }, 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || 'Error al crear la solicitud');
      }
    });
  }
}


