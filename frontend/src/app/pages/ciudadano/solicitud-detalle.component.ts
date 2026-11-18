import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, DestroyRef, ElementRef, computed, effect, untracked, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Apelacion } from '../../models/apelacion.model';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { ampliacionParaApelar, AmpliacionPlazoSolicitud, DECISIONES_ENTREGA, EncauzamientoSolicitud, LiquidacionCostoSolicitud, ObservacionSolicitud, Solicitud, tieneHitoDesfavorable } from '../../models/solicitud.model';
import { isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';
import { DocumentoRelation, DocumentoListItem, DOCUMENTO_RELATION_KEYS, getDocumentoRelationEntry } from '../../models/documento.model';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TimelineComponent, TimelineEvent } from '../../shared/timeline.component';
import { DocumentListComponent } from '../../shared/document-list.component';
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
  LucideReceipt,
  LucideScale,
  LucideUser
} from '@lucide/angular';

import { formatosEntregaSolicitados } from '../../utils/modalidad-entrega.util';

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
    LucideReceipt,
    LucideScale,
    LucideUser,
    DocumentListComponent,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  solicitud = signal<Solicitud | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<RequestTabId>('solicitud');

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

  readonly estadoSaipLabel = computed(() => this.getEstadoDisplay(this.solicitud()?.estado));

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
    return this.estadoSaipLabel();
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
    return this.idValido(this.solicitud()?.respuesta?.id);
  });

  readonly apelable = computed<boolean>(() => {
    return this.puedeApelar();
  });

  readonly respDenegada = computed<boolean>(() => {
    const sol = this.solicitud();
    return sol?.respuesta?.tipoRespuesta === 'DENEGACION_TOTAL';
  });

  readonly respParcial = computed<boolean>(() => {
    return this.solicitud()?.respuesta?.tipoRespuesta === 'ENTREGA_PARCIAL';
  });

  readonly respLabel = computed<string>(() => {
    if (this.respDenegada()) return 'Denegada';
    if (this.respParcial()) return 'Entrega parcial';
    if (this.solicitud()?.respuesta?.tipoRespuesta === 'ENTREGA_TOTAL') return 'Entrega total';
    return 'Tipo no registrado';
  });

  readonly misDocumentos = computed<DocumentoDetalleItem[]>(() => {
    const sol = this.solicitud();
    return sol ? this.mapDocumentos(sol.documentosMetadata ?? sol.documentos ?? [], 'ciudadano', { solicitudId: sol.id }) : [];
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
    return respuesta && this.idValido(respuesta.id)
      ? this.mapDocumentos(respuesta.documentosMetadata ?? respuesta.documentos ?? [], 'entidad', { respuestaId: respuesta.id }) : [];
  });

  readonly documentosSolicitudIncompletos = computed(() => {
    const sol = this.solicitud();
    const docs = sol?.documentosMetadata ?? sol?.documentos;
    return !Array.isArray(docs) || docs.length !== this.misDocumentos().length;
  });
  readonly documentosRespuestaIncompletos = computed(() => {
    const resp = this.solicitud()?.respuesta;
    const docs = resp?.documentosMetadata ?? resp?.documentos;
    return !Array.isArray(docs) || docs.length !== this.adjuntosRespuesta().length;
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
      if (!this.idValido(r.id) || vistos.has(r.id)) return false;
      vistos.add(r.id);
      return true;
    }).map(r => ({
      stage: String(r.id), num: r.numeroResolucion || '—',
      label: this.getEstadoDisplay(r.tipoResolucion), resultado: this.getEstadoDisplay(r.decision),
      docs: [
        ...this.mapDocumentos(r.documentos ?? [], 'resolucion', { resolucionId: r.id! }).map(doc => ({ ...doc,
          tipo: 'resolucion' as const, titulo: doc.nombre, subtitulo: r.numeroResolucion || 'Resolución registrada' })),
        ...(r.cedulas ?? []).filter(cedula => this.idValido(cedula.id) && cedula.destinatario === 'CIUDADANO').flatMap(cedula => this.mapDocumentos(cedula.documentos ?? [], 'resolucion', { cedulaNotificacionId: cedula.id! }).map(doc => ({ ...doc,
          tipo: 'cedula' as const, titulo: doc.nombre, subtitulo: cedula.numeroCedula || 'Cédula registrada' })))
      ]
    }));
  });

  private mapDocumentos(documentos: ReadonlyArray<DocumentoListItem>, origen: DocumentoDetalleItem['tipoOrigen'], relation: DocumentoRelation): DocumentoDetalleItem[] {
    const [key, id] = getDocumentoRelationEntry(relation);
    // Legacy DTOs have no relation fields: their association is the authorized nested DTO.
    // Explicit metadata must agree with that parent; never reinterpret another resource.
    return (Array.isArray(documentos) ? documentos : []).filter(doc => {
      if (!doc || !this.idValido(doc.id)) return false;
      const metadata = doc as Record<string, unknown>;
      const explicitRelation = DOCUMENTO_RELATION_KEYS.some(field => metadata[field] != null);
      return !explicitRelation || metadata[key] === id;
    }).map(doc => {
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
  private sesionActual = this.authService.cambiosSesion();
  private tokenDetalle: string | null = null;
  private sesionDetalle = -1;
  private consultaTribunal = new Subscription();

  constructor() {
    effect(() => {
      const sesion = this.authService.cambiosSesion();
      untracked(() => {
        const token = this.authService.getToken();
        if (token !== this.tokenActual || sesion !== this.sesionActual) {
          this.tokenActual = token;
          this.sesionActual = sesion;
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
    this.consultaTribunal.unsubscribe();
  }

  cargarSolicitud(expediente: string): void {
    this.expedienteActual = expediente;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
    this.consultaTribunal.unsubscribe();
    this.consultas = new Subscription();
    this.descargas = new Subscription();
    const generacion = ++this.generacion;
    const token = this.authService.getToken();
    const sesion = this.authService.cambiosSesion();
    this.tokenDetalle = null;
    this.sesionDetalle = -1;
    this.solicitud.set(null);
    this.apelacionDetalle.set(null);
    this.loadingApelacion.set(false);
    this.errorApelacion.set('');
    this.documentoError.set('');
    this.cerrarPreview();
    this.activeTab.set('solicitud');
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
        if (!this.esConsultaActual(generacion, token, sesion)) return;
        this.loading.set(false);
        if (!data) {
          this.estadoConsulta.set('vacio');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        if (!this.idValido(data.id) || data.expediente !== expediente ||
          (data.ciudadanoId != null && data.ciudadanoId !== this.authService.obtenerSesion()?.usuarioId)) {
          this.estadoConsulta.set('error');
          this.error.set('El servidor devolvió una solicitud que no corresponde al recurso consultado.');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        this.solicitud.set(data);
        this.tokenDetalle = token;
        this.sesionDetalle = sesion;
        this.estadoConsulta.set('disponible');
        this.cargarDocumentosTribunal();
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token, sesion)) return;
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
    if (!this.idValido(id) || !this.detalleActual()) return;
    this.consultaTribunal.unsubscribe();
    const generacion = this.generacion;
    const token = this.authService.getToken();
    const sesion = this.authService.cambiosSesion();
    this.apelacionDetalle.set(null);
    this.errorApelacion.set('');
    this.loadingApelacion.set(true);
    this.reintentarApelacion.set(false);
    this.consultaTribunal = this.apelacionService.findById(id).subscribe({
      next: data => {
        if (!this.esConsultaActual(generacion, token, sesion)) return;
        this.loadingApelacion.set(false);
        if (!data || data.id !== id ||
          (data.solicitudId != null && data.solicitudId !== this.solicitud()?.id) ||
          (data.ciudadanoId != null && data.ciudadanoId !== this.authService.obtenerSesion()?.usuarioId)) {
          this.errorApelacion.set('El servidor no devolvió el detalle documental de esta apelación.');
          this.reintentarApelacion.set(true);
          return;
        }
        this.apelacionDetalle.set(data);
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token, sesion)) return;
        const fallo = falloConsulta(error, 'los documentos del Tribunal');
        this.errorApelacion.set(fallo.mensaje);
        this.reintentarApelacion.set(fallo.reintentable);
        this.loadingApelacion.set(false);
      }
    });
  }

  private esConsultaActual(generacion: number, token: string | null, sesion = this.sesionDetalle): boolean {
    return generacion === this.generacion && token === this.authService.getToken() && sesion === this.authService.cambiosSesion();
  }

  private idValido(id: unknown): id is number { return typeof id === 'number' && Number.isSafeInteger(id) && id > 0; }

  private detalleActual(): boolean {
    return !!this.solicitud() && !!this.tokenDetalle && this.tokenDetalle === this.authService.getToken() &&
      this.sesionDetalle === this.authService.cambiosSesion();
  }

  cambiarTab(tab: RequestTabId): void {
    if (this.detalleActual() && this.tabs().some(item => item.id === tab)) this.activeTab.set(tab);
  }

  navegarTabs(event: KeyboardEvent, tab: RequestTabId): void {
    const tabs = this.tabs();
    const index = tabs.findIndex(item => item.id === tab);
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    this.cambiarTab(tabs[next].id);
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#tab-${tabs[next].id}`)?.focus();
  }

  private documentoActual(id: number | undefined): boolean {
    const docsCronograma = (this.ampliacionActiva()?.cronograma ?? [])
      .flatMap(h => (h.documentos ?? []).filter(d => this.idValido(d?.id)))
      .map(d => ({ id: d.id }));
    return this.detalleActual() && this.idValido(id) && [
      ...this.misDocumentos(), ...this.adjuntosRespuesta(), ...docsCronograma, ...this.notifStages().flatMap(stage => stage.docs)
    ].some(doc => doc.id === id);
  }

  isTabActive(tab: RequestTabId): boolean {
    return this.activeTab() === tab;
  }

  abrirModalPreview(doc: { id?: number; nombre: string; contentType?: string }): void {
    this.documentoError.set('');
    this.cerrarPreview();
    if (!this.documentoActual(doc.id)) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    this.previewTarget.set({ id: doc.id, nombre: doc.nombre, tipo: doc.contentType });
    this.isPreviewOpen.set(true);
  }

  cerrarPreview(): void {
    this.previewTarget.set(null);
    this.isPreviewOpen.set(false);
  }

  descargarDoc(doc: { id?: number; nombre: string }): void {
    this.documentoError.set('');
    if (!this.documentoActual(doc.id)) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.descargas.add(this.documentoService.download(doc.id!, doc.nombre).subscribe({
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
    if (upper === 'RECEPCIONADA') return 'Recepcionada';
    if (upper === 'EN_REVISION') return 'En revisión';
    if (this.enPrecisionSaip(upper)) return 'En precisión';
    if (upper === 'DENEGADA') return 'Denegada';
    if (upper === 'VENCIDA') return 'Vencida';
    if (upper === 'RESPONDIDA') return 'Respondida';
    if (upper === 'APELADA') return 'Apelada';
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  observaciones(): ObservacionSolicitud[] {
    const sol = this.solicitud();
    return (sol?.observaciones ?? []).filter(item => this.idValido(item.id) &&
      (item.solicitudId == null || item.solicitudId === sol?.id));
  }

  observacionPendiente(): ObservacionSolicitud | null {
    return this.observaciones().find((item) => item.estado === 'PENDIENTE_SUBSANACION') || null;
  }

  observacionSubsanada(): ObservacionSolicitud | null {
    return this.observaciones().find((item) => item.estado === 'SUBSANADA') || null;
  }

  ampliaciones(): AmpliacionPlazoSolicitud[] {
    const sol = this.solicitud();
    return (sol?.ampliacionesPlazo ?? []).filter(item => this.idValido(item.id) && item.solicitudId === sol?.id);
  }

  ampliacionActiva(): AmpliacionPlazoSolicitud | null {
    return this.ampliaciones().find(item => item.estadoAmpliacion !== 'CANCELADA') || null;
  }

  cronogramaEntregasOrdenadas() {
    return [...(this.ampliacionActiva()?.cronograma ?? [])].sort((a, b) => a.numeroEntrega - b.numeroEntrega);
  }

  cronogramaTotalCount(): number {
    return this.cronogramaEntregasOrdenadas().length;
  }

  cronogramaEntregadasCount(): number {
    return this.cronogramaEntregasOrdenadas().filter(h => h.estado === 'ENTREGADA').length;
  }

  cronogramaIncumplido(): boolean {
    const ampliacion = this.ampliacionActiva();
    return ampliacion?.cronograma?.some(h => h.ampliacionId === ampliacion.id && h.incumplida === true) ?? false;
  }

  readonly etiquetasDecisionHito = DECISIONES_ENTREGA;

  hitoDesfavorable(): boolean {
    const sol = this.solicitud();
    return !!sol && tieneHitoDesfavorable(sol);
  }

  ampliacionApelable(): AmpliacionPlazoSolicitud | undefined {
    const sol = this.solicitud();
    return sol ? ampliacionParaApelar(sol) : undefined;
  }

  encauzamientos(): EncauzamientoSolicitud[] {
    const sol = this.solicitud();
    return (sol?.encauzamientos ?? []).filter(item => this.idValido(item.id) && item.solicitudId === sol?.id);
  }

  encauzamientoActivo(): EncauzamientoSolicitud | null {
    return this.encauzamientos().find((item) => item.estadoEncauzamiento === 'REGISTRADO' || item.estadoEncauzamiento === 'DERIVADO') || null;
  }

  liquidaciones(): LiquidacionCostoSolicitud[] {
    const sol = this.solicitud();
    return (sol?.liquidacionesCosto ?? []).filter(item => this.idValido(item.id) && item.solicitudId === sol?.id);
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
    return formatosEntregaSolicitados(this.solicitud());
  }

  respuestaAunNoEmitida(): boolean {
    if (this.yaRespondio()) return false;
    const estado = (this.solicitud()?.estado || '').toUpperCase();
    return estado === 'RECEPCIONADA'
      || estado === 'EN_REVISION'
      || estado === 'EN_PROCESO'
      || this.enPrecisionSaip(estado);
  }

  puedeApelar(): boolean {
    const sol = this.solicitud();
    return !!sol && (sol.estado === 'RESPONDIDA' || sol.estado === 'DENEGADA' || sol.estado === 'VENCIDA'
      || this.esSilencioAdministrativo() || this.cronogramaIncumplido() || this.hitoDesfavorable()
      || this.ampliacionApelable()?.plazoOrdinarioVencido === true) && !this.enApelacion();
  }

  esSilencioAdministrativo(): boolean {
    const sol = this.solicitud();
    return !!sol && !this.observacionPendiente() && !this.enPrecisionSaip(sol.estado)
      && isSilencioAdministrativo(sol);
  }

  private enPrecisionSaip(estado?: string): boolean {
    return ['PENDIENTE_INFORMACION', 'EN_PRECISION', 'OBSERVADA'].includes((estado || '').toUpperCase());
  }

  isApelacionResuelta(): boolean {
    const estado = this.solicitud()?.apelacion?.estado || '';
    return estado.startsWith('RESUELTO') || estado.startsWith('CONCLUSION') || estado === 'TENER_POR_NO_PRESENTADO' || !!this.solicitud()?.apelacion?.resultado;
  }

  showSubsanarAction(): boolean {
    return this.solicitud()?.apelacion?.estado === 'EN_SUBSANACION';
  }

  private formatTimelineDate(dateStr?: string | null): string {
    return fechaVisible(dateStr, 'corta') || dateStr || '—';
  }

  textoFecha(dateStr?: string | null): string {
    return fechaVisible(dateStr, 'numerica');
  }

  private formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return 'Tamaño no registrado';
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Only recorded acts enter this view. Current status is a separate summary,
  // not evidence that intermediate acts, delivery or notifications occurred.
  buildCitizenTimeline(sol: Solicitud): TimelineEvent[] {
    const events: (TimelineEvent & { fechaOrden: number | null; secuencia: number })[] = [];
    const add = (title: string, description: string, date: string | null | undefined,
      icon: TimelineEvent['icon'], secuencia: number, instancia: 1 | 2 = 1) => {
      events.push({
        title, description, date: this.formatTimelineDate(date), icon, instancia, status: 'completed',
        fechaOrden: diaCalendario(date), secuencia
      });
    };
    if (sol.fechaPresentacion) add('Solicitud presentada', 'Registro de la solicitud SAIP.', sol.fechaPresentacion, 'mail', 10);
    for (const obs of sol.observaciones ?? []) {
      if (!this.idValido(obs.id) || (obs.solicitudId != null && obs.solicitudId !== sol.id)) continue;
      add('Solicitud de precisión', this.resumenPrecision(obs.estado), obs.fechaObservacion, 'search', 20);
      if (obs.estado === 'SUBSANADA') add('Precisión registrada', obs.comentarioSubsanacion || 'Respuesta del administrado registrada.', obs.fechaSubsanacion, 'filecheck', 30);
    }
    for (const enc of sol.encauzamientos ?? []) {
      if (!this.idValido(enc.id) || enc.solicitudId !== sol.id) continue;
      add('Encauzamiento registrado', enc.motivoEncauzamiento || 'Motivo no registrado.', enc.fechaEncauzamiento, 'search', 40);
    }
    for (const amp of sol.ampliacionesPlazo ?? []) {
      if (!this.idValido(amp.id) || amp.solicitudId !== sol.id) continue;
      add('Ampliación registrada', amp.motivoAmpliacion || amp.informeAmpliacion || 'Motivo no registrado.', amp.fechaSolicitudAmpliacion || amp.fechaNotificacionAmpliacion, 'search', 50);
      for (const hito of [...(amp.cronograma ?? [])].sort((a, b) => a.numeroEntrega - b.numeroEntrega)) {
        if (hito.estado !== 'ENTREGADA') continue;
        const docsCount = (hito.documentos ?? []).filter(d => this.idValido(d?.id)).length;
        const suffix = docsCount > 0 ? ` · ${docsCount} ${docsCount === 1 ? 'documento' : 'documentos'}` : '';
        const programada = this.textoFecha(hito.fechaProgramada);
        const cuando = programada ? ` Programada para el ${programada}.` : '';
        add(
          `Entrega parcial ${hito.numeroEntrega}`,
          `${hito.decision ? DECISIONES_ENTREGA[hito.decision] + ' · ' : ''}${hito.descripcion || 'Entrega programada registrada'}.${cuando}${suffix}`,
          hito.fechaEntregaReal || hito.fechaProgramada,
          'filecheck',
          60 + (hito.numeroEntrega || 0)
        );
      }
    }
    for (const liq of sol.liquidacionesCosto ?? []) {
      if (!this.idValido(liq.id) || liq.solicitudId !== sol.id) continue;
      add('Liquidación registrada', liq.concepto || 'Concepto no registrado.', liq.fechaEmision, 'mail', 80);
      if (liq.estadoLiquidacion === 'PAGADA' && liq.fechaPago) add('Pago registrado', 'Pago registrado por la entidad.', liq.fechaPago, 'filecheck', 81);
      if (liq.estadoLiquidacion === 'RECOGIDA') add('Recojo registrado', 'Recojo registrado por la entidad.', liq.fechaRecojo, 'filecheck', 82);
    }
    if (this.idValido(sol.respuesta?.id)) {
      add('Respuesta de la entidad', this.respLabel(), sol.respuesta?.fechaRespuesta, 'filecheck', 90);
    }
    const ap = sol.apelacion;
    if (this.idValido(ap?.id)) {
      add('Apelación registrada', ap?.expediente || 'Numeración TTAIP no registrada.', ap?.fechaApelacion, 'gavel', 100, 2);
      const detalle = this.apelacionDetalle();
      if (detalle) {
        const vistos = new Set<number>();
        for (const res of [...(detalle.resoluciones ?? []), detalle.resolucionPrimeraCalificacion,
          detalle.resolucionSegundaCalificacion, detalle.resolucion]) {
          if (!res || !this.idValido(res.id) || vistos.has(res.id)) continue;
          vistos.add(res.id);
          add(this.getEstadoDisplay(res.tipoResolucion), res.decision ? this.getEstadoDisplay(res.decision) : 'Decisión no registrada.', res.fechaResolucion, 'scale', 110, 2);
        }
      }
    }
    const dated = events.filter(event => event.fechaOrden !== null)
      .sort((a, b) => a.fechaOrden! - b.fechaOrden! || a.secuencia - b.secuencia);
    const undated = events.filter(event => event.fechaOrden === null).sort((a, b) => a.secuencia - b.secuencia);
    return [...dated, ...undated].map(({ fechaOrden, secuencia, ...event }) => event);
  }

  timelineDisplayOrder(steps: TimelineEvent[]): TimelineEvent[] {
    return [...steps].reverse();
  }

  private resumenPrecision(estado: string): string {
    switch (estado) {
      case 'PENDIENTE_SUBSANACION': return 'En espera de su precisión.';
      case 'SUBSANADA': return 'La observación fue subsanada.';
      case 'NO_SUBSANADA': return 'La observación quedó sin subsanar.';
      case 'ARCHIVADA': return 'La observación fue archivada.';
      default: return 'La entidad pidió precisar su solicitud.';
    }
  }
}

function diaCalendario(valor?: string | null): number | null {
  const iso = fechaIsoCalendario(valor);
  if (iso) return Number(iso.anio) * 10000 + Number(iso.mes) * 100 + Number(iso.dia);
  if (!valor) return null;
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return null;
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
  const [anio, mes, dia] = partes.split('-');
  return Number(anio) * 10000 + Number(mes) * 100 + Number(dia);
}

function fechaVisible(valor: string | null | undefined, formato: 'corta' | 'numerica'): string {
  const iso = fechaIsoCalendario(valor);
  if (iso) {
    if (formato === 'numerica') return `${iso.dia}/${iso.mes}/${iso.anio}`;
    const fecha = new Date(Date.UTC(Number(iso.anio), Number(iso.mes) - 1, Number(iso.dia), 12));
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  if (!valor) return '';
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return valor;
  return parsed.toLocaleDateString('es-PE', formato === 'numerica'
    ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' });
}

function fechaIsoCalendario(valor?: string | null): { anio: string; mes: string; dia: string } | null {
  const iso = valor ? /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(valor.trim()) : null;
  return iso ? { anio: iso[1], mes: iso[2], dia: iso[3] } : null;
}
