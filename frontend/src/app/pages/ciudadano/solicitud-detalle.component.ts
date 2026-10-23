import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, DestroyRef, computed, effect, untracked, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Apelacion } from '../../models/apelacion.model';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { AmpliacionPlazoSolicitud, EncauzamientoSolicitud, LiquidacionCostoSolicitud, ObservacionSolicitud, Solicitud } from '../../models/solicitud.model';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';
import { DocumentoRelation, DocumentoListItem } from '../../models/documento.model';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TimelineComponent, TimelineEvent } from '../../shared/timeline.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import {
  LucideAlertCircle,
  LucideArrowLeft,
  LucideArrowRightLeft,
  LucideBellRing,
  LucideCalendar,
  LucideCalendarClock,
  LucideClock,
  LucideDownload,
  LucideEye,
  LucideFileText,
  LucideHelpCircle,
  LucideLock,
  LucideReceipt,
  LucideScale,
  LucideUser,
  LucideX
} from '@lucide/angular';

export type RequestTabId = 'solicitud' | 'respuesta' | 'notificaciones' | 'apelacion';

export interface RequestTabItem {
  id: RequestTabId;
  label: string;
}

export interface DocumentoDetalleItem {
  id?: number;
  contentType?: string;
  nombre: string;
  tamano: string;
  fecha: string;
  esSubsanacion: boolean;
  tipoOrigen: 'ciudadano' | 'subsanacion' | 'entidad' | 'resolucion';
}

export interface NotifStageItem {
  stage: string;
  num: string;
  label: string;
  resultado: string;
  docs: {
    id?: number;
    contentType?: string;
    tipo: 'resolucion' | 'cedula';
    titulo: string;
    subtitulo: string;
    tamano: string;
    fecha: string;
    nombre: string;
  }[];
}

