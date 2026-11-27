import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { combineLatest, Subscription, timeout } from 'rxjs';
import { ApelacionService } from '../../services/apelacion.service';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { Apelacion, ApelacionCreate, ApelacionCreateAnteEntidad, ApelacionCreateExterna, CanalPresentacionApelacion, TipoDenegatoriaApelacion, TipoOrigenApelacion } from '../../models/apelacion.model';
import { Entidad } from '../../models/entidad.model';
import { aISO, hoyLima } from '../../models/calendario.model';
import { ampliacionParaApelar, ampliacionPermiteApelar, Solicitud, tienePlazoAmpliadoVigente } from '../../models/solicitud.model';
import { DocumentoMetadata, DOCUMENTO_ACCEPT, DOCUMENTO_RELATION_KEYS, TipoDocumento, validarDocumento } from '../../models/documento.model';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { YaikuCargandoComponent } from '../../shared/yaiku-cargando.component';
import { ReferenceConfirmModalComponent, ReferenceConfirmSummary, ReferenceConfirmWarning } from '../../shared/reference-confirm-modal.component';
import { ReferenceSuccessModalComponent, ReferenceSuccessMeta, ReferenceSuccessNextStep } from '../../shared/reference-success-modal.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { LucideArrowLeft, LucideArrowRight, LucideScale, LucideSend, LucideInfo, LucideSearch, LucideFileText,
  LucideAlertCircle, LucideEye, LucideDownload, LucideX, LucideUpload, LucideArchive } from '@lucide/angular';

import type { AltaApelacionRecepcionDTO, RegistrarAltaApelacionRequest } from '../../api/types';

type Comando = { modo: 'directa'; datos: ApelacionCreate } | { modo: 'ante-entidad'; datos: ApelacionCreateAnteEntidad }
  | { modo: 'externa'; datos: ApelacionCreateExterna };
