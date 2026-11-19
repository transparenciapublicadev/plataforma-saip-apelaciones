import { ReferenceTabsDirective } from '../../shared/reference-tabs.directive';
import { forkJoin, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { falloConsulta } from '../../utils/consulta-remota.util';
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, effect, computed, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService, PlazoSeguimientoDTO } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { EntidadService } from '../../services/entidad.service';
import {
  AlcanceEncauzamientoSolicitud,
  AmpliacionPlazoSolicitud,
  CanalNotificacion,
  CronogramaEntregaParcial,
  EncauzamientoSolicitud,
  LiquidacionCostoSolicitud,
  ObservacionSolicitud,
  RegistrarEntregaParcialPayload,
  Solicitud
} from '../../models/solicitud.model';
import { Entidad } from '../../models/entidad.model';
import { aISO, habilesEntre, hoyLima, sumarDias } from '../../models/calendario.model';
import { canNavigateToResponse, positiveId } from './funcionario-dashboard.model';
import { documentosDelRecurso, modalidadesRegistradas, detalleConRelacionesVerificadas } from './entity-request-detail.model';
import { descripcionSinNotasInternas, entregaFisicaSinPublicacionDigital, esEvidenciaRecojo } from '../../utils/modalidad-entrega.util';
import { DocumentoService } from '../../services/documento.service';
import { problemDetailsMessage } from '../../utils/problem-details.util';
import {
  CronogramaEntregasPanelComponent,
  HitoPanelMessage,
  RegistroEntregaHitoEvent
} from '../../shared/cronograma-entregas-panel.component';
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from '../../shared/document-preview-modal.component';

type DetailTabId = 'respuesta' | 'solicitud' | 'ciudadano' | 'adjuntos' | 'notificaciones' | 'historial' | 'observacion' | 'encauzamiento' | 'liquidacion' | 'ampliacion' | 'cronograma';

interface DetailTab {
  id: DetailTabId;
  label: string;
}

export interface DocRowItem {
  id?: number | null;
  raw: any;
  nombre: string;
  tipo: string;
  tamano: string;
}

interface HistorialItem {
  accion: string;
  fecha: string;
  responsable: string;
  detalle: string;
  color: 'brand' | 'warning' | 'success' | 'muted' | 'violet';
}

import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { MultiFileUploadZoneComponent } from '../../shared/multi-file-upload-zone.component';
import { AreaResponsablePanelComponent } from '../../shared/area-responsable-panel.component';
import {
  LucideArrowLeft, LucideSend, LucideClock,
  LucideAlertTriangle, LucideCalendar, LucideFileText, LucideCheckCircle2,
  LucideScale, LucideChevronRight, LucideEye, LucideDownload,
  LucideArchive, LucidePackageCheck
} from '@lucide/angular';

