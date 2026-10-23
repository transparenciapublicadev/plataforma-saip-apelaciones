import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAlertCircle,
  LucideArrowLeft,
  LucideBuilding2,
  LucideCheckCircle2,
  LucideClock,
  LucideDownload,
  LucideEye,
  LucideFileText,
  LucideInfo,
  LucideLoader2,
  LucideSend,
  LucideUpload,
  LucideX
} from '@lucide/angular';
import { SolicitudService } from '../../services/solicitud.service';
import { DocumentoService } from '../../services/documento.service';
import { AuthService } from '../../services/auth.service';
import { ObservacionSolicitud, Solicitud } from '../../models/solicitud.model';
import { DocumentoMetadata, validarDocumento } from '../../models/documento.model';
import { PrecisionSaipRecepcion, PrecisionSaipService } from '../../services/precision-saip.service';
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

export interface ExpedienteDocItem {
  id: number;
  nombre: string;
  fecha?: string;
  tamano?: string;
  path?: string;
  url?: string;
  kind: 'ciudadano' | 'subsanacion';
  blob?: Blob;
}

export interface GrupoDocItem {
  kind: 'ciudadano' | 'subsanacion';
  label: string;
  docs: ExpedienteDocItem[];
}

interface IntentoPrecision {
  solicitudId: number;
  observacionId: number;
  claveOperacion: string;
  comentario?: string;
  archivo?: File;
}

