import { PresentacionesAdmisionComponent } from './shared/presentaciones-admision.component';
import { CumplimientoDocumentalComponent } from './shared/cumplimiento-documental.component';
import { ActosNotificacionComponent } from './shared/actos-notificacion.component';
import { InformacionComplementariaComponent } from './shared/informacion-complementaria.component';
import { Observable, Subscription, forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { positiveId, apelacionCompatible, motivoPrimera, documentosRelacionados } from './ttaip-calificar.model';
import { motivoFinal } from './ttaip-resolver.model';
import { contextoSegunda, relojConsultado, requerimientoConsultado } from './ttaip-segunda-calificacion.model';
import { ConsultaRecepcion, consultarRecepcionInstitucional, motivoRecepcion, sinConsultaRecepcion } from './recepcion-institucional.model';
import { RecepcionInstitucionalComponent } from './recepcion-institucional.component';
import { detalleConsultado, eficaciaConsultada, single, DetailCollection } from './ttaip-resolucion-detalle.model';
import { falloConsulta } from '../../utils/consulta-remota.util';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, OnDestroy, ElementRef, effect, untracked, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { SolicitudService } from '../../services/solicitud.service';
import { TtaipService } from '../../services/ttaip.service';
import { DocumentoService } from '../../services/documento.service';
import { Apelacion } from '../../models/apelacion.model';
import { Solicitud } from '../../models/solicitud.model';
import { CumplimientoResolucionTtaip, NotificacionTtaip, SuspensionPlazoTtaip } from '../../models/resolucion.model';
import { DocumentoMetadata, DocumentoRelation } from '../../models/documento.model';
import { DocumentListComponent } from '../../shared/document-list.component';
import { agruparExpediente, nombreDocumento as nombreDeDocumento } from './shared/expediente-docs';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';

import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { YaikuCargandoComponent } from '../../shared/yaiku-cargando.component';
import { resolucionPdf, buildResolucionBlob, DocContext, OfficialStage } from './shared/official-docs.util';
import {
  LucideEye, LucideDownload, LucideBuilding2, LucideFolderOpen, LucideFileText,
  LucideCalendar, LucideHash, LucideScale, LucideCheckCircle2,
  LucideXCircle, LucideAlertCircle, LucideClock, LucideMail,
  LucideGlobe, LucideMonitor, LucidePackage, LucideArrowLeft,
  LucideRefreshCw, LucideShieldCheck, LucideUser, LucideSearch, LucideChevronDown
} from '@lucide/angular';

type DetailTab = 'apelacion' | 'subsanacion' | 'subprocesos' | 'requerimientos' | 'notificaciones' | 'adjuntos';
type TimelineIcon = 'check' | 'x' | 'alert';
type SuspensionAdicional = 'INFORME_ORAL' | 'INFORMACION_COMPLEMENTARIA';
type SuspensionSolicitante = 'CIUDADANO' | 'ENTIDAD_PUBLICA' | 'TTAIP';
type TipoCumplimiento = 'TOTAL' | 'PARCIAL' | 'NO_CUMPLE';
const TIPO_RESPUESTA: Record<string, string> = {
  ENTREGA_TOTAL: 'Entrega total', ENTREGA_PARCIAL: 'Entrega parcial',
  DENEGACION_TOTAL: 'Denegación total', SILENCIO_ADMINISTRATIVO: 'Silencio administrativo',
};
const CAUSAL_ENTIDAD: Record<string, string> = {
  no_posee: 'La entidad no posee la información y no está obligada a poseerla',
  inexistente: 'La solicitud exige crear o producir información inexistente',
  evaluacion: 'La solicitud exige realizar evaluaciones o análisis',
  extraviada: 'La información se extravió, destruyó o no puede ubicarse pese a que debía poseerla',
  secreta: 'Información secreta', reservada: 'Información reservada', confidencial: 'Información confidencial',
};

interface TimelineItem {
  id: number | string;
  fecha: string;
  titulo: string;
  descripcion: string;
  icon: TimelineIcon;
}

interface ResultadoMeta {
  label: string;
  accent: string;
}

import { AudienciaInformeOral } from './ttaip-informe-oral.model';
import { RegistrarSuspensionTtaipPayload } from '../../models/resolucion.model';

@Component({
  selector: 'app-ttaip-resolucion-detalle',
  imports: [PresentacionesAdmisionComponent, ActosNotificacionComponent, InformacionComplementariaComponent, CumplimientoDocumentalComponent,
    CommonModule, RouterLink, DocumentListComponent, StatusBadgeComponent, YaikuCargandoComponent,
    DocumentPreviewModalComponent, RecepcionInstitucionalComponent,
    LucideEye, LucideDownload, LucideScale,
    LucideMail, LucideGlobe,
    LucideMonitor, LucidePackage, LucideShieldCheck, LucideFolderOpen, LucideFileText, LucideRefreshCw,
    LucideSearch, LucideChevronDown
  ],
  templateUrl: './ttaip-resolucion-detalle.component.html',
  styleUrl: './ttaip-resolucion-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolucionDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private routeSub = new Subscription();
  private requests = new Subscription();
  private destroyed = false;
  private initialized = false;
  private session = '';
  private revision = -1;
  private receiptRequests = new Subscription();
  private receiptGeneration = 0;
  private receiptOwner: { apelacion: Apelacion; query: number; session: string; revision: number; requerimientoId?: number } | null = null;
  private readonly receipt = signal<ConsultaRecepcion>(sinConsultaRecepcion());
  readonly resourceRevision = signal(0);
  readonly actionUncertain = signal(false);
  private pendingAction: { collection: DetailCollection; category: 'descargo' | 'notificacion' | 'cumplimiento'; id?: number; result?: Record<string, unknown>; code: string; apelacionId: number } | null = null;
  readonly selectedActId = signal<number | null>(null);
  private readonly apelacionService = inject(ApelacionService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly documentoService = inject(DocumentoService);
  private readonly ttaipService = inject(TtaipService);
  private docsReads = new Subscription();
  private docsDownloads = new Subscription();
  private docsGeneration = 0;
  private docsKey = '';
  private docsLoaded = false;

  readonly apelacion = signal<Apelacion | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly activeTab = signal<DetailTab>('apelacion');
  readonly descargoLoading = signal<boolean>(false);
  readonly descargoMessage = signal<string>('');
  readonly descargoError = signal<string>('');
  readonly notificacionLoading = signal<boolean>(false);
  readonly notificacionMessage = signal<string>('');
  readonly notificacionError = signal<string>('');
  readonly cumplimientoLoading = signal<boolean>(false);
  readonly cumplimientoMessage = signal<string>('');
  readonly cumplimientoError = signal<string>('');
  readonly draftError = signal('');
  readonly solicitudOrigen = signal<Solicitud | null>(null);
  readonly origenEstado = signal<'ausente' | 'cargando' | 'disponible' | 'error'>('ausente');
  readonly origenMensaje = signal('');
  readonly documentGroups = signal<{ label: string; relation: DocumentoRelation; documents: DocumentoMetadata[] }[]>([]);
  readonly documentSearch = signal('');
  readonly documentFilter = signal('');
  readonly closedGroups = signal<Record<string, boolean>>({});
  readonly loadingDocuments = signal(false);
  readonly documentError = signal('');
  readonly downloadError = signal('');
  readonly downloadingId = signal<number | null>(null);
  private documentQuery = 0;
  readonly previewModalOpen = signal<boolean>(false);
  readonly previewModalDoc = signal<DocumentPreviewTarget | null>(null);
  get tabs(): { id: DetailTab; label: string }[] {
    const tribunal = this.rolInstitucional();
    return [
      { id: 'apelacion', label: 'Apelación' },
      ...(tribunal && this.requiereRecepcion() ? [{ id: 'subsanacion' as const, label: 'Subsanación' }] : []),
      { id: 'subprocesos', label: tribunal ? 'Descargos y cumplimiento' : 'Requerimientos del Tribunal' },
      ...(tribunal ? [{ id: 'requerimientos' as const, label: 'Requerimientos del administrado y de la entidad' }] : []),
      { id: 'notificaciones', label: 'Notificaciones' },
      { id: 'adjuntos', label: 'Documentos del expediente' },
    ];
  }

  private readonly routeExpediente = signal<string>('');

  readonly expedienteDisplay = computed(() => this.apelacion()?.expediente || this.routeExpediente() || '—');
  readonly expedienteTtaip = computed(() => this.apelacion()?.expedienteTtaip ?? null);
  readonly salaAsignada = computed(() => positiveId(this.expedienteTtaip()?.sala?.id) ? this.expedienteTtaip()?.sala?.nombre || 'Nombre de sala no informado' : 'Sala no informada');
  readonly miembrosSala = computed(() => { const values = this.expedienteTtaip()?.miembros; return Array.isArray(values) && values.every(m => positiveId(m.id)) ? values : []; });
  readonly detalle = computed(() => detalleConsultado(this.apelacion()));
  readonly resolucionesExpediente = computed(() => this.detalle().resoluciones.data ?? []);
  readonly cedulasExpediente = computed(() => this.detalle().cedulas.data ?? []);
  readonly notificacionesExpediente = computed(() => this.detalle().notificaciones.data ?? []);
  readonly historialExpediente = computed(() => this.detalle().historial.data ?? []);
  readonly historialVisible = computed(() => [...this.historialExpediente()]
    .filter(evento => evento.tipoEvento !== 'SUSPENSION_PLAZO')
    .sort((a, b) => (b.fechaEvento || '').localeCompare(a.fechaEvento || '')));
  readonly reprocesosExpediente = computed(() => this.detalle().reprocesos.data ?? []);
  readonly descargosExpediente = computed(() => this.detalle().descargosEntidad.data ?? []);
  readonly suspensionesExpediente = computed(() => this.detalle().suspensionesPlazo.data ?? []);
  readonly cumplimientosExpediente = computed(() => this.detalle().cumplimientosResolucion.data ?? []);
  readonly descargoActivo = computed(() => single(this.descargosExpediente(), d => d.estadoDescargo === 'REQUERIDO'));
  readonly cumplimientosHistoricos = computed(() => this.cumplimientosExpediente().filter(c => !c.documental));
  readonly cumplimientoActivo = computed(() => single(this.cumplimientosHistoricos(), c => ['PENDIENTE', 'OBSERVADO'].includes(c.estadoCumplimiento || '')));
  readonly resolucionFinalFundada = computed(() => { const id = this.apelacion()?.resolucion?.id; return this.resolucionesExpediente().find(r => r.id === id && r.tipoResolucion === 'RESOLUCION_FINAL' && ['FUNDADO', 'FUNDADO_EN_PARTE'].includes(r.decision || '')) ?? null; });
  readonly selectedAct = computed(() => this.resolucionesExpediente().find(r => r.id === this.selectedActId()) ?? null);
  readonly relojTexto = computed(() => relojConsultado(this.apelacion()));
  readonly retorno = computed(() => {
    this.auth.cambiosSesion();
    try {
      if (this.auth.obtenerSesion()?.tipoUsuario !== 'FUNCIONARIO') return '/ttaip';
      return this.route.snapshot?.queryParamMap?.get('desde') === 'actuaciones' ? '/funcionario/tribunal' : '/funcionario';
    } catch { return '/ttaip'; }
  });
  readonly textoRetorno = computed(() => this.retorno() === '/funcionario/tribunal' ? 'Volver a actuaciones' : 'Volver al panel institucional');
  readonly rolInstitucional = computed(() => { this.auth.cambiosSesion(); try { return ['TTAIP', 'ADMINISTRADOR'].includes(this.auth.obtenerSesion()?.tipoUsuario || ''); } catch { return false; } });
  readonly rolEntidad = computed(() => { this.auth.cambiosSesion(); try { return ['FUNCIONARIO', 'ADMINISTRADOR'].includes(this.auth.obtenerSesion()?.tipoUsuario || ''); } catch { return false; } });
  readonly requerimiento = computed(() => requerimientoConsultado(this.apelacion()));
  readonly requiereRecepcion = computed(() => {
    const ap = this.apelacion();
    if (!ap) return false;
    const inadmisible = ap.calificacionPrimera === 'INADMISIBLE' || ap.resolucionPrimeraCalificacion?.decision === 'INADMISIBLE';
    return inadmisible && ['EN_SUBSANACION', 'EN_CALIFICACION_2', 'NOTIFICACION_SEGUNDA_CALIFICACION', 'EN_RESOLUCION'].includes(ap.estado);
  });
  readonly recepcionVisible = computed<ConsultaRecepcion>(() => {
    const base = this.recepcion();
    if (base.estado !== 'ausente') return base;
    const espera = this.apelacion()?.estado === 'EN_SUBSANACION';
    return { ...base, mensaje: espera
      ? 'El administrado todavía no presenta la subsanación. La consulta está completa: no hay un escrito recibido.'
      : 'No hay una subsanación registrada para el requerimiento inadmisible. Sin ese escrito no corresponde una nueva calificación.' };
  });
  readonly recepcion = computed<ConsultaRecepcion>(() => {
    const revision = this.auth.cambiosSesion(); this.resourceRevision();
    const value = this.receipt(), owner = this.receiptOwner;
    return owner && this.contextoVigente() && owner.apelacion === this.apelacion() && owner.query === this.documentQuery
      && owner.revision === revision && owner.session === this.sessionKey() && owner.requerimientoId === this.requerimiento()?.id ? value : sinConsultaRecepcion();
  });
  private readonly motivoContextoNavegacion = computed(() => {
    const revision = this.auth.cambiosSesion(); this.resourceRevision();
    if (this.revision !== revision || !this.contextoVigente() || this.loading() || this.error() || !this.apelacion()) return 'Consulte el expediente actual antes de continuar.';
    if (this.auth.obtenerSesion()?.tipoUsuario !== 'TTAIP') return 'El registro de segunda calificación y resolución final requiere el acceso TTAIP.';
    if (this.actionUncertain()) return 'Recupere la actuación incierta antes de continuar.';
    return this.detalle().resoluciones.error;
  });
  readonly motivoSegunda = computed(() => {
    const base = this.motivoContextoNavegacion(); if (base) return base;
    const ap = this.apelacion()!, contexto = contextoSegunda(ap);
    if (contexto === 'registrada') return 'Ya hay una segunda calificación registrada. Revise la actuación y sus notificaciones; no registre otra.';
    if (contexto !== 'borrador') return 'Segunda calificación no disponible: ' + (contexto === 'incompleto' ? 'información incompleta de la primera actuación o del requerimiento.' : 'estado incompatible con una segunda calificación.');
    return motivoRecepcion(ap, this.requerimiento()!.id!, this.recepcion());
  });
  readonly motivoResolucionFinal = computed(() => this.motivoContextoNavegacion() || motivoFinal(this.apelacion(), this.recepcion()));
  readonly navegacionPrimera = computed(() => !!this.apelacion() && this.rolInstitucional() && !motivoPrimera(this.apelacion()!));
  readonly navegacionSegunda = computed(() => !this.motivoSegunda());
  readonly navegacionFinal = computed(() => !this.motivoResolucionFinal());
  readonly coleccionesIncompletas = computed(() => Object.values(this.detalle()).map(c => c.error).filter(Boolean));
  readonly estadoLabel = computed(() => this.formatEstado(this.apelacion()?.estado || ''));
  readonly listoParaArchivo = computed(() => {
    const apelacion = this.apelacion();
    return !!apelacion?.expedienteTtaip?.cumplimientoDocumental?.fechaRemision
      && ['RESUELTO_FUNDADO', 'RESUELTO_FUNDADO_EN_PARTE'].includes(apelacion.estado);
  });

  readonly resultadoNormalizado = computed(() => {
    const id = this.apelacion()?.resolucion?.id;
    const raw = this.resolucionesExpediente().find(r => r.id === id && r.tipoResolucion === 'RESOLUCION_FINAL')?.decision || this.apelacion()?.resultado;
    return this.normalizeKey(raw);
  });

  readonly resultadoMeta = computed<ResultadoMeta | null>(() => {
    const resultado = this.resultadoNormalizado();
    switch (resultado) {
      case 'FUNDADO':
        return { label: 'FUNDADO', accent: 'var(--success)' };
      case 'FUNDADO_EN_PARTE':
        return { label: 'FUNDADO EN PARTE', accent: 'var(--gold-dark)' };
      case 'INFUNDADO':
        return { label: 'INFUNDADO', accent: 'var(--brand-700)' };
      case 'INFUNDADO_EN_PARTE':
        return { label: 'INFUNDADO EN PARTE', accent: 'var(--brand-700)' };
      case 'IMPROCEDENTE':
      case 'RESUELTO_IMPROCEDENTE':
        return { label: 'IMPROCEDENTE', accent: 'var(--muted-foreground)' };
      case 'TENER_POR_NO_PRESENTADO':
        return { label: 'NO PRESENTADO', accent: 'var(--warning)' };
      case 'CONCLUSION_SUSTRACCION_MATERIA':
        return { label: 'SUSTRACCION DE MATERIA', accent: 'var(--info)' };
      case 'CONCLUSION_DESISTIMIENTO':
        return { label: 'DESISTIMIENTO', accent: 'var(--gold-dark)' };
      case 'ESTESE_A_LO_RESUELTO':
      case 'RESUELTO_ESTESE_A_LO_RESUELTO':
        return { label: 'ESTESE A LO RESUELTO', accent: 'var(--info)' };
      case 'NULIDAD_DEL_ACTO':
      case 'RESUELTO_NULIDAD_ACTO':
        return { label: 'NULIDAD DEL ACTO', accent: 'var(--warning)' };
      case 'ADMISIBLE':
        return { label: 'ADMISIBLE', accent: 'var(--info)' };
      case 'INADMISIBLE':
        return { label: 'INADMISIBLE', accent: 'var(--warning)' };
      default:
        return null;
    }
  });

  readonly dataView = computed(() => {
    const apelacion = this.apelacion();
    const respuesta = this.solicitudOrigen()?.respuesta;
    return {
      ciudadano: apelacion?.ciudadanoNombre || 'Ciudadano',
      dni: this.datoContacto(this.solicitudOrigen()?.ciudadanoDni),
      email: this.datoContacto(this.solicitudOrigen()?.ciudadanoEmail),
      telefono: this.datoContacto(this.solicitudOrigen()?.ciudadanoTelefono),
      entidad: apelacion?.entidadNombre || apelacion?.entidadExternaNombre || 'Entidad no informada',
      expedienteSAIP: apelacion?.solicitudExpediente || apelacion?.numeroSolicitudExterna || '—',
      asuntoSAIP: apelacion?.solicitudAsunto || apelacion?.resumenSolicitudOriginal || 'Sin asunto registrado',
      causalDenegatoria: this.causalVisible(apelacion, respuesta),
      fundamentoEntidad: this.fundamentoVisible(apelacion, respuesta),
      fundamentosApelacion: apelacion?.fundamentos || 'Sin fundamentos registrados.',
      fechaApelacion: apelacion?.fechaApelacion || ''
    };
  });
  readonly documentCount = computed(() => this.documentGroups().reduce((sum, group) => sum + group.documents.length, 0));
  readonly etapasDocumentales = computed(() => agruparExpediente(this.documentosDelExpediente(), this.entidadDocumental(), ''));
  readonly etapasVisibles = computed(() => {
    const filtro = this.documentFilter();
    return agruparExpediente(this.documentosDelExpediente(), this.entidadDocumental(), this.documentSearch().trim())
      .filter(etapa => !filtro || filtro === etapa.key)
      .filter(etapa => etapa.filas.length > 0);
  });

  resolucionDocumentoRelation(resolucionId?: number | null): DocumentoRelation | null {
    return resolucionId ? { resolucionId } : null;
  }

  cedulaDocumentoRelation(cedulaId?: number | null): DocumentoRelation | null {
    return cedulaId ? { cedulaNotificacionId: cedulaId } : null;
  }

  cedulasDeResolucion(resolucionId: number) {
    if (this.detalle().cedulas.error) return [];
    const resolucion = this.resolucionesExpediente().find(r => r.id === resolucionId);
    return this.cedulasExpediente().filter(c => resolucion?.cedulas?.some(own => own.id === c.id));
  }

  readonly timeline = computed<TimelineItem[]>(() => this.buildTimeline());

  readonly mostrarCajaResultado = computed(() => {
    const id = this.apelacion()?.resolucion?.id;
    const resultado = this.resolucionesExpediente().some(r => r.id === id && r.tipoResolucion === 'RESOLUCION_FINAL') ? this.resultadoNormalizado() : '';
    return resultado.startsWith('FUNDADO') || resultado.startsWith('INFUNDADO') || resultado.includes('NULIDAD');
  });

  readonly resultadoCajaLabel = computed(() => {
    const resultado = this.resultadoNormalizado();
    if (resultado.startsWith('FUNDADO')) return 'APELACIÓN FUNDADA';
    if (resultado.startsWith('INFUNDADO')) return 'APELACIÓN INFUNDADA';
    if (resultado.includes('NULIDAD')) return 'NULIDAD DEL ACTO APELADO';
    return 'APELACION RESUELTA';
  });

  readonly resultadoCajaDetalle = computed(() => {
    const id = this.apelacion()?.resolucion?.id;
    const acto = this.resolucionesExpediente().find(r => r.id === id && r.tipoResolucion === 'RESOLUCION_FINAL');
    return acto?.fundamentos || 'La consulta informa la decisión registrada, pero no sus fundamentos. No acredita entrega, notificación eficaz ni cumplimiento.';
  });

  readonly resultadoCajaColor = computed(() => {
    const resultado = this.apelacion()?.resolucion?.tipoResolucion === 'RESOLUCION_FINAL' ? this.resultadoNormalizado() : '';
    if (resultado.startsWith('FUNDADO')) return 'var(--success)';
    if (resultado.includes('NULIDAD')) return 'var(--warning)';
    return 'var(--brand-700)';
  });

  readonly docCtx = computed<Partial<DocContext>>(() => {
    const ap = this.apelacion();
    const res = this.selectedAct();
    return {
      expediente: ap?.expediente || this.routeExpediente() || '',
      recurrente: (ap?.ciudadanoNombre || 'No registrado').toUpperCase(),
      entidad: ap?.entidadNombre || 'No registrada',
      correo: '—',
      direccionEntidad: '—',
      sumilla: ap?.solicitudAsunto || ap?.resumenSolicitudOriginal || 'No registrada',
      resolucionNro: res?.numeroResolucion || undefined,
      fechaResolucion: res?.fechaResolucion || undefined
    };
  });

  verResolucion(): void {
    this.draftError.set('');
    if (!this.puedePrepararBorrador()) return;
    try {
      const { blob, filename } = buildResolucionBlob(this.obtenerOfficialStage(),
        this.selectedAct()?.decision || undefined, this.docCtx());
      this.previewModalDoc.set({ nombre: filename, blob, tipo: 'application/pdf', expediente: this.docCtx().expediente });
      this.previewModalOpen.set(true);
    } catch {
      this.draftError.set('No se pudo preparar el borrador. No se ha emitido ningún documento.');
    }
  }

  cerrarPreviewModal(): void {
    this.previewModalOpen.set(false);
    this.previewModalDoc.set(null);
  }

  descargarResolucion(): void {
    this.draftError.set('');
    if (!this.puedePrepararBorrador()) return;
    try {
      resolucionPdf('download', this.obtenerOfficialStage(), this.selectedAct()?.decision || undefined, this.docCtx());
    } catch {
      this.draftError.set('No se pudo descargar el borrador. Reintente; no se ha emitido ningún documento.');
    }
  }

  private puedePrepararBorrador(): boolean {
    const expediente = this.apelacion()?.expediente;
    if (!this.contextoVigente() || this.loading() || this.error() || !this.selectedAct() || !expediente || expediente !== this.routeExpediente()) {
      this.draftError.set('Consulte correctamente el expediente antes de preparar un borrador.');
      return false;
    }
    return true;
  }

  private obtenerOfficialStage(): OfficialStage { const type = this.selectedAct()?.tipoResolucion; return type === 'RESOLUCION_FINAL' ? 'final' : type === 'SEGUNDA_CALIFICACION' ? 'segunda' : 'primera'; }
  constructor() {
    effect(() => { const rev = this.auth.cambiosSesion(); if (this.initialized && rev !== this.revision) untracked(() => this.cargarApelacion(this.routeExpediente())); });
    effect(() => {
      const ap = this.apelacion(); this.auth.cambiosSesion(); this.resourceRevision();
      if (this.initialized) untracked(() => this.consultarRecepcionActual(ap));
    });
  }
  private sessionKey(): string { try { const s = this.auth.obtenerSesion(); return JSON.stringify([s?.token, s?.usuarioId, s?.tipoUsuario, s?.entidadId]); } catch { return ''; } }
  contextoVigente(): boolean { return !this.destroyed && this.session === this.sessionKey(); }
  private current(query: number): boolean { return query === this.documentQuery && this.contextoVigente(); }
  ngOnInit(): void { this.initialized = true; this.routeSub = this.route.paramMap.subscribe(p => {
    const tab = this.route.snapshot?.queryParamMap?.get('tab');
    if (tab === 'notificaciones' || tab === 'subprocesos' || tab === 'subsanacion' || (tab === 'requerimientos' && this.rolInstitucional())) this.activeTab.set(tab);
    this.cargarApelacion(p.get('expediente') || '');
  }); }
  ngOnDestroy(): void { this.destroyed = true; this.documentQuery++; this.docsGeneration++; this.docsReads.unsubscribe(); this.docsDownloads.unsubscribe(); this.limpiarRecepcion(); this.requests.unsubscribe(); this.routeSub.unsubscribe(); this.cerrarPreviewModal(); }
  cargarApelacion(expediente: string): void {
    if (this.destroyed) return;
    if (this.pendingAction && expediente === this.routeExpediente() && this.session === this.sessionKey()) { this.recuperarActuacion(); return; }
    this.requests.unsubscribe(); this.requests = new Subscription(); const query = ++this.documentQuery;
    this.limpiarRecepcion();
    this.routeExpediente.set(expediente); this.session = this.sessionKey(); this.revision = this.auth.cambiosSesion(); this.resourceRevision.update(v => v + 1);
    this.cerrarPreviewModal(); this.draftError.set(''); this.apelacion.set(null); this.solicitudOrigen.set(null); this.origenEstado.set('ausente'); this.origenMensaje.set('');
    this.reiniciarDocumentos(); this.selectedActId.set(null); this.error.set(''); this.loading.set(true);
    this.pendingAction = null; this.actionUncertain.set(false);
    for (const category of ['descargo', 'notificacion', 'cumplimiento'] as const) { this.flags(category).busy.set(false); this.flags(category).message.set(''); this.flags(category).error.set(''); }
    let account; try { account = this.auth.obtenerSesion(); } catch { account = null; }
    if (!account?.token || !positiveId(account.usuarioId) || !['TTAIP', 'ADMINISTRADOR', 'FUNCIONARIO'].includes(account.tipoUsuario || '')) { this.loading.set(false); this.error.set('La sesión no permite consultar este detalle institucional. Utilice el acceso interno.'); return; }
    if (!expediente) { this.loading.set(false); this.error.set('No se encontró el expediente solicitado.'); return; }
    this.requests.add(this.apelacionService.findByExpediente(expediente).subscribe({ next: data => {
      if (!this.current(query)) return;
      if (!this.baseCompatible(data, expediente)) this.error.set('El servidor no devolvió el expediente solicitado o sus asociaciones son incompatibles.');
      else { this.apelacion.set(data); const id = data.resolucion?.id ?? data.resolucionSegundaCalificacion?.id ?? data.resolucionPrimeraCalificacion?.id; this.selectedActId.set(positiveId(id) && this.resolucionesExpediente().some(r => r.id === id) ? id : null); this.cargarContacto(data, query); }
      this.loading.set(false);
    }, error: err => { if (this.current(query)) { this.error.set(falloConsulta(err, 'la apelación').mensaje); this.loading.set(false); } } }));
  }
  private baseCompatible(data: unknown, code: string): data is Apelacion {
    if (!apelacionCompatible(data, code)) return false; const ap = data as Apelacion;
    if (ap.expedienteTtaip && (!positiveId(ap.expedienteTtaip.id) || ap.expedienteTtaip.numeroExpediente !== code)) return false;
    const s = this.auth.obtenerSesion(); return s?.tipoUsuario !== 'FUNCIONARIO' || (positiveId(s.entidadId) && ap.entidadId === s.entidadId);
  }
  private limpiarRecepcion(): void {
    ++this.receiptGeneration; this.receiptRequests.unsubscribe(); this.receiptRequests = new Subscription();
    this.receiptOwner = null; this.receipt.set(sinConsultaRecepcion());
  }
  private consultarRecepcionActual(ap: Apelacion | null): void {
    this.limpiarRecepcion();
    if (!ap || !this.contextoVigente() || !this.rolInstitucional() || !this.requiereRecepcion() || this.loading() || this.error()) return;
    const req = this.requerimiento(), query = this.documentQuery, generation = this.receiptGeneration, revision = this.auth.cambiosSesion();
    this.receiptOwner = { apelacion: ap, query, session: this.sessionKey(), revision, requerimientoId: req?.id };
    if (!Array.isArray(ap.resoluciones) && !Array.isArray(ap.expedienteTtaip?.resoluciones)) {
      this.receipt.set({ estado: 'incompleto', mensaje: 'No se han recuperado las actuaciones necesarias para identificar el requerimiento.' }); return;
    }
    if (this.detalle().resoluciones.error) {
      this.receipt.set({ estado: 'incompatible', mensaje: this.detalle().resoluciones.error }); return;
    }
    if (!req) {
      this.receipt.set({ estado: 'incompleto', mensaje: 'Información incompleta de la primera calificación INADMISIBLE y de su requerimiento. Consulte nuevamente; no se deduce la recepción del estado.' }); return;
    }
    this.receiptRequests.add(consultarRecepcionInstitucional(this.ttaipService, ap, req.id!).subscribe(value => {
      if (generation === this.receiptGeneration && revision === this.auth.cambiosSesion() && this.current(query) && this.apelacion() === ap && this.requerimiento()?.id === req.id) this.receipt.set(value);
    }));
  }
  reintentarRecepcion(): void { this.cargarApelacion(this.routeExpediente()); }
  revisarNotificaciones(): void {
    if (!this.contextoVigente() || this.loading() || this.error()) return;
    this.cambiarTab('notificaciones'); this.host.nativeElement.querySelector<HTMLElement>('#detail-tab-notificaciones')?.focus();
  }
  seleccionarActuacion(value: string): void { const id = Number(value); this.cerrarPreviewModal(); this.draftError.set(''); this.selectedActId.set(positiveId(id) && this.resolucionesExpediente().some(r => r.id === id) ? id : null); }
  onTabKey(event: KeyboardEvent, tab: DetailTab): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = this.tabs;
    const i = tabs.findIndex(t => t.id === tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (i + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
    this.cambiarTab(tabs[next].id);
    this.host.nativeElement.querySelector<HTMLElement>('#detail-tab-' + tabs[next].id)?.focus();
  }
  nombreSalaResolucion(r: { sala?: { nombre?: string } | null }): string { return r.sala?.nombre || 'Sala no informada'; }
  eficaciaLabel(n: NotificacionTtaip): string { if (this.detalle().historial.error) return 'Evidencia de eficacia incompleta'; return eficaciaConsultada(n, this.detalle().historial.data) ? 'Evidencia de eficacia consultada' : 'Eficacia no acreditada en los datos consultados'; }
  cambiarTab(tab: DetailTab): void {
    this.activeTab.set(tab);
    if (tab === 'adjuntos') this.cargarDocumentos();
  }
  onDocumentoSubido(): void {
    const expediente = this.expedienteDisplay();
    if (expediente && expediente !== '—') this.cargarApelacion(expediente);
  }
  private datoContacto(valor: string | null | undefined): string {
    if (positiveId(this.apelacion()?.solicitudId) && this.origenEstado() === 'cargando') return 'Consultando…';
    return (valor || '').trim() || 'No informado';
  }
  private causalVisible(ap: Apelacion | null, respuesta: Solicitud['respuesta'] | undefined): string {
    const codigo = (respuesta?.causalDenegatoria || '').trim();
    if (codigo) return CAUSAL_ENTIDAD[codigo] || codigo;
    const tipo = respuesta?.tipoRespuesta;
    if (tipo && TIPO_RESPUESTA[tipo]) return TIPO_RESPUESTA[tipo];
    const denegatoria = (ap?.tipoDenegatoria || '').trim();
    if (denegatoria === 'EXPRESA') return 'Denegatoria expresa';
    if (denegatoria === 'TACITA') return 'Denegatoria tácita';
    if (denegatoria) return denegatoria;
    return 'La entidad no registró la causal';
  }
  private fundamentoVisible(ap: Apelacion | null, respuesta: Solicitud['respuesta'] | undefined): string {
    const contenido = (respuesta?.contenido || '').trim();
    const legal = (respuesta?.fundamentoLegal || '').trim();
    const partes = [contenido, legal && legal !== contenido ? legal : ''].filter(Boolean);
    if (partes.length) return partes.join('\n');
    const resumen = (ap?.resumenRespuestaEntidad || '').trim();
    return resumen || 'La respuesta de la entidad no trae el fundamento.';
  }
  private cargarContacto(ap: Apelacion, query: number): void {
    if (!positiveId(ap.solicitudId)) { this.solicitudOrigen.set(null); this.origenEstado.set('ausente'); return; }
    this.origenEstado.set('cargando'); this.origenMensaje.set('');
    this.requests.add(this.solicitudService.findById(ap.solicitudId).subscribe({
      next: sol => {
        if (!this.current(query) || this.apelacion() !== ap) return;
        if (!this.origenCompatible(sol, ap)) { this.solicitudOrigen.set(null); this.origenEstado.set('error'); this.origenMensaje.set('Los antecedentes no corresponden a la solicitud de origen.'); return; }
        this.solicitudOrigen.set(sol); this.origenEstado.set('disponible');
        if (this.activeTab() === 'adjuntos') this.cargarDocumentos();
      },
      error: err => { if (this.current(query) && this.apelacion() === ap) { this.solicitudOrigen.set(null); this.origenEstado.set('error'); this.origenMensaje.set(falloConsulta(err, 'la solicitud de origen').mensaje); } }
    }));
  }
  private origenCompatible(sol: Solicitud, ap: Apelacion): boolean {
    if (!sol || sol.id !== ap.solicitudId) return false;
    if (ap.solicitudExpediente && sol.expediente !== ap.solicitudExpediente) return false;
    if (sol.ciudadanoId != null && ap.ciudadanoId != null && sol.ciudadanoId !== ap.ciudadanoId) return false;
    const respuesta = sol.respuesta as { solicitudId?: number } | null | undefined;
    return !respuesta || respuesta.solicitudId == null || respuesta.solicitudId === sol.id;
  }
  private reiniciarDocumentos(): void {
    this.docsGeneration++; this.docsReads.unsubscribe(); this.docsReads = new Subscription();
    this.docsKey = ''; this.docsLoaded = false; this.documentGroups.set([]); this.documentSearch.set(''); this.documentFilter.set('');
    this.closedGroups.set({}); this.loadingDocuments.set(false); this.documentError.set(''); this.downloadError.set(''); this.downloadingId.set(null);
  }
  private entidadDocumental(): string { return this.apelacion()?.entidadNombre || this.apelacion()?.entidadExternaNombre || 'Entidad'; }
  private documentosDelExpediente(): DocumentoMetadata[] {
    const vistos = new Set<number>();
    return this.documentGroups().flatMap(group => group.documents).filter(doc => {
      const id = doc.id;
      if (!positiveId(id) || vistos.has(id)) return false;
      vistos.add(id);
      return true;
    });
  }
  /** El Tribunal ve el legajo. La entidad solo ve lo presentado por el administrado y lo notificado a ella. */
  private vistaInstitucional(): boolean { return this.rolInstitucional(); }
  leyendaDocumentos(): string {
    return this.vistaInstitucional()
      ? 'Cada archivo indica su tipo, quién lo presentó y la fecha. El tipo no confirma por sí solo a qué escrito corresponde.'
      : 'Se muestran los documentos que presentó el administrado y los que el Tribunal notificó a su entidad. No aparecen documentos de otras entidades que no hayan sido notificados.';
  }
  private cedulasDeLaEntidad() {
    return this.cedulasExpediente().filter(cedula => cedula.destinatario === 'ENTIDAD_PUBLICA' && positiveId(cedula.id));
  }
  private resolucionNotificadaALaEntidad(resolucion: { id?: number; decision?: string | null; cedulas?: { id?: number }[] | null }): boolean {
    if (!positiveId(resolucion.id) || resolucion.decision === 'INADMISIBLE') return false;
    const notificadas = new Set(this.cedulasDeLaEntidad().map(cedula => cedula.id));
    return !!resolucion.cedulas?.some(cedula => positiveId(cedula.id) && notificadas.has(cedula.id));
  }
  private relacionesDocumentales(): { label: string; relation: DocumentoRelation }[] {
    const ap = this.apelacion();
    if (!positiveId(ap?.id)) return [];
    const groups: { label: string; relation: DocumentoRelation }[] = [];
    if (positiveId(ap.solicitudId)) groups.push({ label: 'Solicitud de origen', relation: { solicitudId: ap.solicitudId } });
    if (this.vistaInstitucional()) {
      const respuestaId = this.solicitudOrigen()?.respuesta?.id;
      if (positiveId(respuestaId)) groups.push({ label: 'Respuesta de la entidad', relation: { respuestaId } });
    }
    groups.push({ label: 'Recurso de apelación', relation: { apelacionId: ap.id } });
    if (this.vistaInstitucional()) {
      if (!this.detalle().resoluciones.error) {
        for (const resolucion of this.resolucionesExpediente()) {
          if (positiveId(resolucion.id)) groups.push({ label: 'Resolución', relation: { resolucionId: resolucion.id } });
        }
      }
      if (!this.detalle().cedulas.error) {
        for (const cedula of this.cedulasExpediente()) {
          if (positiveId(cedula.id)) groups.push({ label: 'Cédula', relation: { cedulaNotificacionId: cedula.id } });
        }
      }
      const expediente = ap.expedienteTtaip;
      if (positiveId(expediente?.id) && expediente.numeroExpediente === ap.expediente) groups.push({ label: 'Expediente TTAIP', relation: { expedienteTtaipId: expediente.id } });
      return groups;
    }
    if (!this.detalle().cedulas.error) {
      if (!this.detalle().resoluciones.error) {
        for (const resolucion of this.resolucionesExpediente()) {
          if (this.resolucionNotificadaALaEntidad(resolucion)) groups.push({ label: 'Resolución notificada a la entidad', relation: { resolucionId: resolucion.id! } });
        }
      }
      for (const cedula of this.cedulasDeLaEntidad()) {
        groups.push({ label: 'Notificación a la entidad', relation: { cedulaNotificacionId: cedula.id } });
      }
    }
    return groups;
  }
  cargarDocumentos(forzar = false): void {
    const ap = this.apelacion();
    if (!ap || !this.contextoVigente() || this.loading() || this.error()) return;
    const groups = this.relacionesDocumentales();
    const key = JSON.stringify(groups);
    if (!forzar && key === this.docsKey && (this.docsLoaded || this.loadingDocuments())) return;
    const generation = this.docsGeneration, query = this.documentQuery;
    this.docsKey = key; this.docsReads.unsubscribe(); this.docsReads = new Subscription();
    this.loadingDocuments.set(true); this.documentError.set(''); this.documentGroups.set([]); this.docsLoaded = false;
    if (!groups.length) { this.loadingDocuments.set(false); this.docsLoaded = true; return; }
    this.docsReads.add(forkJoin(groups.map(group => this.documentoService.listByRelation(group.relation))).subscribe({
      next: values => {
        if (generation !== this.docsGeneration || !this.current(query)) return;
        const accepted: { label: string; relation: DocumentoRelation; documents: DocumentoMetadata[] }[] = [];
        const ids = new Set<number>();
        let invalid = false;
        for (let index = 0; index < groups.length; index++) {
          const documents = documentosRelacionados(values[index], groups[index].relation);
          if (documents === null || documents.some(doc => ids.has(doc.id!) || !ids.add(doc.id!))) { invalid = true; break; }
          accepted.push({ ...groups[index], documents });
        }
        if (invalid) this.documentError.set('Datos documentales incompletos o asociados a otro recurso. No se muestran archivos sustitutos.');
        else { this.documentGroups.set(accepted); this.docsLoaded = true; }
        this.loadingDocuments.set(false);
      },
      error: err => { if (generation === this.docsGeneration && this.current(query)) { this.loadingDocuments.set(false); this.documentError.set(falloConsulta(err, 'los documentos').mensaje); } }
    }));
  }
  groupOpen(clave: string): boolean { return !!this.documentSearch().trim() || !!this.documentFilter() || !this.closedGroups()[clave]; }
  toggleDocumentGroup(clave: string): void { if (!this.documentSearch().trim() && !this.documentFilter()) this.closedGroups.update(groups => ({ ...groups, [clave]: !groups[clave] })); }
  documentGroupId(clave: string): string { return 'detail-docs-' + clave; }
  nombreDocumento(doc: DocumentoMetadata): string { return nombreDeDocumento(doc); }
  private documentoActual(doc: DocumentoMetadata): boolean { return this.contextoVigente() && this.documentGroups().some(group => group.documents.some(item => item === doc && positiveId(item.id))); }
  verDocumento(doc: DocumentoMetadata): void {
    if (this.documentoActual(doc)) { this.previewModalDoc.set({ id: doc.id, nombre: this.nombreDocumento(doc), tipo: doc.contentType, expediente: this.apelacion()!.expediente }); this.previewModalOpen.set(true); }
  }
  descargarDocumento(doc: DocumentoMetadata): void {
    if (!this.documentoActual(doc) || this.downloadingId() != null) { this.downloadError.set('Consulte un archivo identificado del recurso actual.'); return; }
    const generation = this.docsGeneration, query = this.documentQuery;
    this.downloadingId.set(doc.id!); this.downloadError.set('');
    this.docsDownloads.add(this.documentoService.download(doc.id!, this.nombreDocumento(doc)).subscribe({
      next: ({ blob, filename }) => {
        if (generation !== this.docsGeneration || !this.current(query)) return;
        this.downloadingId.set(null); const url = URL.createObjectURL(blob);
        try { const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.click(); }
        finally { URL.revokeObjectURL(url); }
      },
      error: err => { if (generation === this.docsGeneration && this.current(query)) { this.downloadingId.set(null); this.downloadError.set(falloConsulta(err, 'el documento').mensaje); } }
    }));
  }

  private flags(category: 'descargo' | 'notificacion' | 'cumplimiento') {
    return category === 'descargo' ? { busy: this.descargoLoading, message: this.descargoMessage, error: this.descargoError }
      : category === 'notificacion' ? { busy: this.notificacionLoading, message: this.notificacionMessage, error: this.notificacionError }
      : { busy: this.cumplimientoLoading, message: this.cumplimientoMessage, error: this.cumplimientoError };
  }
  actorLabel(): string { const s = this.auth.obtenerSesion(); return s?.nombre?.trim() || 'Miembro del Tribunal'; }
  onAudienciaCambio(_audiencia: AudienciaInformeOral): void {
    // Si la audiencia fue actualizada localmente, se sincroniza el estado de la vista
  }

  onSolicitarSuspensionInformeOral(payload: RegistrarSuspensionTtaipPayload): void {
    this.registrarSuspensionAdicional('INFORME_ORAL', payload.solicitante, payload.motivo, payload.responsable, payload.observacion || '');
  }

  onCancelarSuspensionInformeOral(suspensionId: number): void {
    this.cancelarSuspension(suspensionId, 'Cancelación de suspensión por conclusión de informe oral');
  }
  private allowed(category: 'descargo' | 'notificacion' | 'cumplimiento', collection: DetailCollection, target?: number, entity = false): boolean {
    const f = this.flags(category), ap = this.apelacion();
    if (!this.contextoVigente() || !ap || this.loading() || this.error() || this.pendingAction) return false;
    const role = this.auth.obtenerSesion()?.tipoUsuario;
    if (!(entity ? ['FUNCIONARIO', 'ADMINISTRADOR'] : ['TTAIP', 'ADMINISTRADOR']).includes(role || '')) { f.error.set('Esta actuación corresponde a otro rol. Se conserva la autorización del servidor.'); return false; }
    if (!positiveId(this.expedienteTtaip()?.id) || this.detalle()[collection].error || (target != null && !this.records(collection).some(r => r['id'] === target))) {
      f.error.set('No se ha consultado una actuación identificada de este expediente. No se envía la operación.'); return false;
    }
    return true;
  }
  private records(collection: DetailCollection): Record<string, unknown>[] { return (this.detalle()[collection].data ?? []) as unknown as Record<string, unknown>[]; }
  private run(category: 'descargo' | 'notificacion' | 'cumplimiento', collection: DetailCollection, command: Observable<unknown>, expectedId?: number, intended: Record<string, unknown> = {}): void {
    const ap = this.apelacion()!, query = this.documentQuery, f = this.flags(category);
    const op = { category, collection, code: ap.expediente, apelacionId: ap.id, id: expectedId, result: undefined as Record<string, unknown> | undefined };
    const previousIds = this.records(collection).map(r => r['id']);
    this.pendingAction = op; f.busy.set(true); f.error.set(''); f.message.set(''); this.cerrarPreviewModal();
    this.requests.add(command.subscribe({ next: value => {
      if (!this.current(query) || this.pendingAction !== op) return;
      const result = value as Record<string, unknown> | null;
      const applied = !!result && Object.entries(intended).every(([key, value]) => key.startsWith('fecha') && typeof value === 'string'
        ? Number.isFinite(Date.parse(String(result[key]))) && Date.parse(String(result[key])) === Date.parse(value) : result[key] === value);
      if (!positiveId(result?.['id']) || (expectedId != null && result?.['id'] !== expectedId) || (expectedId == null && previousIds.includes(result['id'])) || !applied) { this.uncertain('No se recibió una actuación compatible. Consulte el estado antes de repetir.'); return; }
      op.id = result['id']; op.result = result; this.queryAction(op, query);
    }, error: err => {
      if (!this.current(query) || this.pendingAction !== op) return; f.busy.set(false);
      if ([400, 401, 403, 404, 409, 422].includes(err?.status)) { this.pendingAction = null; f.error.set(falloConsulta(err, 'la actuación').mensaje); }
      else this.uncertain('Resultado incierto. El servidor puede haberlo registrado. Consulte sin repetir la operación.');
    } }));
  }
  private uncertain(message: string): void { this.actionUncertain.set(true); const op = this.pendingAction; if (op) { this.flags(op.category).busy.set(false); this.flags(op.category).error.set(message); } }
  recuperarActuacion(): void { const op = this.pendingAction; if (op && this.contextoVigente() && !this.flags(op.category).busy()) this.queryAction(op, this.documentQuery); }
  private queryAction(op: NonNullable<TtaipResolucionDetalleComponent['pendingAction']>, query: number): void {
    const f = this.flags(op.category); f.busy.set(true);
    this.requests.add(this.apelacionService.findByExpediente(op.code).subscribe({ next: ap => {
      if (!this.current(query) || this.pendingAction !== op) return; f.busy.set(false);
      if (!this.baseCompatible(ap, op.code) || ap.id !== op.apelacionId) { this.apelacion.set(null); this.cerrarPreviewModal(); this.error.set('La recuperación no corresponde al expediente esperado.'); this.uncertain('La recuperación no corresponde al expediente. No se confirma la actuación.'); return; }
      this.apelacion.set(ap); this.error.set(''); this.cerrarPreviewModal(); this.resourceRevision.update(v => v + 1);
      const records = (detalleConsultado(ap)[op.collection].data ?? []) as unknown as Record<string, unknown>[];
      const found = records.find(r => r['id'] === op.id);
      const keys = Object.keys(op.result ?? {}).filter(k => op.result![k] == null || typeof op.result![k] !== 'object');
      if (!positiveId(op.id) || !op.result || !found || !keys.every(k => found[k] === op.result![k])) { this.uncertain('Consulta realizada. La actuación no se puede atribuir al envío por sus datos. No se repite automáticamente.'); return; }
      this.pendingAction = null; this.actionUncertain.set(false); f.error.set(''); f.message.set('Actuación registrada y recuperada. No acredita por sí sola firma, entrega o inicio de plazo.');
    }, error: () => { if (this.current(query) && this.pendingAction === op) { this.apelacion.set(null); this.cerrarPreviewModal(); this.error.set('No se pudo recuperar el expediente de la actuación. Reintente la consulta.'); this.uncertain('No se pudo recuperar la actuación. Consulte sin repetir la escritura.'); } } }));
  }
  requerirDescargos(observacion: string): void {
    if (!this.allowed('descargo', 'descargosEntidad') || this.apelacion()?.estado !== 'EN_RESOLUCION' || this.descargosExpediente().some(d => d.estadoDescargo === 'REQUERIDO')) { this.descargoError.set('El requerimiento exige EN_RESOLUCION, datos completos y ausencia de otro descargo pendiente.'); return; }
    this.run('descargo', 'descargosEntidad', this.ttaipService.requerirDescargos(this.expedienteTtaip()!.id, { responsableTtaip: this.actorLabel(), observacion: observacion.trim() || null }), undefined, { estadoDescargo: 'REQUERIDO' });
  }
  presentarDescargo(id: number | undefined, resumen: string, referencia: string, responsable: string, observacion: string): void {
    if (!positiveId(id) || !this.allowed('descargo', 'descargosEntidad', id, true)) return;
    if (!resumen.trim() || !responsable.trim()) { this.descargoError.set('Complete resumen del descargo y responsable de la entidad.'); return; }
    this.run('descargo', 'descargosEntidad', this.ttaipService.presentarDescargo(this.expedienteTtaip()!.id, id, { resumenDescargo: resumen, referenciaDocumento: referencia || null, responsableEntidad: responsable, observacion: observacion || null }), id, { resumenDescargo: resumen, responsableEntidad: responsable });
  }
  registrarSuspensionAdicional(tipo: SuspensionAdicional, solicitante: string, motivo: string, responsable: string, observacion: string): void {
    if (!this.allowed('descargo', 'suspensionesPlazo') || this.apelacion()?.estado !== 'EN_RESOLUCION') return;
    const actor = this.parseSuspensionSolicitante(solicitante); if (!actor || !motivo.trim() || !responsable.trim()) { this.descargoError.set('Complete solicitante, motivo y responsable de la suspensión.'); return; }
    const request = { solicitante: actor, motivo, responsable, observacion: observacion || null };
    this.run('descargo', 'suspensionesPlazo', tipo === 'INFORME_ORAL' ? this.ttaipService.registrarInformeOral(this.expedienteTtaip()!.id, request) : this.ttaipService.registrarInformacionComplementaria(this.expedienteTtaip()!.id, request), undefined, { estadoSuspension: 'ACTIVA', motivoSuspension: tipo, solicitante: actor, motivoDetalle: motivo });
  }
  cancelarSuspension(id: number | undefined, observacion: string): void {
    if (!positiveId(id) || !this.allowed('descargo', 'suspensionesPlazo', id) || !this.suspensionesExpediente().some(s => s.id === id && this.esSuspensionAdicionalActiva(s))) return;
    this.run('descargo', 'suspensionesPlazo', this.ttaipService.cancelarSuspension(this.expedienteTtaip()!.id, id, { responsable: this.actorLabel(), observacion: observacion || null }), id, { estadoSuspension: 'CANCELADA' });
  }
  crearSeguimientoCumplimiento(_observacion: string): void { this.cumplimientoError.set('Apertura no disponible: falta una base de inicio acreditada inequívoca en el contrato. La fecha registrada no certifica un vencimiento legal.'); }
  registrarCumplimiento(id: number | undefined, tipo: string, descripcion: string, evidencia: string, responsable: string, observacion: string): void {
    if (!positiveId(id) || !this.allowed('cumplimiento', 'cumplimientosResolucion', id, true)) return;
    const parsed = this.parseTipoCumplimiento(tipo); if (!parsed || !descripcion.trim() || !responsable.trim()) { this.cumplimientoError.set('Complete tipo, descripción y responsable del cumplimiento.'); return; }
    this.run('cumplimiento', 'cumplimientosResolucion', this.ttaipService.registrarCumplimiento(this.expedienteTtaip()!.id, id, { tipoCumplimiento: parsed, descripcionCumplimiento: descripcion, evidenciaCumplimiento: this.isUrl(evidencia) ? evidencia : null, referenciaDocumento: this.isUrl(evidencia) ? null : evidencia || null, responsableEntidad: responsable, observacion: observacion || null }), id, { tipoCumplimiento: parsed, descripcionCumplimiento: descripcion, responsableEntidad: responsable });
  }
  observarCumplimiento(id: number | undefined, observacion: string): void {
    if (!positiveId(id) || !this.allowed('cumplimiento', 'cumplimientosResolucion', id)) return;
    if (!observacion.trim()) { this.cumplimientoError.set('Complete el sustento de observación.'); return; }
    this.run('cumplimiento', 'cumplimientosResolucion', this.ttaipService.observarCumplimiento(this.expedienteTtaip()!.id, id, { responsableTtaip: this.actorLabel(), observacion }), id, { estadoCumplimiento: 'OBSERVADO', observacion });
  }
  cerrarCumplimiento(id: number | undefined, observacion: string): void {
    if (!positiveId(id) || !this.allowed('cumplimiento', 'cumplimientosResolucion', id)) return;
    this.run('cumplimiento', 'cumplimientosResolucion', this.ttaipService.cerrarCumplimiento(this.expedienteTtaip()!.id, id, { responsableTtaip: this.actorLabel(), observacion: observacion || null }), id, { estadoCumplimiento: 'CERRADO' });
  }
  private fechaAcreditada(value: string): string | null { return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) && Number.isFinite(Date.parse(value)) ? value.length === 16 ? value + ':00' : value : null; }
  registrarConstanciaNotificacion(id: number | undefined, medio: string, envio: string, codigo: string, constancia: string, evidencia: string): void {
    if (!positiveId(id) || !this.allowed('notificacion', 'notificaciones', id)) return;
    if (!medio.trim() || !constancia.trim()) { this.notificacionError.set('Complete medio y constancia de envío.'); return; }
    this.run('notificacion', 'notificaciones', this.ttaipService.registrarConstanciaEnvio(this.expedienteTtaip()!.id, id, { medioNotificacion: medio, codigoEnvio: envio || null, codigoConstancia: codigo || null, constanciaEnvio: constancia, evidenciaUrl: this.isUrl(evidencia) ? evidencia : null, referenciaEvidencia: this.isUrl(evidencia) ? null : evidencia || null, responsable: this.actorLabel(), observacion: null }), id, { medioNotificacion: medio, constanciaEnvio: constancia });
  }
  registrarAcuseNotificacion(id: number | undefined, estadoAcuse: string, acuse: string, evidencia: string, fecha = ''): void {
    if (!positiveId(id) || !this.allowed('notificacion', 'notificaciones', id)) return;
    const estado = this.parseEstadoAcuse(estadoAcuse); if (!estado || !acuse.trim() || (fecha && !this.fechaAcreditada(fecha))) { this.notificacionError.set('Complete estado, acuse y una fecha acreditada válida cuando corresponda.'); return; }
    this.run('notificacion', 'notificaciones', this.ttaipService.registrarAcuseAutomatico(this.expedienteTtaip()!.id, id, { estadoAcuse: estado, acuseAutomatico: acuse, fechaAcuse: this.fechaAcreditada(fecha), evidenciaUrl: this.isUrl(evidencia) ? evidencia : null, referenciaEvidencia: this.isUrl(evidencia) ? null : evidencia || null, responsable: this.actorLabel(), observacion: null }), id, { estadoAcuse: estado, acuseAutomatico: acuse, ...(fecha ? { fechaAcuse: this.fechaAcreditada(fecha) } : {}) });
  }
  validarNotificacionManual(id: number | undefined, observacion: string, evidencia: string, fecha = ''): void {
    if (!positiveId(id) || !this.allowed('notificacion', 'notificaciones', id)) return;
    if (!observacion.trim() || (fecha && !this.fechaAcreditada(fecha))) { this.notificacionError.set('Complete el sustento y una fecha acreditada válida cuando corresponda.'); return; }
    this.run('notificacion', 'notificaciones', this.ttaipService.validarNotificacionManualmente(this.expedienteTtaip()!.id, id, { responsableValidacion: this.actorLabel(), observacionValidacion: observacion, fechaEficacia: this.fechaAcreditada(fecha), evidenciaUrl: this.isUrl(evidencia) ? evidencia : null, referenciaEvidencia: this.isUrl(evidencia) ? null : evidencia || null }), id, { estado: 'VALIDADA', validadaManualmente: true, observacionValidacion: observacion });
  }
  notificationStatusClass(notificacion: NotificacionTtaip): string {
    const estado = this.normalizeKey(notificacion.estado);
    if (estado === 'FALLIDA' || estado === 'OBSERVADA') return 'pill pill-high';
    if (eficaciaConsultada(notificacion, this.detalle().historial.data)) return 'pill pill-low';
    return 'pill pill-medium';
  }

  notificationEvidenceLabel(notificacion: NotificacionTtaip): string {
    return notificacion.evidenciaUrl || notificacion.referenciaEvidencia || notificacion.codigoConstancia || 'Sin evidencia registrada';
  }

  cumplimientoStatusClass(cumplimiento: CumplimientoResolucionTtaip): string {
    const estado = this.normalizeKey(cumplimiento.estadoCumplimiento);
    if (estado === 'VENCIDO' || estado === 'OBSERVADO') return 'pill pill-high';
    if (estado === 'CUMPLIDO' || estado === 'CERRADO') return 'pill pill-low';
    return 'pill pill-medium';
  }

  private esSuspensionAdicionalActiva(suspension: SuspensionPlazoTtaip): boolean {
    const motivo = this.normalizeKey(suspension.motivoSuspension);
    return suspension.estadoSuspension === 'ACTIVA'
      && (motivo === 'INFORME_ORAL' || motivo === 'INFORMACION_COMPLEMENTARIA');
  }

  private parseEstadoAcuse(value: string): 'ENTREGADO' | 'FALLIDO' | 'NO_RECIBIDO' | 'OBSERVADO' | null {
    const normalized = this.normalizeKey(value);
    if (normalized === 'ENTREGADO' || normalized === 'FALLIDO' || normalized === 'NO_RECIBIDO' || normalized === 'OBSERVADO') {
      return normalized;
    }
    return null;
  }

  private parseTipoCumplimiento(value: string): TipoCumplimiento | null {
    const normalized = this.normalizeKey(value);
    if (normalized === 'TOTAL' || normalized === 'PARCIAL' || normalized === 'NO_CUMPLE') {
      return normalized;
    }
    return null;
  }

  private isUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
  }

  dotColor(icon: TimelineIcon): string {
    if (icon === 'x') return 'var(--brand-700)';
    if (icon === 'alert') return 'var(--warning)';
    return 'var(--success)';
  }

  ciudadanoIniciales(): string {
    const ciudadano = this.dataView().ciudadano.trim();
    const words = ciudadano.split(/\s+/).filter((word) => word.length > 0);

    if (words.length === 0) return 'CI';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  etiquetaEvento(value?: string | null): string { return this.formatEventoTtaip(value); }
  etiquetaActuacion(tipo?: string | null, decision?: string | null): string {
    const nombres: Record<string, string> = {
      PRIMERA_CALIFICACION: 'Primera calificación',
      SEGUNDA_CALIFICACION: 'Segunda calificación',
      RESOLUCION_FINAL: 'Resolución final',
    };
    const clave = this.normalizeKey(tipo);
    const nombre = clave ? (nombres[clave] || this.formatEventoTtaip(clave)) : 'Actuación';
    return decision ? `${nombre} · ${this.formatDecision(decision)}` : nombre;
  }
  etiquetaEstado(value?: string | null): string {
    const clave = this.normalizeKey(value);
    if (!clave) return 'Estado no registrado';
    return this.formatEventoTtaip(clave);
  }
  iconoTrazabilidad(tipo?: string | null): 'inicio' | 'resolucion' | 'notificacion' | 'estado' | 'documento' {
    if (tipo === 'APERTURA_EXPEDIENTE') return 'inicio';
    if (tipo === 'RESOLUCION_EMITIDA') return 'resolucion';
    if (tipo === 'CAMBIO_ESTADO') return 'estado';
    if (tipo?.includes('NOTIFICACION') || tipo === 'CEDULA_EMITIDA' || tipo === 'REPROCESO_REGISTRADO') return 'notificacion';
    return 'documento';
  }
  private buildTimeline(): TimelineItem[] {
    const apelacion = this.apelacion();
    if (!apelacion) return [];
    const eventos: TimelineItem[] = [{
      id: apelacion.id,
      fecha: this.formatDateLabel(apelacion.fechaApelacion),
      titulo: 'Apelación presentada',
      descripcion: 'Recurso de apelación recibido y registrado en el Tribunal.',
      icon: 'check',
    }];
    const primera = apelacion.resolucionPrimeraCalificacion;
    if (positiveId(primera?.id) && apelacion.calificacionPrimera) {
      eventos.push({
        id: primera.id,
        fecha: this.formatDateLabel(primera.fechaResolucion),
        titulo: `1ra calificación · ${this.formatDecision(apelacion.calificacionPrimera)}`,
        descripcion: 'Calificación de admisibilidad registrada por el Tribunal.',
        icon: this.iconForDecision(apelacion.calificacionPrimera),
      });
    }
    const subsanacionRegistrada = Boolean(apelacion.fundamentosSubsanacion?.trim()) || (apelacion.documentosSubsanacion?.length ?? 0) > 0;
    if (subsanacionRegistrada) {
      eventos.push({
        id: -apelacion.id,
        fecha: 'Fecha no informada',
        titulo: 'Subsanación presentada',
        descripcion: 'El administrado registró el escrito de subsanación.',
        icon: 'check',
      });
    }
    const segunda = apelacion.resolucionSegundaCalificacion;
    if (positiveId(segunda?.id) && apelacion.calificacionSegunda) {
      eventos.push({
        id: segunda.id,
        fecha: this.formatDateLabel(segunda.fechaResolucion),
        titulo: `2da calificación · ${this.formatDecision(apelacion.calificacionSegunda)}`,
        descripcion: 'Segunda calificación registrada tras la subsanación.',
        icon: this.iconForDecision(apelacion.calificacionSegunda),
      });
    }
    const final = apelacion.resolucion;
    if (positiveId(final?.id) && final.tipoResolucion === 'RESOLUCION_FINAL') {
      const decision = final.decision || apelacion.resultado;
      eventos.push({
        id: final.id,
        fecha: this.formatDateLabel(final.fechaResolucion || apelacion.expedienteTtaip?.fechaResolucionFinal),
        titulo: `Resolución final · ${this.formatDecision(decision)}`,
        descripcion: 'El Tribunal registró la resolución final.',
        icon: this.iconForDecision(decision),
      });
    }
    const cumplimiento = apelacion.expedienteTtaip?.cumplimientoDocumental;
    if (cumplimiento?.fechaRemision) {
      eventos.push({
        id: 'cumplimiento',
        fecha: this.formatDateLabel(cumplimiento.fechaRemision),
        titulo: 'Cumplimiento',
        descripcion: 'La entidad remitió el cumplimiento al Tribunal.',
        icon: 'check',
      });
      if (this.listoParaArchivo()) {
        eventos.push({
          id: 'cierre-cumplimiento',
          fecha: cumplimiento.fechaCierre ? this.formatDateLabel(cumplimiento.fechaCierre) : '',
          titulo: 'Listo para archivo y publicación',
          descripcion: 'El expediente quedó resuelto y se completó el cumplimiento.',
          icon: 'check',
        });
      }
    }
    return eventos.reverse();
  }
  private normalizeKey(value?: string | null): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  private parseSuspensionSolicitante(value: string): SuspensionSolicitante | null {
    const normalized = this.normalizeKey(value);
    if (normalized === 'CIUDADANO' || normalized === 'ENTIDAD_PUBLICA' || normalized === 'TTAIP') {
      return normalized;
    }
    return null;
  }

  private formatEstado(value: string): string {
    switch (this.normalizeKey(value)) {
      case 'PENDIENTE_ELEVACION':
        return 'Pendiente de elevacion al TTAIP';
      case 'EN_CALIFICACION_1':
        return 'En primera calificacion';
      case 'EN_SUBSANACION':
        return 'En subsanacion';
      case 'EN_CALIFICACION_2':
        return 'En segunda calificacion';
      case 'NOTIFICACION_SEGUNDA_CALIFICACION':
        return 'Notificacion de segunda calificacion';
      case 'EN_RESOLUCION':
        return 'En resolucion final';
      case 'NOTIFICACION_RESOLUCION_FINAL':
        return 'Notificación de la resolución final pendiente';
      case 'EN_CUMPLIMIENTO':
        return 'En cumplimiento';
      case 'RESUELTO':
        return 'Resuelto';
      case 'RESUELTO_FUNDADO':
        return 'Resuelto fundado';
      case 'RESUELTO_FUNDADO_EN_PARTE':
        return 'Resuelto fundado en parte';
      case 'RESUELTO_INFUNDADO':
        return 'Resuelto infundado';
      case 'RESUELTO_INFUNDADO_EN_PARTE':
        return 'Resuelto infundado en parte';
      case 'RESUELTO_IMPROCEDENTE':
        return 'Resuelto improcedente';
      case 'RESUELTO_ESTESE_A_LO_RESUELTO':
        return 'Estese a lo resuelto';
      case 'RESUELTO_NULIDAD_ACTO':
        return 'Nulidad del acto';
      case 'TENER_POR_NO_PRESENTADO':
        return 'No presentado';
      case 'CONCLUSION_SUSTRACCION_MATERIA':
        return 'Conclusion por sustraccion de materia';
      case 'CONCLUSION_DESISTIMIENTO':
        return 'Conclusion por desistimiento';
      default:
        return value ? value.replaceAll('_', ' ') : 'Estado no informado';
    }
  }

  private formatDateLabel(raw?: string | null, includeTime = false): string {
    if (!raw) return 'Fecha no informada';
    const escrita = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (escrita && !includeTime) return `${escrita[3]}/${escrita[2]}/${escrita[1]}`;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return 'Fecha no informada';

    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: includeTime ? '2-digit' : undefined,
      minute: includeTime ? '2-digit' : undefined,
      hour12: false
    }).format(date);
  }

  private formatDecision(value?: string | null): string {
    const normalized = this.normalizeKey(value);
    return normalized ? normalized.replaceAll('_', ' ') : 'SIN DECISIÓN';
  }

  private formatEventoTtaip(value?: string | null): string {
    const normalized = this.normalizeKey(value);
    if (!normalized) return 'Evento TTAIP';
    return normalized
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^\w|\s\w/g, (letter) => letter.toUpperCase());
  }

  private iconForEventoTtaip(value?: string | null): TimelineIcon {
    const normalized = this.normalizeKey(value);
    if (normalized.includes('REPROCESO')) return 'alert';
    if (normalized.includes('DESCARGO') || normalized.includes('SUSPENSION') || normalized.includes('CUMPLIMIENTO')) return 'alert';
    if (normalized.includes('CAMBIO_ESTADO')) return 'check';
    return 'check';
  }

  private iconForDecision(value?: string | null): TimelineIcon {
    const normalized = this.normalizeKey(value);
    if (normalized.includes('INADMISIBLE')) {
      return 'alert';
    }
    if (normalized.includes('IMPROCEDENTE') || normalized.includes('INFUNDADO') || normalized.includes('NO_PRESENTADO')) {
      return 'x';
    }
    return 'check';
  }
}
