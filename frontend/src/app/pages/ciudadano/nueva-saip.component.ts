import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { Entidad } from '../../models/entidad.model';
import { CanalNotificacion, SolicitudCreate } from '../../models/solicitud.model';
import {
  ReferenceConfirmModalComponent,
  ReferenceConfirmSummary,
  ReferenceConfirmWarning
} from '../../shared/reference-confirm-modal.component';
import {
  ReferenceSuccessMeta,
  ReferenceSuccessModalComponent,
  ReferenceSuccessNextStep
} from '../../shared/reference-success-modal.component';

interface SesionVisual {
  nombre: string;
  dni: string;
  email: string;
}

@Component({
  selector: 'app-nueva-saip',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent],
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
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);
  expedienteCreado = signal<string>('');
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
  consentimientoDatosPersonales = false;
  canalNotificacion: CanalNotificacion = 'CASILLA_ELECTRONICA';

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
      consentimientoDatosPersonales: this.consentimientoDatosPersonales,
      canalNotificacion: this.canalNotificacion,
      ciudadanoId: sesion?.ciudadanoId ?? null,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('saip.borrador', JSON.stringify(payload));
    this.error.set('');
    this.mensaje.set('Borrador guardado correctamente.');
  }

  abrirConfirmacionSolicitud(): void {
    if (!this.validarSolicitud()) {
      return;
    }

    this.confirmModalAbierto.set(true);
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
    if (!this.validarSolicitud()) {
      return;
    }

    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('No se encontró el ciudadano en sesión');
      return;
    }

    this.confirmModalAbierto.set(false);
    this.loading.set(true);
    this.error.set('');

    const solicitud: SolicitudCreate = {
      asunto: this.asunto,
      descripcion: this.descripcion,
      ciudadanoId: sesion.ciudadanoId,
      entidadId: this.entidadId!,
      tipoInformacion: this.tipoInformacion,
      formatoDigital: this.formatoDigital,
      formatoFisico: this.formatoFisico,
      copiaSimple: this.copiaSimple,
      copiaCertificada: this.copiaCertificada,
      consentimientoDatosPersonales: this.consentimientoDatosPersonales,
      canalNotificacion: this.canalNotificacion
    };

    this.solicitudService.crear(solicitud).subscribe({
      next: (respuesta) => {
        this.loading.set(false);
        this.expedienteCreado.set(respuesta.expediente || '');
        this.mensaje.set(`SAIP creada correctamente. Expediente: ${respuesta.expediente}`);
        this.successModalAbierto.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || 'Error al crear la solicitud');
      }
    });
  }

  canSubmit(): boolean {
    return !!this.asunto.trim()
      && !!this.descripcion.trim()
      && !!this.entidadId
      && !!this.canalNotificacion
      && this.consentimientoDatosPersonales
      && (this.formatoDigital || this.formatoFisico || this.copiaSimple || this.copiaCertificada);
  }

  solicitudConfirmSummary(): ReferenceConfirmSummary[] {
    return [
      { label: 'Solicitante', value: this.sesionVisual().nombre || '—' },
      { label: 'DNI', value: this.sesionVisual().dni || '—', mono: true },
      { label: 'Entidad', value: this.getEntidadSeleccionadaNombre() },
      { label: 'Asunto', value: this.asunto.trim() || '—' },
      { label: 'Formatos', value: this.getFormatosSeleccionados().join(', ') || '—' },
      { label: 'Notificación', value: this.getCanalNotificacionLabel() }
    ];
  }

  solicitudWarning(): ReferenceConfirmWarning {
    return {
      label: 'Plazo legal',
      detail: 'La entidad tendrá 10 días hábiles para responder desde la fecha de envío (Ley N° 27806).'
    };
  }

  solicitudSuccessMetadata(): ReferenceSuccessMeta[] {
    const formatos = this.getFormatosSeleccionados();
    return [
      { label: 'Entidad receptora', value: this.getEntidadSeleccionadaNombre() },
      { label: 'Asunto', value: this.asunto.trim() || '—' },
      {
        label: 'Modalidad',
        value: formatos.length > 0 ? `${formatos.length} seleccionada${formatos.length > 1 ? 's' : ''}` : 'No definida'
      },
      { label: 'Notificación', value: this.getCanalNotificacionLabel() },
      { label: 'Solicitante', value: this.sesionVisual().nombre || '—' }
    ];
  }

  solicitudNextSteps(): ReferenceSuccessNextStep[] {
    return [
      {
        label: 'La entidad evaluará su solicitud y emitirá respuesta.',
        hint: 'Recibirá notificación por correo cuando exista una decisión.'
      },
      {
        label: 'Si no recibe respuesta en 10 días hábiles, podrá apelar ante el TTAIP.',
        hint: 'Silencio Administrativo Negativo'
      },
      { label: 'Puede consultar el estado en cualquier momento desde su panel.' }
    ];
  }

  irPanelCiudadano(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  verSolicitudCreada(): void {
    const expediente = this.expedienteCreado();
    this.successModalAbierto.set(false);
    this.router.navigate(expediente ? ['/ciudadano/solicitud', expediente] : ['/ciudadano']);
  }

  private validarSolicitud(): boolean {
    if (!this.asunto.trim()) {
      this.error.set('El asunto es obligatorio');
      return false;
    }
    if (!this.descripcion.trim()) {
      this.error.set('La descripción es obligatoria');
      return false;
    }
    if (!this.entidadId) {
      this.error.set('Debe seleccionar una entidad');
      return false;
    }
    if (!this.formatoDigital && !this.formatoFisico && !this.copiaSimple && !this.copiaCertificada) {
      this.error.set('Seleccione al menos un formato de respuesta');
      return false;
    }
    if (!this.canalNotificacion) {
      this.error.set('Debe seleccionar un canal formal de notificación');
      return false;
    }
    if (!this.consentimientoDatosPersonales) {
      this.error.set('Debe aceptar el tratamiento de datos personales para presentar la SAIP');
      return false;
    }

    this.error.set('');
    return true;
  }

  getEntidadSeleccionadaNombre(): string {
    return this.entidades().find((entidad) => entidad.id === this.entidadId)?.nombre || '—';
  }

  private getFormatosSeleccionados(): string[] {
    const formatos: string[] = [];

    if (this.formatoDigital) {
      formatos.push('Digital');
    }

    if (this.formatoFisico) {
      formatos.push('Físico');
    }

    if (this.copiaSimple) {
      formatos.push('Copia simple');
    }

    if (this.copiaCertificada) {
      formatos.push('Copia certificada');
    }

    return formatos;
  }

  getCanalNotificacionLabel(): string {
    const labels: Record<CanalNotificacion, string> = {
      CORREO_ELECTRONICO: 'Correo electrónico',
      CASILLA_ELECTRONICA: 'Casilla electrónica',
      PLATAFORMA: 'Plataforma',
      FISICA: 'Notificación física'
    };

    return labels[this.canalNotificacion] || '—';
  }
}