@Component({
  selector: 'app-precision-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ReferenceConfirmModalComponent,
    ReferenceSuccessModalComponent,
    LucideArrowLeft,
    LucideClock,
    LucideAlertCircle,
    LucideBuilding2,
    LucideInfo,
    LucideFileText,
    LucideSend,
    LucideCheckCircle2,
    LucideEye,
    LucideDownload,
    LucideUpload,
    LucideX,
    LucideLoader2,
    DocumentPreviewModalComponent
  ],
  templateUrl: './precision-form.component.html',
  styleUrl: './precision-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrecisionFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudService = inject(SolicitudService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private readonly precisionService = inject(PrecisionSaipService);
  private readonly destroyRef = inject(DestroyRef);
  private intento: IntentoPrecision | null = null;

  readonly pasosGuia: string[] = [
    'Lea la observación señalada por la entidad.',
    'Precise o corrija su solicitud según lo observado.',
    'Describa las correcciones realizadas.',
    'Adjunte el documento que subsana la observación.',
    'Envíe antes del plazo límite de 2 días hábiles.'
  ];

  // Estado del expediente
  expediente = signal<string>('');
  solicitud = signal<Solicitud | null>(null);
  loadingSolicitud = signal<boolean>(true);
  loadingEnvio = signal<boolean>(false);
  error = signal<string>('');
  verificacionPendiente = signal(false);
  private readonly conservarContenidoIntento = signal(false);
  recepcion = signal<PrecisionSaipRecepcion | null>(null);
  observacionSeleccionada = signal<ObservacionSolicitud | null>(null);
  readonly formularioBloqueado = computed(() => this.loadingEnvio() || this.verificacionPendiente()
    || this.conservarContenidoIntento() || !!this.recepcion());
  readonly puedeEnviar = computed(() => !!this.solicitud()?.id
    && this.observacionSeleccionada()?.estado === 'PENDIENTE_SUBSANACION'
    && !this.loadingSolicitud() && !this.loadingEnvio() && !this.verificacionPendiente() && !this.recepcion());

  // Metadatos de la observación en 1ª instancia
  observacion = signal<string>('');
  fechaNotificacion = signal<string>('');
  fechaLimite = signal<string>('');

  // Documentos cargados en el expediente
  documentosExpediente = signal<ExpedienteDocItem[]>([]);

  // Formulario del ciudadano
  respuesta = signal<string>('');
  archivoSeleccionado = signal<File | null>(null);
  isDragging = signal<boolean>(false);

  // Modales
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);

  // Visor in-situ de documento
  previewTarget = signal<DocumentPreviewTarget | null>(null);
  isPreviewOpen = signal<boolean>(false);
  previewModalAbierto = signal<boolean>(false);
  previewDocNombre = signal<string>('');
  previewDocUrl = signal<string | null>(null);
  previewDocEsPdf = signal<boolean>(false);
  previewDocEsImagen = signal<boolean>(false);
  previewCargando = signal<boolean>(false);

  // Grupos computados para antecedentes
  gruposDocs = computed<GrupoDocItem[]>(() => {
    const docs = this.documentosExpediente();
    const grupos: GrupoDocItem[] = [
      {
        kind: 'ciudadano',
        label: 'Su solicitud original (SAIP)',
        docs: docs.filter(d => d.kind === 'ciudadano')
      },
      {
        kind: 'subsanacion',
        label: 'Subsanación presentada',
        docs: docs.filter(d => d.kind === 'subsanacion')
      }
    ];
    return grupos.filter(g => g.docs.length > 0);
  });

  // Fecha de hoy formateada
  readonly fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  ngOnInit(): void {
    const param = this.route.snapshot.paramMap.get('expediente');
    if (param) {
      this.expediente.set(param);
      this.cargarDatos(param);
    } else {
      this.loadingSolicitud.set(false);
      this.error.set('No se ha identificado la solicitud SAIP. Abra la precisión desde su panel.');
    }
  }

  cargarDatos(expedienteParam: string): void {
    this.loadingSolicitud.set(true);
    this.error.set('');
    this.solicitudService.findByExpediente(expedienteParam).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sol) => {
        this.solicitud.set(sol);
        this.expediente.set(sol.expediente);
        const observaciones = [...(sol.observaciones || [])].sort((a, b) =>
          (b.fechaObservacion || '').localeCompare(a.fechaObservacion || '') || (b.id || 0) - (a.id || 0));
        const activa = observaciones.find((obs) => obs.estado === 'PENDIENTE_SUBSANACION') || observaciones[0] || null;
        this.observacionSeleccionada.set(activa);
        this.observacion.set(activa?.motivoObservacion || '');
        this.fechaNotificacion.set(activa?.fechaObservacion ? this.formatearFecha(activa.fechaObservacion) : '');
        this.fechaLimite.set(activa?.fechaLimiteSubsanacion ? this.formatearFecha(activa.fechaLimiteSubsanacion) : '');
        const metadata = sol.documentosMetadata || [];
        this.documentosExpediente.set(metadata.length
          ? metadata.filter((doc) => !!doc.id).map((doc) => this.documentoItem(doc))
          : (sol.documentos || []).filter((doc) => !!doc.id).map((doc) => ({
              id: doc.id,
              nombre: doc.nombreArchivo || `Documento ${doc.id}`,
              fecha: doc.fechaSubida ? this.formatearFecha(doc.fechaSubida) : undefined,
              tamano: doc.tamanio != null ? `${(doc.tamanio / 1024).toFixed(1)} KB` : undefined,
              kind: doc.tipoDocumento === 'SUBSANACION' ? 'subsanacion' as const : 'ciudadano' as const
            })));
        this.loadingSolicitud.set(false);
        const recuperado = activa?.id ? this.recuperarIntento(sol.id, activa.id) : null;
        if (recuperado) {
          this.intento = recuperado;
          this.comprobarRecepcion();
        } else if (!activa || activa.estado !== 'PENDIENTE_SUBSANACION') {
          this.error.set('Esta solicitud no tiene una observación pendiente de subsanación.');
        }
      },
      error: (error: unknown) => {
        this.solicitud.set(null);
        this.observacionSeleccionada.set(null);
        this.documentosExpediente.set([]);
        this.loadingSolicitud.set(false);
        this.error.set(this.mensajeError(error, 'No se pudo recuperar la solicitud. Vuelva a intentarlo desde su panel.'));
      }
    });
  }

  private formatearFecha(fechaIso: string): string {
    if (!fechaIso) return '—';
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);
    const dt = soloFecha
      ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
      : new Date(fechaIso);
    if (isNaN(dt.getTime())) return fechaIso;
    return dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Manejo de drag & drop y selección de archivo
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      this.procesarArchivo(file);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  private procesarArchivo(file: File): void {
    if (this.formularioBloqueado()) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const error = file.size === 0 ? 'El archivo está vacío.'
      : validarDocumento(file) || (!['pdf', 'jpg', 'jpeg', 'png', 'txt'].includes(extension || '')
        ? 'Formato no permitido. Use PDF, JPG, PNG o TXT.' : null);
    if (error) {
      this.error.set(error);
      return;
    }
    this.error.set('');
    this.archivoSeleccionado.set(file);
  }

  removerArchivo(): void {
    if (!this.formularioBloqueado()) this.archivoSeleccionado.set(null);
  }

  // Recuperar siempre los bytes privados por su identificador de servidor.
  abrirDoc(doc: ExpedienteDocItem, descargar: boolean): void {
    this.documentoService.download(doc.id, doc.nombre).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ blob, filename }) => {
        if (descargar) {
          this.guardarArchivo(blob, filename);
        } else {
          this.previewTarget.set({ nombre: filename, blob, expediente: this.expediente(), fecha: doc.fecha });
          this.isPreviewOpen.set(true);
        }
      },
      error: (error: unknown) => this.error.set(this.mensajeError(error, 'No se pudo recuperar el archivo. No se ha sustituido por otro documento.'))
    });
  }

  abrirPreviewArchivoLocal(): void {
    const file = this.archivoSeleccionado();
    if (!file) return;

    this.previewTarget.set({
      nombre: file.name,
      file: file,
      blob: file,
      tipo: file.type || 'application/pdf'
    });
    this.isPreviewOpen.set(true);
  }

  cerrarPreview(): void {
    this.isPreviewOpen.set(false);
    this.previewTarget.set(null);
    this.previewModalAbierto.set(false);
  }

  descargarDoc(doc: ExpedienteDocItem): void {
    this.abrirDoc(doc, true);
  }

  private guardarArchivo(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  abrirConfirmacion(): void {
    if (this.validarEnvio()) this.confirmModalAbierto.set(true);
  }

  confirmarEnvio(): void {
    if (this.loadingEnvio() || this.recepcion()) return;
    if (this.verificacionPendiente()) {
      this.comprobarRecepcion();
      return;
    }
    if (!this.validarEnvio()) return;
    const solicitudId = this.solicitud()!.id;
    const observacionId = this.observacionSeleccionada()!.id;
    const comentario = this.respuesta().trim();
    const archivo = this.archivoSeleccionado()!;
    const anterior = this.intento;
    if (this.conservarContenidoIntento() && anterior?.archivo
      && (anterior.archivo !== archivo || anterior.comentario !== comentario)) {
      this.error.set('Reintente con el mismo comentario y archivo del envío pendiente para evitar una recepción diferente.');
      return;
    }
    if (!anterior || anterior.solicitudId !== solicitudId || anterior.observacionId !== observacionId) {
      this.intento = { solicitudId, observacionId, claveOperacion: crypto.randomUUID(), comentario, archivo };
    } else {
      this.intento = { ...anterior, comentario, archivo };
    }
    const intento = this.intento;
    if (!intento || !this.guardarIntento(intento)) return;
    this.loadingEnvio.set(true);
    this.error.set('');
    this.precisionService.enviar(solicitudId, observacionId, intento.claveOperacion, comentario, archivo)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (recepcion) => {
          if (!this.aceptarRecepcion(recepcion)) this.dejarResultadoIncierto();
        },
        error: (error: unknown) => {
          this.confirmModalAbierto.set(false);
          if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500 || error.status === 408) {
            this.conservarContenidoIntento.set(true);
            this.verificacionPendiente.set(true);
            this.comprobarRecepcion();
          } else {
            this.conservarContenidoIntento.set(false);
            this.loadingEnvio.set(false);
            this.error.set(this.mensajeError(error, 'La precisión no fue recibida. Revise los datos e inténtelo de nuevo.'));
          }
        }
      });
  }

  comprobarRecepcion(): void {
    const intento = this.intento;
    if (!intento || this.recepcion()) return;
    this.loadingEnvio.set(true);
    this.verificacionPendiente.set(true);
    this.error.set('');
    this.precisionService.consultar(intento.solicitudId, intento.observacionId, intento.claveOperacion)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (recepcion) => {
          if (!this.aceptarRecepcion(recepcion)) this.dejarResultadoIncierto();
        },
        error: (error: unknown) => {
          this.loadingEnvio.set(false);
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.verificacionPendiente.set(false);
            this.error.set('El servidor aún no registra esta recepción. Puede reintentar con el mismo comentario y archivo; se conservará la misma clave para evitar duplicados.');
          } else {
            this.dejarResultadoIncierto(error);
          }
        }
      });
  }

  private aceptarRecepcion(recepcion: PrecisionSaipRecepcion): boolean {
    const intento = this.intento;
    const doc = recepcion?.documento;
    if (!intento || !recepcion || recepcion.solicitudId !== intento.solicitudId || recepcion.observacionId !== intento.observacionId
      || recepcion.claveOperacion !== intento.claveOperacion || recepcion.estado !== 'SUBSANADA'
      || !recepcion.fechaRecepcion || Number.isNaN(Date.parse(recepcion.fechaRecepcion)) || !doc?.id || doc.solicitudId !== intento.solicitudId
      || doc.tipoDocumento !== 'SUBSANACION' || doc.estado !== 'ACTIVO' || !doc.nombreOriginal
      || !doc.sizeBytes || !/^[a-f0-9]{64}$/i.test(doc.hashSha256 || '')
      || (intento.archivo !== undefined && doc.sizeBytes !== intento.archivo.size)
      || (intento.comentario !== undefined && recepcion.comentario !== intento.comentario)) return false;
    this.recepcion.set(recepcion);
    this.documentosExpediente.update((docs) => [...docs.filter((d) => d.id !== doc.id), this.documentoItem(doc)]);
    this.loadingEnvio.set(false);
    this.verificacionPendiente.set(false);
    this.confirmModalAbierto.set(false);
    this.error.set('');
    this.successModalAbierto.set(true);
    return true;
  }

  private dejarResultadoIncierto(error?: unknown): void {
    this.loadingEnvio.set(false);
    this.verificacionPendiente.set(true);
    this.conservarContenidoIntento.set(!!this.intento?.archivo);
    this.confirmModalAbierto.set(false);
    this.error.set(this.mensajeError(error,
      'No se pudo confirmar la recepción. Conserve este formulario y compruebe la recepción antes de volver a enviar.'));
  }

  private validarEnvio(): boolean {
    if (!this.puedeEnviar()) {
      this.error.set('No hay una observación pendiente disponible para este envío.');
      return false;
    }
    const archivo = this.archivoSeleccionado();
    if (!this.respuesta().trim() || this.respuesta().trim().length > 3000 || !archivo) {
      this.error.set('Describa las correcciones (hasta 3000 caracteres) y adjunte el documento requerido.');
      return false;
    }
    const errorArchivo = validarDocumento(archivo);
    if (!archivo.size || errorArchivo) {
      this.error.set(errorArchivo || 'El archivo está vacío.');
      return false;
    }
    if (!this.usuarioId()) {
      this.error.set('No se pudo identificar su sesión. Ingrese nuevamente antes de enviar.');
      return false;
    }
    return true;
  }

  private documentoItem(doc: DocumentoMetadata): ExpedienteDocItem {
    return {
      id: doc.id!, nombre: doc.nombreOriginal!,
      fecha: doc.fechaCreacion ? this.formatearFecha(doc.fechaCreacion) : undefined,
      tamano: doc.sizeBytes != null ? `${(doc.sizeBytes / 1024).toFixed(1)} KB` : undefined,
      kind: doc.tipoDocumento === 'SUBSANACION' ? 'subsanacion' : 'ciudadano'
    };
  }

  private usuarioId(): number | undefined {
    try {
      return this.authService.obtenerSesion()?.usuarioId;
    } catch {
      return undefined;
    }
  }

  private storageKey(solicitudId: number, observacionId: number): string {
    return `yaiku:precision:${this.usuarioId()}:${solicitudId}:${observacionId}`;
  }

  private guardarIntento(intento: IntentoPrecision): boolean {
    try {
      // Solo identificadores de operación; nunca comentario, archivo ni credenciales.
      sessionStorage.setItem(this.storageKey(intento.solicitudId, intento.observacionId), JSON.stringify({
        solicitudId: intento.solicitudId, observacionId: intento.observacionId, claveOperacion: intento.claveOperacion
      }));
      return true;
    } catch {
      this.error.set('No se pudo preparar la verificación del envío. Habilite el almacenamiento de esta sesión y reintente.');
      return false;
    }
  }

  private recuperarIntento(solicitudId: number, observacionId: number): IntentoPrecision | null {
    try {
      if (!this.usuarioId()) return null;
      const raw = sessionStorage.getItem(this.storageKey(solicitudId, observacionId));
      if (!raw) return null;
      const intento: unknown = JSON.parse(raw);
      if (intento && typeof intento === 'object' && 'solicitudId' in intento && 'observacionId' in intento
        && 'claveOperacion' in intento && intento.solicitudId === solicitudId && intento.observacionId === observacionId
        && typeof intento.claveOperacion === 'string' && /^[a-f0-9-]{36}$/i.test(intento.claveOperacion)) {
        return { solicitudId, observacionId, claveOperacion: intento.claveOperacion };
      }
    } catch {
      // Un dato local corrupto nunca constituye confirmación del servidor.
    }
    return null;
  }

  private mensajeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Su sesión no está autorizada. Ingrese nuevamente; no se ha confirmado la recepción.';
      if (error.status === 403) return 'No tiene permiso para realizar esta operación sobre la solicitud.';
      if (error.status === 404) return 'No se encontró la solicitud, observación o documento solicitado.';
      if (error.status === 400 || error.status === 409 || error.status === 413 || error.status === 415) {
        return typeof error.error?.detail === 'string' ? error.error.detail : fallback;
      }
    }
    return fallback;
  }

  irAlPanel(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  verDetalleExpediente(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano/solicitud', this.expediente()]);
  }

  // Resumen para confirmación
  subsanacionConfirmSummary = computed<ReferenceConfirmSummary[]>(() => {
    const obs = this.observacion();
    const obsTruncada = obs ? `${obs.slice(0, 60)}${obs.length > 60 ? '…' : ''}` : '—';
    const doc = this.archivoSeleccionado();

    return [
      { label: 'Expediente SAIP', value: this.expediente(), mono: true },
      { label: 'Observación', value: obsTruncada },
      { label: 'Descripción', value: `${this.respuesta().trim().length} caracteres` },
      { label: 'Documento', value: doc ? doc.name : '—' }
    ];
  });

  readonly subsanacionWarning: ReferenceConfirmWarning = {
    label: 'Plazo de subsanación',
    detail: 'Cuenta con 2 días hábiles desde la notificación. Una subsanación incompleta o fuera de plazo causa el archivo del expediente.'
  };

  // Metadatos para modal de éxito
  subsanacionSuccessMetadata = computed<ReferenceSuccessMeta[]>(() => {
    const recepcion = this.recepcion();
    return [
      { label: 'Observación subsanada', value: recepcion ? String(recepcion.observacionId) : '—' },
      { label: 'Documento adjunto', value: recepcion?.documento.nombreOriginal || '—' },
      { label: 'Recepción registrada', value: recepcion ? this.formatearFecha(recepcion.fechaRecepcion) : '—' },
      { label: 'Documento registrado', value: recepcion?.documento.id ? String(recepcion.documento.id) : '—', mono: true }
    ];
  });

  readonly subsanacionNextSteps: ReferenceSuccessNextStep[] = [
    {
      label: 'Si la subsanación es válida, su solicitud pasará a EN TRÁMITE.',
      hint: 'Plazo de atención: 10 días hábiles'
    },
    {
      label: 'Recibirá notificación con la decisión de la entidad.'
    }
  ];
}