@Component({
  selector: 'app-funcionario-solicitud-detalle',
  imports: [
    CommonModule, FormsModule, RouterLink, ReferenceTabsDirective,
    DocumentPreviewModalComponent,
    StatusBadgeComponent,
    MultiFileUploadZoneComponent,
    AreaResponsablePanelComponent,
    CronogramaEntregasPanelComponent,
    LucideArrowLeft, LucideSend, LucideClock,
    LucideAlertTriangle, LucideCalendar, LucideFileText, LucideCheckCircle2,
    LucideScale, LucideChevronRight, LucideEye, LucideDownload,
    LucideArchive, LucidePackageCheck
  ],
  templateUrl: './funcionario-solicitud-detalle.component.html',
  styleUrl: './funcionario-solicitud-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioSolicitudDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router, { optional: true });
  private readonly solicitudService = inject(SolicitudService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private readonly entidadService = inject(EntidadService);

  readonly Math = Math;

  solicitud = signal<Solicitud | null>(null);
  plazoSeguimiento = signal<PlazoSeguimientoDTO | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');

  evaluarSubsanacion(observacion: ObservacionSolicitud, aceptada: boolean): void {
    const sol = this.solicitud();
    if (!sol?.id) return;
    const nuevoEstado = aceptada ? 'EN_REVISION' : 'CONCLUIDA';
    this.solicitudService.cambiarEstado(sol.id, nuevoEstado).subscribe({
      next: () => {
        if (sol.expediente) this.cargarSolicitud(sol.expediente);
      },
      error: () => {
        if (sol.expediente) this.cargarSolicitud(sol.expediente);
      }
    });
  }
  reintentable = signal(false);
  previasError = signal('');
  previasLoading = signal(false);
  informacionIncompleta = signal(false);
  plazoError = signal('');
  documentoError = signal('');
  private consultas = new Subscription();
  private navegacion?: Subscription;
  private generacion = 0;
  private destruido = false;
  private expedienteActual = '';
  private sesionActual = this.claveSesion();
  private sesionDetalle = '';
  constructor() {
    effect(() => {
      this.authService.cambiosSesion?.();
      const sesion = this.claveSesion();
      if (sesion !== this.sesionActual) {
        untracked(() => {
          this.sesionActual = sesion; this.generacion++; this.consultas.unsubscribe(); this.limpiarConsulta();
          this.loading.set(false); this.reintentable.set(false);
          this.error.set('La sesión cambió. Abra nuevamente el expediente con la cuenta actual.');
        });
      }
    });
  }
  private claveSesion(): string {
    const s = this.authService.obtenerSesion();
    return JSON.stringify([s?.token, s?.usuarioId, s?.funcionarioId, s?.entidadId]);
  }
  private limpiarConsulta(): void {
    this.sesionDetalle = '';
    this.solicitud.set(null); this.plazoSeguimiento.set(null); this.previewTarget.set(null);
    this.solicitudesPrevias.set([]); this.previasError.set(''); this.plazoError.set(''); this.documentoError.set('');
    this.previasLoading.set(false); this.informacionIncompleta.set(false); this.activeTab.set('solicitud');
    this.observacionMotivo.set(''); this.observacionError.set(''); this.observacionSuccess.set(''); this.observacionLoading.set(false);
    this.ampliacionMotivo.set(''); this.ampliacionInforme.set(''); this.ampliacionError.set(''); this.ampliacionSuccess.set(''); this.ampliacionLoading.set(false);
    this.ampliacionFechaNotificacion.set(''); this.ampliacionCronograma.set([this.crearEntregaForm(1)]);
    this.fechaEntregaHito.set({}); this.archivosPorHito.set({}); this.hitoRegistrandoId.set(null);
    this.hitoExitoId.set(null); this.cronogramaHitoError.set(null);
    this.encauzamientoMotivo.set(''); this.encauzamientoSustento.set(''); this.encauzamientoEntidadDestinoId.set(null);
    this.encauzamientoError.set(''); this.encauzamientoSuccess.set(''); this.encauzamientoLoading.set(false);
    this.liquidacionCodigo.set(''); this.liquidacionMonto.set(''); this.liquidacionConcepto.set(''); this.liquidacionObservacion.set('');
    this.liquidacionFechaNotificacion.set('');
    this.liquidacionError.set(''); this.liquidacionSuccess.set(''); this.liquidacionLoading.set(false); this.liquidacionUpdateLoading.set(false);
    this.archivoCargo.set(null); this.archivoComprobante.set(null); this.archivoIdentidad.set(null); this.motivoArchivo.set('NO_RECOJO');
  }
  ngOnDestroy(): void { this.destruido = true; this.generacion++; this.consultas.unsubscribe(); this.navegacion?.unsubscribe(); }
  reintentarConsulta(): void { if (this.reintentable()) this.cargarSolicitud(this.expedienteActual); }
  activeTab = signal<DetailTabId>('solicitud');
  solicitudesPrevias = signal<Solicitud[]>([]);
  observacionMotivo = signal<string>('');
  observacionLoading = signal<boolean>(false);
  observacionError = signal<string>('');
  observacionSuccess = signal<string>('');
  ampliacionMotivo = signal<string>('');
  ampliacionInforme = signal<string>('');
  ampliacionFechaNotificacion = signal<string>('');
  ampliacionCronograma = signal<RegistrarEntregaParcialPayload[]>([this.crearEntregaForm(1)]);
  ampliacionLoading = signal<boolean>(false);
  ampliacionError = signal<string>('');
  ampliacionSuccess = signal<string>('');
  fechaEntregaHito = signal<Record<number, string>>({});
  archivosPorHito = signal<Record<number, File[]>>({});
  hitoRegistrandoId = signal<number | null>(null);
  hitoExitoId = signal<number | null>(null);
  cronogramaHitoError = signal<HitoPanelMessage | null>(null);
  entidadesActivas = signal<Entidad[]>([]);
  encauzamientoEntidadDestinoId = signal<number | null>(null);
  encauzamientoAlcance = signal<AlcanceEncauzamientoSolicitud>('TOTAL');
  encauzamientoMotivo = signal<string>('');
  encauzamientoSustento = signal<string>('');
  encauzamientoLoading = signal<boolean>(false);
  encauzamientoError = signal<string>('');
  encauzamientoSuccess = signal<string>('');
  liquidacionCodigo = signal<string>('');
  liquidacionMonto = signal<string>('');
  liquidacionMoneda = signal<string>('PEN');
  liquidacionConcepto = signal<string>('');
  liquidacionFechaNotificacion = signal<string>('');
  liquidacionMedioNotificacion = signal<CanalNotificacion>('CASILLA_ELECTRONICA');
  liquidacionObservacion = signal<string>('');
  liquidacionLoading = signal<boolean>(false);
  liquidacionError = signal<string>('');
  liquidacionSuccess = signal<string>('');
  liquidacionUpdateLoading = signal<boolean>(false);
  archivoCargo = signal<File | null>(null);
  archivoComprobante = signal<File | null>(null);
  archivoIdentidad = signal<File | null>(null);
  motivoArchivo = signal<'NO_RECOJO' | 'SIN_ACREDITACION_DE_PAGO'>('NO_RECOJO');

  previewTarget = signal<DocumentPreviewTarget | null>(null);

  esAnexo(nombre: string): boolean {
    return /^\s*anexo/i.test(nombre);
  }

  limpiarNombre(nombre: string): string {
    return nombre.replace(/^\s*(principal|anexo\s*\d*)\s*[—-]\s*/i, '').trim();
  }

  etiquetaAnexo(nombre: string): string {
    const match = nombre.match(/^\s*anexo\s*(\d+)/i);
    return match ? `Anexo ${match[1]}` : 'Anexo';
  }

  readonly todosDocumentosAdministrado = computed(() => {
    const sol = this.solicitud();
    if (!sol) return [];
    return documentosDelRecurso(sol.documentosMetadata ?? sol.documentos, { solicitudId: sol.id });
  });

  private mapToDocRow(d: any): DocRowItem {
    const nombre = d.nombreOriginal || d.nombreArchivo || d.nombre || 'Documento';
    const tipo = d.contentType || d.tipoArchivo || d.tipoDocumento || 'Tipo no informado';
    return {
      id: d.id,
      raw: d,
      nombre,
      tipo,
      tamano: this.tamanoDoc(d)
    };
  }

  readonly grupoPrincipales = computed<DocRowItem[]>(() => {
    return this.todosDocumentosAdministrado()
      .filter((d: any) => {
        const tipo = (d.tipoDocumento || d.tipoArchivo || d.tipo || '').toUpperCase();
        const nombre = d.nombreOriginal || d.nombreArchivo || d.nombre || '';
        return tipo !== 'SUBSANACION' && !this.esAnexo(nombre) && !esEvidenciaRecojo(nombre);
      })
      .map(d => this.mapToDocRow(d));
  });

  readonly grupoAnexos = computed<DocRowItem[]>(() => {
    return this.todosDocumentosAdministrado()
      .filter((d: any) => {
        const tipo = (d.tipoDocumento || d.tipoArchivo || d.tipo || '').toUpperCase();
        const nombre = d.nombreOriginal || d.nombreArchivo || d.nombre || '';
        return tipo !== 'SUBSANACION' && this.esAnexo(nombre) && !esEvidenciaRecojo(nombre);
      })
      .map(d => this.mapToDocRow(d));
  });

  readonly grupoSubsanaciones = computed<DocRowItem[]>(() => {
    return this.todosDocumentosAdministrado()
      .filter((d: any) => {
        const tipo = (d.tipoDocumento || d.tipoArchivo || d.tipo || '').toUpperCase();
        return tipo === 'SUBSANACION';
      })
      .map(d => this.mapToDocRow(d));
  });

  readonly evidenciasRecojo = computed<DocRowItem[]>(() => {
    const respuesta = this.solicitud()?.respuesta;
    const deRespuesta = respuesta
      ? documentosDelRecurso(respuesta.documentosMetadata ?? respuesta.documentos, { respuestaId: respuesta.id })
      : [];
    return [...this.todosDocumentosAdministrado(), ...deRespuesta]
      .filter((d: any) => esEvidenciaRecojo(d.nombreOriginal || d.nombreArchivo || d.nombre))
      .map(d => this.mapToDocRow(d));
  });

  readonly documentosRespuestaEntidad = computed<DocRowItem[]>(() => {
    const sol = this.solicitud();
    const respuesta = sol?.respuesta;
    if (!respuesta) return [];
    return documentosDelRecurso(respuesta.documentosMetadata ?? respuesta.documentos, { respuestaId: respuesta.id })
      .filter((d: any) => !esEvidenciaRecojo(d.nombreOriginal || d.nombreArchivo || d.nombre))
      .map(d => this.mapToDocRow(d));
  });

  readonly formatoEntrega = computed<string>(() => {
    return this.formatosSolicitados().join(' · ') || 'Modalidad no informada';
  });

  readonly funcionarioResponsable = computed<string>(() => {
    const sol = this.solicitud();
    return sol?.respuesta?.funcionarioNombre || 'Funcionario no informado';
  });

  readonly esRespuestaAceptada = computed<boolean>(() => {
    const sol = this.solicitud();
    const tipo = sol?.respuesta?.tipoRespuesta;
    return tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL';
  });

  abrirDocPreview(doc: any): void {
    const actual = this.documentoActual(doc);
    if (!actual) { this.documentoError.set('El documento no pertenece al contexto recuperable de este expediente.'); return; }
    this.documentoError.set('');
    const d = actual.raw, nombre = actual.nombre;
    this.previewTarget.set({
      id: d.id,
      nombre,
      tipo: d.contentType || d.tipoArchivo,
      expediente: this.solicitud()?.expediente
    });
  }

  private documentoActual(doc: any): DocRowItem | null {
    if (!this.contextoVigente()) return null;
    const id = doc?.raw?.id ?? doc?.id;
    return positiveId(id) ? [...this.todosDocumentosAdministrado().map(item => this.mapToDocRow(item)),
      ...this.documentosRespuestaEntidad(),
      ...this.evidenciasRecojo()].find(item => item.id === id) ?? null : null;
  }

  contextoVigente(): boolean {
    return !this.destruido && !!this.solicitud() && this.sesionDetalle === this.claveSesion()
      && this.solicitud()?.expediente === this.expedienteActual;
  }

  descargarDoc(doc: any): void {
    const actual = this.documentoActual(doc);
    if (!actual) { this.documentoError.set('Documento sin identificador o relación recuperable en este expediente. No se puede descargar.'); return; }
    const d = actual.raw, nombre = actual.nombre;
    this.documentoError.set('');
    const generacion = this.generacion, sesion = this.claveSesion();
    const vigente = () => !this.destruido && generacion === this.generacion && sesion === this.claveSesion();
    if (d.id) {
      this.consultas.add(this.documentoService.download(d.id, nombre).subscribe({
        next: ({ blob }) => {
          if (!vigente()) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = nombre;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
        error: err => { if (vigente()) this.documentoError.set(falloConsulta(err, 'el documento').mensaje); }
      }));
    } else this.documentoError.set('Documento sin identificador recuperable. No se puede descargar.');
  }

  tamanoDoc(doc: any): string {
    const bytes = doc.tamanoBytes ?? doc.sizeBytes ?? doc.tamanio ?? doc.size ?? doc.tamano;
    if (typeof bytes === 'number' && bytes >= 0) {
      if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }
      return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
    }
    return 'Tamaño no informado';
  }

  readonly formatosSolicitados = computed(() => {
    return modalidadesRegistradas(this.solicitud());
  });

  aplicarArea(actualizada: Solicitud): void {
    this.solicitud.set(actualizada);
  }

  readonly yaRespondida = computed<boolean>(() => {
    return positiveId(this.solicitud()?.respuesta?.id);
  });

  readonly tabs = computed<DetailTab[]>(() => {
    const base: DetailTab[] = [];
    if (this.yaRespondida()) {
      base.push({ id: 'respuesta', label: 'Respuesta' });
    }
    if (this.liquidaciones().length > 0) {
      base.push({ id: 'liquidacion', label: 'Entrega física' });
    }
    if (this.enPrecision() || this.observaciones().length > 0) {
      base.push({ id: 'observacion', label: 'Precisión' });
    }
    if (this.ampliaciones().some(item => item.estadoAmpliacion !== 'CANCELADA')) {
      base.push({ id: 'cronograma', label: 'Cronograma' });
    }
    if (this.encauzamientos().length > 0) {
      base.push({ id: 'encauzamiento', label: 'Encauzamiento' });
    }
    base.push(
      { id: 'solicitud', label: 'Solicitud' },
      { id: 'ciudadano', label: 'Administrado' },
      { id: 'adjuntos', label: 'Documentos del administrado' }
    );

    if (this.solicitud()?.apelacion) {
      base.push({ id: 'notificaciones', label: 'Resoluciones y cédulas' });
    }

    base.push({ id: 'historial', label: 'Historial' });

    return base;
  });

  readonly historialItems = computed<HistorialItem[]>(() => {
    const sol = this.solicitud();
    if (!sol) {
      return [];
    }

    const origen = this.encauzamientos().find(item => item.entidadOrigenNombre)?.entidadOrigenNombre;
    const items: HistorialItem[] = [
      {
        accion: 'Solicitud presentada',
        fecha: sol.fechaPresentacion,
        responsable: 'Registrada en Yaiku',
        detalle: origen
          ? `El administrado presentó la solicitud ante ${origen}.`
          : sol.entidadNombre?.trim()
            ? `Solicitud registrada y asignada a ${sol.entidadNombre.trim()}.`
            : 'Solicitud registrada. La entidad responsable no figura en el expediente.',
        color: 'brand'
      }
    ];

    if (positiveId(sol.respuesta?.id)) {
      items.push({
        accion: `Respuesta registrada · ${this.getResultadoLabel()}`,
        fecha: sol.respuesta!.fechaRespuesta || '',
        responsable: sol.respuesta!.funcionarioNombre || 'Funcionario no informado',
        detalle: 'La entidad registró respuesta para el ciudadano.',
        color: this.esRespuestaEntrega() ? 'success' : 'warning'
      });
    }

    for (const observacion of this.observaciones()) {
      items.push({
        accion: 'Solicitud de precisión',
        fecha: observacion.fechaObservacion,
        responsable: observacion.responsableObservacion || 'Entidad pública',
        detalle: this.resumenObservacion(observacion.estado),
        color: observacion.estado === 'SUBSANADA' ? 'success' : (observacion.estado === 'NO_SUBSANADA' ? 'warning' : 'muted')
      });
      if (observacion.estado === 'SUBSANADA') {
        items.push({
          accion: 'Subsanación ciudadana recibida',
        fecha: observacion.fechaSubsanacion || '',
          responsable: observacion.responsableSubsanacion || 'Ciudadano',
          detalle: observacion.comentarioSubsanacion || observacion.documentoSubsanacionNombre || 'Subsanación registrada.',
          color: 'success'
        });
      }
    }

    for (const ampliacion of this.ampliaciones()) {
      items.push({
        accion: `Ampliación de plazo · ${this.getAmpliacionEstadoDisplay(ampliacion.estadoAmpliacion)}`,
        fecha: ampliacion.fechaSolicitudAmpliacion,
        responsable: ampliacion.responsable || 'Entidad pública',
        detalle: `Plazo ampliado de ${ampliacion.fechaLimiteOriginal} a ${ampliacion.fechaLimiteAmpliada}.`,
        color: ampliacion.estadoAmpliacion === 'COMPLETADA' ? 'success' : 'warning'
      });
    }

    for (const encauzamiento of this.encauzamientos()) {
      items.push({
        accion: `Encauzamiento ${this.getEncauzamientoAlcanceDisplay(encauzamiento.alcance)} · ${this.getEncauzamientoEstadoDisplay(encauzamiento.estadoEncauzamiento)}`,
        fecha: encauzamiento.fechaEncauzamiento,
        responsable: encauzamiento.responsable || 'Entidad pública',
        detalle: `${encauzamiento.entidadOrigenNombre} -> ${encauzamiento.entidadDestinoNombre}. ${encauzamiento.motivoEncauzamiento}`,
        color: encauzamiento.alcance === 'TOTAL' ? 'warning' : 'brand'
      });
    }

    for (const liquidacion of this.liquidaciones()) {
      items.push({
        accion: `Liquidación · ${this.getLiquidacionEstadoDisplay(liquidacion.estadoLiquidacion)}`,
        fecha: liquidacion.fechaEmision,
        responsable: liquidacion.responsable || 'Entidad pública',
        detalle: `${liquidacion.codigoLiquidacion} por ${liquidacion.moneda} ${liquidacion.monto}. Límite de recojo: ${liquidacion.fechaLimiteRecojo}.`,
        color: liquidacion.estadoLiquidacion === 'RECOGIDA' ? 'success' : (liquidacion.estadoLiquidacion === 'ARCHIVADA' ? 'warning' : 'brand')
      });
    }

    if (sol.apelacion?.expediente) {
      items.push({
        accion: `Apelación presentada · ${this.getEstadoDisplay(sol.apelacion.estado || '')}`,
        fecha: sol.apelacion.fechaApelacion,
        responsable: 'Ciudadano recurrente',
        detalle: 'Apelación vinculada en la solicitud; consulte su detalle para las actuaciones del Tribunal.',
        color: 'violet'
      });
    }

    return items
      .map((item, orden) => ({ item, orden, fecha: aISO(item.fecha) ?? '' }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.orden - a.orden)
      .map(entry => entry.item);
  });

  readonly observaciones = computed<ObservacionSolicitud[]>(() => this.solicitud()?.observaciones || []);

  readonly idApelacion = computed<string>(() => this.solicitud()?.apelacion?.expediente || '');

  readonly ampliaciones = computed<AmpliacionPlazoSolicitud[]>(() => this.solicitud()?.ampliacionesPlazo || []);

  readonly encauzamientos = computed<EncauzamientoSolicitud[]>(() => this.solicitud()?.encauzamientos || []);

  readonly liquidaciones = computed<LiquidacionCostoSolicitud[]>(() => this.solicitud()?.liquidacionesCosto || []);

  readonly observacionPendiente = computed<ObservacionSolicitud | null>(() =>
    this.observaciones().find((item) => item.estado === 'PENDIENTE_SUBSANACION') || null
  );
  readonly enPrecision = computed(() =>
    this.solicitud()?.estado === 'PENDIENTE_INFORMACION' || this.observacionPendiente() !== null
  );

  readonly ampliacionActiva = computed<AmpliacionPlazoSolicitud | null>(() =>
    this.ampliaciones().find((item) => item.estadoAmpliacion === 'REGISTRADA' || item.estadoAmpliacion === 'NOTIFICADA') || null
  );

  readonly encauzamientoActivo = computed<EncauzamientoSolicitud | null>(() =>
    this.encauzamientos().find((item) => item.estadoEncauzamiento === 'REGISTRADO' || item.estadoEncauzamiento === 'DERIVADO') || null
  );

  readonly liquidacionActiva = computed<LiquidacionCostoSolicitud | null>(() =>
    this.liquidaciones().find((item) =>
      item.estadoLiquidacion === 'EMITIDA' || item.estadoLiquidacion === 'NOTIFICADA' || item.estadoLiquidacion === 'PAGADA') || null
  );

  readonly observacionesAnteriores = computed(() =>
    this.observaciones().filter(observacion => observacion.id !== this.observacionPendiente()?.id)
  );

  ngOnInit(): void {
    const params = this.route.paramMap;
    if (params) this.navegacion = params.subscribe(p => this.cargarSolicitud(p.get('expediente') || ''));
    else this.cargarSolicitud(this.route.snapshot.paramMap.get('expediente') || '');
  }

  cargarSolicitud(expediente: string, preferredTab?: DetailTabId): void {
    if (this.destruido) return;
    const generacion = ++this.generacion, sesion = this.claveSesion();
    this.expedienteActual = expediente;
    this.consultas.unsubscribe(); this.consultas = new Subscription(); this.limpiarConsulta();
    this.error.set(''); this.reintentable.set(false); this.loading.set(true);
    const vigente = () => !this.destruido && generacion === this.generacion && sesion === this.claveSesion();
    if (!expediente) { this.error.set('No se recibió el expediente de la solicitud.'); this.loading.set(false); return; }
    this.consultas.add(this.solicitudService.findByExpediente(expediente).subscribe({
      next: data => {
        if (!vigente()) return;
        this.loading.set(false);
        if (!data) return;
        if (!positiveId(data.id) || data.expediente !== expediente) {
          this.error.set('La respuesta está incompleta o no corresponde al expediente solicitado.'); return;
        }
        const verified = detalleConRelacionesVerificadas(data);
        this.sesionDetalle = sesion;
        this.solicitud.set(verified.solicitud); this.informacionIncompleta.set(verified.incompleta);
        this.inicializarFechasCronograma(verified.solicitud);
        const initial = this.observacionPendiente() && !this.yaRespondida()
          ? 'observacion'
          : this.cronogramaPendiente()
            ? 'cronograma'
            : this.encauzamientoActivo() && !this.yaRespondida()
              ? 'encauzamiento'
              : this.puedeVerRespuesta() ? 'respuesta' : 'solicitud';
        this.activeTab.set(preferredTab && this.tabs().some(tab => tab.id === preferredTab) ? preferredTab : initial);
        if (!this.enPrecision()) this.consultas.add(this.solicitudService.obtenerSeguimientoPlazo(data.id).subscribe({
          next: plazo => {
            if (!vigente()) return;
            if (plazo && Number.isSafeInteger(plazo.diasRestantes)) this.plazoSeguimiento.set(plazo);
            else if (this.getDiasRestantes() === null) this.plazoError.set('Seguimiento del plazo incompleto.');
          },
          error: () => { if (vigente() && this.getDiasRestantes() === null) this.plazoError.set('Seguimiento del plazo no disponible. Se conserva la fecha límite registrada.'); }
        }));
        if (data.ciudadanoId) this.cargarSolicitudesPrevias(data.ciudadanoId, data.expediente, vigente);
      },
      error: err => {
        if (!vigente()) return;
        const fallo = falloConsulta(err, 'la solicitud'); this.error.set(fallo.mensaje);
        this.reintentable.set(fallo.reintentable); this.loading.set(false);
      }
    }));
  }

  cargarSolicitudesPrevias(ciudadanoId: number, currentExpediente?: string, vigente: () => boolean = () => true): void {
    if (!vigente()) return;
    // GET /ciudadano/{id} is for that citizen or TTAIP/admin, not this institutional route.
    // Do not obtain a broader list merely to reconstruct a private citizen history here.
    this.solicitudesPrevias.set([]); this.previasLoading.set(false);
    this.previasError.set('Consulta de solicitudes previas no disponible para el funcionario en este detalle. No se consulta el historial privado del administrado.');
  }

  temaInformacion(): string {
    return this.solicitud()?.tipoInformacion?.trim() || 'No indicado';
  }

  getResultadoLabel(): string {
    const tipo = this.getTipoRespuestaDisplay();
    if (tipo === 'DENEGACION_TOTAL') return 'Denegada';
    if (tipo === 'ENTREGA_PARCIAL') return 'Entrega parcial';
    if (tipo === 'ENTREGA_TOTAL') return 'Entrega total';
    if (tipo === 'SILENCIO_ADMINISTRATIVO') return 'Silencio administrativo';
    return 'Tipo no informado';
  }

  getResultadoColor(): string {
    const tipo = this.getTipoRespuestaDisplay();
    if (tipo === 'DENEGACION_TOTAL' || tipo === 'SILENCIO_ADMINISTRATIVO') return 'var(--brand-700)';
    return tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL' ? 'var(--success)' : 'var(--muted-foreground)';
  }

  getIniciales(nombre?: string): string {
    if (!nombre) return '—';
    return nombre.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '—';
  }

  cambiarTab(tab: DetailTabId): void {
    if (this.tabs().some(item => item.id === tab)) this.activeTab.set(tab);
  }

  esEntidadResponsable(): boolean {
    const sol = this.solicitud();
    const entidad = this.authService.obtenerSesion()?.entidadId;
    if (!sol || !entidad) return true;
    return sol.entidadId === entidad;
  }

  puedeResponder(): boolean {
    const sol = this.solicitud();
    if (!sol || !this.esEntidadResponsable()) {
      return false;
    }

    return this.contextoVigente() && !this.informacionIncompleta() && canNavigateToResponse(sol);
  }

  private cronogramaPendiente(): boolean {
    return this.ampliaciones().some(ampliacion =>
      ampliacion.estadoAmpliacion !== 'CANCELADA'
      && this.tieneCronograma(ampliacion)
      && !this.cronogramaSoloLectura(ampliacion)
      && (ampliacion.cronograma ?? []).some(hito => hito.estado !== 'ENTREGADA' && hito.estado !== 'CANCELADA')
    );
  }

  puedeVerRespuesta(): boolean {
    return positiveId(this.solicitud()?.respuesta?.id);
  }

  esSilencioAdministrativo(): boolean {
    return this.solicitud()?.estado === 'VENCIDA' || this.solicitud()?.respuesta?.tipoRespuesta === 'SILENCIO_ADMINISTRATIVO';
  }

  getTipoRespuestaDisplay(): string {
    const sol = this.solicitud();
    if (!sol) {
      return '';
    }

    return sol.respuesta?.tipoRespuesta || 'SIN_RESPUESTA';
  }

  getTituloRespuesta(): string {
    const tipo = this.getTipoRespuestaDisplay();

    if (tipo === 'SILENCIO_ADMINISTRATIVO') {
      return 'Silencio administrativo';
    }

    if (tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL') {
      return 'Solicitud aceptada';
    }

    if (tipo === 'SIN_RESPUESTA') {
      return 'Sin respuesta registrada';
    }

    return tipo === 'DENEGACION_TOTAL' ? 'Denegación registrada' : 'Tipo de respuesta no informado';
  }

  esRespuestaEntrega(): boolean {
    const tipo = this.getTipoRespuestaDisplay();
    return tipo === 'ENTREGA_TOTAL' || tipo === 'ENTREGA_PARCIAL';
  }

  getRespuestaAccentColor(): string {
    if (this.esRespuestaEntrega()) {
      return 'var(--success)';
    }

    if (this.getTipoRespuestaDisplay() === 'SILENCIO_ADMINISTRATIVO') {
      return 'var(--muted-foreground)';
    }

    return 'var(--brand-700)';
  }

  descripcionVisible(): string {
    return descripcionSinNotasInternas(this.solicitud()?.descripcion) || 'Descripción no registrada';
  }

  estadoExpedienteVisible(): string {
    if (this.liquidacionActiva()) return 'Información puesta a disposición';
    return this.getEstadoDisplay(this.solicitud()?.estado);
  }

  getEstadoDisplay(value: string | undefined): string {
    if ((value || '').toUpperCase() === 'PENDIENTE_ELEVACION') {
      return 'PENDIENTE DE ELEVACION AL TTAIP';
    }
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  puedeObservar(): boolean {
    const sol = this.solicitud();
    return !!sol
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION')
      && !this.observacionPendiente();
  }

  puedeAmpliar(): boolean {
    const sol = this.solicitud();
    return !!sol
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION')
      && !this.ampliacionActiva();
  }

  puedeEncauzar(): boolean {
    const sol = this.solicitud();
    return !!sol
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION')
      && !this.encauzamientoActivo();
  }

  puedeLiquidar(): boolean {
    const sol = this.solicitud();
    return !!sol
      && (sol.estado === 'RECEPCIONADA' || sol.estado === 'EN_REVISION')
      && !this.liquidacionActiva()
      && (sol.formatoFisico || sol.copiaSimple || sol.copiaCertificada);
  }

  setEncauzamientoAlcance(value: string): void {
    this.encauzamientoAlcance.set(value === 'PARCIAL' ? 'PARCIAL' : 'TOTAL');
  }

  registrarObservacion(): void {
    if (!this.contextoVigente() || this.observacionLoading()) return;
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    const motivo = this.observacionMotivo().trim();
    if (!sol || !motivo) {
      this.observacionError.set('Ingrese el motivo de observación.');
      return;
    }

    this.observacionLoading.set(true);
    this.observacionError.set('');
    this.observacionSuccess.set('');

    this.consultas.add(this.solicitudService.observar(sol.id, {
      motivoObservacion: motivo,
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad'
    }).subscribe({
      next: () => {
        if (!vigente()) return;
        this.observacionMotivo.set('');
        this.observacionSuccess.set('Observación registrada. Consulte las condiciones y fechas de la solicitud.');
        this.observacionLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'observacion');
      },
      error: (error) => {
        if (!vigente()) return;
        this.observacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la observación.');
        this.observacionLoading.set(false);
      }
    }));
  }

  registrarAmpliacion(): void {
    if (!this.contextoVigente() || this.ampliacionLoading()) return;
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    const motivo = this.ampliacionMotivo().trim();
    const informe = this.ampliacionInforme().trim();
    const fechaNotificacion = this.ampliacionFechaNotificacion();
    const cronograma = this.ampliacionCronograma()
      .map((item) => ({
        numeroEntrega: Number(item.numeroEntrega),
        descripcion: item.descripcion.trim(),
        fechaProgramada: item.fechaProgramada,
        observacion: item.observacion?.trim() || undefined
      }))
      .filter((item) => item.numeroEntrega && item.descripcion && item.fechaProgramada);

    if (!sol || !motivo || !informe || !fechaNotificacion || cronograma.length === 0) {
      this.ampliacionError.set('Complete motivo, informe, fecha de notificación y al menos una entrega parcial.');
      return;
    }

    this.ampliacionLoading.set(true);
    this.ampliacionError.set('');
    this.ampliacionSuccess.set('');

    this.consultas.add(this.solicitudService.registrarAmpliacion(sol.id, {
      motivoAmpliacion: motivo,
      informeAmpliacion: informe,
      fechaNotificacionAmpliacion: fechaNotificacion,
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad',
      cronograma
    }).subscribe({
      next: () => {
        if (!vigente()) return;
        this.ampliacionMotivo.set('');
        this.ampliacionInforme.set('');
        this.ampliacionFechaNotificacion.set('');
        this.ampliacionCronograma.set([this.crearEntregaForm(1)]);
        this.ampliacionSuccess.set('Ampliación registrada.');
        this.ampliacionLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'ampliacion');
      },
      error: (error) => {
        if (!vigente()) return;
        this.ampliacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la ampliación.');
        this.ampliacionLoading.set(false);
      }
    }));
  }

  cronogramaSoloLectura(ampliacion: AmpliacionPlazoSolicitud): boolean {
    const sol = this.solicitud();
    if (!sol || this.informacionIncompleta()) return true;
    if (ampliacion.estadoAmpliacion === 'CANCELADA') return true;
    if (this.yaRespondida()) return true;
    return ['CONCLUIDA', 'RESPONDIDA', 'DENEGADA', 'ENCAUZADA_TOTAL', 'PENDIENTE_INFORMACION', 'NO_ADMITIDA', 'ARCHIVADA']
      .includes(sol.estado);
  }

  tieneCronograma(ampliacion: AmpliacionPlazoSolicitud): boolean {
    return Array.isArray(ampliacion?.cronograma) && ampliacion.cronograma.length > 0;
  }

  actualizarFechaEntregaHito(event: { hitoId: number; fecha: string }): void {
    this.fechaEntregaHito.update(prev => ({ ...prev, [event.hitoId]: event.fecha }));
    if (this.cronogramaHitoError()?.hitoId === event.hitoId) {
      this.cronogramaHitoError.set(null);
    }
  }

  actualizarArchivosHito(event: { hitoId: number; archivos: File[] }): void {
    this.archivosPorHito.update(prev => ({ ...prev, [event.hitoId]: event.archivos }));
    if (this.cronogramaHitoError()?.hitoId === event.hitoId) {
      this.cronogramaHitoError.set(null);
    }
  }

  irARespuestaFinal(): void {
    const sol = this.solicitud();
    if (!sol || !this.puedeResponder()) return;
    this.router?.navigate(['/funcionario/responder', sol.expediente]);
  }

  registrarEntregaDesdePanel(ampliacion: AmpliacionPlazoSolicitud, event: RegistroEntregaHitoEvent): void {
    if (!this.contextoVigente() || this.cronogramaSoloLectura(ampliacion) || this.hitoRegistrandoId() !== null) return;
    const sol = this.solicitud();
    const { hito } = event;
    const ampliacionId = ampliacion.id;
    if (!sol?.id || ampliacion.solicitudId !== sol.id || hito.ampliacionId !== ampliacionId || !hito.id || !event.decision) return;

    const fecha = (event.fecha || this.fechaEntregaHito()[hito.id] || '').trim();
    if (!fecha) {
      this.cronogramaHitoError.set({ hitoId: hito.id, mensaje: 'Indique la fecha real de entrega.' });
      return;
    }
    if (hito.estado !== 'ENTREGADA' && fecha > hoyLima()) {
      this.cronogramaHitoError.set({ hitoId: hito.id, mensaje: 'La fecha real de entrega no puede ser posterior a hoy.' });
      return;
    }
    const minFecha = ampliacion.fechaNotificacionAmpliacion;
    if (hito.estado !== 'ENTREGADA' && minFecha && fecha < minFecha) {
      this.cronogramaHitoError.set({
        hitoId: hito.id,
        mensaje: `La fecha real no puede ser anterior a la notificación de la ampliación (${minFecha}).`
      });
      return;
    }
    const archivos = event.archivos?.length ? event.archivos : (this.archivosPorHito()[hito.id] ?? []);
    if (!archivos.length) {
      this.cronogramaHitoError.set({
        hitoId: hito.id,
        mensaje: 'Adjunte al menos un documento de respaldo para registrar esta entrega parcial.'
      });
      return;
    }

    const vigente = this.operacionVigente();
    this.hitoRegistrandoId.set(hito.id);
    this.hitoExitoId.set(null);
    this.cronogramaHitoError.set(null);

    this.consultas.add(
      this.solicitudService.registrarDocumentosEntregaParcial(
        sol.id,
        ampliacionId,
        hito.id,
        fecha,
        archivos,
        event.decision,
        event.fundamentoDecision
      ).subscribe({
        next: (guardado: CronogramaEntregaParcial) => {
          if (!vigente()) return;
          this.hitoRegistrandoId.set(null);
          if (!guardado?.id || guardado.id !== hito.id || guardado.ampliacionId !== ampliacionId || guardado.estado !== 'ENTREGADA'
              || guardado.decision !== event.decision || guardado.documentos?.length !== archivos.length) {
            this.cronogramaHitoError.set({
              hitoId: hito.id,
              mensaje: 'La respuesta del servidor no confirmó la entrega parcial. Consulte el expediente antes de reintentar.'
            });
            return;
          }
          this.archivosPorHito.update(prev => {
            const next = { ...prev };
            delete next[hito.id];
            return next;
          });
          this.solicitud.update(actual => {
            if (!actual) return actual;
            const ampliacionesActualizadas = (actual.ampliacionesPlazo ?? []).map(a =>
              a.id !== ampliacion.id ? a : {
                ...a,
                cronograma: (a.cronograma ?? []).map(c => c.id === hito.id ? { ...c, ...guardado } : c)
              }
            );
            return { ...actual, ampliacionesPlazo: ampliacionesActualizadas };
          });
          this.hitoExitoId.set(hito.id);
          this.refrescarSolicitudSilencioso(sol.expediente, vigente);
        },
        error: err => {
          if (!vigente()) return;
          this.hitoRegistrandoId.set(null);
          this.cronogramaHitoError.set({
            hitoId: hito.id,
            mensaje: problemDetailsMessage(err, 'No se pudo registrar la entrega parcial con sus documentos.')
          });
        }
      })
    );
  }

  private inicializarFechasCronograma(sol: Solicitud): void {
    const hoy = hoyLima();
    const actual = { ...this.fechaEntregaHito() };
    for (const amp of sol.ampliacionesPlazo ?? []) {
      const min = amp.fechaNotificacionAmpliacion;
      const def = min && min > hoy ? min : hoy;
      for (const h of amp.cronograma ?? []) {
        if (h.estado !== 'ENTREGADA' && h.estado !== 'CANCELADA' && !actual[h.id]) {
          actual[h.id] = def;
        }
      }
    }
    this.fechaEntregaHito.set(actual);
  }

  private refrescarSolicitudSilencioso(expediente: string, vigente: () => boolean): void {
    this.consultas.add(
      this.solicitudService.findByExpediente(expediente).subscribe({
        next: data => {
          if (!vigente() || !data || !positiveId(data.id) || data.expediente !== expediente) return;
          const verified = detalleConRelacionesVerificadas(data);
          this.solicitud.set(verified.solicitud);
          this.informacionIncompleta.set(verified.incompleta);
          this.inicializarFechasCronograma(verified.solicitud);
        },
        error: () => {
          // Conserva el estado ya confirmado por POST cuando la recarga silenciosa falla.
        }
      })
    );
  }

  registrarEncauzamiento(): void {
    if (!this.contextoVigente() || this.encauzamientoLoading()) return;
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    const entidadDestinoId = this.encauzamientoEntidadDestinoId();
    const motivo = this.encauzamientoMotivo().trim();
    const sustento = this.encauzamientoSustento().trim();

    if (!sol || !entidadDestinoId || !motivo) {
      this.encauzamientoError.set('Seleccione entidad destino e ingrese el motivo de encauzamiento.');
      return;
    }

    this.encauzamientoLoading.set(true);
    this.encauzamientoError.set('');
    this.encauzamientoSuccess.set('');

    this.consultas.add(this.solicitudService.registrarEncauzamiento(sol.id, {
      entidadDestinoId,
      motivoEncauzamiento: motivo,
      alcance: this.encauzamientoAlcance(),
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad',
      observacionSustento: sustento || undefined
    }).subscribe({
      next: () => {
        if (!vigente()) return;
        this.encauzamientoEntidadDestinoId.set(null);
        this.encauzamientoAlcance.set('TOTAL');
        this.encauzamientoMotivo.set('');
        this.encauzamientoSustento.set('');
        this.encauzamientoSuccess.set('Encauzamiento registrado con trazabilidad de entidad origen y destino.');
        this.encauzamientoLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'encauzamiento');
      },
      error: (error) => {
        if (!vigente()) return;
        this.encauzamientoError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar el encauzamiento.');
        this.encauzamientoLoading.set(false);
      }
    }));
  }

  emitirLiquidacion(): void {
    if (!this.contextoVigente() || this.liquidacionLoading()) return;
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    const monto = Number(this.liquidacionMonto());
    const concepto = this.liquidacionConcepto().trim();
    const fechaNotificacion = this.liquidacionFechaNotificacion();

    if (!sol || Number.isNaN(monto) || monto < 0 || !concepto || !fechaNotificacion) {
      this.liquidacionError.set('Complete monto, concepto y fecha de notificación del cupón.');
      return;
    }

    this.liquidacionLoading.set(true);
    this.liquidacionError.set('');
    this.liquidacionSuccess.set('');

    this.consultas.add(this.solicitudService.emitirLiquidacion(sol.id, {
      codigoLiquidacion: this.liquidacionCodigo().trim() || undefined,
      monto,
      moneda: this.liquidacionMoneda().trim() || 'PEN',
      concepto,
      fechaNotificacion,
      medioNotificacion: this.liquidacionMedioNotificacion(),
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad',
      observacion: this.liquidacionObservacion().trim() || undefined
    }).subscribe({
      next: () => {
        if (!vigente()) return;
        this.liquidacionCodigo.set('');
        this.liquidacionMonto.set('');
        this.liquidacionMoneda.set('PEN');
        this.liquidacionConcepto.set('');
        this.liquidacionFechaNotificacion.set('');
        this.liquidacionMedioNotificacion.set('CASILLA_ELECTRONICA');
        this.liquidacionObservacion.set('');
        this.liquidacionSuccess.set('Liquidación registrada. Consulte sus fechas y actuaciones en la solicitud.');
        this.liquidacionLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'liquidacion');
      },
      error: (error) => {
        if (!vigente()) return;
        this.liquidacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo emitir la liquidación.');
        this.liquidacionLoading.set(false);
      }
    }));
  }

  actualizarLiquidacion(liquidacion: LiquidacionCostoSolicitud, estado: 'PAGADA' | 'RECOGIDA' | 'CANCELADA'): void {
    if (!this.contextoVigente() || this.liquidacionUpdateLoading() || !this.liquidaciones().some(item => item.id === liquidacion.id)) return;
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    if (!sol) {
      return;
    }

    this.liquidacionUpdateLoading.set(true);
    this.liquidacionError.set('');
    this.liquidacionSuccess.set('');

    this.consultas.add(this.solicitudService.actualizarLiquidacion(sol.id, liquidacion.id, {
      estado,
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad'
    }).subscribe({
      next: () => {
        if (!vigente()) return;
        const message = estado === 'PAGADA'
          ? 'Pago registrado en la liquidación.'
          : estado === 'RECOGIDA'
            ? 'Recojo registrado; consulte el estado recuperado de la solicitud.'
            : 'Liquidación cancelada.';
        this.liquidacionSuccess.set(message);
        this.liquidacionUpdateLoading.set(false);
        this.cargarSolicitud(sol.expediente, 'liquidacion');
      },
      error: (error) => {
        if (!vigente()) return;
        this.liquidacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo actualizar la liquidación.');
        this.liquidacionUpdateLoading.set(false);
      }
    }));
  }

  entregaFisicaEnPersona(): boolean {
    return entregaFisicaSinPublicacionDigital(this.solicitud());
  }

  private archivoConPrefijo(archivo: File, prefijo: string): File {
    const nombre = archivo.name.replace(/^.*[\\/]/, '');
    return new File([archivo], `${prefijo}-${nombre}`, { type: archivo.type });
  }

  fijarEvidencia(destino: 'cargo' | 'comprobante' | 'identidad', archivos: File[]): void {
    const archivo = archivos[0] ?? null;
    if (destino === 'cargo') this.archivoCargo.set(archivo);
    if (destino === 'comprobante') this.archivoComprobante.set(archivo);
    if (destino === 'identidad') this.archivoIdentidad.set(archivo);
    if (archivo) this.liquidacionError.set('');
  }

  isRecojoVencido(liq: LiquidacionCostoSolicitud): boolean {
    if (!liq.fechaLimiteRecojo) return false;
    let limitDate: Date;
    if (/^\d{4}-\d{2}-\d{2}/.test(liq.fechaLimiteRecojo)) {
      limitDate = new Date(liq.fechaLimiteRecojo);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(liq.fechaLimiteRecojo)) {
      const [d, m, y] = liq.fechaLimiteRecojo.split('/');
      limitDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    } else {
      const ms = Date.parse(liq.fechaLimiteRecojo);
      if (Number.isNaN(ms)) return false;
      limitDate = new Date(ms);
    }
    limitDate.setHours(23, 59, 59, 999);
    return limitDate.getTime() < Date.now();
  }

  confirmarRecojoFisico(liquidacion: LiquidacionCostoSolicitud): void {
    if (!this.contextoVigente() || this.liquidacionUpdateLoading() || !this.liquidaciones().some(item => item.id === liquidacion.id)) return;
    if (!this.archivoCargo() || !this.archivoComprobante() || !this.archivoIdentidad()) {
      this.liquidacionError.set('Adjunte el cargo de entrega, la foto del comprobante de pago y la copia del DNI de quien recibe.');
      return;
    }
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    if (!sol) return;

    this.liquidacionUpdateLoading.set(true);
    this.liquidacionError.set('');
    this.liquidacionSuccess.set('');

    const respuestaId = sol.respuesta?.id;
    if ((sol.estado === 'RESPONDIDA' || sol.estado === 'VENCIDA') && !respuestaId) {
      this.liquidacionError.set('No hay una respuesta registrada para asociar las constancias de la entrega.');
      this.liquidacionUpdateLoading.set(false);
      return;
    }
    const relacion = respuestaId ? { respuestaId } : { solicitudId: sol.id };
    const evidencias = [
      this.archivoConPrefijo(this.archivoCargo()!, 'cargo-entrega'),
      this.archivoConPrefijo(this.archivoComprobante()!, 'comprobante-pago'),
      this.archivoConPrefijo(this.archivoIdentidad()!, 'dni-receptor')
    ];
    this.consultas.add(forkJoin(evidencias.map(archivo =>
      this.documentoService.upload(archivo, 'DOCUMENTO_ADJUNTO', relacion)
    )).pipe(switchMap(() => this.solicitudService.actualizarLiquidacion(sol.id, liquidacion.id, {
      estado: 'RECOGIDA',
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad'
    }))).subscribe({
      next: () => {
        if (!vigente()) return;
        this.liquidacionSuccess.set('Entrega física registrada. La información fue recogida y el expediente queda en entrega total.');
        this.liquidacionUpdateLoading.set(false);
        this.archivoCargo.set(null);
        this.archivoComprobante.set(null);
        this.archivoIdentidad.set(null);
        this.cargarSolicitud(sol.expediente);
      },
      error: (error) => {
        if (!vigente()) return;
        this.liquidacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo registrar la entrega física.');
        this.liquidacionUpdateLoading.set(false);
      }
    }));
  }

  archivarLiquidacion(liquidacion: LiquidacionCostoSolicitud): void {
    if (!this.contextoVigente() || this.liquidacionUpdateLoading() || !this.liquidaciones().some(item => item.id === liquidacion.id)) return;
    const vigente = this.operacionVigente();
    const sol = this.solicitud();
    if (!sol) return;

    this.liquidacionUpdateLoading.set(true);
    this.liquidacionError.set('');
    this.liquidacionSuccess.set('');

    const observacionLegal = this.motivoArchivo() === 'SIN_ACREDITACION_DE_PAGO'
      ? 'No acreditó el pago — Vencimiento de 30 días calendario'
      : 'No recogió la información — Vencimiento de 30 días calendario';

    this.consultas.add(this.solicitudService.actualizarLiquidacion(sol.id, liquidacion.id, {
      estado: 'CANCELADA',
      responsable: this.authService.obtenerSesion()?.nombre || 'Funcionario de entidad',
      observacion: observacionLegal
    }).subscribe({
      next: registrada => {
        if (!vigente()) return;
        if (registrada.id !== liquidacion.id || registrada.solicitudId !== sol.id || registrada.estadoLiquidacion !== 'CANCELADA') {
          this.liquidacionError.set('No se pudo verificar el archivo de esta liquidación. Consulte el expediente antes de repetir.');
          this.liquidacionUpdateLoading.set(false);
          return;
        }
        this.cargarSolicitud(sol.expediente);
        this.liquidacionSuccess.set('Liquidación archivada por vencimiento del plazo de 30 días.');
        this.liquidacionUpdateLoading.set(false);
      },
      error: (error) => {
        if (!vigente()) return;
        this.liquidacionError.set(error?.error?.detail || error?.error?.mensaje || 'No se pudo archivar la liquidación.');
        this.liquidacionUpdateLoading.set(false);
      }
    }));
  }

  agregarEntregaCronograma(): void {
    const items = this.ampliacionCronograma();
    const next = items.reduce((max, item) => Math.max(max, Number(item.numeroEntrega) || 0), 0) + 1;
    this.ampliacionCronograma.set([...items, this.crearEntregaForm(next)]);
  }

  removerEntregaCronograma(index: number): void {
    const items = this.ampliacionCronograma();
    if (items.length <= 1) {
      return;
    }
    this.ampliacionCronograma.set(items.filter((_, current) => current !== index));
  }

  actualizarEntregaCronograma(index: number, field: keyof RegistrarEntregaParcialPayload, value: string | number): void {
    this.ampliacionCronograma.set(this.ampliacionCronograma().map((item, current) => {
      if (current !== index) {
        return item;
      }
      const updated: RegistrarEntregaParcialPayload = { ...item };
      if (field === 'numeroEntrega') {
        updated.numeroEntrega = Number(value);
      } else if (field === 'descripcion') {
        updated.descripcion = String(value);
      } else if (field === 'fechaProgramada') {
        updated.fechaProgramada = String(value);
      } else {
        updated.observacion = String(value);
      }
      return updated;
    }));
  }

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      RECEPCIONADA: 'pill pill-medium',
      EN_REVISION: 'pill pill-medium',
      PENDIENTE_INFORMACION: 'pill pill-medium',
      RESPONDIDA: 'pill pill-low',
      DENEGADA: 'pill pill-high',
      VENCIDA: 'pill pill-high',
      CONCLUIDA: 'pill'
    };
    return map[estado] || 'pill';
  }

  getApelacionEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      PENDIENTE_ELEVACION: 'pill pill-medium',
      EN_CALIFICACION_1: 'pill pill-medium',
      EN_CALIFICACION_2: 'pill pill-medium',
      EN_SUBSANACION: 'pill pill-medium',
      NOTIFICACION_SEGUNDA_CALIFICACION: 'pill pill-medium',
      EN_RESOLUCION: 'pill pill-medium',
      RESUELTO: 'pill pill-low',
      RESUELTO_FUNDADO: 'pill pill-low',
      RESUELTO_FUNDADO_EN_PARTE: 'pill pill-low',
      RESUELTO_INFUNDADO: 'pill',
      RESUELTO_INFUNDADO_EN_PARTE: 'pill',
      RESUELTO_IMPROCEDENTE: 'pill pill-high',
      RESUELTO_ESTESE_A_LO_RESUELTO: 'pill',
      RESUELTO_NULIDAD_ACTO: 'pill pill-high',
      TENER_POR_NO_PRESENTADO: 'pill pill-high',
      CONCLUSION_SUSTRACCION_MATERIA: 'pill pill-low',
      CONCLUSION_DESISTIMIENTO: 'pill'
    };
    return map[estado] || 'pill';
  }

  getDiasRestantes(): number | null {
    const value = this.plazoSeguimiento()?.diasRestantes;
    if (Number.isSafeInteger(value)) return value!;
    const limite = aISO(this.solicitud()?.fechaLimite);
    if (!limite) return null;
    const hoy = hoyLima();
    if (hoy > limite) return -habilesEntre(sumarDias(limite, -1), hoy);
    return habilesEntre(sumarDias(hoy, -1), limite);
  }

  getDiasRestantesColor(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) {
      return 'var(--muted-foreground)';
    }
    if (dias < 0) {
      return 'var(--brand-700)';
    }
    if (dias <= 3) {
      return 'var(--warning)';
    }
    return 'var(--success)';
  }

  getDiasRestantesDisplay(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) {
      return 'Sin dato';
    }

    if (dias < 0) {
      const retraso = Math.abs(dias);
      return `${retraso} ${retraso === 1 ? 'día hábil' : 'días hábiles'} de retraso`;
    }

    return `${dias} ${dias === 1 ? 'día hábil' : 'días hábiles'}`;
  }

  isUrgente(): boolean {
    const dias = this.getDiasRestantes();
    return !this.enPrecision() && dias !== null && dias >= 0 && dias <= 3 && this.puedeResponder();
  }

  getInitials(name: string | undefined): string {
    const source = (name || 'Ciudadano').trim();
    if (!source) {
      return 'CI';
    }

    return source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'CI';
  }

  getHistorialColorClass(color: HistorialItem['color']): string {
    const map: Record<HistorialItem['color'], string> = {
      brand: 'var(--brand-600)',
      warning: 'var(--warning)',
      success: 'var(--success)',
      muted: 'var(--muted-foreground)',
      violet: 'var(--accent-violet)'
    };
    return map[color];
  }

  private resumenObservacion(estado: string | undefined): string {
    switch (estado) {
      case 'PENDIENTE_SUBSANACION': return 'En espera de la precisión del administrado.';
      case 'SUBSANADA': return 'Observación subsanada.';
      case 'NO_SUBSANADA': return 'Observación sin subsanar.';
      case 'ARCHIVADA': return 'Observación archivada.';
      default: return 'La entidad pidió precisar el pedido.';
    }
  }

  getAmpliacionEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getEncauzamientoEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getEncauzamientoAlcanceDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin alcance';
  }

  getEncauzamientoEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      REGISTRADO: 'pill pill-medium',
      DERIVADO: 'pill pill-medium',
      ATENDIDO: 'pill pill-low',
      CANCELADO: 'pill',
      VENCIDO: 'pill pill-high'
    };
    return map[estado] || 'pill';
  }

  getLiquidacionEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getLiquidacionEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      EMITIDA: 'pill pill-medium',
      NOTIFICADA: 'pill pill-medium',
      PAGADA: 'pill pill-low',
      RECOGIDA: 'pill pill-low',
      ARCHIVADA: 'pill pill-high',
      CANCELADA: 'pill',
      VENCIDA: 'pill pill-high'
    };
    return map[estado] || 'pill';
  }

  getEntregaEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      PROGRAMADA: 'pill pill-medium',
      ENTREGADA: 'pill pill-low',
      OBSERVADA: 'pill pill-medium',
      CANCELADA: 'pill',
      VENCIDA: 'pill pill-high'
    };
    return map[estado] || 'pill';
  }

  private crearEntregaForm(numeroEntrega: number): RegistrarEntregaParcialPayload {
    return {
      numeroEntrega,
      descripcion: '',
      fechaProgramada: '',
      observacion: ''
    };
  }

  private operacionVigente(): () => boolean {
    const generacion = this.generacion, sesion = this.claveSesion(), id = this.solicitud()?.id;
    return () => this.contextoVigente() && generacion === this.generacion && sesion === this.claveSesion()
      && this.solicitud()?.id === id;
  }

  fechaCalendario(value: unknown): string {
    if (typeof value !== 'string' || !value) return 'No disponible';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const latina = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (latina) return `${latina[1].padStart(2, '0')}/${latina[2].padStart(2, '0')}/${latina[3]}`;
    return value;
  }

  fechaVisible(value: unknown): string | null {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  }


  private cargarEntidadesActivas(): void {
    this.entidadService.findActivas().subscribe({
      next: (entidades) => this.entidadesActivas.set(entidades),
      error: () => this.entidadesActivas.set([])
    });
  }

  private toInputDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