type GrupoDocumental = 1 | 2 | 3;
const FECHA_PRESENTACION = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'long', timeZone: 'UTC'
});
interface DocumentoEnvio {
  label: string; tipo: TipoDocumento; file?: File; origen?: DocumentoMetadata;
  estado: 'pendiente' | 'enviando' | 'registrado' | 'rechazado' | 'incierto'; documento?: DocumentoMetadata;
}
interface Intento { clave: string; comando: Comando; documentos: DocumentoEnvio[]; contexto: string; solicitudExpediente?: string; }
@Component({
  selector: 'app-nueva-apelacion', imports: [CommonModule, FormsModule, RouterLink, YaikuCargandoComponent, ReferenceConfirmModalComponent,
    ReferenceSuccessModalComponent, DocumentPreviewModalComponent, StatusBadgeComponent, LucideArrowLeft,
    LucideArrowRight, LucideScale, LucideSend, LucideInfo, LucideSearch, LucideFileText, LucideAlertCircle,
    LucideEye, LucideDownload, LucideX, LucideUpload, LucideArchive],
  templateUrl: './nueva-apelacion.component.html', styleUrl: './nueva-apelacion.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaApelacionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apelacionService = inject(ApelacionService);
  private readonly entidadService = inject(EntidadService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly authService = inject(AuthService);
  private readonly documentoService = inject(DocumentoService);
  readonly solicitud = signal<Solicitud | null>(null);
  readonly solicitudesApelables = signal<Solicitud[]>([]);
  readonly entidades = signal<Entidad[]>([]);
  readonly estadoConsulta = signal<EstadoConsulta>('cargando');
  readonly errorConsulta = signal('');
  readonly reintentarConsulta = signal(false);
  readonly estadoEntidades = signal<EstadoConsulta>('cargando');
  readonly errorEntidades = signal('');
  readonly loadingSolicitud = signal(true);
  readonly loading = signal(false);
  readonly modoSeleccion = signal(true);
  readonly searchTerm = signal('');
  readonly tipoOrigen = signal<TipoOrigenApelacion>('SAIP_INTERNA');
  readonly canalPresentacion = signal<CanalPresentacionApelacion>('DIRECTA_TTAIP');
  readonly modoEntidad = signal<'catalogo' | 'declarada'>('catalogo');
  readonly tipoDenegatoriaExterna = signal<TipoDenegatoriaApelacion>('EXPRESA');
  readonly error = signal('');
  readonly errores = signal<Record<string, string>>({});
  readonly documentoError = signal('');
  readonly documentosIncompletos = signal(false);
  readonly confirmModalAbierto = signal(false);
  readonly successModalAbierto = signal(false);
  readonly apelacionCreada = signal<Apelacion | null>(null);
  readonly expedienteTtaip = signal('');
  readonly estadoEnvio = signal<'lista' | 'rechazada' | 'incierta' | 'sin-recepcion' | 'confirmada'>('lista');
  readonly operacionPendiente = signal(false);
  readonly claveOperacion = signal('');
  readonly recepcionId = signal<number | null>(null);
  private recepcionEsperada: AltaApelacionRecepcionDTO | null = null;
  readonly documentosEnviados = signal<DocumentoEnvio[]>([]);
  readonly documentosConsultados = signal<DocumentoMetadata[] | null>(null);
  readonly errorRecuperacion = signal('');
  readonly bloqueado = computed(() => this.loading() || !!this.apelacionCreada() || this.operacionPendiente());
  readonly archivos = signal<Record<GrupoDocumental, readonly File[]>>({ 1: [], 2: [], 3: [] });
  private readonly excluidos = signal<ReadonlySet<number>>(new Set());
  readonly avisosArchivo = signal<Record<number, string>>({});
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly isPreviewOpen = signal(false);
  readonly accept = DOCUMENTO_ACCEPT;
  readonly filteredSolicitudes = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.solicitudesApelables().filter(s => !term || [s.expediente, s.asunto, s.entidadNombre].some(v => v?.toLowerCase().includes(term)));
  });
  readonly documentos = computed(() => [
    { n: 1 as const, label: 'SAIP original', desc: this.esApelacionExterna() ? 'Puede añadir copias de la solicitud externa.' : 'Incluya una copia de la solicitud presentada a la entidad. Puede acompañarla con sus anexos.' },
    { n: 2 as const, label: this.esApelacionExterna() && this.tipoDenegatoriaExterna() === 'TACITA' ? 'Sustento de silencio' : 'Respuesta de la entidad',
      desc: this.requiereRespuesta() ? 'Incluya al menos un documento de la respuesta de la entidad.' : 'Puede añadir archivos de respaldo.' },
    { n: 3 as const, label: 'Recurso fundamentado', desc: 'Puede añadir documentos que complementen sus fundamentos escritos.' }
  ]);
  readonly archivosCargados = computed(() => this.documentos().reduce(
    (total, { n }) => total + this.archivos()[n].length + this.documentosPara(n).length, 0));
  fundamentos = '';
  entidadExternaId: number | null = null;
  entidadExternaNombre = '';
  entidadExternaRuc = '';
  entidadExternaEmail = '';
  numeroSolicitudExterna = '';
  fechaPresentacionSolicitudExterna = '';
  fechaRespuestaEntidad = '';
  resumenSolicitudOriginal = '';
  resumenRespuestaEntidad = '';
  referenciaDocumentoSolicitud = '';
  referenciaCargoRecepcion = '';
  referenciaRespuestaEntidad = '';
  evidenciaSilencioAdministrativo = '';
  observacionExterna = '';
  fechaPresentacionAnteEntidad = '';
  referenciaCargoPresentacionEntidad = '';
  observacionPresentacionEntidad = '';
  private consultas = new Subscription();
  private catalogo = new Subscription();
  private operaciones = new Subscription();
  private descargas = new Subscription();
  private generacion = 0;
  private destruido = false;
  private token = this.authService.getToken();
  private revision = this.authService.cambiosSesion();
  private entrada: { expediente?: string; id?: number; invalida?: boolean } = {};
  private fuenteActual: { expediente?: string; id?: number } | null = null;
  private confirmacion: Intento | null = null;
  private intento: Intento | null = null;
  constructor() {
    effect(() => { const revision = this.authService.cambiosSesion(); untracked(() => {
      if (revision !== this.revision || this.token !== this.authService.getToken()) {
        this.revision = revision; this.token = this.authService.getToken(); this.cargarEntrada();
      }
    }); });
  }
  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([params, query]) => {
      const exp = params.get('expediente') || query.get('expediente') || undefined, raw = query.get('solicitudId');
      this.entrada = { expediente: exp, id: raw && /^\d+$/.test(raw) ? Number(raw) : undefined,
        invalida: !!raw && (!/^\d+$/.test(raw) || !this.idValido(Number(raw)))
          || !!params.get('expediente') && !!query.get('expediente') && params.get('expediente') !== query.get('expediente') };
      this.cargarEntrada();
    });
  }
  ngOnDestroy(): void { this.destruido = true; this.limpiarContexto(); }
  private idValido(id: unknown): id is number { return typeof id === 'number' && Number.isSafeInteger(id) && id > 0; }
  private actual(gen = this.generacion): boolean { return !this.destruido && gen === this.generacion && !!this.token
    && this.token === this.authService.getToken() && this.revision === this.authService.cambiosSesion(); }
  private limpiarContexto(): void {
    this.generacion++; this.consultas.unsubscribe(); this.catalogo.unsubscribe(); this.operaciones.unsubscribe(); this.descargas.unsubscribe();
    this.consultas = new Subscription(); this.operaciones = new Subscription(); this.descargas = new Subscription();
    this.solicitud.set(null); this.solicitudesApelables.set([]); this.entidades.set([]);
    this.archivos.set({ 1: [], 2: [], 3: [] }); this.excluidos.set(new Set()); this.fundamentos = ''; this.searchTerm.set('');
    this.tipoOrigen.set('SAIP_INTERNA'); this.canalPresentacion.set('DIRECTA_TTAIP'); this.modoEntidad.set('catalogo');
    this.tipoDenegatoriaExterna.set('EXPRESA'); this.entidadExternaId = null;
    this.entidadExternaNombre = ''; this.entidadExternaRuc = ''; this.entidadExternaEmail = ''; this.numeroSolicitudExterna = '';
    this.fechaPresentacionSolicitudExterna = ''; this.fechaRespuestaEntidad = ''; this.resumenSolicitudOriginal = '';
    this.resumenRespuestaEntidad = ''; this.referenciaDocumentoSolicitud = ''; this.referenciaCargoRecepcion = '';
    this.referenciaRespuestaEntidad = ''; this.evidenciaSilencioAdministrativo = ''; this.observacionExterna = '';
    this.fechaPresentacionAnteEntidad = ''; this.referenciaCargoPresentacionEntidad = ''; this.observacionPresentacionEntidad = '';
    this.error.set(''); this.errores.set({}); this.errorConsulta.set(''); this.errorEntidades.set(''); this.documentoError.set(''); this.reintentarConsulta.set(false);
    this.documentosIncompletos.set(false); this.avisosArchivo.set({}); this.loading.set(false); this.loadingSolicitud.set(false);
    this.modoSeleccion.set(true); this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.cerrarPreview();
    this.apelacionCreada.set(null); this.expedienteTtaip.set(''); this.estadoEnvio.set('lista'); this.documentosEnviados.set([]);
    this.documentosConsultados.set(null); this.errorRecuperacion.set(''); this.confirmacion = null; this.intento = null;
    this.operacionPendiente.set(false); this.claveOperacion.set(''); this.recepcionId.set(null); this.recepcionEsperada = null;
  }
  private cargarEntrada(): void {
    if (this.destruido) return;
    if (this.entrada.invalida) { this.limpiarContexto(); this.estadoConsulta.set('validacion'); this.errorConsulta.set('Los identificadores de la solicitud no son válidos o son incompatibles.'); return; }
    if (this.entrada.id) this.cargarSolicitudPorId(this.entrada.id, this.entrada.expediente);
    else if (this.entrada.expediente) this.cargarSolicitud(this.entrada.expediente);
    else this.cargarSolicitudesApelables();
  }
  cargarEntidades(): void {
    this.catalogo.unsubscribe(); this.catalogo = new Subscription();
    const gen = this.generacion; this.entidades.set([]); this.estadoEntidades.set('cargando'); this.errorEntidades.set('');
    if (!this.actual()) { this.estadoEntidades.set('autenticacion'); return; }
    this.catalogo.add(this.entidadService.findActivas().subscribe({ next: data => {
      if (!this.actual(gen)) return;
      if (!Array.isArray(data) || data.some(e => !e || !this.idValido(e.id) || !e.nombre?.trim()) || new Set(data.map(e => e.id)).size !== data.length) {
        this.estadoEntidades.set('error'); this.errorEntidades.set('El catálogo de entidades está incompleto.'); return;
      }
      this.entidades.set(data); this.estadoEntidades.set(data.length ? 'disponible' : 'vacio');
    }, error: error => { if (this.actual(gen)) { const fallo = falloConsulta(error, 'las entidades'); this.estadoEntidades.set(fallo.estado); this.errorEntidades.set(fallo.mensaje); } } }));
  }
  cargarSolicitud(expediente: string): void { this.consultarSolicitud({ expediente }); }
  cargarSolicitudPorId(id: number, expediente?: string): void { this.consultarSolicitud({ id, expediente }); }
  private consultarSolicitud(ref: { id?: number; expediente?: string }): void {
    this.limpiarContexto(); this.modoSeleccion.set(false); this.estadoConsulta.set('cargando'); this.loadingSolicitud.set(true); this.cargarEntidades();
    this.subirAlInicio();
    this.fuenteActual = ref;
    if (!this.actual() || ref.id !== undefined && !this.idValido(ref.id) || !ref.id && !ref.expediente?.trim()) {
      this.estadoConsulta.set('validacion'); this.errorConsulta.set('No se pudo identificar la solicitud y el ciudadano.'); this.loadingSolicitud.set(false); return;
    }
    const gen = this.generacion;
    this.consultas.add((ref.id ? this.solicitudService.findById(ref.id) : this.solicitudService.findByExpediente(ref.expediente!)).subscribe({ next: data => {
      if (!this.actual(gen)) return;
      this.loadingSolicitud.set(false);
      if (!data) { this.estadoConsulta.set('vacio'); this.errorConsulta.set('El servidor no devolvió la solicitud.'); this.reintentarConsulta.set(true); return; }
      if (!this.solicitudCompatible(data) || ref.id && data.id !== ref.id || ref.expediente && data.expediente !== ref.expediente) {
        this.estadoConsulta.set('error'); this.errorConsulta.set('La información no corresponde a la solicitud autorizada o está incompleta.'); this.reintentarConsulta.set(true); return;
      }
      this.solicitud.set(data); this.estadoConsulta.set('disponible'); this.inicializarDocumentos(data);
    }, error: error => { if (this.actual(gen)) { const fallo = falloConsulta(error, 'la solicitud'); this.estadoConsulta.set(fallo.estado);
      this.errorConsulta.set(fallo.mensaje); this.reintentarConsulta.set(fallo.reintentable); this.loadingSolicitud.set(false); } } }));
  }
  private solicitudCompatible(s: Solicitud): boolean {
    return this.idValido(s.id) && !!s.expediente?.trim() && s.ciudadanoId === this.authService.obtenerSesion()?.ciudadanoId && this.idValido(s.entidadId);
  }
  private esApelableEnSelector(s: Solicitud): boolean {
    if (s.apelacion) return false;
    if (ampliacionPermiteApelar(ampliacionParaApelar(s))) return true;
    const tipo = s.respuesta?.tipoRespuesta;
    if (tipo) return true;
    const estado = (s.estado || '').toUpperCase();
    return estado === 'RESPONDIDA' || estado === 'DENEGADA' || estado === 'VENCIDA';
  }
  avisoPlazoAmpliacion(s: Solicitud): string | null {
    if (this.esApelableEnSelector(s)) return null;
    const ancla = aISO(ampliacionParaApelar(s)?.fechaLimiteOriginal);
    if (!ancla) return null;
    const fecha = this.fechaCorta(ancla);
    if (hoyLima() <= ancla) {
      return `Puede apelar el cronograma desde el día hábil siguiente al ${fecha}, durante 15 días hábiles. Recibió la ampliación, así que no es silencio administrativo.`;
    }
    return 'El plazo de 15 días hábiles para apelar el cronograma ya terminó. Podrá presentar su apelación cuando reciba una entrega.';
  }
  private fechaCorta(iso: string): string {
    const [anio, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${anio}`;
  }
  fechaVisible(s: Solicitud): string {
    const raw = s.respuesta?.fechaRespuesta || s.fechaPresentacion || '';
    return raw ? raw.slice(0, 10) : 'Fecha no recuperada';
  }
  estadoVisible(s: Solicitud): string {
    const estado = (s.estado || '').toUpperCase();
    if (estado === 'RESPONDIDA' || estado === 'DENEGADA') return estado;
    if (tienePlazoAmpliadoVigente(s)) return 'PLAZO_AMPLIADO';
    return s.estado || '';
  }
  vinoDesdeLista(): boolean { return !this.entrada.expediente && !this.entrada.id; }
  cargarSolicitudesApelables(): void {
    this.limpiarContexto(); this.estadoConsulta.set('cargando'); this.loadingSolicitud.set(true); this.cargarEntidades();
    this.fuenteActual = null;
    const ciudadano = this.authService.obtenerSesion()?.ciudadanoId;
    if (!this.actual() || !this.idValido(ciudadano)) { this.estadoConsulta.set('autenticacion'); this.errorConsulta.set('Inicie sesión como ciudadano.'); this.loadingSolicitud.set(false); return; }
    const gen = this.generacion;
    this.consultas.add(this.solicitudService.findByCiudadanoId(ciudadano).subscribe({ next: data => {
      if (!this.actual(gen)) return;
      this.loadingSolicitud.set(false);
      if (!Array.isArray(data) || data.some(s => !s || !this.solicitudCompatible(s)) || new Set(data.map(s => s.id)).size !== data.length) {
        this.estadoConsulta.set('error'); this.errorConsulta.set('La lista está incompleta o contiene una relación incompatible.'); this.reintentarConsulta.set(true); return;
      }
      const apelables = data.filter(s => this.esApelableEnSelector(s));
      this.solicitudesApelables.set(apelables); this.estadoConsulta.set(apelables.length ? 'disponible' : 'vacio');
    }, error: error => { if (this.actual(gen)) { const fallo = falloConsulta(error, 'sus solicitudes'); this.estadoConsulta.set(fallo.estado);
      this.errorConsulta.set(fallo.mensaje); this.reintentarConsulta.set(fallo.reintentable); this.loadingSolicitud.set(false); } } }));
  }
  seleccionarSolicitud(sol: Solicitud): void {
    if (!this.actual() || !this.solicitudesApelables().some(s => s.id === sol.id && s.expediente === sol.expediente)) return;
    this.cargarSolicitudPorId(sol.id, sol.expediente);
  }
  iniciarApelacionExterna(): void { if (this.destruido) return; this.limpiarContexto(); this.fuenteActual = null; this.tipoOrigen.set('EXTERNA'); this.modoSeleccion.set(false); this.estadoConsulta.set('disponible'); this.cargarEntidades(); this.subirAlInicio(); }
  volverASeleccion(): void { if (!this.destruido) this.cargarSolicitudesApelables(); }
  reintentarFuente(): void { if (this.fuenteActual) this.consultarSolicitud(this.fuenteActual); else this.cargarEntrada(); }
  esApelacionExterna(): boolean { return this.tipoOrigen() === 'EXTERNA'; }
  esPresentacionAnteEntidad(): boolean { return !this.esApelacionExterna() && this.canalPresentacion() === 'ANTE_ENTIDAD'; }
  cambiarCanal(canal: CanalPresentacionApelacion): void { if (!this.bloqueado() && this.actual()) { this.canalPresentacion.set(canal); this.confirmacion = null; this.confirmModalAbierto.set(false); } }
  cambiarEntidad(modo: 'catalogo' | 'declarada'): void { if (!this.bloqueado() && this.actual()) { this.modoEntidad.set(modo); this.entidadExternaId = null; this.entidadExternaNombre = ''; this.entidadExternaRuc = ''; this.entidadExternaEmail = ''; } }
  cambiarDenegatoria(tipo: TipoDenegatoriaApelacion): void {
    if (this.bloqueado() || !this.actual()) return;
    this.tipoDenegatoriaExterna.set(tipo); this.fechaRespuestaEntidad = ''; this.resumenRespuestaEntidad = ''; this.referenciaRespuestaEntidad = ''; this.evidenciaSilencioAdministrativo = '';
    this.archivos.update(archivos => ({ ...archivos, 2: [] }));
    this.avisosArchivo.update(avisos => ({ ...avisos, 2: '' }));
    this.cerrarPreview(); this.confirmacion = null;
  }
  private metadataFuente(d: DocumentoMetadata, tipo: TipoDocumento, key: 'solicitudId' | 'respuestaId', id: number): boolean {
    return !!d && this.idValido(d.id) && d.tipoDocumento === tipo && d.estado === 'ACTIVO' && d[key] === id && !!d.nombreOriginal
      && typeof d.sizeBytes === 'number' && d.sizeBytes > 0 && !!d.contentType?.trim() && /^[a-f0-9]{64}$/.test(d.hashSha256 || '')
      && DOCUMENTO_RELATION_KEYS.every(k => k === key || d[k] == null);
  }
  private inicializarDocumentos(s: Solicitud): void {
    const fuente1 = Array.isArray(s.documentosMetadata) ? s.documentosMetadata : [];
    const fuente2 = Array.isArray(s.respuesta?.documentosMetadata) ? s.respuesta.documentosMetadata : [];
    const entregables = this.entregablesRecibidos(s);
    this.documentosIncompletos.set(!Array.isArray(s.documentosMetadata)
      || fuente1.filter(d => d?.tipoDocumento === 'SOLICITUD_ORIGINAL' || d?.tipoDocumento === 'DOCUMENTO_ADJUNTO').length !== this.antecedentes(1).length
      || this.requiereRespuesta() && (!Array.isArray(s.respuesta?.documentosMetadata)
        || fuente2.filter(d => d?.tipoDocumento === 'RESPUESTA_ENTIDAD').length + entregables.length !== this.antecedentes(2).length)
      || this.entregableIncompleto(s));
  }
  private entregableIncompleto(s: Solicitud): boolean {
    const ampliacion = ampliacionParaApelar(s);
    return (ampliacion?.cronograma ?? []).some(hito => hito.ampliacionId === ampliacion?.id && hito.estado === 'ENTREGADA'
      && Array.isArray(hito.documentos) && hito.documentos.some(d => !this.metadataEntregable(d)));
  }
  private entregablesRecibidos(s: Solicitud): DocumentoMetadata[] {
    const ampliacion = ampliacionParaApelar(s);
    if (!ampliacion) return [];
    return (ampliacion.cronograma ?? [])
      .filter(hito => hito.ampliacionId === ampliacion.id && hito.estado === 'ENTREGADA' && Array.isArray(hito.documentos))
      .flatMap(hito => hito.documentos ?? [])
      .filter(d => this.metadataEntregable(d));
  }
  private metadataEntregable(d: DocumentoMetadata | null | undefined): d is DocumentoMetadata {
    return !!d && this.idValido(d.id) && d.tipoDocumento === 'RESPUESTA_ENTIDAD' && d.estado === 'ACTIVO'
      && !!d.nombreOriginal && typeof d.sizeBytes === 'number' && d.sizeBytes > 0 && !!d.contentType?.trim()
      && /^[a-f0-9]{64}$/.test(d.hashSha256 || '')
      && DOCUMENTO_RELATION_KEYS.every(k => d[k] == null);
  }
  private antecedentes(n: GrupoDocumental): DocumentoMetadata[] {
    const s = this.solicitud();
    if (!s || !this.actual() || n === 3) return [];
    const respuestaId = s.respuesta?.id;
    const originales = Array.isArray(s.documentosMetadata) ? s.documentosMetadata : [];
    const respuestas = Array.isArray(s.respuesta?.documentosMetadata) ? s.respuesta.documentosMetadata : [];
    const deRespuesta = this.requiereRespuesta() && this.idValido(respuestaId)
      ? respuestas.filter(d => this.metadataFuente(d, 'RESPUESTA_ENTIDAD', 'respuestaId', respuestaId))
      : [];
    const documentos = n === 1
      ? originales.filter(d => this.metadataFuente(d, 'SOLICITUD_ORIGINAL', 'solicitudId', s.id)
        || this.metadataFuente(d, 'DOCUMENTO_ADJUNTO', 'solicitudId', s.id))
      : [...deRespuesta, ...this.entregablesRecibidos(s)];
    return [...new Map(documentos.map(d => [d.id, d])).values()];
  }
  documentosPara(n: GrupoDocumental): DocumentoMetadata[] {
    return this.antecedentes(n).filter(d => !this.excluidos().has(d.id!));
  }
  antecedentesExcluidos(n: GrupoDocumental): DocumentoMetadata[] {
    return this.antecedentes(n).filter(d => this.excluidos().has(d.id!));
  }
  adjuntosPara(n: GrupoDocumental) {
    return [
      ...this.documentosPara(n).map(doc => ({ adjunto: doc, nombre: doc.nombreOriginal, bytes: doc.sizeBytes, antecedente: true })),
      ...this.archivos()[n].map(file => ({ adjunto: file, nombre: file.name, bytes: file.size, antecedente: false }))
    ];
  }
  incluirAntecedente(n: GrupoDocumental, id: number): void {
    if (this.bloqueado() || !this.antecedentes(n).some(d => d.id === id)) return;
    this.excluidos.update(ids => new Set([...ids].filter(excluido => excluido !== id)));
    this.enfocar(`apelacion-elegir-${n}`);
  }
  onFileChange(event: Event, n: GrupoDocumental): void {
    const input = event.target as HTMLInputElement;
    this.agregarArchivos(n, Array.from(input.files ?? []));
    input.value = '';
  }
  onFileDrop(event: DragEvent, n: GrupoDocumental): void {
    event.preventDefault();
    this.agregarArchivos(n, Array.from(event.dataTransfer?.files ?? []));
  }
  private agregarArchivos(n: GrupoDocumental, seleccion: File[]): void {
    if (!this.actual() || this.bloqueado() || !seleccion.length) return;
    const aceptados: File[] = [], errores: string[] = [];
    for (const file of seleccion) {
      const error = !file.size ? 'No se admiten archivos vacíos.' : validarDocumento(file);
      if (error) errores.push(`${file.name}: ${error}`);
      else aceptados.push(file);
    }
    this.archivos.update(archivos => ({ ...archivos, [n]: [...new Set([...archivos[n], ...aceptados])] }));
    this.avisosArchivo.update(avisos => ({ ...avisos, [n]: errores.join(' ') }));
  }
  quitarArchivo(n: GrupoDocumental, adjunto: File | DocumentoMetadata): void {
    if (!this.actual() || this.bloqueado()) return;
    if (adjunto instanceof File) {
      this.archivos.update(archivos => ({ ...archivos, [n]: archivos[n].filter(file => file !== adjunto) }));
    } else if (this.documentosPara(n).some(doc => doc.id === adjunto.id)) {
      this.excluidos.update(ids => new Set([...ids, adjunto.id!]));
    }
    this.cerrarPreview();
    this.enfocar(`apelacion-elegir-${n}`);
  }
  previewFile(n: GrupoDocumental, adjunto: File | DocumentoMetadata): void {
    if (!this.actual()) return;
    const doc = adjunto instanceof File
      ? this.archivos()[n].includes(adjunto) ? { file: adjunto, blob: adjunto, nombre: adjunto.name, tipo: adjunto.type } : null
      : this.documentosPara(n).find(d => d.id === adjunto.id);
    if (!doc) return;
    this.previewTarget.set('file' in doc ? doc : { id: doc.id, nombre: doc.nombreOriginal!, tipo: doc.contentType });
    this.isPreviewOpen.set(true);
  }
  cerrarPreview(): void { this.isPreviewOpen.set(false); this.previewTarget.set(null); }
  downloadFile(n: GrupoDocumental, adjunto: File | DocumentoMetadata): void {
    if (!this.actual()) return;
    if (adjunto instanceof File) {
      if (this.archivos()[n].includes(adjunto)) this.descargarBlob(adjunto, adjunto.name);
    } else {
      const doc = this.documentosPara(n).find(d => d.id === adjunto.id);
      if (doc) this.descargar(doc);
    }
  }
  private descargar(doc: DocumentoMetadata): void {
    const gen = this.generacion; this.documentoError.set('');
    this.descargas.add(this.documentoService.download(doc.id!, doc.nombreOriginal || 'documento').subscribe({
      next: ({ blob, filename }) => { if (this.actual(gen)) this.descargarBlob(blob, filename); },
      error: error => { if (this.actual(gen)) this.documentoError.set(falloConsulta(error, 'el documento').mensaje); }
    }));
  }
  private descargarBlob(blob: Blob, nombre: string): void { const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = nombre; anchor.rel = 'noopener'; anchor.click(); URL.revokeObjectURL(url); }
  requiereRespuesta(): boolean { return !this.esApelacionExterna() && !!this.solicitud()?.respuesta && this.solicitud()?.respuesta?.tipoRespuesta !== 'SILENCIO_ADMINISTRATIVO'; }
  limiteFundamentos(): number | null { return this.esApelacionExterna() || this.esPresentacionAnteEntidad() ? 5000 : null; }
  private validar(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!this.actual() || !this.idValido(this.authService.obtenerSesion()?.ciudadanoId)) e['sesion'] = 'No se identificó al ciudadano autenticado.';
    if (!this.fundamentos.trim() || this.limiteFundamentos() && this.fundamentos.trim().length > this.limiteFundamentos()!) e['fundamentos'] = 'Ingrese los fundamentos; respete el límite indicado para este comando.';
    if (this.esApelacionExterna()) {
      if (this.modoEntidad() === 'catalogo' ? this.estadoEntidades() !== 'disponible' || !this.entidades().some(v => v.id === this.entidadExternaId) : !this.entidadExternaNombre.trim()) e['entidad'] = 'Seleccione una entidad del catálogo o declare expresamente su nombre.';
      for (const [campo, valor, max] of [ ['Entidad declarada', this.entidadExternaNombre, 200], ['RUC declarado', this.entidadExternaRuc, 20], ['Correo declarado', this.entidadExternaEmail, 120], ['Número de solicitud', this.numeroSolicitudExterna, 100], ['Resumen de solicitud', this.resumenSolicitudOriginal, 5000], ['Resumen de respuesta', this.resumenRespuestaEntidad, 5000], ['Referencia de solicitud', this.referenciaDocumentoSolicitud, 500], ['Referencia del cargo', this.referenciaCargoRecepcion, 500], ['Referencia de respuesta', this.referenciaRespuestaEntidad, 500], ['Sustento de silencio', this.evidenciaSilencioAdministrativo, 5000], ['Observación', this.observacionExterna, 5000] ] as const) if (valor.trim().length > max) e['externa'] = `${campo}: máximo ${max} caracteres.`;
      if (!this.numeroSolicitudExterna.trim() || !this.fechaPresentacionSolicitudExterna || !this.resumenSolicitudOriginal.trim() || !this.referenciaDocumentoSolicitud.trim()) e['externa'] = 'Complete número, fecha, resumen y referencia declarada del documento de la solicitud externa.';
      if (this.entidadExternaEmail && !/^[^\s@]+@[^\s@]+$/.test(this.entidadExternaEmail.trim())) e['correo'] = 'Revise el correo declarado de la entidad.';
      if (this.tipoDenegatoriaExterna() === 'EXPRESA') {
        if (!this.fechaRespuestaEntidad || !this.resumenRespuestaEntidad.trim() && !this.referenciaRespuestaEntidad.trim()) e['respuesta'] = 'La denegatoria expresa exige fecha y resumen o referencia de la respuesta.';
      } else if (this.tipoDenegatoriaExterna() !== 'TACITA' || !this.evidenciaSilencioAdministrativo.trim()) e['respuesta'] = 'Declare el sustento del silencio administrativo; no se deduce de una fecha o estado.';
    } else {
      const s = this.solicitud();
      if (!s || !this.solicitudCompatible(s) || s.apelacion !== null || s.respuesta === undefined || s.respuesta && !this.idValido(s.respuesta.id)) e['solicitud'] = 'La solicitud está incompleta o ya registra una apelación. Actualice su consulta.';
      if (s && !this.esApelableEnSelector(s)) e['plazo'] = this.avisoPlazoAmpliacion(s) ?? 'Esta solicitud no está en plazo de apelación.';
      if (!this.archivos()[1].length && !this.documentosPara(1).some(d => d.tipoDocumento === 'SOLICITUD_ORIGINAL')) e['documentos'] = 'Seleccione una copia real de la SAIP original o un antecedente registrado.';
      if (this.requiereRespuesta() && !this.archivos()[2].length && !this.documentosPara(2).length) e['respuesta'] = 'Incluya al menos un documento de la respuesta de la entidad.';
      if (this.esPresentacionAnteEntidad() && (!this.fechaPresentacionAnteEntidad || !this.referenciaCargoPresentacionEntidad.trim()
        || this.referenciaCargoPresentacionEntidad.trim().length > 500 || this.observacionPresentacionEntidad.trim().length > 5000)) e['cargo'] = 'Ingrese la fecha real y referencia del cargo ante entidad (máximo 500); observación hasta 5000 caracteres.';
    }
    if (Object.values(this.archivos()).some(files => files.some(file => !file.size || validarDocumento(file)))) {
      e['archivos'] = 'Revise los archivos seleccionados y el límite de 10 MB por archivo.';
    }
    return e;
  }
  puedeEnviar(): boolean { return !this.bloqueado() && !this.loadingSolicitud() && Object.keys(this.validar()).length === 0; }
  abrirConfirmacionApelacion(): void {
    if (this.bloqueado()) return;
    const e = this.validar(); this.errores.set(e); this.error.set(Object.keys(e).length ? 'Revise los campos señalados antes de presentar.' : '');
    if (Object.keys(e).length) { this.enfocar('apelacion-errores'); return; }
    this.confirmacion = this.capturar(); this.confirmModalAbierto.set(true);
  }
  private contexto(): string { return `${this.tipoOrigen()}:${this.solicitud()?.id ?? ''}:${this.canalPresentacion()}:${this.modoEntidad()}`; }
  private capturar(clave: string = crypto.randomUUID()): Intento {
    const ciudadanoId = this.authService.obtenerSesion()!.ciudadanoId!, fundamentos = this.fundamentos.trim();
    let comando: Comando;
    if (this.esApelacionExterna()) comando = { modo: 'externa', datos: { ciudadanoId,
      entidadId: this.modoEntidad() === 'catalogo' ? this.entidadExternaId! : undefined,
      entidadExternaNombre: this.modoEntidad() === 'declarada' ? this.entidadExternaNombre.trim() : undefined,
      entidadExternaRuc: this.modoEntidad() === 'declarada' ? this.entidadExternaRuc.trim() || undefined : undefined,
      entidadExternaEmail: this.modoEntidad() === 'declarada' ? this.entidadExternaEmail.trim() || undefined : undefined,
      numeroSolicitudExterna: this.numeroSolicitudExterna.trim(), fechaPresentacionSolicitudExterna: this.fechaPresentacionSolicitudExterna,
      tipoDenegatoria: this.tipoDenegatoriaExterna(), resumenSolicitudOriginal: this.resumenSolicitudOriginal.trim(), referenciaDocumentoSolicitud: this.referenciaDocumentoSolicitud.trim(),
      referenciaCargoRecepcion: this.referenciaCargoRecepcion.trim() || undefined, fundamentos, observacion: this.observacionExterna.trim() || undefined,
      ...(this.tipoDenegatoriaExterna() === 'EXPRESA' ? { fechaRespuestaEntidad: this.fechaRespuestaEntidad, resumenRespuestaEntidad: this.resumenRespuestaEntidad.trim() || undefined, referenciaRespuestaEntidad: this.referenciaRespuestaEntidad.trim() || undefined }
        : { evidenciaSilencioAdministrativo: this.evidenciaSilencioAdministrativo.trim() }) } };
    else if (this.esPresentacionAnteEntidad()) comando = { modo: 'ante-entidad', datos: { solicitudId: this.solicitud()!.id, ciudadanoId, fundamentos,
      fechaPresentacionAnteEntidad: this.fechaPresentacionAnteEntidad, referenciaCargoPresentacion: this.referenciaCargoPresentacionEntidad.trim(), observacion: this.observacionPresentacionEntidad.trim() || undefined } };
    else comando = { modo: 'directa', datos: { solicitudId: this.solicitud()!.id, ciudadanoId, fundamentos } };
    return { clave, comando, contexto: this.contexto(), solicitudExpediente: this.solicitud()?.expediente,
      documentos: this.documentos().flatMap(({ n, label }) => {
        const respuestaExpresa = this.esApelacionExterna() ? this.tipoDenegatoriaExterna() === 'EXPRESA' : this.requiereRespuesta();
        const tipo: TipoDocumento = n === 1 ? 'SOLICITUD_ORIGINAL' : n === 3 ? 'RECURSO_APELACION'
          : respuestaExpresa ? 'RESPUESTA_ENTIDAD' : 'DOCUMENTO_ADJUNTO';
        return [
          ...this.documentosPara(n).map(origen => ({ label, tipo: origen.tipoDocumento as TipoDocumento, origen: { ...origen }, estado: 'pendiente' as const })),
          ...this.archivos()[n].map(file => ({ label, tipo, file, estado: 'pendiente' as const }))
        ];
      }) };
  }
  crearApelacion(): void {
    if (this.bloqueado() || !this.actual()) return;
    const e = this.validar(); this.errores.set(e); if (Object.keys(e).length) { this.error.set('Revise los campos señalados antes de presentar.'); return; }
    const intento = this.capturar(this.confirmacion?.clave);
    if (this.confirmacion && (JSON.stringify(intento.comando) !== JSON.stringify(this.confirmacion.comando) || intento.documentos.length !== this.confirmacion.documentos.length
      || intento.documentos.some((d, i) => d.file !== this.confirmacion!.documentos[i].file || d.origen?.id !== this.confirmacion!.documentos[i].origen?.id || d.origen?.hashSha256 !== this.confirmacion!.documentos[i].origen?.hashSha256))) {
      this.error.set('El contenido cambió. Revise y confirme nuevamente.'); this.confirmModalAbierto.set(false); this.confirmacion = null; return;
    }
    this.intento = intento; this.claveOperacion.set(intento.clave); this.operacionPendiente.set(true); this.recepcionEsperada = null;
    this.enviarOperacion(intento, this.generacion);
  }
  private datosRecepcion(i: Intento): RegistrarAltaApelacionRequest {
    const c = i.comando;
    const datos: Record<string, unknown> = { claveOperacion: i.clave,
      modalidad: c.modo === 'externa' ? 'EXTERNA' : c.modo === 'ante-entidad' ? 'ANTE_ENTIDAD' : 'DIRECTA_TTAIP' };
    for (const key of ['solicitudId', 'fundamentos', 'entidadId', 'entidadExternaNombre', 'entidadExternaRuc', 'entidadExternaEmail',
      'numeroSolicitudExterna', 'fechaPresentacionSolicitudExterna', 'fechaRespuestaEntidad', 'tipoDenegatoria',
      'resumenSolicitudOriginal', 'resumenRespuestaEntidad', 'referenciaDocumentoSolicitud', 'referenciaCargoRecepcion',
      'referenciaRespuestaEntidad', 'evidenciaSilencioAdministrativo', 'observacion', 'fechaPresentacionAnteEntidad', 'referenciaCargoPresentacion']) {
      const value = (c.datos as unknown as Record<string, unknown>)[key]; if (value != null) datos[key] = value;
    }
    datos['documentos'] = i.documentos.map(d => ({ tipoDocumento: d.tipo,
      ...(d.origen ? { origenId: d.origen.id, hashOrigen: d.origen.hashSha256 } : {}) }));
    return datos as unknown as RegistrarAltaApelacionRequest;
  }
  private enviarOperacion(i: Intento, gen: number): void {
    if (!this.intentoActual(gen) || this.intento !== i) return;
    this.loading.set(true); this.error.set(''); this.estadoEnvio.set('lista'); this.documentosEnviados.set(i.documentos);
    this.operaciones.add(this.apelacionService.registrarAlta(this.datosRecepcion(i), i.documentos.flatMap(d => d.file ? [d.file] : [])).pipe(timeout(30_000)).subscribe({
      next: r => {
        if (!this.intentoActual(gen) || this.intento !== i) return;
        this.confirmModalAbierto.set(false);
        if (!this.recepcionCompatible(r, i) || !this.mismaRecepcion(r)) { this.incierta('Aún no pudimos confirmar su apelación. Compruebe si se presentó antes de volver a enviarla.'); return; }
        this.recepcionEsperada = r; this.consultarRecepcion(i, gen);
      }, error: error => {
        if (!this.intentoActual(gen) || this.intento !== i) return;
        this.loading.set(false); this.confirmModalAbierto.set(false);
        if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500) {
          this.incierta('La apelación podría haberse presentado. Compruebe el resultado antes de volver a enviarla.');
        } else {
          this.estadoEnvio.set('rechazada'); this.error.set(error.status === 401 ? 'Su sesión no es válida. Inicie sesión nuevamente.'
            : error.status === 403 ? 'No tiene permiso para registrar este recurso.' : error.status === 409
              ? 'No se pudo confirmar este envío. Compruebe el resultado antes de presentar otra apelación.'
              : error.status === 413 ? 'Los archivos nuevos superan el tamaño total admitido. Quite alguno o use archivos más pequeños.'
                : 'No se pudo presentar la apelación. Revise los datos y vuelva a intentarlo.');
          if (error.status !== 409) { this.operacionPendiente.set(false); this.intento = null; this.confirmacion = null; }
        }
      }
    }));
  }
  private intentoActual(gen: number): boolean { return this.actual(gen) && !!this.intento && this.intento.contexto === this.contexto(); }
  private incierta(mensaje: string): void { this.estadoEnvio.set('incierta'); this.loading.set(false); this.confirmModalAbierto.set(false); this.error.set(mensaje); }
  private registroCompatible(r: Apelacion | null, i: Intento, alta: boolean): r is Apelacion {
    const c = i.comando;
    if (!r || !this.idValido(r.id) || !r.expediente?.trim() || r.ciudadanoId !== c.datos.ciudadanoId
      || alta && (r.fundamentos !== c.datos.fundamentos || r.estado !== (c.modo === 'ante-entidad' ? 'PENDIENTE_ELEVACION' : 'EN_CALIFICACION_1'))) return false;
    if (c.modo !== 'externa') {
      if (r.tipoOrigen !== 'SAIP_INTERNA' || r.solicitudId !== c.datos.solicitudId || r.solicitudExpediente !== i.solicitudExpediente || r.entidadId !== this.solicitud()?.entidadId) return false;
      if (c.modo === 'ante-entidad' && alta && (!this.idValido(r.elevacion?.id) || r.elevacion?.apelacionId !== r.id || r.elevacion.fechaPresentacionAnteEntidad !== c.datos.fechaPresentacionAnteEntidad || r.elevacion.referenciaCargoPresentacion !== c.datos.referenciaCargoPresentacion)) return false;
      return true;
    }
    return r.tipoOrigen === 'EXTERNA' && r.solicitudId == null && (r.entidadId ?? undefined) === c.datos.entidadId
      && (['numeroSolicitudExterna', 'fechaPresentacionSolicitudExterna', 'entidadExternaNombre', 'entidadExternaRuc',
        'entidadExternaEmail', 'tipoDenegatoria', 'resumenSolicitudOriginal', 'referenciaDocumentoSolicitud',
        'referenciaCargoRecepcion', 'fechaRespuestaEntidad', 'resumenRespuestaEntidad', 'referenciaRespuestaEntidad',
        'evidenciaSilencioAdministrativo', 'observacion'] as const).every(key => (r[key] ?? undefined) === c.datos[key]);
  }
  private documentoDeApelacion(d: DocumentoMetadata, id = this.apelacionCreada()?.id): boolean {
    return !!d && this.idValido(d.id) && d.apelacionId === id && d.estado === 'ACTIVO'
      && DOCUMENTO_RELATION_KEYS.every(k => k === 'apelacionId' || d[k] == null);
  }
  private recepcionCompatible(r: AltaApelacionRecepcionDTO | null, i: Intento): r is AltaApelacionRecepcionDTO {
    const modalidad = this.datosRecepcion(i).modalidad;
    return !!r && this.idValido(r.id) && r.claveOperacion === i.clave && r.modalidad === modalidad
      && typeof r.fechaRecepcion === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.fechaRecepcion) && Number.isFinite(Date.parse(r.fechaRecepcion))
      && this.registroCompatible(r.apelacion as Apelacion, i, false) && r.apelacion.fundamentos === i.comando.datos.fundamentos
      && (i.comando.modo !== 'ante-entidad' || this.idValido(r.apelacion.elevacion?.id)
        && r.apelacion.elevacion?.apelacionId === r.apelacion.id
        && r.apelacion.elevacion?.fechaPresentacionAnteEntidad === i.comando.datos.fechaPresentacionAnteEntidad
        && r.apelacion.elevacion?.referenciaCargoPresentacion === i.comando.datos.referenciaCargoPresentacion)
      && Array.isArray(r.documentos) && r.documentos.length === i.documentos.length
      && new Set(r.documentos.map(d => d?.documento?.id)).size === r.documentos.length
      && r.documentos.every((item, index) => {
        const expected = i.documentos[index], doc = item?.documento;
        return this.documentoDeApelacion(doc, r.apelacion.id) && doc.tipoDocumento === expected.tipo
          && (item.origenId ?? undefined) === expected.origen?.id && doc.id !== expected.origen?.id
          && item.hashAceptado === doc.hashSha256 && /^[a-f0-9]{64}$/i.test(item.hashAceptado || '')
          // Names are descriptive; receipt, IDs and byte version identify uploads and copies.
          && !!doc.nombreOriginal?.trim()
          && doc.sizeBytes === (expected.file?.size ?? expected.origen?.sizeBytes)
          && (!expected.origen || item.hashAceptado === expected.origen.hashSha256);
      });
  }
  private mismaRecepcion(r: AltaApelacionRecepcionDTO): boolean {
    const prior = this.recepcionEsperada;
    return !prior || r.id === prior.id && r.fechaRecepcion === prior.fechaRecepcion && r.apelacion.id === prior.apelacion.id
      && r.documentos.every((d, n) => d.documento.id === prior.documentos[n]?.documento.id);
  }
  comprobarRegistro(): void {
    if (!this.actual() || this.loading() || !this.intento) return;
    this.consultarRecepcion(this.intento, this.generacion);
  }
  reintentarAlta(): void {
    if (!this.actual() || this.loading() || this.estadoEnvio() !== 'sin-recepcion' || !this.intento) return;
    this.enviarOperacion(this.intento, this.generacion);
  }
  private consultarRecepcion(i: Intento, gen: number): void {
    const confirmada = this.estadoEnvio() === 'confirmada';
    this.loading.set(true); this.errorRecuperacion.set(''); this.documentosConsultados.set(null);
    this.operaciones.add(this.apelacionService.obtenerRecepcionAlta(i.clave).pipe(timeout(30_000)).subscribe({ next: r => {
      if (!this.intentoActual(gen) || this.intento !== i) return;
      this.loading.set(false);
      if (!this.recepcionCompatible(r, i) || !this.mismaRecepcion(r)) {
        if (!confirmada) this.incierta('Aún no pudimos confirmar la presentación de su apelación.');
        this.errorRecuperacion.set('La información consultada no coincide con su apelación o sus documentos.'); return;
      }
      this.recepcionEsperada = r; this.recepcionId.set(r.id); this.apelacionCreada.set(r.apelacion as Apelacion); this.expedienteTtaip.set(r.apelacion.expediente!);
      i.documentos.forEach((d, n) => { d.documento = r.documentos[n].documento; d.estado = 'registrado'; });
      this.documentosEnviados.set([...i.documentos]); this.documentosConsultados.set(r.documentos.map(d => d.documento));
      this.operacionPendiente.set(false); this.estadoEnvio.set('confirmada'); this.error.set(''); if (!confirmada) this.successModalAbierto.set(true);
    }, error: error => {
      if (!this.intentoActual(gen) || this.intento !== i) return;
      this.loading.set(false);
      if (!confirmada && error?.status === 404) {
        this.estadoEnvio.set('sin-recepcion'); this.error.set('Aún no se ha confirmado la presentación. Puede comprobar de nuevo o volver a enviar la misma apelación.');
      } else {
        if (!confirmada) this.incierta('No se pudo comprobar si su apelación se presentó. Vuelva a consultar antes de enviarla de nuevo.');
        this.errorRecuperacion.set('No pudimos consultar la apelación y sus documentos en este momento.');
      }
    } }));
  }
  apelacionConfirmSummary(): ReferenceConfirmSummary[] {
    const solicitud = this.solicitud();
    return [
      { label: 'Solicitud original', value: solicitud?.expediente || this.numeroSolicitudExterna.trim() || 'No indicada', mono: true },
      { label: 'Entidad', value: this.entidadDisplay() },
      { label: 'Asunto original', value: solicitud?.asunto || this.resumenSolicitudOriginal.trim() || 'No indicado' },
      { label: 'Vía de ingreso', value: this.esPresentacionAnteEntidad() ? 'Ante la entidad' : 'Directa al TTAIP' },
      { label: 'Documentos incluidos', value: String(this.archivosCargados()) },
    ];
  }
  apelacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Antes de presentar',
      detail: this.esPresentacionAnteEntidad()
        ? 'Compruebe la fecha y el cargo de presentación. La entidad deberá remitir el recurso al Tribunal.'
        : 'Compruebe que los documentos y los fundamentos correspondan a su solicitud. El Tribunal revisará si su apelación cumple los requisitos.',
    };
  }
  estadoPresentacion(): string {
    switch (this.apelacionCreada()?.estado) {
      case 'EN_CALIFICACION_1': return 'En primera calificación';
      case 'PENDIENTE_ELEVACION': return 'Pendiente de remisión al Tribunal';
      case 'EN_SUBSANACION': return 'En subsanación';
      case 'EN_CALIFICACION_2': return 'En segunda calificación';
      case 'NOTIFICACION_SEGUNDA_CALIFICACION': return 'Pendiente de notificación';
      case 'EN_RESOLUCION': return 'En resolución final';
      default: return 'Consulte el expediente';
    }
  }
  fechaPresentacion(): string {
    const fecha = this.recepcionEsperada?.modalidad === 'ANTE_ENTIDAD'
      ? this.apelacionCreada()?.elevacion?.fechaPresentacionAnteEntidad
      : this.recepcionEsperada?.fechaRecepcion;
    const dia = fecha?.slice(0, 10);
    const valor = dia && Date.parse(`${dia}T00:00:00Z`);
    return typeof valor === 'number' && Number.isFinite(valor) ? FECHA_PRESENTACION.format(valor) : 'Fecha por confirmar';
  }
  apelacionSuccessMetadata(): ReferenceSuccessMeta[] {
    return this.apelacionCreada() ? [
      { label: 'Estado', value: this.estadoPresentacion() },
      { label: 'Fecha de presentación', value: this.fechaPresentacion() },
      { label: 'Entidad', value: this.entidadDisplay() },
      { label: 'Documentos adjuntos', value: String(this.documentosEnviados().filter(d => d.estado === 'registrado').length) },
    ] : [];
  }
  apelacionNextSteps(): ReferenceSuccessNextStep[] {
    const seguimiento = { label: 'En Mi panel, abra el expediente para consultar su estado y las decisiones del Tribunal.' };
    switch (this.apelacionCreada()?.estado) {
      case 'PENDIENTE_ELEVACION':
        return [{ label: 'La entidad debe remitir su apelación al Tribunal. La primera calificación comienza después de que el Tribunal la reciba.' }, seguimiento];
      case 'EN_CALIFICACION_1':
        return [
          { label: 'El Tribunal tiene 7 días hábiles desde el día hábil siguiente a la recepción para revisar si su apelación cumple los requisitos.' },
          seguimiento,
          { label: 'Si el Tribunal le pide corregir o completar algo, consulte las observaciones y el plazo para responder.' },
        ];
      default: return [seguimiento];
    }
  }
  entidadDisplay(): string { return !this.esApelacionExterna() ? this.solicitud()?.entidadNombre || 'Nombre no disponible'
    : this.modoEntidad() === 'catalogo' ? this.entidades().find(e => e.id === this.entidadExternaId)?.nombre || 'Entidad no disponible' : this.entidadExternaNombre || 'Nombre declarado no indicado'; }
  rutaRegreso(): string[] { const s = this.solicitud(); return s && (this.entrada.expediente || this.entrada.id) ? ['/ciudadano/solicitud', s.expediente] : ['/ciudadano']; }
  irPanelCiudadano(): void { if (this.actual()) this.router.navigate(['/ciudadano']); }
  verSolicitudOrigen(): void { if (this.actual() && this.solicitud()) this.router.navigate(['/ciudadano/solicitud', this.solicitud()!.expediente]); }
  cerrarResultado(): void {
    this.successModalAbierto.set(false);
    if (this.actual() && this.apelacionCreada() && this.estadoEnvio() === 'confirmada') {
      void this.router.navigate(['/ciudadano']);
    }
  }
  private enfocar(id: string): void { const gen = this.generacion; queueMicrotask(() => { if (this.actual(gen)) document.getElementById(id)?.focus(); }); }
  private subirAlInicio(): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    const gen = this.generacion;
    afterNextRender(() => {
      if (!this.actual(gen) || typeof window === 'undefined') return;
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.getElementById('apelacion-titulo')?.focus();
    }, { injector: this.injector });
  }
}
