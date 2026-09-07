import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { Entidad } from '../../models/entidad.model';
import { SolicitudCreate } from '../../models/solicitud.model';
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
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from '../../shared/document-preview-modal.component';
import {
  ReferenceComboboxComponent,
  ReferenceComboboxOption
} from '../../shared/reference-combobox.component';
import { firstValueFrom } from 'rxjs';
import { problemDetailsMessage } from '../../utils/problem-details.util';
import { TipoDocumento } from '../../models/documento.model';
import {
  LucideArrowLeft, LucideShieldCheck, LucideBadgeCheck, LucideCheckCircle2,
  LucideXCircle, LucideHelpCircle, LucideInfo, LucideUpload,
  LucideEye, LucideX, LucideSave, LucideSend, LucideFileText,
  LucideAlertTriangle
} from '@lucide/angular';

export interface FormatoItem {
  key: 'correo' | 'copiaSimple' | 'copiaCertificada' | 'soporteMagnetico';
  label: string;
  desc: string;
}

export interface MedioNotificacionItem {
  key: 'correo' | 'fisica';
  label: string;
  desc: string;
}

interface SesionVisual {
  nombre: string;
  dni: string;
  email: string;
  telefono?: string;
  tipoPersona?: 'NATURAL' | 'JURIDICA';
  ruc?: string;
  razonSocial?: string;
  representanteNombreCompleto?: string;
}

export const FORMATOS: FormatoItem[] = [
  { key: 'correo', label: 'Correo electrónico', desc: 'Vía gratuita para formatos digitales (PDF, Excel, Word)' },
  { key: 'copiaSimple', label: 'Copia simple / fotocopia', desc: 'Impreso, previo pago del costo de reproducción' },
  { key: 'copiaCertificada', label: 'Copia certificada', desc: 'Con sello y firma' },
  { key: 'soporteMagnetico', label: 'Soportes magnéticos o digitales', desc: 'Datos grabados en CD, DVD o USB (según TUPA)' },
];

export const MEDIOS_NOTIFICACION: MedioNotificacionItem[] = [
  { key: 'correo', label: 'Correo electrónico', desc: 'Notificación al correo consignado (T.U.O. Ley N° 27444)' },
  { key: 'fisica', label: 'Notificación física', desc: 'Entrega en el domicilio registrado, previo pago según TUPA' },
];

export const TEMAS_PREDETERMINADOS: string[] = [
  'Presupuesto, contrataciones y adquisiciones',
  'Planeamiento, organización y funciones',
  'Personal, planillas y escalas remunerativas',
  'Actividades oficiales, actas y agendas',
  'Información ambiental y recursos naturales',
  'Proyectos de inversión y obras públicas',
  'Normativa, directivas y resoluciones',
  'Otros'
];