@Component({
  selector: 'app-solicitud-detalle',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    TimelineComponent,
    LucideAlertCircle,
    LucideArrowLeft,
    LucideArrowRightLeft,
    LucideBellRing,
    LucideCalendar,
    LucideCalendarClock,
    LucideClock,
    LucideDownload,
    LucideEye,
    LucideFileText,
    LucideHelpCircle,
    LucideLock,
    LucideReceipt,
    LucideScale,
    LucideUser,
    DocumentPreviewModalComponent
  ],
  templateUrl: './solicitud-detalle.component.html',
  styleUrl: './solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly solicitudService = inject(SolicitudService);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);
  private readonly documentoService = inject(DocumentoService);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<RequestTabId>('solicitud');
  subsanacionComentario = signal<string>('');
  subsanacionDocumentoNombre = signal<string>('');
  subsanacionLoading = signal<boolean>(false);
  subsanacionError = signal<string>('');
  subsanacionSuccess = signal<string>('');
  recojoConfirmado = signal<boolean>(false);

  previewDoc = signal<DocumentoDetalleItem | null>(null);
  previewTarget = signal<DocumentPreviewTarget | null>(null);
  isPreviewOpen = signal<boolean>(false);

  readonly enApelacion = computed<boolean>(() => {
    const sol = this.solicitud();
    return !!(sol?.apelacion?.expediente || sol?.apelacion?.id);
  });

  readonly expedienteTTAIP = computed<string>(() => {
    return this.solicitud()?.apelacion?.expediente || '';
  });

  readonly estadoTTAIPLabel = computed<string>(() => {
    const est = this.solicitud()?.apelacion?.estado;
    return est ? this.getEstadoDisplay(est) : 'Sin estado registrado';
  });

  readonly estadoBadge = computed<string>(() => {
    const sol = this.solicitud();
    if (!sol) return 'Sin estado registrado';
    if (this.enApelacion()) {
      const res = sol.apelacion?.resultado;
      const est = sol.apelacion?.estado;
      if (res || est?.startsWith('RESUELTO')) {
        return res ? this.getEstadoDisplay(res) : 'Resuelto';
      }
      if (est === 'EN_SUBSANACION') {
        return 'En subsanación';
      }
      if (est === 'EN_CALIFICACION_1' || est === 'PENDIENTE_ELEVACION') {
        return 'En 1ra Calificación';
      }
      if (est === 'EN_CALIFICACION_2' || est === 'NOTIFICACION_SEGUNDA_CALIFICACION') {
        return 'En 2da Calificación';
      }
      if (est === 'EN_RESOLUCION') {
        return 'En Resolución';
      }
      return this.getEstadoDisplay(est);
    }
    return this.getEstadoDisplay(sol.estado);
  });

  readonly tabs = computed<RequestTabItem[]>(() => {
    return [
      { id: 'solicitud', label: 'Solicitud' },
      { id: 'respuesta', label: 'Respuesta de la entidad' },
      ...(this.enApelacion()
        ? [{ id: 'notificaciones' as const, label: 'Resoluciones y cédulas' }]
        : [{ id: 'apelacion' as const, label: 'Apelación' }])
    ];
  });

  readonly yaRespondio = computed<boolean>(() => {
    const sol = this.solicitud();
    if (!sol) return false;
    return !!sol.respuesta || ['RESPONDIDA', 'DENEGADA', 'VENCIDA', 'CONCLUIDA', 'APELADA'].includes((sol.estado || '').toUpperCase());
  });

  readonly apelable = computed<boolean>(() => {
    return this.yaRespondio() && !this.enApelacion();
  });

  readonly respDenegada = computed<boolean>(() => {
    const sol = this.solicitud();
    return sol?.estado === 'DENEGADA' || sol?.respuesta?.tipoRespuesta === 'DENEGACION_TOTAL';
  });

  readonly respParcial = computed<boolean>(() => {
    return this.solicitud()?.respuesta?.tipoRespuesta === 'ENTREGA_PARCIAL';
  });

  readonly respLabel = computed<string>(() => {
    if (this.respDenegada()) return 'Denegada';
    if (this.respParcial()) return 'Entrega parcial';
    if (this.solicitud()?.respuesta?.tipoRespuesta === 'ENTREGA_TOTAL') return 'Entrega total';
    return this.yaRespondio() ? 'Atendida' : 'En proceso';
  });

  readonly solicitudDocumentoRelation = computed<DocumentoRelation | null>(() => {
    const solicitudId = this.solicitud()?.id;
    return solicitudId ? { solicitudId } : null;
  });

  readonly respuestaDocumentoRelation = computed<DocumentoRelation | null>(() => {
    const respuestaId = this.solicitud()?.respuesta?.id;
    return respuestaId ? { respuestaId } : null;
  });

  readonly puedeAdjuntarDocumentos = computed<boolean>(() => {
    const estado = this.solicitud()?.estado;
    return estado !== 'RESPONDIDA' && estado !== 'VENCIDA' && estado !== 'DENEGADA' && estado !== 'CONCLUIDA';
  });

  readonly misDocumentos = computed<DocumentoDetalleItem[]>(() => {
    const sol = this.solicitud();
    return sol ? this.mapDocumentos(sol.documentosMetadata?.length ? sol.documentosMetadata : sol.documentos ?? [], 'ciudadano') : [];
  });

  readonly gruposMisDocumentos = computed(() => {
    const docs = this.misDocumentos();
    return [
      { key: 'sol', title: 'Adjuntos de la solicitud', docs: docs.filter(d => !d.esSubsanacion) },
      { key: 'sub', title: 'Subsanaciones presentadas', docs: docs.filter(d => d.esSubsanacion) }
    ].filter(grupo => grupo.docs.length > 0);
  });

  readonly adjuntosRespuesta = computed<DocumentoDetalleItem[]>(() => {
    const respuesta = this.solicitud()?.respuesta;
    return respuesta ? this.mapDocumentos(respuesta.documentosMetadata?.length ? respuesta.documentosMetadata : respuesta.documentos ?? [], 'entidad') : [];
  });

  // La SAIP contiene solo el resumen de la apelación. Los archivos y sus IDs
  // se consultan en el detalle autorizado, nunca se deducen a partir del estado.
  readonly notifStages = computed<NotifStageItem[]>(() => {
    const ap = this.apelacionDetalle();
    if (!ap) return [];
    const resoluciones = [...(ap.resoluciones ?? []), ap.resolucionPrimeraCalificacion,
      ap.resolucionSegundaCalificacion, ap.resolucion].filter(r => !!r);
    const vistos = new Set<number>();
    return resoluciones.filter(r => {
      if (!r.id || vistos.has(r.id)) return false;
      vistos.add(r.id);
      return true;
    }).map(r => ({
      stage: String(r.id), num: r.numeroResolucion || '—',
      label: this.getEstadoDisplay(r.tipoResolucion), resultado: this.getEstadoDisplay(r.decision),
      docs: [
        ...this.mapDocumentos(r.documentos ?? [], 'resolucion').map(doc => ({ ...doc,
          tipo: 'resolucion' as const, titulo: doc.nombre, subtitulo: r.numeroResolucion || 'Resolución registrada' })),
        ...(r.cedulas ?? []).flatMap(cedula => this.mapDocumentos(cedula.documentos ?? [], 'resolucion').map(doc => ({ ...doc,
          tipo: 'cedula' as const, titulo: doc.nombre, subtitulo: cedula.numeroCedula || 'Cédula registrada' })))
      ]
    }));
  });

  private mapDocumentos(documentos: ReadonlyArray<DocumentoListItem>, origen: DocumentoDetalleItem['tipoOrigen']): DocumentoDetalleItem[] {
    return documentos.map(doc => {
      const metadata = 'nombreOriginal' in doc ? doc : null;
      const legacy = 'nombreArchivo' in doc ? doc : null;
      return {
        id: doc.id, nombre: metadata?.nombreOriginal || legacy?.nombreArchivo || 'Documento sin nombre',
        contentType: metadata?.contentType || legacy?.tipoArchivo,
        tamano: this.formatBytes(metadata?.sizeBytes ?? legacy?.tamanio),
        fecha: this.formatTimelineDate(metadata?.fechaCreacion || legacy?.fechaSubida),
        esSubsanacion: doc.tipoDocumento === 'SUBSANACION', tipoOrigen: origen
      };
    });
  }

  readonly timelineEvents = computed<TimelineEvent[]>(() => {
    const sol = this.solicitud();
    if (!sol) return [];
    return this.timelineDisplayOrder(this.buildCitizenTimeline(sol));
  });

  readonly estadoConsulta = signal<EstadoConsulta>('cargando');
  readonly puedeReintentarConsulta = signal(false);
  readonly documentoError = signal('');
  readonly apelacionDetalle = signal<Apelacion | null>(null);
  readonly loadingApelacion = signal(false);
  readonly errorApelacion = signal('');
  readonly reintentarApelacion = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  private consultas = new Subscription();
  private descargas = new Subscription();
  private generacion = 0;
  private expedienteActual: string | null = null;
  private tokenActual = this.authService.getToken();

  constructor() {
    effect(() => {
      this.authService.cambiosSesion();
      untracked(() => {
        const token = this.authService.getToken();
        if (token !== this.tokenActual) {
          this.tokenActual = token;
          if (this.expedienteActual !== null) this.cargarSolicitud(this.expedienteActual);
        }
      });
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.cargarSolicitud(params.get('expediente') || '');
    });
  }

  ngOnDestroy(): void {
    this.generacion++;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
  }

  cargarSolicitud(expediente: string): void {
    this.expedienteActual = expediente;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
    this.consultas = new Subscription();
    this.descargas = new Subscription();
    const generacion = ++this.generacion;
    const token = this.authService.getToken();
    this.solicitud.set(null);
    this.apelacionDetalle.set(null);
    this.loadingApelacion.set(false);
    this.errorApelacion.set('');
    this.documentoError.set('');
    this.cerrarPreview();
    this.activeTab.set('solicitud');
    this.recojoConfirmado.set(false);
    this.subsanacionComentario.set('');
    this.subsanacionDocumentoNombre.set('');
    this.subsanacionError.set('');
    this.subsanacionSuccess.set('');
    this.subsanacionLoading.set(false);
    this.error.set('');
    this.puedeReintentarConsulta.set(false);
    this.loading.set(false);
    if (!expediente.trim()) {
      this.estadoConsulta.set('validacion');
      this.error.set('No se recibió el identificador de la solicitud.');
      return;
    }
    if (!token) {
      this.estadoConsulta.set('autenticacion');
      this.error.set('Su sesión no es válida. Inicie sesión nuevamente.');
      return;
    }
    this.loading.set(true);
    this.estadoConsulta.set('cargando');
    this.consultas.add(this.solicitudService.findByExpediente(expediente).subscribe({
      next: (data) => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loading.set(false);
        if (!data) {
          this.estadoConsulta.set('vacio');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        if (!data.id || data.expediente !== expediente) {
          this.estadoConsulta.set('error');
          this.error.set('El servidor devolvió una solicitud que no corresponde al recurso consultado.');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        this.solicitud.set(data);
        this.estadoConsulta.set('disponible');
        this.cargarDocumentosTribunal();
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token)) return;
        const fallo = falloConsulta(error, 'la solicitud');
        this.estadoConsulta.set(fallo.estado);
        this.error.set(fallo.mensaje);
        this.puedeReintentarConsulta.set(fallo.reintentable);
        this.loading.set(false);
      }
    }));
  }

  reintentarConsulta(): void {
    if (this.expedienteActual !== null) this.cargarSolicitud(this.expedienteActual);
  }

  cargarDocumentosTribunal(): void {
    const id = this.solicitud()?.apelacion?.id;
    if (!id) return;
    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.apelacionDetalle.set(null);
    this.errorApelacion.set('');
    this.loadingApelacion.set(true);
    this.reintentarApelacion.set(false);
    this.consultas.add(this.apelacionService.findById(id).subscribe({
      next: data => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loadingApelacion.set(false);
        if (!data || data.id !== id) {
          this.errorApelacion.set('El servidor no devolvió el detalle documental de esta apelación.');
          this.reintentarApelacion.set(true);
          return;
        }
        this.apelacionDetalle.set(data);
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token)) return;
        const fallo = falloConsulta(error, 'los documentos del Tribunal');
        this.errorApelacion.set(fallo.mensaje);
        this.reintentarApelacion.set(fallo.reintentable);
        this.loadingApelacion.set(false);
      }
    }));
  }

  private esConsultaActual(generacion: number, token: string | null): boolean {
    return generacion === this.generacion && token === this.authService.getToken();
  }

  onDocumentoSubido(): void {
    const expediente = this.solicitud()?.expediente;
    if (expediente) {
      this.cargarSolicitud(expediente);
    }
  }

  cambiarTab(tab: RequestTabId): void {
    this.activeTab.set(tab);
  }

  isTabActive(tab: RequestTabId): boolean {
    return this.activeTab() === tab;
  }

  abrirModalPreview(doc: { id?: number; nombre: string; contentType?: string }): void {
    this.documentoError.set('');
    this.cerrarPreview();
    if (!doc.id || !this.solicitud()) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    this.previewTarget.set({ id: doc.id, nombre: doc.nombre, tipo: doc.contentType });
    this.isPreviewOpen.set(true);
  }

  cerrarPreview(): void {
    this.previewDoc.set(null);
    this.previewTarget.set(null);
    this.isPreviewOpen.set(false);
  }

  descargarDoc(doc: { id?: number; nombre: string }): void {
    this.documentoError.set('');
    if (!doc.id || !this.solicitud()) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.descargas.add(this.documentoService.download(doc.id, doc.nombre).subscribe({
      next: ({ blob, filename }) => {
        if (!this.esConsultaActual(generacion, token)) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || doc.nombre;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => {
        if (this.esConsultaActual(generacion, token)) this.documentoError.set(falloConsulta(error, 'el documento').mensaje);
      }
    }));
  }

  confirmarRecojo(): void {
    this.recojoConfirmado.set(true);
  }

  subsanarObservacion(): void {
    const sol = this.solicitud();
    const observacion = this.observacionPendiente();
    const comentario = this.subsanacionComentario().trim();
    const documento = this.subsanacionDocumentoNombre().trim();

    if (!sol || !observacion) {
      return;
    }
    if (this.esSubsanacionObservacionVencida(observacion)) {
      this.subsanacionError.set('El plazo legal de subsanación ha vencido.');
      return;
    }
    if (!comentario && !documento) {
      this.subsanacionError.set('Ingrese un comentario o referencia de documento para subsanar.');
      return;
    }

    this.subsanacionLoading.set(true);
    this.subsanacionError.set('');
    this.subsanacionSuccess.set('');

    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.solicitudService.subsanar(sol.id, observacion.id, {
      comentarioSubsanacion: comentario || undefined,
      documentoSubsanacionNombre: documento || undefined,
      responsable: this.getSolicitanteNombre()
    }).subscribe({
      next: () => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.subsanacionComentario.set('');
        this.subsanacionDocumentoNombre.set('');
        this.subsanacionSuccess.set('Subsanación enviada. La solicitud volvió a revisión de la entidad.');
        this.subsanacionLoading.set(false);
        this.cargarSolicitud(sol.expediente);
      },
      error: (error) => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.subsanacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la subsanación.');
        this.subsanacionLoading.set(false);
      }
    });
  }

  getEstadoDisplay(value: string | undefined): string {
    if (!value) return 'Sin estado registrado';
    const upper = value.toUpperCase();
    if (upper === 'PENDIENTE_ELEVACION') return 'En 1ra Calificación';
    if (upper === 'EN_CALIFICACION_1') return 'En 1ra Calificación';
    if (upper === 'EN_CALIFICACION_2') return 'En 2da Calificación';
    if (upper === 'EN_SUBSANACION' || upper === 'SUBSANACION') return 'En subsanación';
    if (upper === 'EN_RESOLUCION') return 'En Resolución';
    if (upper === 'RESUELTO_FUNDADO' || upper === 'FUNDADO') return 'Fundado';
    if (upper === 'RESUELTO_INFUNDADO' || upper === 'INFUNDADO') return 'Infundado';
    if (upper === 'RESUELTO_FUNDADO_EN_PARTE' || upper === 'FUNDADO_EN_PARTE') return 'Fundado en parte';
    if (upper === 'RESUELTO_IMPROCEDENTE' || upper === 'IMPROCEDENTE') return 'Improcedente';
    if (upper === 'EN_PROCESO' || upper === 'EN_REVISION' || upper === 'RECEPCIONADA') return 'En Proceso';
    if (upper === 'DENEGADA') return 'Denegada';
    if (upper === 'VENCIDA') return 'Vencida';
    if (upper === 'RESPONDIDA') return 'Respondida';
    if (upper === 'APELADA') return 'Apelada';
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  observaciones(): ObservacionSolicitud[] {
    return this.solicitud()?.observaciones || [];
  }

  observacionPendiente(): ObservacionSolicitud | null {
    return this.observaciones().find((item) => item.estado === 'PENDIENTE_SUBSANACION') || null;
  }

  observacionSubsanada(): ObservacionSolicitud | null {
    return this.observaciones().find((item) => item.estado === 'SUBSANADA') || null;
  }

  esSubsanacionObservacionVencida(obs: ObservacionSolicitud | null): boolean {
    if (!obs || !obs.fechaLimiteSubsanacion) return false;
    try {
      const fechaLimite = new Date(obs.fechaLimiteSubsanacion);
      return new Date().getTime() > fechaLimite.getTime();
    } catch {
      return false;
    }
  }

  ampliaciones(): AmpliacionPlazoSolicitud[] {
    return this.solicitud()?.ampliacionesPlazo || [];
  }

  ampliacionActiva(): AmpliacionPlazoSolicitud | null {
    return this.ampliaciones().find((item) => item.estadoAmpliacion === 'REGISTRADA' || item.estadoAmpliacion === 'NOTIFICADA') || null;
  }

  encauzamientos(): EncauzamientoSolicitud[] {
    return this.solicitud()?.encauzamientos || [];
  }

  encauzamientoActivo(): EncauzamientoSolicitud | null {
    return this.encauzamientos().find((item) => item.estadoEncauzamiento === 'REGISTRADO' || item.estadoEncauzamiento === 'DERIVADO') || null;
  }

  liquidaciones(): LiquidacionCostoSolicitud[] {
    return this.solicitud()?.liquidacionesCosto || [];
  }

  liquidacionActiva(): LiquidacionCostoSolicitud | null {
    return this.liquidaciones().find((item) =>
      item.estadoLiquidacion === 'EMITIDA' || item.estadoLiquidacion === 'NOTIFICADA' || item.estadoLiquidacion === 'PAGADA') || null;
  }

  getSolicitanteNombre(): string {
    const sol = this.solicitud();
    return sol?.ciudadanoNombre || 'No registrado';
  }

  getSolicitanteIniciales(): string {
    const base = this.getSolicitanteNombre()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
    return base || '—';
  }

  getSolicitanteDni(): string {
    return this.solicitud()?.ciudadanoDni || 'No registrado';
  }

  getSolicitanteEmail(): string {
    return this.solicitud()?.ciudadanoEmail || 'No registrado';
  }

  esEmpresa(): boolean {
    const dni = (this.getSolicitanteDni() || '').replace(/\D/g, '');
    return dni.length === 11;
  }

  docLabel(): string {
    return this.esEmpresa() ? 'RUC' : 'DNI';
  }

  formatosSeleccionados(): string[] {
    const sol = this.solicitud();
    if (!sol) {
      return [];
    }

    const selected: string[] = [];
    if (sol.formatoDigital) selected.push('Digital');
    if (sol.formatoFisico) selected.push('Físico');
    if (sol.copiaSimple) selected.push('Copia simple');
    if (sol.copiaCertificada) selected.push('Copia certificada');
    return selected;
  }

  puedeApelar(): boolean {
    const sol = this.solicitud();
    return !!sol && (sol.estado === 'RESPONDIDA' || sol.estado === 'DENEGADA' || sol.estado === 'VENCIDA') && !this.enApelacion();
  }

  esSilencioAdministrativo(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  isApelacionResuelta(): boolean {
    const estado = this.solicitud()?.apelacion?.estado || '';
    return estado.startsWith('RESUELTO') || estado.startsWith('CONCLUSION') || estado === 'TENER_POR_NO_PRESENTADO' || !!this.solicitud()?.apelacion?.resultado;
  }

  showSubsanarAction(): boolean {
    return this.solicitud()?.apelacion?.estado === 'EN_SUBSANACION';
  }

  private formatTimelineDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  private formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return 'Tamaño no registrado';
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Timeline logic matching design-reference ──────────────────────────────
  buildCitizenTimeline(sol: Solicitud): TimelineEvent[] {
    const steps: TimelineEvent[] = [];
    const fechaPres = this.formatTimelineDate(sol.fechaPresentacion);
    const respondida = !!sol.respuesta?.fechaRespuesta;
    const enApel = !!(sol.apelacion?.expediente || sol.apelacion?.id);
    const denegada = sol.estado === 'DENEGADA' || sol.respuesta?.tipoRespuesta === 'DENEGACION_TOTAL';
    const yaRespondida = respondida || denegada || enApel;

    // 1. Solicitud presentada
    steps.push({
      instancia: 1,
      icon: 'mail',
      status: 'completed',
      title: 'Solicitud presentada',
      description: 'SAIP registrada y notificada a la entidad.',
      date: fechaPres
    });

    // Precision (observaciones)
    const obsActiva = sol.observaciones?.find(o => o.estado === 'PENDIENTE_SUBSANACION');
    const obsSubsanada = sol.observaciones?.find(o => o.estado === 'SUBSANADA');
    if (obsActiva) {
      steps.push({
        instancia: 1,
        icon: 'search',
        status: 'current',
        title: 'Solicitud de precisión',
        description: `La entidad pidió precisar la solicitud · plazo de 2 días hábiles hasta el ${this.formatTimelineDate(obsActiva.fechaLimiteSubsanacion)}.`,
        date: this.formatTimelineDate(obsActiva.fechaObservacion)
      });
    } else if (obsSubsanada) {
      steps.push({
        instancia: 1,
        icon: 'search',
        status: 'completed',
        title: 'Solicitud de precisión',
        description: 'La entidad pidió precisar la solicitud · plazo de 2 días hábiles.',
        date: this.formatTimelineDate(obsSubsanada.fechaObservacion)
      });
      steps.push({
        instancia: 1,
        icon: 'filecheck',
        status: 'completed',
        title: 'Subsanación presentada',
        description: 'El administrado precisó su solicitud dentro del plazo.',
        date: this.formatTimelineDate(obsSubsanada.fechaSubsanacion)
      });
    }

    // Encauzamiento
    const enc = sol.encauzamientos?.find(e => e.estadoEncauzamiento === 'REGISTRADO' || e.estadoEncauzamiento === 'DERIVADO');
    if (enc) {
      steps.push({
        instancia: 1,
        icon: 'search',
        status: 'completed',
        title: `Encauzamiento ${enc.alcance === 'TOTAL' ? 'total' : 'parcial'}`,
        description: `La solicitud fue derivada a ${enc.entidadDestinoNombre} por corresponder a su competencia.`,
        date: this.formatTimelineDate(enc.fechaEncauzamiento)
      });
    }

    // Liquidación (Cupón de pago)
    const liq = sol.liquidacionesCosto?.find(l => l.estadoLiquidacion === 'EMITIDA' || l.estadoLiquidacion === 'NOTIFICADA' || l.estadoLiquidacion === 'PAGADA' || l.estadoLiquidacion === 'RECOGIDA');
    if (liq) {
      const recogido = liq.estadoLiquidacion === 'RECOGIDA' || this.recojoConfirmado();
      steps.push({
        instancia: 1,
        icon: 'mail',
        status: recogido ? 'completed' : 'current',
        title: recogido ? 'Información recogida' : 'Cupón de pago emitido',
        description: recogido
          ? 'El administrado recogió la información en la oficina de la entidad.'
          : `Pague ${liq.moneda} ${liq.monto} y recoja antes del ${this.formatTimelineDate(liq.fechaLimiteRecojo)} (30 días calendario).`,
        date: this.formatTimelineDate(liq.fechaNotificacion)
      });
    }

    // Ampliación
    const amp = sol.ampliacionesPlazo?.find(a => a.estadoAmpliacion === 'REGISTRADA' || a.estadoAmpliacion === 'NOTIFICADA');
    if (amp) {
      steps.push({
        instancia: 1,
        icon: 'search',
        status: 'completed',
        title: 'Plazo ampliado · ampliación registrada',
        description: `La entidad amplió el plazo de atención. Nueva fecha límite: ${this.formatTimelineDate(amp.fechaLimiteAmpliada)}.`,
        date: this.formatTimelineDate(amp.fechaNotificacionAmpliacion)
      });
    }

    if (sol.estado === 'VENCIDA' || this.esSilencioAdministrativo()) {
      steps.push({
        instancia: 1,
        icon: 'search',
        status: 'completed',
        title: 'Plazo vencido · Silencio administrativo',
        description: 'La entidad no respondió dentro del plazo legal (SAN).',
        date: this.formatTimelineDate(sol.fechaLimite)
      });
    } else if (yaRespondida) {
      steps.push({
        instancia: 1,
        icon: 'search',
        status: 'completed',
        title: 'Revisión de la entidad',
        description: 'La entidad evaluó la solicitud.',
        date: fechaPres
      });
      const respTitle = denegada
        ? 'Denegada por la entidad'
        : `Respuesta de la entidad · ${sol.respuesta?.tipoRespuesta === 'ENTREGA_PARCIAL' ? 'Parcial' : 'Total'}`;
      steps.push({
        instancia: 1,
        icon: 'filecheck',
        status: 'completed',
        title: respTitle,
        description: enApel ? 'El ciudadano no quedó conforme e interpuso apelación.' : 'La entidad emitió su respuesta.',
        date: this.formatTimelineDate(sol.respuesta?.fechaRespuesta)
      });
    } else {
      const yaHayCurrent = steps.some(s => s.status === 'current');
      steps.push({
        instancia: 1,
        icon: 'search',
        status: yaHayCurrent ? 'completed' : 'current',
        title: 'En revisión de la entidad',
        description: `Plazo legal de 10 días hábiles${sol.fechaLimite ? ` · vence ${this.formatTimelineDate(sol.fechaLimite)}` : ''}.`,
        date: fechaPres
      });
      steps.push({
        instancia: 1,
        icon: 'filecheck',
        status: 'pending',
        title: 'Respuesta de la entidad',
        description: 'Pendiente de respuesta de la entidad.',
        date: 'Pendiente'
      });
    }

    // Segunda instancia (TTAIP)
    if (enApel) {
      const apel = sol.apelacion!;
      const est = (apel.estado || '').toUpperCase();
      const enSubsanacion = est === 'EN_SUBSANACION' || est === 'SUBSANACION';
      const primeraPendiente = est === 'EN_CALIFICACION_1' || est === 'PENDIENTE_ELEVACION';
      const cal1 = (apel as any).calificacionPrimera || (enSubsanacion ? { resultado: 'INADMISIBLE' } : null);
      const cal2 = (apel as any).calificacionSegunda;
      const resuelto = this.isApelacionResuelta();

      steps.push({
        instancia: 2,
        icon: 'gavel',
        status: 'completed',
        title: 'Apelación presentada al TTAIP',
        description: `Recurso elevado al Tribunal · ${apel.expediente || 'en trámite'}.`,
        date: this.formatTimelineDate(apel.fechaApelacion)
      });

      // 1ra Calificación
      steps.push({
        instancia: 2,
        icon: 'scale',
        status: primeraPendiente ? 'current' : 'completed',
        title: '1ra Calificación',
        description: primeraPendiente
          ? 'El Tribunal revisa la admisibilidad del recurso.'
          : enSubsanacion
            ? 'El Tribunal declaró el recurso INADMISIBLE.'
            : 'El Tribunal calificó la admisibilidad del recurso.',
        date: this.formatTimelineDate((cal1 as any)?.fecha || apel.fechaApelacion)
      });

      // Subsanación requerida
      if (enSubsanacion) {
        steps.push({
          instancia: 2,
          icon: 'filecheck',
          status: 'current',
          title: 'Subsanación requerida',
          description: 'Debe subsanar las observaciones del Tribunal para que su recurso sea admitido.',
          date: this.formatTimelineDate((cal1 as any)?.fecha || apel.fechaApelacion)
        });
      }

      if (cal1?.resultado !== 'IMPROCEDENTE') {
        const segPendiente = est === 'EN_CALIFICACION_2' || est === 'NOTIFICACION_SEGUNDA_CALIFICACION';
        const segTerminada = est === 'EN_RESOLUCION' || resuelto;
        steps.push({
          instancia: 2,
          icon: 'scale',
          status: segPendiente ? 'current' : segTerminada ? 'completed' : 'pending',
          title: '2da Calificación',
          description: segTerminada
            ? 'Tras la subsanación, el Tribunal declaró el recurso ADMITIDO.'
            : 'Verificación de requisitos tras la subsanación.',
          date: this.formatTimelineDate((cal2 as any)?.fecha || apel.fechaSubsanacion)
        });

        steps.push({
          instancia: 2,
          icon: 'gavel',
          status: est === 'EN_RESOLUCION' ? 'current' : resuelto ? 'completed' : 'pending',
          title: 'En resolución',
          description: 'La sala analiza el fondo del expediente.',
          date: '—'
        });
      }

      steps.push({
        instancia: 2,
        icon: 'check',
        status: resuelto ? 'completed' : 'pending',
        title: 'Resolución final',
        description: apel.resultado ? `Fallo del Tribunal: ${apel.resultado}.` : 'Pendiente de resolución del Tribunal.',
        date: this.formatTimelineDate(sol.respuesta?.fechaRespuesta || (apel as any)?.fechaResolucionFinal)
      });
    } else if (sol.estado === 'VENCIDA' || sol.estado === 'DENEGADA') {
      steps.push({
        instancia: 2,
        icon: 'scale',
        status: 'pending',
        title: 'Apelación disponible',
        description: 'Puede interponer recurso de apelación ante el TTAIP.',
        date: 'Disponible'
      });
    }

    return steps;
  }

  timelineDisplayOrder(steps: TimelineEvent[]): TimelineEvent[] {
    const currentIdx = steps.findIndex(s => s.status === 'current');
    const cut = currentIdx >= 0 ? currentIdx : steps.length - 1;
    return steps.slice(0, cut + 1).reverse();
  }

}
