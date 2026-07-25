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
import { DocumentoService } from '../../services/documento.service';
import { validarDocumento } from '../../models/documento.model';
import { firstValueFrom } from 'rxjs';
import { problemDetailsMessage } from '../../utils/problem-details.util';

interface SesionVisual {
  nombre: string;
  dni: string;
  email: string;
  tipoPersona?: 'NATURAL' | 'JURIDICA';
  ruc?: string;
  razonSocial?: string;
  representanteNombreCompleto?: string;
}

import {
  LucideArrowLeft, LucideShieldAlert, LucideCheckCircle2, LucideSend,
  LucideFileText, LucideXCircle, LucideInfo
} from '@lucide/angular';

@Component({
  selector: 'app-nueva-saip',
  imports: [
    CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    LucideArrowLeft, LucideShieldAlert, LucideCheckCircle2, LucideSend,
    LucideFileText, LucideXCircle, LucideInfo
  ],
  templateUrl: './nueva-saip.component.html',
  styleUrl: './nueva-saip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaSaipComponent implements OnInit {
  private readonly solicitudService = inject(SolicitudService);
  private readonly entidadService = inject(EntidadService);
  private readonly authService = inject(AuthService);
  private readonly documentoService = inject(DocumentoService);
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
    email: 'No disponible',
    tipoPersona: 'NATURAL'
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
  documentosSeleccionados = signal<File[]>([]);

  ngOnInit(): void {
    this.cargarSesionVisual();
    this.cargarEntidades();
    this.restaurarBorradorSeguro();
  }

  private restaurarBorradorSeguro(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const borradorRaw = localStorage.getItem('saip.borrador');
    if (!borradorRaw) {
      return;
    }

    try {
      const borrador = JSON.parse(borradorRaw);
      const sesion = this.authService.obtenerSesion();
      
      // Seguridad: verificar que el borrador pertenezca al ciudadano actual en sesión
      if (borrador && sesion?.ciudadanoId && borrador.ciudadanoId === sesion.ciudadanoId) {
        this.asunto = borrador.asunto || '';
        this.descripcion = borrador.descripcion || '';
        this.entidadId = borrador.entidadId ?? null;
        this.tipoInformacion = borrador.tipoInformacion || '';
        this.formatoDigital = borrador.formatoDigital ?? true;
        this.formatoFisico = borrador.formatoFisico ?? false;
        this.copiaSimple = borrador.copiaSimple ?? true;
        this.copiaCertificada = borrador.copiaCertificada ?? false;
        this.consentimientoDatosPersonales = borrador.consentimientoDatosPersonales ?? false;
        this.canalNotificacion = borrador.canalNotificacion || 'CASILLA_ELECTRONICA';
        
        const fechaMsg = borrador.updatedAt ? new Date(borrador.updatedAt).toLocaleString() : 'fecha desconocida';
        this.mensaje.set(`Se restauró el borrador guardado el ${fechaMsg}`);
      } else {
        // Limpiar silenciosamente si pertenece a otro usuario o no hay sesión
        localStorage.removeItem('saip.borrador');
      }
    } catch (e) {
      localStorage.removeItem('saip.borrador');
    }
  }

  private cargarSesionVisual(): void {
    const sesion = this.authService.obtenerSesion();
    this.sesionVisual.set({
      nombre: sesion?.nombre?.trim() || sesion?.nombreCompleto?.trim() || 'Ciudadano autenticado',
      dni: sesion?.dni?.trim() || 'No disponible',
      email: sesion?.email?.trim() || 'No disponible',
      tipoPersona: sesion?.tipoPersona || 'NATURAL',
      ruc: sesion?.ruc?.trim() || '',
      razonSocial: sesion?.razonSocial?.trim() || '',
      representanteNombreCompleto: sesion?.representanteNombreCompleto?.trim() || ''
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

  seleccionarDocumento(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const filesToAdd: File[] = [];
      let lastError = '';
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const errorMsg = validarDocumento(file);
        if (errorMsg) {
          lastError = errorMsg;
        } else {
          filesToAdd.push(file);
        }
      }
      if (lastError) {
        this.error.set(lastError);
      } else {
        this.error.set('');
      }
      if (filesToAdd.length > 0) {
        this.documentosSeleccionados.update(prev => [...prev, ...filesToAdd]);
      }
    }
    input.value = '';
  }

  removerDocumento(index: number): void {
    this.documentosSeleccionados.update(prev => prev.filter((_, i) => i !== index));
    this.error.set('');
  }

  formatFileSize(size: number): string {
    return (size / 1024).toFixed(1);
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

    // Parche pragmático: mantener el confirm modal abierto durante la carga (submitting)
    // para evitar el parpadeo del overlay y prevenir interacciones adicionales.
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
        // Limpiar el borrador tras creación exitosa
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('saip.borrador');
        }

        const files = this.documentosSeleccionados();
        if (files.length > 0) {
          (async () => {
            let exitos = 0;
            const errores: string[] = [];
            
            for (const file of files) {
              try {
                await firstValueFrom(
                  this.documentoService.upload(file, 'SOLICITUD_ORIGINAL', { solicitudId: respuesta.id! })
                );
                exitos++;
              } catch (uploadErr: any) {
                const msg = problemDetailsMessage(uploadErr, 'Error en el servidor');
                errores.push(`El archivo ${file.name} no pudo subirse: ${msg}`);
              }
            }

            this.loading.set(false);
            this.expedienteCreado.set(respuesta.expediente || '');
            
            if (errores.length > 0) {
              this.mensaje.set(`SAIP creada (Expediente: ${respuesta.expediente}), pero hubo errores al subir los documentos: ${errores.join(' | ')}`);
            } else {
              this.mensaje.set(`SAIP creada y ${exitos} documentos adjuntos subidos correctamente. Expediente: ${respuesta.expediente}`);
            }

            this.successModalAbierto.set(true);
            this.confirmModalAbierto.set(false);
          })();
        } else {
          this.loading.set(false);
          this.expedienteCreado.set(respuesta.expediente || '');
          this.mensaje.set(`SAIP creada correctamente. Expediente: ${respuesta.expediente}`);
          
          this.successModalAbierto.set(true);
          this.confirmModalAbierto.set(false);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.confirmModalAbierto.set(false);
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