@Component({
  selector: 'app-nueva-saip',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ReferenceConfirmModalComponent,
    ReferenceSuccessModalComponent,
    DocumentPreviewModalComponent,
    ReferenceComboboxComponent,
    LucideArrowLeft,
    LucideShieldCheck,
    LucideBadgeCheck,
    LucideCheckCircle2,
    LucideXCircle,
    LucideHelpCircle,
    LucideInfo,
    LucideUpload,
    LucideEye,
    LucideX,
    LucideSave,
    LucideSend,
    LucideFileText,
    LucideAlertTriangle
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
  private readonly cdr = inject(ChangeDetectorRef);

  // Catálogos
  readonly formatos = FORMATOS;
  readonly mediosNotificacion = MEDIOS_NOTIFICACION;
  readonly temas = TEMAS_PREDETERMINADOS;
  entidades = signal<Entidad[]>([]);

  // Estado general
  loading = signal<boolean>(false);
  error = signal<string>('');
  mensaje = signal<string>('');

  // Modales
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);
  draftModalAbierto = signal<boolean>(false);
  expedienteCreado = signal<string>('');

  // Visor de documentos in-page
  previewTarget = signal<DocumentPreviewTarget | null>(null);
  isPreviewOpen = signal<boolean>(false);

  // Sesión del administrado
  sesionVisual = signal<SesionVisual>({
    nombre: 'Ciudadano autenticado',
    dni: 'No disponible',
    email: 'No disponible',
    telefono: '',
    tipoPersona: 'NATURAL'
  });

  // Campos del formulario
  entidadId: number | null = null;
  tema = '';
  temaOtro = '';
  oficinaDestinataria = '';
  asunto = '';
  descripcion = '';

  // Sección 02: Modalidad de entrega (Checkbox 2x2)
  formatoRespuesta = {
    correo: true,
    copiaSimple: false,
    copiaCertificada: false,
    soporteMagnetico: false
  };

  // Sección 03: Medio de notificación
  medioNotificacion: '' | 'correo' | 'fisica' = 'correo';
  aceptaCorreo = true;
  aceptaFisica = false;

  // Sección 04: Archivos
  adjunto = signal<File | null>(null);
  anexo1 = signal<File | null>(null);
  anexo2 = signal<File | null>(null);

  isDraggingPrincipal = signal<boolean>(false);
  isDraggingAnexo1 = signal<boolean>(false);
  isDraggingAnexo2 = signal<boolean>(false);

  // Avisos y advertencias contextuales para archivos
  fileWarningPrincipal = signal<string | null>(null);
  fileWarningAnexo1 = signal<string | null>(null);
  fileWarningAnexo2 = signal<string | null>(null);

  // Helper computados
  esEmpresa = computed(() => this.sesionVisual().tipoPersona === 'JURIDICA');
  docLabel = computed(() => (this.esEmpresa() ? 'RUC' : 'DNI'));
  docNumero = computed(() => (this.esEmpresa() ? (this.sesionVisual().ruc || this.sesionVisual().dni) : this.sesionVisual().dni));
  correoMask = computed(() => this.maskEmail(this.sesionVisual().email));
  fechaHoy = computed(() => new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }));

  // Opciones reactivas para Comboboxes estilo Radix UI
  entidadOptions = computed<ReferenceComboboxOption[]>(() =>
    this.entidades().map((e) => ({
      id: e.id,
      label: e.nombre,
      sublabel: e.acronimo || ''
    }))
  );

  readonly temaOptions: ReferenceComboboxOption[] = TEMAS_PREDETERMINADOS.map((t) => ({
    id: t,
    label: t
  }));

  onEntidadChange(id: number | null): void {
    this.entidadId = id;
    this.cdr.markForCheck();
  }

  onTemaChange(val: string): void {
    this.tema = val || '';
    if (this.tema !== 'Otros') {
      this.temaOtro = '';
    }
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.cargarSesionVisual();
    this.cargarEntidades();
    this.restaurarBorradorSeguro();
  }

  private cargarSesionVisual(): void {
    const sesion = this.authService.obtenerSesion();
    this.sesionVisual.set({
      nombre: sesion?.nombre?.trim() || sesion?.nombreCompleto?.trim() || 'Ciudadano autenticado',
      dni: sesion?.dni?.trim() || 'No disponible',
      email: sesion?.email?.trim() || 'No disponible',
      telefono: (sesion as any)?.telefono || '',
      tipoPersona: sesion?.tipoPersona || 'NATURAL',
      ruc: sesion?.ruc?.trim() || '',
      razonSocial: sesion?.razonSocial?.trim() || '',
      representanteNombreCompleto: sesion?.representanteNombreCompleto?.trim() || ''
    });
  }

  private cargarEntidades(): void {
    this.entidadService.findActivas().subscribe({
      next: (data) => {
        this.entidades.set(data);
        this.cdr.markForCheck();
      },
      error: () => this.error.set('Error al cargar la lista de entidades públicas')
    });
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email || '—';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const visible = user.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(3, user.length - 2))}@${domain}`;
  }

  temaEfectivo(): string {
    return this.tema === 'Otros' ? this.temaOtro.trim() : this.tema;
  }

  formatosSeleccionadosLabels(): string[] {
    const seleccionados: string[] = [];
    if (this.formatoRespuesta.correo) seleccionados.push('Correo electrónico');
    if (this.formatoRespuesta.copiaSimple) seleccionados.push('Copia simple / fotocopia');
    if (this.formatoRespuesta.copiaCertificada) seleccionados.push('Copia certificada');
    if (this.formatoRespuesta.soporteMagnetico) seleccionados.push('Soportes magnéticos o digitales');
    return seleccionados;
  }

  getEntidadSeleccionadaNombre(): string {
    return this.entidades().find((e) => e.id === this.entidadId)?.nombre || '—';
  }

  seleccionarMedioNotificacion(medio: 'correo' | 'fisica'): void {
    this.medioNotificacion = medio;
    if (medio === 'correo') {
      this.aceptaCorreo = true;
    } else {
      this.aceptaFisica = true;
    }
  }

  // ── GESTIÓN DE ARCHIVOS ─────────────────────────────────────────────────────

  validarArchivoConAviso(
    file: File,
    allowZip = false,
    isPrincipal = false
  ): { valid: boolean; warning?: string } {
    const name = file.name || 'documento';
    const ext = name.toLowerCase().split('.').pop() || '';
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const maxSize = 10 * 1024 * 1024; // 10MB

    // 1. Advertencia de límite de peso mayor a 10 MB
    if (file.size > maxSize) {
      return {
        valid: false,
        warning: `El archivo «${name}» (${sizeMB} MB) supera el límite máximo permitido de 10 MB. Reduzca el tamaño o comprima el documento antes de adjuntarlo.`
      };
    }

    // 2. Advertencia si intenta subir .ZIP en Archivo Principal
    if (isPrincipal && (ext === 'zip' || file.type.includes('zip'))) {
      return {
        valid: false,
        warning: `El archivo principal no admite formato ZIP. Puede adjuntar archivos ZIP únicamente en los casilleros de Anexos a continuación.`
      };
    }

    // 3. Validar formatos permitidos
    const isPdf = file.type === 'application/pdf' || file.type === 'application/x-pdf' || ext === 'pdf';
    const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext);
    const isZip = allowZip && (
      ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/x-zip'].includes(file.type) ||
      ext === 'zip'
    );

    if (!isPdf && !isImage && !isZip) {
      const permitidos = allowZip ? 'PDF, JPG, PNG o ZIP' : 'PDF, JPG o PNG';
      return {
        valid: false,
        warning: `El formato .${ext.toUpperCase() || 'desconocido'} de «${name}» no es compatible. Formatos admitidos: ${permitidos} (hasta 10 MB).`
      };
    }

    return { valid: true };
  }

  validarArchivo(file: File, allowZip = false): boolean {
    const res = this.validarArchivoConAviso(file, allowZip, false);
    if (!res.valid) {
      this.error.set(res.warning || 'Archivo no permitido');
      return false;
    }
    this.error.set('');
    return true;
  }

  formatFileSizeMB(size: number): string {
    return (size / 1024 / 1024).toFixed(2);
  }

  onDragOverPrincipal(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingPrincipal.set(true);
  }

  onDragLeavePrincipal(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingPrincipal.set(false);
  }

  onPrincipalDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingPrincipal.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const check = this.validarArchivoConAviso(file, false, true);
      if (check.valid) {
        this.adjunto.set(file);
        this.fileWarningPrincipal.set(null);
      } else {
        this.fileWarningPrincipal.set(check.warning || 'Archivo no permitido');
      }
    }
  }

  onPrincipalSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const check = this.validarArchivoConAviso(file, false, true);
      if (check.valid) {
        this.adjunto.set(file);
        this.fileWarningPrincipal.set(null);
      } else {
        this.fileWarningPrincipal.set(check.warning || 'Archivo no permitido');
      }
    }
    input.value = '';
  }

  removePrincipal(): void {
    this.adjunto.set(null);
    this.fileWarningPrincipal.set(null);
  }

  onDragOverAnexo1(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingAnexo1.set(true);
  }

  onDragLeaveAnexo1(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingAnexo1.set(false);
  }

  onAnexo1Drop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingAnexo1.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const check = this.validarArchivoConAviso(file, true, false);
      if (check.valid) {
        this.anexo1.set(file);
        this.fileWarningAnexo1.set(null);
      } else {
        this.fileWarningAnexo1.set(check.warning || 'Archivo no permitido');
      }
    }
  }

  onAnexo1Select(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const check = this.validarArchivoConAviso(file, true, false);
      if (check.valid) {
        this.anexo1.set(file);
        this.fileWarningAnexo1.set(null);
      } else {
        this.fileWarningAnexo1.set(check.warning || 'Archivo no permitido');
      }
    }
    input.value = '';
  }

  removeAnexo1(): void {
    this.anexo1.set(null);
    this.fileWarningAnexo1.set(null);
  }

  onDragOverAnexo2(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingAnexo2.set(true);
  }

  onDragLeaveAnexo2(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingAnexo2.set(false);
  }

  onAnexo2Drop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingAnexo2.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const check = this.validarArchivoConAviso(file, true, false);
      if (check.valid) {
        this.anexo2.set(file);
        this.fileWarningAnexo2.set(null);
      } else {
        this.fileWarningAnexo2.set(check.warning || 'Archivo no permitido');
      }
    }
  }

  onAnexo2Select(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const check = this.validarArchivoConAviso(file, true, false);
      if (check.valid) {
        this.anexo2.set(file);
        this.fileWarningAnexo2.set(null);
      } else {
        this.fileWarningAnexo2.set(check.warning || 'Archivo no permitido');
      }
    }
    input.value = '';
  }

  removeAnexo2(): void {
    this.anexo2.set(null);
    this.fileWarningAnexo2.set(null);
  }

  previsualizarArchivo(file: File): void {
    if (!file) return;
    const ext = (file.name || '').toLowerCase().split('.').pop() || '';
    let tipo = file.type;
    if (!tipo) {
      if (ext === 'pdf') tipo = 'application/pdf';
      else if (['jpg', 'jpeg'].includes(ext)) tipo = 'image/jpeg';
      else if (ext === 'png') tipo = 'image/png';
      else if (ext === 'zip') tipo = 'application/zip';
      else tipo = 'application/octet-stream';
    }

    this.previewTarget.set({
      nombre: file.name,
      blob: file,
      file: file,
      tipo: tipo
    });
    this.isPreviewOpen.set(true);
  }

  cerrarPreview(): void {
    this.isPreviewOpen.set(false);
    this.previewTarget.set(null);
  }

  // ── BORRADOR ───────────────────────────────────────────────────────────────

  guardarBorrador(): void {
    const sesion = this.authService.obtenerSesion();
    const payload = {
      entidadId: this.entidadId,
      tema: this.tema,
      temaOtro: this.temaOtro,
      oficinaDestinataria: this.oficinaDestinataria,
      asunto: this.asunto,
      descripcion: this.descripcion,
      formatoRespuesta: this.formatoRespuesta,
      medioNotificacion: this.medioNotificacion,
      aceptaCorreo: this.aceptaCorreo,
      aceptaFisica: this.aceptaFisica,
      ciudadanoId: sesion?.ciudadanoId ?? null,
      updatedAt: new Date().toISOString()
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('saip.borrador', JSON.stringify(payload));
    }
    this.error.set('');
    this.draftModalAbierto.set(true);
  }

  private restaurarBorradorSeguro(): void {
    if (typeof localStorage === 'undefined') return;
    const borradorRaw = localStorage.getItem('saip.borrador');
    if (!borradorRaw) return;

    try {
      const borrador = JSON.parse(borradorRaw);
      const sesion = this.authService.obtenerSesion();
      if (borrador && sesion?.ciudadanoId && borrador.ciudadanoId === sesion.ciudadanoId) {
        this.entidadId = borrador.entidadId ?? null;
        this.tema = borrador.tema || '';
        this.temaOtro = borrador.temaOtro || '';
        this.oficinaDestinataria = borrador.oficinaDestinataria || '';
        this.asunto = borrador.asunto || '';
        this.descripcion = borrador.descripcion || '';
        if (borrador.formatoRespuesta) {
          this.formatoRespuesta = { ...this.formatoRespuesta, ...borrador.formatoRespuesta };
        }
        if (borrador.medioNotificacion) {
          this.medioNotificacion = borrador.medioNotificacion;
        }
        this.aceptaCorreo = borrador.aceptaCorreo ?? true;
        this.aceptaFisica = borrador.aceptaFisica ?? false;

        const fechaMsg = borrador.updatedAt ? new Date(borrador.updatedAt).toLocaleString() : 'recientemente';
        this.mensaje.set(`Se restauró el borrador guardado el ${fechaMsg}`);
        this.cdr.markForCheck();
      } else {
        localStorage.removeItem('saip.borrador');
      }
    } catch {
      localStorage.removeItem('saip.borrador');
    }
  }

  resetForm(): void {
    this.entidadId = null;
    this.tema = '';
    this.temaOtro = '';
    this.oficinaDestinataria = '';
    this.asunto = '';
    this.descripcion = '';
    this.formatoRespuesta = { correo: true, copiaSimple: false, copiaCertificada: false, soporteMagnetico: false };
    this.medioNotificacion = 'correo';
    this.aceptaCorreo = true;
    this.aceptaFisica = false;
    this.adjunto.set(null);
    this.anexo1.set(null);
    this.anexo2.set(null);
    this.fileWarningPrincipal.set(null);
    this.fileWarningAnexo1.set(null);
    this.fileWarningAnexo2.set(null);
    this.error.set('');
    this.mensaje.set('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.cdr.markForCheck();
  }

  // ── VALIDACIÓN Y ENVÍO ──────────────────────────────────────────────────────

  canSubmit(): boolean {
    if (!this.entidadId || !this.asunto.trim() || !this.descripcion.trim()) return false;
    const anyFormat = Object.values(this.formatoRespuesta).some((v) => v);
    if (!anyFormat) return false;
    if (!this.medioNotificacion) return false;
    if (this.medioNotificacion === 'correo' && !this.aceptaCorreo) return false;
    if (this.medioNotificacion === 'fisica' && !this.aceptaFisica) return false;
    if (this.tema === 'Otros' && !this.temaOtro.trim()) return false;
    return true;
  }

  handleSubmit(isDraft: boolean): void {
    if (isDraft) {
      this.guardarBorrador();
      return;
    }

    if (!this.entidadId || !this.asunto.trim() || !this.descripcion.trim()) {
      this.error.set('Por favor complete todos los campos obligatorios (*).');
      return;
    }

    const anyFormat = Object.values(this.formatoRespuesta).some((v) => v);
    if (!anyFormat) {
      this.error.set('Seleccione al menos una modalidad de entrega.');
      return;
    }

    if (!this.medioNotificacion) {
      this.error.set('Seleccione un medio formal de notificación.');
      return;
    }

    if (this.medioNotificacion === 'correo' && !this.aceptaCorreo) {
      this.error.set('Debe aceptar la notificación por correo electrónico conforme a Ley.');
      return;
    }

    if (this.medioNotificacion === 'fisica' && !this.aceptaFisica) {
      this.error.set('Debe aceptar el compromiso de pago según el TUPA de la entidad.');
      return;
    }

    if (this.tema === 'Otros' && !this.temaOtro.trim()) {
      this.error.set('Ha seleccionado "Otros" como tema: por favor escriba la materia correspondiente.');
      return;
    }

    this.error.set('');
    this.confirmModalAbierto.set(true);
  }

  crearSolicitud(): void {
    const sesion = this.authService.obtenerSesion();
    if (!sesion?.ciudadanoId) {
      this.error.set('No se encontró el ciudadano en sesión. Por favor inicie sesión nuevamente.');
      this.confirmModalAbierto.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const temaFinal = this.temaEfectivo();
    const formatoDigital = this.formatoRespuesta.correo;
    const formatoFisico = this.formatoRespuesta.copiaSimple || this.formatoRespuesta.copiaCertificada || this.formatoRespuesta.soporteMagnetico;
    const canalNotif = this.medioNotificacion === 'fisica' ? 'FISICA' : 'CORREO_ELECTRONICO';

    const notasAdicionales: string[] = [];
    if (this.oficinaDestinataria.trim()) {
      notasAdicionales.push(`[Oficina destinataria: ${this.oficinaDestinataria.trim()}]`);
    }
    if (this.formatoRespuesta.soporteMagnetico) {
      notasAdicionales.push(`[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]`);
    }

    const descFinal = notasAdicionales.length > 0
      ? `${notasAdicionales.join('\n')}\n\n${this.descripcion.trim()}`
      : this.descripcion.trim();

    const solicitud: SolicitudCreate = {
      asunto: this.asunto.trim(),
      descripcion: descFinal,
      ciudadanoId: sesion.ciudadanoId,
      entidadId: this.entidadId!,
      tipoInformacion: temaFinal || undefined,
      formatoDigital,
      formatoFisico,
      copiaSimple: this.formatoRespuesta.copiaSimple,
      copiaCertificada: this.formatoRespuesta.copiaCertificada,
      consentimientoDatosPersonales: true,
      canalNotificacion: canalNotif
    };

    this.solicitudService.crear(solicitud).subscribe({
      next: (respuesta) => {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('saip.borrador');
        }

        const archivos: { file: File; tipo: TipoDocumento }[] = [];
        if (this.adjunto()) archivos.push({ file: this.adjunto()!, tipo: 'SOLICITUD_ORIGINAL' });
        if (this.anexo1()) archivos.push({ file: this.anexo1()!, tipo: 'DOCUMENTO_ADJUNTO' });
        if (this.anexo2()) archivos.push({ file: this.anexo2()!, tipo: 'DOCUMENTO_ADJUNTO' });

        if (archivos.length > 0 && respuesta.id) {
          (async () => {
            let exitos = 0;
            const errores: string[] = [];

            for (const item of archivos) {
              try {
                await firstValueFrom(
                  this.documentoService.upload(item.file, item.tipo, { solicitudId: respuesta.id! })
                );
                exitos++;
              } catch (uploadErr: any) {
                const msg = problemDetailsMessage(uploadErr, 'Error al subir archivo');
                errores.push(`${item.file.name}: ${msg}`);
              }
            }

            this.loading.set(false);
            this.confirmModalAbierto.set(false);
            this.expedienteCreado.set(respuesta.expediente || '');

            if (errores.length > 0) {
              this.mensaje.set(`Solicitud registrada pero ocurrieron errores al subir adjuntos: ${errores.join(' | ')}`);
            }
            this.successModalAbierto.set(true);
            this.cdr.markForCheck();
          })();
        } else {
          this.loading.set(false);
          this.confirmModalAbierto.set(false);
          this.expedienteCreado.set(respuesta.expediente || '');
          this.successModalAbierto.set(true);
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.confirmModalAbierto.set(false);
        this.error.set(err.error?.mensaje || 'Error al presentar la solicitud. Verifique su conexión.');
        this.cdr.markForCheck();
      }
    });
  }

  // ── RESUMEN PARA MODAL DE CONFIRMACIÓN ──────────────────────────────────────

  solicitudConfirmSummary(): ReferenceConfirmSummary[] {
    const tema = this.temaEfectivo();
    const formatosStr = this.formatosSeleccionadosLabels().join(', ') || '—';
    const medioLabel = this.medioNotificacion === 'fisica' ? 'Notificación física' : 'Correo electrónico';

    const summary: ReferenceConfirmSummary[] = [
      { label: 'Solicitante', value: this.sesionVisual().nombre || '—' },
      { label: this.docLabel(), value: this.docNumero() || '—', mono: true },
      { label: 'Entidad', value: this.getEntidadSeleccionadaNombre() }
    ];

    if (tema) {
      summary.push({ label: 'Tema o materia', value: tema });
    }
    if (this.oficinaDestinataria.trim()) {
      summary.push({ label: 'Oficina destinataria', value: this.oficinaDestinataria.trim() });
    }

    summary.push(
      { label: 'Asunto', value: this.asunto.trim() || '—' },
      { label: 'Modalidad de entrega', value: formatosStr },
      { label: 'Medio de notificación', value: medioLabel }
    );

    return summary;
  }

  solicitudWarning(): ReferenceConfirmWarning {
    return {
      label: 'Plazo legal',
      detail: 'La entidad tendrá 10 días hábiles para responder desde la fecha de envío (Ley N° 27806).'
    };
  }

  // ── METADATOS PARA MODAL DE ÉXITO ──────────────────────────────────────────

  solicitudSuccessMetadata(): ReferenceSuccessMeta[] {
    const formatosStr = this.formatosSeleccionadosLabels().join(', ') || 'No definida';
    return [
      { label: 'Entidad receptora', value: this.getEntidadSeleccionadaNombre() },
      { label: 'Asunto', value: this.asunto.trim() || '—' },
      { label: 'Modalidad', value: formatosStr },
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
    this.draftModalAbierto.set(false);
    this.resetForm();
    this.router.navigate(['/ciudadano']);
  }

  verSolicitudCreada(): void {
    const exp = this.expedienteCreado();
    this.successModalAbierto.set(false);
    this.resetForm();
    this.router.navigate(exp ? ['/ciudadano/solicitud', exp] : ['/ciudadano']);
  }
}
