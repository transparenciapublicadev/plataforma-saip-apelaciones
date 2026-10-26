import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  DestroyRef,
  computed,
  effect,
  untracked,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
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
import { DocumentoMetadata, DocumentoListItem, DOCUMENTO_RELATION_KEYS, validarDocumento } from '../../models/documento.model';
import { PrecisionSaipRecepcion, PrecisionSaipService } from '../../services/precision-saip.service';
import { falloConsulta } from '../../utils/consulta-remota.util';
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

interface ContextoPrecision {
  generacion: number;
  expediente: string;
  token: string | null;
  revision: number;
  usuarioId: number | undefined;
}

type EstadoFormulario = 'cargando' | 'disponible' | 'sin-requerimiento' | 'atendido' | 'incompleto' | 'vacio' | 'error';

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
export class PrecisionFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudService = inject(SolicitudService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private readonly precisionService = inject(PrecisionSaipService);
  private readonly destroyRef = inject(DestroyRef);
  private intento: IntentoPrecision | null = null;
  private operaciones = new Subscription();
  private verificacion = new Subscription();
  private descarga = new Subscription();
  private confirmacion: { contexto: ContextoPrecision; observacionId: number; comentario: string; archivo: File } | null = null;
  private contexto: ContextoPrecision | null = null;
  private generacion = 0;
  private destruido = false;
  private tokenSesion = this.authService.getToken();
  private revisionSesion = this.authService.cambiosSesion();
  readonly estadoFormulario = signal<EstadoFormulario>('cargando');
  readonly puedeReintentarCarga = signal(false);
  readonly documentosIncompletos = signal(false);
  readonly comentarioError = signal('');
  readonly archivoError = signal('');

  readonly pasosGuia: string[] = [
    'Lea la observación señalada por la entidad.',
    'Precise o corrija su solicitud según lo observado.',
    'Describa las correcciones realizadas.',
    'Adjunte el documento que subsana la observación.',
    'Consulte la fecha límite registrada; el servidor comprueba las condiciones de presentación.'
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
  readonly formularioBloqueado = computed(() => !this.puedeEnviar() || this.loadingEnvio() || this.verificacionPendiente()
    || this.conservarContenidoIntento() || !!this.recepcion());
  readonly puedeEnviar = computed(() => !!this.solicitud()?.id
    && this.estadoFormulario() === 'disponible' && this.esContextoActual(this.contexto)
    && this.observacionSeleccionada()?.estado === 'PENDIENTE_SUBSANACION'
    && !this.loadingSolicitud() && !this.loadingEnvio() && !this.verificacionPendiente() && !this.recepcion());

  // Metadatos de la observación en 1ª instancia
  observacion = signal<string>('');
  fechaObservacion = signal<string>('');
  fechaLimite = signal<string>('');

  // Documentos cargados en el expediente
  documentosExpediente = signal<ExpedienteDocItem[]>([]);

  // Formulario del ciudadano
  respuesta = signal<string>('');
  archivoSeleccionado = signal<File | null>(null);
  readonly archivoRevisado = signal(false);
  isDragging = signal<boolean>(false);

  // Modales
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);

  // Visor in-situ de documento
  previewTarget = signal<DocumentPreviewTarget | null>(null);
  isPreviewOpen = signal<boolean>(false);

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

  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      untracked(() => {
        const token = this.authService.getToken();
        if (token !== this.tokenSesion || revision !== this.revisionSesion) {
          this.tokenSesion = token;
          this.revisionSesion = revision;
          if (this.contexto && !this.destruido) this.cargarDatos(this.contexto.expediente);
        }
      });
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.cargarDatos(params.get('expediente') || ''));
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.generacion++;
    this.operaciones.unsubscribe();
    this.verificacion.unsubscribe();
    this.descarga.unsubscribe();
    this.intento = null;
    this.confirmacion = null;
    this.respuesta.set('');
    this.archivoSeleccionado.set(null);
    this.archivoRevisado.set(false);
    this.cerrarPreview();
  }

  cargarDatos(expedienteParam: string): void {
    if (this.destruido) return;
    this.operaciones.unsubscribe(); this.verificacion.unsubscribe();
    this.descarga.unsubscribe();
    this.operaciones = new Subscription();
    this.intento = null;
    this.confirmacion = null;
    const contexto: ContextoPrecision = { generacion: ++this.generacion, expediente: expedienteParam,
      token: this.authService.getToken(), revision: this.authService.cambiosSesion(), usuarioId: this.usuarioId() };
    this.contexto = contexto;
    this.expediente.set(expedienteParam);
    this.solicitud.set(null); this.observacionSeleccionada.set(null);
    this.observacion.set(''); this.fechaObservacion.set(''); this.fechaLimite.set('');
    this.documentosExpediente.set([]); this.documentosIncompletos.set(false);
    this.recepcion.set(null); this.respuesta.set(''); this.archivoSeleccionado.set(null); this.archivoRevisado.set(false);
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.cerrarPreview();
    this.loadingEnvio.set(false); this.verificacionPendiente.set(false); this.conservarContenidoIntento.set(false);
    this.puedeReintentarCarga.set(false); this.comentarioError.set(''); this.archivoError.set('');
    this.loadingSolicitud.set(true);
    this.estadoFormulario.set('cargando');
    this.error.set('');
    if (!expedienteParam.trim() || !contexto.token || !contexto.usuarioId) {
      this.loadingSolicitud.set(false); this.estadoFormulario.set('error');
      this.error.set(!expedienteParam.trim() ? 'No se ha identificado la solicitud SAIP. Abra la precisión desde su panel.'
        : 'Su sesión no es válida. Inicie sesión nuevamente.');
      return;
    }
    this.operaciones.add(this.solicitudService.findByExpediente(expedienteParam).subscribe({
      next: (sol) => {
        if (!this.esContextoActual(contexto)) return;
        this.loadingSolicitud.set(false);
        if (!sol) { this.estadoFormulario.set('vacio'); this.puedeReintentarCarga.set(true); return; }
        if (!this.idValido(sol.id) || sol.expediente !== expedienteParam || (sol.ciudadanoId != null && sol.ciudadanoId !== contexto.usuarioId)) {
          this.estadoFormulario.set('error'); this.error.set('El servidor devolvió datos que no corresponden a la solicitud consultada.');
          return;
        }
        this.solicitud.set(sol);
        this.cargarDocumentos(sol);
        if (!Array.isArray(sol.observaciones) || sol.observaciones.some(obs => !obs || !this.idValido(obs.id) ||
          !obs.estado || (obs.solicitudId != null && obs.solicitudId !== sol.id))) {
          this.estadoFormulario.set('incompleto'); return;
        }
        const observaciones = [...(sol.observaciones || [])].sort((a, b) =>
          (b.fechaObservacion || '').localeCompare(a.fechaObservacion || '') || (b.id || 0) - (a.id || 0));
        const pendientes = observaciones.filter(obs => obs.estado === 'PENDIENTE_SUBSANACION');
        if (pendientes.length > 1) { this.estadoFormulario.set('incompleto'); return; }
        const activa = pendientes[0] || observaciones[0] || null;
        this.observacionSeleccionada.set(activa);
        this.observacion.set(activa?.motivoObservacion || '');
        this.fechaObservacion.set(activa?.fechaObservacion ? this.formatearFecha(activa.fechaObservacion) : '');
        this.fechaLimite.set(activa?.fechaLimiteSubsanacion ? this.formatearFecha(activa.fechaLimiteSubsanacion) : '');
        this.estadoFormulario.set(!activa ? 'sin-requerimiento' : activa.estado !== 'PENDIENTE_SUBSANACION' ? 'atendido'
          : !activa.motivoObservacion?.trim() || sol.estado !== 'PENDIENTE_INFORMACION' ? 'incompleto' : 'disponible');
        const recuperado = activa?.id ? this.recuperarIntento(sol.id, activa.id) : null;
        if (recuperado) {
          this.intento = recuperado;
          this.comprobarRecepcion();
        }
      },
      error: (error: unknown) => {
        if (!this.esContextoActual(contexto)) return;
        this.loadingSolicitud.set(false);
        this.estadoFormulario.set('error');
        const fallo = falloConsulta(error, 'la solicitud y su requerimiento');
        this.puedeReintentarCarga.set(fallo.reintentable);
        this.error.set(fallo.mensaje);
      }
    }));
  }

  reintentarCarga(): void { if (this.contexto) this.cargarDatos(this.contexto.expediente); }

  private idValido(id: unknown): id is number { return typeof id === 'number' && Number.isSafeInteger(id) && id > 0; }

  private esContextoActual(contexto: ContextoPrecision | null): boolean {
    return !!contexto && !this.destruido && contexto.generacion === this.generacion &&
      contexto.token === this.authService.getToken() && contexto.revision === this.authService.cambiosSesion() &&
      contexto.usuarioId === this.usuarioId();
  }

  private esIntentoActual(intento: IntentoPrecision, contexto: ContextoPrecision | null): boolean {
    return this.esContextoActual(contexto) && this.solicitud()?.id === intento.solicitudId &&
      this.observacionSeleccionada()?.id === intento.observacionId && this.intento?.claveOperacion === intento.claveOperacion;
  }

  private cargarDocumentos(sol: Solicitud): void {
    const docs: readonly DocumentoListItem[] | undefined = sol.documentosMetadata ?? sol.documentos;
    const validos = (Array.isArray(docs) ? docs : []).filter(doc => {
      if (!doc || !this.idValido(doc.id)) return false;
      const metadata = doc as Record<string, unknown>;
      return !DOCUMENTO_RELATION_KEYS.some(key => metadata[key] != null) || metadata['solicitudId'] === sol.id;
    });
    this.documentosIncompletos.set(!Array.isArray(docs) || docs.length !== validos.length);
    this.documentosExpediente.set(validos.map(doc => {
      if ('nombreOriginal' in doc) return this.documentoItem(doc);
      const legacy = 'nombreArchivo' in doc ? doc : null;
      return {
        id: doc.id!, nombre: legacy?.nombreArchivo || 'Nombre no registrado',
        fecha: legacy?.fechaSubida ? this.formatearFecha(legacy.fechaSubida) : undefined,
        tamano: legacy?.tamanio != null ? `${(legacy.tamanio / 1024).toFixed(1)} KB` : undefined,
        kind: doc.tipoDocumento === 'SUBSANACION' ? 'subsanacion' as const : 'ciudadano' as const
      };
    }));
  }

  abrirSelector(event: KeyboardEvent, input: HTMLInputElement): void {
    if (!this.formularioBloqueado() && !this.archivoSeleccionado() && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); input.click();
    }
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
    if (!this.formularioBloqueado()) this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    if (this.formularioBloqueado()) return;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 1) {
      this.archivoError.set('Seleccione un solo archivo; no se han añadido los archivos arrastrados.'); return;
    }
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      this.procesarArchivo(file);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 1) {
      this.archivoError.set('Seleccione un solo archivo.');
    } else if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
    input.value = '';
  }

  private procesarArchivo(file: File): void {
    if (this.formularioBloqueado()) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const error = file.size === 0 ? 'El archivo está vacío.'
      : validarDocumento(file) || (!['pdf', 'jpg', 'jpeg', 'png', 'txt'].includes(extension || '')
        ? 'Formato no permitido. Use PDF, JPG, PNG o TXT.' : null);
    if (error) {
      this.archivoError.set(error);
      return;
    }
    this.archivoError.set('');
    this.error.set('');
    this.archivoSeleccionado.set(file);
    this.archivoRevisado.set(false);
  }

  removerArchivo(): void {
    if (!this.formularioBloqueado()) { this.archivoSeleccionado.set(null); this.archivoRevisado.set(false); }
  }

  // Recuperar siempre los bytes privados por su identificador de servidor.
  abrirDoc(doc: ExpedienteDocItem, descargar: boolean): void {
    const contexto = this.contexto;
    if (!this.esContextoActual(contexto) || !this.documentosExpediente().some(item => item.id === doc.id)) {
      this.error.set('Este documento no corresponde al expediente disponible.'); return;
    }
    this.cerrarPreview();
    this.descarga = this.documentoService.download(doc.id, doc.nombre).subscribe({
      next: ({ blob, filename }) => {
        if (!this.esContextoActual(contexto)) return;
        if (descargar) {
          this.guardarArchivo(blob, filename);
        } else {
          this.previewTarget.set({ nombre: filename, blob, expediente: this.expediente(), fecha: doc.fecha });
          this.isPreviewOpen.set(true);
        }
      },
      error: (error: unknown) => {
        if (this.esContextoActual(contexto)) this.error.set(this.mensajeError(error, 'No se pudo recuperar el archivo. No se ha sustituido por otro documento.'));
      }
    });
  }

  abrirPreviewArchivoLocal(): void {
    const file = this.archivoSeleccionado();
    if (!file || !this.esContextoActual(this.contexto)) return;
    this.descarga.unsubscribe();

    this.previewTarget.set({
      nombre: file.name,
      file: file,
      blob: file,
      tipo: file.type || 'application/pdf'
    });
    this.isPreviewOpen.set(true);
  }

  cerrarPreview(): void {
    this.descarga.unsubscribe();
    this.isPreviewOpen.set(false);
    this.previewTarget.set(null);
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
    if (this.validarEnvio() && this.contexto) {
      this.confirmacion = { contexto: this.contexto, observacionId: this.observacionSeleccionada()!.id,
        comentario: this.respuesta().trim(), archivo: this.archivoSeleccionado()! };
      this.confirmModalAbierto.set(true);
    }
  }

  confirmarDesdeDialogo(): void {
    const confirmacion = this.confirmacion;
    if (!this.confirmModalAbierto() || !confirmacion || !this.esContextoActual(confirmacion.contexto) ||
      confirmacion.observacionId !== this.observacionSeleccionada()?.id) return;
    if (confirmacion.comentario !== this.respuesta().trim() || confirmacion.archivo !== this.archivoSeleccionado()) {
      this.confirmModalAbierto.set(false); this.error.set('El contenido cambió. Revise y confirme nuevamente antes de enviar.'); return;
    }
    this.confirmarEnvio();
  }

  hayIntento(): boolean { return !!this.intento && !this.recepcion() && this.esContextoActual(this.contexto); }

  cerrarResultado(): void {
    this.successModalAbierto.set(false);
    // The form is replaced by the persisted receipt; focus returns to that stable result.
    const contexto = this.contexto;
    queueMicrotask(() => {
      if (this.esContextoActual(contexto)) document.getElementById('precision-recepcion')?.focus();
    });
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
    const contexto = this.contexto;
    this.loadingEnvio.set(true);
    this.error.set('');
    this.operaciones.add(this.precisionService.enviar(solicitudId, observacionId, intento.claveOperacion, comentario, archivo)
      .subscribe({
        next: (recepcion) => {
          if (!this.esIntentoActual(intento, contexto)) return;
          if (!this.aceptarRecepcion(recepcion)) this.dejarResultadoIncierto();
        },
        error: (error: unknown) => {
          if (!this.esIntentoActual(intento, contexto)) return;
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
      }));
  }

  comprobarRecepcion(): void {
    const intento = this.intento;
    const contexto = this.contexto;
    if (!intento || this.recepcion() || !this.esIntentoActual(intento, contexto)) return;
    this.verificacion.unsubscribe();
    this.loadingEnvio.set(true);
    this.verificacionPendiente.set(true);
    this.error.set('');
    this.verificacion = this.precisionService.consultar(intento.solicitudId, intento.observacionId, intento.claveOperacion)
      .subscribe({
        next: (recepcion) => {
          if (!this.esIntentoActual(intento, contexto)) return;
          if (!this.aceptarRecepcion(recepcion)) this.dejarResultadoIncierto();
        },
        error: (error: unknown) => {
          if (!this.esIntentoActual(intento, contexto)) return;
          this.loadingEnvio.set(false);
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.verificacionPendiente.set(false);
            this.error.set(this.estadoFormulario() === 'disponible'
              ? 'El servidor aún no registra esta recepción. Puede reintentar con el mismo comentario y archivo; se conservará la misma clave para evitar duplicados.'
              : 'No se recuperó una recepción para esta clave y el requerimiento no está disponible para otro envío. Consulte el expediente; no se volverá a presentar automáticamente.');
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
      || !recepcion.fechaRecepcion || Number.isNaN(Date.parse(recepcion.fechaRecepcion)) || !this.idValido(doc?.id) || doc.solicitudId !== intento.solicitudId
      || doc.tipoDocumento !== 'SUBSANACION' || doc.estado !== 'ACTIVO' || !doc.nombreOriginal
      || !this.idValido(doc.sizeBytes) || !/^[a-f0-9]{64}$/i.test(doc.hashSha256 || '')
      || (intento.archivo !== undefined && doc.sizeBytes !== intento.archivo.size)
      || (intento.comentario !== undefined && recepcion.comentario !== intento.comentario)) return false;
    this.recepcion.set(recepcion);
    this.estadoFormulario.set('atendido');
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
    this.comentarioError.set(''); this.archivoError.set('');
    if (!this.puedeEnviar()) {
      this.error.set('No hay una observación pendiente disponible para este envío.');
      return false;
    }
    const archivo = this.archivoSeleccionado();
    if (!this.respuesta().trim() || this.respuesta().trim().length > 3000 || !archivo) {
      if (!this.respuesta().trim() || this.respuesta().trim().length > 3000) this.comentarioError.set('Describa las correcciones, hasta 3000 caracteres.');
      if (!archivo) this.archivoError.set('Seleccione el archivo requerido.');
      this.error.set('Describa las correcciones (hasta 3000 caracteres) y adjunte el documento requerido.');
      return false;
    }
    const errorArchivo = validarDocumento(archivo);
    if (!archivo.size || errorArchivo) {
      this.archivoError.set(errorArchivo || 'El archivo está vacío.');
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
      id: doc.id!, nombre: doc.nombreOriginal || 'Nombre no registrado',
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
      if (error.status === 400 || error.status === 422) return 'El servidor rechazó los datos de la precisión. Revise el comentario y el archivo; no se ha confirmado la recepción.';
      if (error.status === 409) return 'La operación entra en conflicto con una recepción o estado registrado. Conserve la clave y compruebe la recepción antes de volver a enviar.';
      if (error.status === 413) return 'El archivo supera el tamaño permitido por el servidor.';
      if (error.status === 415) return 'El servidor rechazó el formato del archivo.';
    }
    return fallback;
  }

  irAlPanel(): void {
    if (!this.esContextoActual(this.contexto)) return;
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  verDetalleExpediente(): void {
    if (!this.esContextoActual(this.contexto) || !this.solicitud()?.id) return;
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
      { label: 'Requerimiento', value: String(this.observacionSeleccionada()?.id ?? '—'), mono: true },
      { label: 'Observación', value: obsTruncada },
      { label: 'Descripción', value: `${this.respuesta().trim().length} caracteres` },
      { label: 'Documento', value: doc ? doc.name : '—' }
    ];
  });

  readonly subsanacionWarning: ReferenceConfirmWarning = {
    label: 'Plazo de subsanación',
    detail: 'La regla contempla 2 días hábiles desde la notificación. La fecha de observación no acredita su eficacia. El servidor comprueba el plazo y el estado al recibir la precisión.'
  };

  // Metadatos para modal de éxito
  subsanacionSuccessMetadata = computed<ReferenceSuccessMeta[]>(() => {
    const recepcion = this.recepcion();
    return [
      { label: 'Observación subsanada', value: recepcion ? String(recepcion.observacionId) : '—' },
      { label: 'Documento adjunto', value: recepcion?.documento.nombreOriginal || '—' },
      { label: 'Recepción registrada', value: recepcion ? this.formatearFecha(recepcion.fechaRecepcion) : '—' },
      { label: 'Documento registrado', value: recepcion?.documento.id ? String(recepcion.documento.id) : '—', mono: true },
      { label: 'Clave de operación', value: recepcion?.claveOperacion || '—', mono: true }
    ];
  });

  readonly subsanacionNextSteps: ReferenceSuccessNextStep[] = [
    {
      label: 'Consulte el expediente para recuperar su estado actualizado.',
      hint: 'El plazo aplicable corresponde al servidor; no se calcula desde esta confirmación.'
    },
    {
      label: 'La recepción acredita el registro de la precisión y su archivo, no una entrega, notificación eficaz, firma o emisión formal.'
    }
  ];
}
