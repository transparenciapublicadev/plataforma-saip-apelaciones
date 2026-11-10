import { falloConsulta } from '../../utils/consulta-remota.util';
import { ResponseContextComponent } from '../../shared/response-context.component';
import { ReferenceTabsDirective } from '../../shared/reference-tabs.directive';
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, effect, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { RespuestaSaipRecepcion, RespuestaService } from '../../services/respuesta.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { Solicitud } from '../../models/solicitud.model';
import type { CrearRespuestaRequest } from '../../api/types';
import { Entidad } from '../../models/entidad.model';
import { Respuesta } from '../../models/respuesta.model';
import {
  DOCUMENTO_ACCEPT,
  DocumentoRelation,
  validarDocumento
} from '../../models/documento.model';
import { DocumentoService } from '../../services/documento.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { problemDetailsMessage } from '../../utils/problem-details.util';
import { canSendManualResponse, isSilencioAdministrativo } from '../../utils/silencio-administrativo.util';
import {
  ReferenceConfirmModalComponent,
  ReferenceConfirmSummary,
  ReferenceConfirmWarning
} from '../../shared/reference-confirm-modal.component';
import {
  ReferenceSuccessMeta,
  ReferenceSuccessModalComponent,
  ReferenceSuccessNextStep,
  ReferenceSuccessTone
} from '../../shared/reference-success-modal.component';
import {
  ReferenceComboboxComponent,
  ReferenceComboboxOption
} from '../../shared/reference-combobox.component';
import { MultiFileUploadZoneComponent } from '../../shared/multi-file-upload-zone.component';
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from '../../shared/document-preview-modal.component';
import { AreaResponsablePanelComponent } from '../../shared/area-responsable-panel.component';

export interface HitoCronogramaItem {
  fecha: string;
  entregable: string;
}
import {
  LucideArrowLeft, LucideAlertTriangle, LucideCalendar, LucideClock,
  LucideFileText, LucideInfo, LucideCheckCircle2,
  LucideSend, LucideUser, LucideScale,
  LucideHelpCircle, LucideArrowRightLeft, LucideReceipt, LucideMail,
  LucidePhone, LucideIdCard, LucideCalendarClock,
  LucideEye, LucideDownload
} from '@lucide/angular';

interface IntentoRespuesta {
  solicitudId: number;
  claveOperacion: string;
  datos?: CrearRespuestaRequest;
  archivos?: readonly File[];
}

type ResponseTabId = 'responder' | 'solicitud' | 'ciudadano' | 'adjuntos';
type DecisionId = 'entrega_total' | 'entrega_parcial' | 'denegacion_total';
type ViaProcesal = 'responder' | 'precision' | 'prorroga';

interface ResponseDecision {
  id: DecisionId;
  title: string;
  description: string;
  accent: string;
}

export interface DocRowItem {
  id?: number | null;
  raw: any;
  nombre: string;
  tipo: string;
  tamano: string;
}

export const CAUSALES_DENEGATORIA = [
  { value: 'no_posee', label: 'La entidad no posee la información y no está obligada a poseerla (corresponde encauzar)' },
  { value: 'inexistente', label: 'La solicitud exige crear o producir información inexistente' },
  { value: 'evaluacion', label: 'La solicitud exige realizar evaluaciones o análisis' },
  { value: 'extraviada', label: 'La información se extravió, destruyó o no puede ubicarse pese a que debía poseerla' },
  { value: 'secreta', label: 'Información secreta' },
  { value: 'reservada', label: 'Información reservada' },
  { value: 'confidencial', label: 'Información confidencial' }
] as const;

@Component({
  selector: 'app-funcionario-responder',
  imports: [
    ResponseContextComponent, ReferenceTabsDirective, CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    ReferenceConfirmModalComponent,
    ReferenceSuccessModalComponent,
    ReferenceComboboxComponent,
    MultiFileUploadZoneComponent,
    DocumentPreviewModalComponent,
    AreaResponsablePanelComponent,
    LucideArrowLeft, LucideAlertTriangle, LucideCalendar, LucideClock,
    LucideFileText, LucideInfo, LucideCheckCircle2,
    LucideSend, LucideUser, LucideScale,
    LucideHelpCircle, LucideArrowRightLeft, LucideReceipt, LucideMail,
    LucidePhone, LucideIdCard, LucideCalendarClock,
    LucideEye, LucideDownload
  ],
  templateUrl: './funcionario-responder.component.html',
  styleUrl: './funcionario-responder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuncionarioResponderComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudService = inject(SolicitudService);
  private readonly respuestaService = inject(RespuestaService);
  private readonly entidadService = inject(EntidadService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);

  solicitud = signal<Solicitud | null>(null);
  entidades = signal<Entidad[]>([]);
  loading = signal<boolean>(false);
  loadingSolicitud = signal<boolean>(true);
  error = signal<string>('');
  consultaReintentable = signal(false);
  private expedienteActual = '';
  private sesionActual = this.claveSesion();
  constructor() {
    effect(() => {
      this.authService.cambiosSesion?.();
      const sesion = this.claveSesion();
      if (sesion !== this.sesionActual) {
        this.sesionActual = sesion; this.generacionRespuesta++; this.consultaSolicitud?.unsubscribe();
        this.solicitud.set(null); this.intentoRespuesta = null; this.recepcionRespuesta.set(null);
        this.documentosEntrega.set([]); this.evidenciaDenegatoria.set([]); this.previewTarget.set(null);
        this.descripcionAceptacion = ''; this.descripcionDenegacion = ''; this.causalDenegatoria = ''; this.fundamentoLegal = '';
        this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.loading.set(false); this.loadingSolicitud.set(false);
        this.consultaReintentable.set(false); this.error.set('La sesión cambió. Abra nuevamente el expediente con la cuenta actual.');
      }
    });
  }
  reintentarConsulta(): void { if (this.consultaReintentable()) this.cargarSolicitud(this.expedienteActual); }
  readonly respuestaPendienteVerificacion = signal(false);
  readonly puedeReintentarRespuesta = signal(false);
  readonly recepcionRespuesta = signal<RespuestaSaipRecepcion | null>(null);
  readonly resultadoRespuesta = signal<'inicial' | 'incierto' | 'sin-confirmacion' | 'rechazado' | 'recibido'>('inicial');
  private intentoRespuesta: IntentoRespuesta | null = null;
  private generacionRespuesta = 0;
  private navegacion?: Subscription;
  private consultaSolicitud?: Subscription;
  private destruido = false;

  ngOnDestroy(): void { this.destruido = true; this.navegacion?.unsubscribe(); this.consultaSolicitud?.unsubscribe(); }

  private claveSesion(): string {
    const s = this.authService.obtenerSesion();
    return JSON.stringify([s?.token, s?.usuarioId, s?.funcionarioId]);
  }
  mensaje = signal<string>('');
  documentUploadWarning = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);

  activeTab = signal<ResponseTabId>('responder');
  via = signal<ViaProcesal>('responder');
  decision = signal<DecisionId | null>(null);

  // Vía de precisión
  precisionDetalle = '';

  // Vía de prórroga / ampliación
  prorrogaDias = '5';
  readonly prorrogaDiasNum = computed(() => parseInt(this.prorrogaDias) || 0);
  prorrogaMotivo = '';
  prorrogaCronograma = '';
  hitos = signal<HitoCronogramaItem[]>([{ fecha: '', entregable: '' }]);
  usarCronograma = signal<boolean>(false);

  agregarHito(): void {
    this.hitos.update(prev => [...prev, { fecha: '', entregable: '' }]);
  }

  quitarHito(index: number): void {
    this.hitos.update(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  actualizarHitoFecha(index: number, fecha: string): void {
    this.hitos.update(prev => prev.map((h, i) => i === index ? { ...h, fecha } : h));
  }

  actualizarHitoEntregable(index: number, entregable: string): void {
    this.hitos.update(prev => prev.map((h, i) => i === index ? { ...h, entregable } : h));
  }

  // Decisión de fondo
  descripcionAceptacion = '';
  descripcionDenegacion = '';
  formatoEntrega = 'digital';
  plazoEntrega = 5;
  causalDenegatoria = '';
  fundamentoLegal = '';

  // Encauzamiento
  encauzar = false;
  entidadDestino = '';
  motivoEncauzamiento = '';
  parteEncauzada = '';

  // Cupón de pago (entrega física)
  cuponEnviado = false;
  cuponLugar = '';
  liqFolios = '';
  liqCostoFolio = '0.10';
  liqCertificadas = '';
  liqCostoCert = '0.50';
  liqSoporte = '0';

  documentosEntrega = signal<File[]>([]);
  evidenciaDenegatoria = signal<File[]>([]);
  readonly documentAccept = DOCUMENTO_ACCEPT;
  readonly causalesOficiales = CAUSALES_DENEGATORIA;
  readonly causalesOptions: ReferenceComboboxOption[] = CAUSALES_DENEGATORIA.map(c => ({
    id: c.value,
    label: c.label
  }));

  previewTarget = signal<DocumentPreviewTarget | null>(null);

  readonly formatosSolicitados = computed(() => {
    const desc = this.solicitud()?.descripcion || '';
    const formatos: string[] = [];
    if (/correo|email|digital/i.test(desc)) formatos.push('Copia digital (correo)');
    if (/simple|copia simple/i.test(desc)) formatos.push('Copia simple');
    if (/certificad/i.test(desc)) formatos.push('Copia certificada');
    if (/cd|dvd|magn[ée]tic|usb/i.test(desc)) formatos.push('Soporte magnético');
    if (formatos.length === 0) formatos.push('Copia digital (plataforma)');
    return formatos;
  });

  readonly requiereFisico = computed(() => {
    const s = this.solicitud();
    return s?.formatoFisico === true || s?.copiaSimple === true || s?.copiaCertificada === true;
  });

  readonly yaPreciso = computed(() => {
    const sol = this.solicitud();
    return sol?.observaciones?.some(o => o.estado === 'SUBSANADA') ?? false;
  });

  readonly diasTranscurridos = computed(() => {
    const sol = this.solicitud();
    if (!sol || !sol.fechaPresentacion) return 0;

    let cur: Date | null = null;
    const raw = String(sol.fechaPresentacion).trim();

    if (raw.includes('/')) {
      const parts = raw.split(/[/\sT]/);
      const d = Number(parts[0]);
      const m = Number(parts[1]);
      const y = Number(parts[2]);
      if (d && m && y && !isNaN(d) && !isNaN(m) && !isNaN(y)) {
        cur = new Date(y, m - 1, d, 0, 0, 0, 0);
      }
    } else {
      const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]);
        const d = Number(match[3]);
        cur = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          cur = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
        }
      }
    }

    if (!cur || isNaN(cur.getTime())) return 0;

    const fin = new Date();
    fin.setHours(0, 0, 0, 0);

    if (cur >= fin) return 0;

    let count = 0;
    const temp = new Date(cur);
    while (temp < fin) {
      temp.setDate(temp.getDate() + 1);
      const dow = temp.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  });

  readonly prorrogaPermitida = computed(() => {
    return this.diasTranscurridos() <= 2;
  });

  readonly nuevaFechaLimite = computed<string | null>(() => {
    const sol = this.solicitud();
    const dias = parseInt(this.prorrogaDias) || 0;
    if (dias <= 0) return null;

    let base: Date;
    if (sol?.fechaLimite) {
      base = sol.fechaLimite.includes('/')
        ? new Date(sol.fechaLimite.split('/').reverse().join('-'))
        : new Date(sol.fechaLimite);
    } else {
      base = new Date();
    }
    if (isNaN(base.getTime())) base = new Date();

    const fecha = new Date(base);
    let agregados = 0;
    while (agregados < dias) {
      fecha.setDate(fecha.getDate() + 1);
      const dow = fecha.getDay();
      if (dow !== 0 && dow !== 6) agregados++;
    }
    return fecha.toISOString().slice(0, 10);
  });

  readonly nuevaFechaLimiteDMY = computed<string>(() => {
    const iso = this.nuevaFechaLimite();
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  });

  readonly hitosValidos = computed(() => {
    return this.hitos().filter(h => h.fecha && h.entregable.trim().length > 0);
  });

  readonly errorHitos = computed<string | null>(() => {
    const dias = parseInt(this.prorrogaDias) || 0;
    const cronogramaObligatorio = dias > 30 || this.usarCronograma();
    if (!cronogramaObligatorio) return null;

    const todos = this.hitos();
    const validos = this.hitosValidos();
    if (validos.length === 0) return 'Registre al menos una entrega con fecha y descripción.';

    if (todos.some(h => !h.fecha || h.entregable.trim().length === 0)) {
      return 'Complete la fecha y entregable de cada hito agregado o elimine los hitos vacíos.';
    }

    const hoyISO = new Date().toISOString().slice(0, 10);
    if (validos.some(h => h.fecha < hoyISO)) return 'Las fechas del cronograma no pueden ser anteriores a hoy.';

    const limite = this.nuevaFechaLimite();
    if (limite && validos.some(h => h.fecha > limite)) {
      return `Las entregas deben programarse hasta la nueva fecha límite (${this.nuevaFechaLimiteDMY()}).`;
    }
    return null;
  });

  readonly dentroPlazoEncauzamiento = computed(() => {
    return this.diasTranscurridos() <= 4;
  });

  readonly liqTotal = computed(() => {
    const f = (Number(this.liqFolios) || 0) * (Number(this.liqCostoFolio) || 0);
    const c = (Number(this.liqCertificadas) || 0) * (Number(this.liqCostoCert) || 0);
    const s = Number(this.liqSoporte) || 0;
    return f + c + s;
  });

  readonly cuponMonto = computed(() => {
    const total = this.liqTotal();
    return total > 0 ? `S/ ${total.toFixed(2)}` : '';
  });

  readonly entidadesDestino = computed(() => {
    const entActual = this.solicitud()?.entidadNombre;
    return this.entidades().filter(e => e.nombre !== entActual);
  });

  readonly entidadesDestinoOptions = computed<ReferenceComboboxOption[]>(() => {
    return this.entidadesDestino().map(e => ({
      id: e.nombre,
      label: e.acronimo ? `${e.nombre} (${e.acronimo})` : e.nombre
    }));
  });

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
    return (sol.documentosMetadata && sol.documentosMetadata.length > 0)
      ? sol.documentosMetadata
      : (sol.documentos || []);
  });

  private mapToDocRow(d: any): DocRowItem {
    const nombre = d.nombreOriginal || d.nombreArchivo || d.nombre || 'Documento';
    const tipo = d.tipoDocumento || d.tipoArchivo || d.tipo || 'PDF';
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
        return tipo !== 'SUBSANACION' && !this.esAnexo(nombre);
      })
      .map(d => this.mapToDocRow(d));
  });

  readonly grupoAnexos = computed<DocRowItem[]>(() => {
    return this.todosDocumentosAdministrado()
      .filter((d: any) => {
        const tipo = (d.tipoDocumento || d.tipoArchivo || d.tipo || '').toUpperCase();
        const nombre = d.nombreOriginal || d.nombreArchivo || d.nombre || '';
        return tipo !== 'SUBSANACION' && this.esAnexo(nombre);
      })
      .map(d => this.mapToDocRow(d));
  });

  readonly grupoSubsanaciones = computed<DocRowItem[]>(() => {
    return this.todosDocumentosAdministrado()
      .filter((d: any) => {
        const tipo = (d.tipoDocumento || d.tipoArchivo || d.tipo || '').toUpperCase();
        const nombre = d.nombreOriginal || d.nombreArchivo || d.nombre || '';
        return tipo === 'SUBSANACION' || /subsanaci[oó]n/i.test(nombre);
      })
      .map(d => this.mapToDocRow(d));
  });

  abrirDocPreview(doc: any): void {
    const d = doc.raw || doc;
    const nombre = doc.nombre || d.nombreOriginal || d.nombreArchivo || d.nombre || 'documento.pdf';
    this.previewTarget.set({
      id: d.id,
      nombre,
      tipo: doc.tipo || d.tipoDocumento || d.tipoArchivo || d.tipo || 'application/pdf',
      expediente: this.solicitud()?.expediente,
      url: d.url || d.ruta
    });
  }

  descargarDoc(doc: any): void {
    const d = doc.raw || doc;
    const nombre = doc.nombre || d.nombreOriginal || d.nombreArchivo || d.nombre || 'documento.pdf';
    const generacion = this.generacionRespuesta, sesion = this.claveSesion();
    const vigente = () => !this.destruido && generacion === this.generacionRespuesta && sesion === this.claveSesion();
    this.error.set('');
    if (d.id) {
      this.documentoService.download(d.id, nombre).subscribe({
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
        error: err => { if (vigente()) this.error.set(falloConsulta(err, 'el documento').mensaje); }
      });
    } else this.error.set('Documento sin identificador recuperable. No se puede descargar.');
  }

  tamanoDoc(doc: any): string {
    const bytes = doc.tamanoBytes || doc.sizeBytes || doc.tamanio || doc.size || doc.tamano;
    if (typeof bytes === 'number' && bytes > 0) {
      if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }
      return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
    }
    return typeof doc.tamano === 'string' ? doc.tamano : 'PDF';
  }

  readonly prorrogaTipo = computed<'programada' | 'registrada'>(() => {
    const dias = parseInt(this.prorrogaDias) || 0;
    return (dias > 30 || this.prorrogaCronograma.trim().length > 0) ? 'programada' : 'registrada';
  });

  readonly solicitudDocumentoRelation = computed<DocumentoRelation | null>(() => {
    const solicitudId = this.solicitud()?.id;
    return solicitudId ? { solicitudId } : null;
  });

  readonly tabs: ReadonlyArray<{ id: ResponseTabId; label: string }> = [
    { id: 'responder', label: 'Responder' },
    { id: 'solicitud', label: 'Solicitud' },
    { id: 'ciudadano', label: 'Administrado' },
    { id: 'adjuntos', label: 'Documentos del administrado' }
  ];

  readonly decisions: ResponseDecision[] = [
    {
      id: 'entrega_total',
      title: 'Entrega total',
      description: 'La información se entrega íntegramente al ciudadano.',
      accent: 'var(--success)'
    },
    {
      id: 'entrega_parcial',
      title: 'Entrega parcial',
      description: 'Se entrega parte; el resto requiere fundamento legal.',
      accent: 'var(--gold-dark)'
    },
    {
      id: 'denegacion_total',
      title: 'Denegación total',
      description: 'Requiere causal legal y evidencia documental.',
      accent: 'var(--brand-700)'
    }
  ];

  ngOnInit(): void {
    this.navegacion = this.route.paramMap.subscribe(params => {
      const expediente = params.get('expediente');
      if (!expediente) {
        this.error.set('No se recibió el expediente para registrar la respuesta.');
        this.loadingSolicitud.set(false);
      } else this.cargarSolicitud(expediente);
    });
    this.cargarEntidades();
  }

  cargarSolicitud(expediente: string): void {
    this.expedienteActual = expediente; this.consultaReintentable.set(false);
    this.previewTarget.set(null); this.confirmModalAbierto.set(false); this.decision.set(null); this.activeTab.set('responder');
    const generacion = ++this.generacionRespuesta;
    const sesion = this.claveSesion();
    this.consultaSolicitud?.unsubscribe();
    this.solicitud.set(null); this.intentoRespuesta = null; this.recepcionRespuesta.set(null);
    this.respuestaPendienteVerificacion.set(false); this.puedeReintentarRespuesta.set(false);
    this.resultadoRespuesta.set('inicial'); this.loading.set(false); this.successModalAbierto.set(false);
    this.documentosEntrega.set([]); this.evidenciaDenegatoria.set([]);
    this.descripcionAceptacion = ''; this.descripcionDenegacion = ''; this.causalDenegatoria = ''; this.fundamentoLegal = '';
    this.loadingSolicitud.set(true); this.error.set('');
    this.consultaSolicitud = this.solicitudService.findByExpediente(expediente).subscribe({
      next: data => {
        if (this.destruido || generacion !== this.generacionRespuesta || sesion !== this.claveSesion()) return;
        this.solicitud.set(data); this.loadingSolicitud.set(false);
        if (this.yaPreciso() && this.via() === 'precision') this.via.set('responder');
        const intento = data?.id ? this.recuperarIntentoRespuesta(data.id) : null;
        if (intento) {
          this.intentoRespuesta = intento;
          this.respuestaPendienteVerificacion.set(true);
          void this.comprobarRecepcionRespuesta();
        }
      },
      error: err => {
        if (this.destruido || generacion !== this.generacionRespuesta || sesion !== this.claveSesion()) return;
        const fallo = falloConsulta(err, 'la solicitud'); this.error.set(fallo.mensaje); this.consultaReintentable.set(fallo.reintentable); this.loadingSolicitud.set(false);
      }
    });
  }

  cargarEntidades(): void {
    this.entidadService.findActivas().subscribe({
      next: (data) => this.entidades.set(data),
      error: () => console.warn('No se pudieron cargar las entidades activas.')
    });
  }

  cambiarTab(tab: ResponseTabId): void {
    this.activeTab.set(tab);
  }

  setVia(v: ViaProcesal): void {
    this.via.set(v);
    this.error.set('');
  }

  seleccionarDecision(value: DecisionId): void {
    this.decision.set(value);
    this.error.set('');
  }

  onDocumentosEntregaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addSelectedFiles(input, this.documentosEntrega);
  }

  onEvidenciaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addSelectedFiles(input, this.evidenciaDenegatoria);
  }

  removeDocumentoEntrega(index: number): void {
    this.documentosEntrega.update(prev => prev.filter((_, i) => i !== index));
    this.error.set('');
  }

  removeEvidenciaDenegatoria(index: number): void {
    this.evidenciaDenegatoria.update(prev => prev.filter((_, i) => i !== index));
    this.error.set('');
  }

  private addSelectedFiles(input: HTMLInputElement, target: { update(fn: (val: File[]) => File[]): void }): void {
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
        target.update(prev => [...prev, ...filesToAdd]);
      }
    }
    input.value = '';
  }

  fileSizeLabel(file: File): string {
    return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  canSubmit(): boolean {
    if (this.loading() || this.respuestaPendienteVerificacion()) return false;
    if (this.via() === 'responder' && (this.motivoRespuestaNoDisponible() || !this.puedeRegistrarRespuestaManual())) return false;
    if (this.via() === 'precision') {
      return this.precisionDetalle.trim().length >= 10;
    }

    if (this.via() === 'prorroga') {
      if (!this.prorrogaPermitida()) return false;
      const dias = parseInt(this.prorrogaDias) || 0;
      const motivoOk = this.prorrogaMotivo.trim().length >= 10;
      const cronogramaRequerido = dias > 30 || this.usarCronograma();
      if (cronogramaRequerido) {
        return dias >= 1 && motivoOk && !this.errorHitos();
      }
      return dias >= 1 && motivoOk;
    }

    // via === 'responder'
    const curDecision = this.decision();
    if (!curDecision) return false;

    const encauzamientoValido = !this.encauzar || (
      !!this.entidadDestino.trim() &&
      this.motivoEncauzamiento.trim().length >= 10 &&
      (curDecision !== 'entrega_parcial' || this.parteEncauzada.trim().length >= 10)
    );

    const cuponValido = !this.requiereFisico() || (
      this.cuponEnviado && !!this.cuponMonto().trim() && this.cuponLugar.trim().length > 0
    );

    if (curDecision === 'entrega_total') {
      return this.descripcionAceptacion.trim().length > 0 &&
        encauzamientoValido &&
        cuponValido;
    }

    if (curDecision === 'entrega_parcial') {
      return this.descripcionAceptacion.trim().length > 0 &&
        this.causalDenegatoria.length > 0 &&
        encauzamientoValido &&
        cuponValido;
    }

    if (curDecision === 'denegacion_total') {
      return this.causalDenegatoria.length > 0 &&
        this.descripcionDenegacion.trim().length > 0 &&
        this.fundamentoLegal.trim().length > 0 &&
        encauzamientoValido;
    }

    return false;
  }

  handleSubmit(): void {
    if (!this.canSubmit()) {
      this.error.set('Complete todos los campos obligatorios antes de enviar.');
      return;
    }
    this.confirmModalAbierto.set(true);
  }

  confirmarAccion(): void {
    const sol = this.solicitud();
    const sesion = this.authService.obtenerSesion();
    if (!sol || !sesion) return;

    if (this.via() === 'precision') {
      this.loading.set(true);
      this.solicitudService.observar(sol.id, {
        motivoObservacion: this.precisionDetalle.trim(),
        responsable: sesion.nombre || 'Funcionario responsable'
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.confirmModalAbierto.set(false);
          this.mensaje.set('Observación registrada. Verifique la notificación y su evidencia en el expediente.');
          this.successModalAbierto.set(true);
        },
        error: (err) => this.handleError(err)
      });
      return;
    }

    if (this.via() === 'prorroga') {
      const dias = parseInt(this.prorrogaDias) || 5;
      const cronogramaReq = dias > 30 || this.usarCronograma();
      if (cronogramaReq && this.errorHitos()) {
        this.loading.set(false);
        this.error.set(this.errorHitos()!);
        return;
      }
      this.loading.set(true);
      const hitosAEnviar = cronogramaReq && this.hitosValidos().length > 0
        ? this.hitosValidos().map((h, i) => ({
            numeroEntrega: i + 1,
            descripcion: h.entregable.trim(),
            fechaProgramada: h.fecha,
            observacion: this.prorrogaCronograma.trim() || undefined
          }))
        : [{
            numeroEntrega: 1,
            descripcion: 'Entrega de información en plazo ampliado',
            fechaProgramada: this.nuevaFechaLimite() || new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10),
            observacion: this.prorrogaMotivo.trim()
          }];

      this.solicitudService.registrarAmpliacion(sol.id, {
        motivoAmpliacion: this.prorrogaMotivo.trim(),
        informeAmpliacion: this.prorrogaCronograma.trim() || this.prorrogaMotivo.trim(),
        fechaNotificacionAmpliacion: new Date().toISOString().slice(0, 10),
        responsable: sesion.nombre || 'Funcionario responsable',
        cronograma: hitosAEnviar
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.confirmModalAbierto.set(false);
          this.mensaje.set('Ampliación registrada. Verifique su notificación en el expediente.');
          this.successModalAbierto.set(true);
        },
        error: (err) => this.handleError(err)
      });
      return;
    }

    // Decisión de fondo
    this.enviarRespuesta();
  }

  motivoRespuestaNoDisponible(): string {
    const sol = this.solicitud();
    if (this.encauzar) return 'El compuesto con encauzamiento no está disponible de forma simultánea. Registre el encauzamiento desde su sección correspondiente.';
    if (sol?.observaciones?.some(o => o.estado === 'PENDIENTE_SUBSANACION')) return 'Existe una observación pendiente. Recupere la recepción de precisión y el estado vigente antes de responder.';
    if (sol && !this.puedeRegistrarRespuestaManual()) return 'El estado actual del expediente no permite registrar otra respuesta. Consulte la respuesta y sus documentos desde el detalle.';
    return '';
  }

  async enviarRespuesta(): Promise<void> {
    const sesion = this.authService.obtenerSesion(); const sol = this.solicitud(); const decision = this.decision();
    if (!sesion?.funcionarioId || !sol || !decision || this.loading() || this.respuestaPendienteVerificacion()) return;
    const motivo = this.motivoRespuestaNoDisponible();
    if (motivo || !this.puedeRegistrarRespuestaManual()) {
      this.error.set(motivo || 'El estado del expediente no permite registrar una respuesta. Recupere su estado actual.'); return;
    }
    const generacion = this.generacionRespuesta; const sesionClave = this.claveSesion();
    const datos: CrearRespuestaRequest = {
      solicitudId: sol.id, funcionarioId: sesion.funcionarioId,
      tipoRespuesta: decision === 'entrega_total' ? 'ENTREGA_TOTAL' : decision === 'entrega_parcial' ? 'ENTREGA_PARCIAL' : 'DENEGACION_TOTAL',
      contenido: (decision === 'denegacion_total' ? this.descripcionDenegacion : this.descripcionAceptacion).trim(),
      causalDenegatoria: decision !== 'entrega_total' ? this.causalDenegatoria || undefined : undefined,
      fundamentoLegal: decision !== 'entrega_total' ? this.fundamentoLegal.trim() || undefined : undefined,
      formatoEntrega: this.formatoEntrega, plazoEntrega: this.plazoEntrega
    };
    const archivos = [...(decision === 'denegacion_total' ? this.evidenciaDenegatoria() : this.documentosEntrega())];
    if (this.intentoRespuesta) {
      await this.comprobarRecepcionRespuesta();
      if (this.recepcionRespuesta() || this.respuestaPendienteVerificacion() || this.solicitud()?.id !== sol.id
          || this.generacionRespuesta !== generacion || this.claveSesion() !== sesionClave || this.destruido) return;
    }
    const intento: IntentoRespuesta = { solicitudId: sol.id,
      claveOperacion: this.intentoRespuesta?.claveOperacion || crypto.randomUUID(), datos,
      archivos };
    if (!this.guardarIntentoRespuesta(intento)) return;
    this.intentoRespuesta = intento;
    await this.ejecutarRespuesta(intento);
  }

  private vigenteRespuesta(intento: IntentoRespuesta, generacion: number, sesion: string): boolean {
    return !this.destruido && this.generacionRespuesta === generacion && this.claveSesion() === sesion
      && this.solicitud()?.id === intento.solicitudId && this.intentoRespuesta === intento;
  }

  private async ejecutarRespuesta(intento: IntentoRespuesta): Promise<void> {
    if (!intento.datos || !intento.archivos) return;
    const generacion = this.generacionRespuesta; const sesion = this.claveSesion();
    this.loading.set(true); this.error.set(''); this.documentUploadWarning.set('');
    this.successModalAbierto.set(false); this.puedeReintentarRespuesta.set(false);
    try {
      const dto = await firstValueFrom(this.respuestaService.registrarConDocumentos(
        intento.solicitudId, intento.claveOperacion, intento.datos, intento.archivos));
      if (!this.vigenteRespuesta(intento, generacion, sesion)) return;
      if (!this.recepcionValida(dto, intento)) throw new Error('Recepción incompatible');
      await this.consultarYConfirmarRespuesta(intento, generacion, sesion, dto.id);
    } catch (err: unknown) {
      if (!this.vigenteRespuesta(intento, generacion, sesion)) return;
      const status = (err as { status?: number })?.status;
      if (status === undefined || status === 0 || status >= 500) {
        this.resultadoRespuesta.set('incierto'); this.respuestaPendienteVerificacion.set(true);
        await this.consultarYConfirmarRespuesta(intento, generacion, sesion);
      } else {
        this.resultadoRespuesta.set('rechazado'); this.respuestaPendienteVerificacion.set(false);
        this.error.set(problemDetailsMessage(err, 'La operación fue rechazada; no se confirmó respuesta ni documentos.'));
      }
    } finally {
      if (this.vigenteRespuesta(intento, generacion, sesion)) { this.loading.set(false); this.confirmModalAbierto.set(false); }
    }
  }

  async comprobarRecepcionRespuesta(): Promise<void> {
    const intento = this.intentoRespuesta; if (!intento || this.loading() || this.recepcionRespuesta()) return;
    const generacion = this.generacionRespuesta; const sesion = this.claveSesion();
    this.loading.set(true); this.respuestaPendienteVerificacion.set(true); this.error.set('');
    try { await this.consultarYConfirmarRespuesta(intento, generacion, sesion); }
    finally { if (this.vigenteRespuesta(intento, generacion, sesion)) this.loading.set(false); }
  }

  async reintentarRespuesta(): Promise<void> {
    const intento = this.intentoRespuesta;
    if (!intento?.datos || !intento.archivos || this.loading() || !this.puedeReintentarRespuesta()) return;
    const generacion = this.generacionRespuesta; const sesion = this.claveSesion();
    await this.comprobarRecepcionRespuesta();
    if (this.vigenteRespuesta(intento, generacion, sesion) && this.puedeReintentarRespuesta() && !this.recepcionRespuesta()) {
      await this.ejecutarRespuesta(intento);
    }
  }

  private async consultarYConfirmarRespuesta(intento: IntentoRespuesta, generacion: number, sesion: string, id?: number): Promise<void> {
    try {
      const dto = await firstValueFrom(this.respuestaService.consultarRecepcion(intento.solicitudId, intento.claveOperacion));
      if (!this.vigenteRespuesta(intento, generacion, sesion)) return;
      if (!this.recepcionValida(dto, intento) || (id !== undefined && dto.id !== id)) throw new Error('Recepción incompatible');
      const actual = this.solicitud(); if (!actual) return;
      const recuperada = await firstValueFrom(this.solicitudService.findByExpediente(actual.expediente));
      if (!this.vigenteRespuesta(intento, generacion, sesion)) return;
      const estado = dto.respuesta.tipoRespuesta === 'DENEGACION_TOTAL' ? 'DENEGADA' : 'RESPONDIDA';
      if (recuperada?.id !== intento.solicitudId || recuperada.expediente !== actual.expediente
          || recuperada.respuesta?.id !== dto.respuesta.id || recuperada.respuesta.tipoRespuesta !== dto.respuesta.tipoRespuesta
          || recuperada.estado !== estado) throw new Error('Recurso incompatible');
      this.solicitud.set(recuperada); this.recepcionRespuesta.set(dto);
      this.decision.set(dto.respuesta.tipoRespuesta === 'ENTREGA_TOTAL' ? 'entrega_total'
        : dto.respuesta.tipoRespuesta === 'ENTREGA_PARCIAL' ? 'entrega_parcial' : 'denegacion_total');
      this.resultadoRespuesta.set('recibido'); this.respuestaPendienteVerificacion.set(false); this.puedeReintentarRespuesta.set(false);
      this.error.set(''); this.documentUploadWarning.set('');
      this.mensaje.set('Respuesta y todos sus archivos seleccionados registrados y recuperados.');
      this.successModalAbierto.set(true); this.confirmModalAbierto.set(false);
      try { sessionStorage.removeItem(this.storageKeyRespuesta(intento.solicitudId)); } catch { /* La recepción del servidor sigue siendo la autoridad. */ }
    } catch (err: unknown) {
      if (!this.vigenteRespuesta(intento, generacion, sesion)) return;
      const status = (err as { status?: number })?.status;
      this.resultadoRespuesta.set(status === 404 ? 'sin-confirmacion' : 'incierto');
      this.puedeReintentarRespuesta.set(status === 404 && !!intento.datos && !!intento.archivos);
      this.respuestaPendienteVerificacion.set(status !== 404 || !!intento.datos);
      this.error.set(status === 404
        ? 'No se confirmó recepción. Un envío puede seguir en curso. Reintente con la misma clave y contenido; si recargó, vuelva a completar exactamente el mismo envío.'
        : 'No se pudo verificar la recepción y sus documentos. Este error no demuestra ausencia del registro. Compruebe nuevamente antes de reintentar.');
    }
  }

  private recepcionValida(dto: RespuestaSaipRecepcion, intento: IntentoRespuesta): boolean {
    const respuesta = dto?.respuesta; const docs = dto?.documentos;
    if (!dto?.id || dto.solicitudId !== intento.solicitudId || dto.claveOperacion !== intento.claveOperacion
      || !dto.fechaRecepcion || Number.isNaN(Date.parse(dto.fechaRecepcion)) || !respuesta?.id
      || !['ENTREGA_TOTAL', 'ENTREGA_PARCIAL', 'DENEGACION_TOTAL'].includes(respuesta.tipoRespuesta || '')
      || !Array.isArray(docs) || new Set(docs.map(d => d.id)).size !== docs.length) return false;
    if (intento.datos && (respuesta.tipoRespuesta !== intento.datos.tipoRespuesta
      || respuesta.funcionarioId !== intento.datos.funcionarioId)) return false;
    if (intento.archivos && intento.archivos.length !== docs.length) return false;
    return docs.every((doc, i) => !!doc.id && doc.respuestaId === respuesta.id && doc.tipoDocumento === 'RESPUESTA_ENTIDAD'
      && doc.estado === 'ACTIVO' && typeof doc.sizeBytes === 'number' && doc.sizeBytes > 0 && /^[a-f0-9]{64}$/i.test(doc.hashSha256 || '')
      && (!intento.archivos || (doc.nombreOriginal === intento.archivos[i].name && doc.sizeBytes === intento.archivos[i].size)));
  }

  private storageKeyRespuesta(solicitudId: number): string {
    const s = this.authService.obtenerSesion();
    return `yaiku:respuesta:${s?.usuarioId || s?.funcionarioId}:${solicitudId}`;
  }

  private guardarIntentoRespuesta(intento: IntentoRespuesta): boolean {
    try {
      // Solo identidad de operación: nunca JWT, contenido, archivos o datos personales.
      sessionStorage.setItem(this.storageKeyRespuesta(intento.solicitudId), JSON.stringify({
        solicitudId: intento.solicitudId, claveOperacion: intento.claveOperacion })); return true;
    } catch { this.error.set('No se pudo preparar la recuperación. Habilite el almacenamiento de esta sesión y reintente.'); return false; }
  }

  private recuperarIntentoRespuesta(solicitudId: number): IntentoRespuesta | null {
    try {
      const raw = sessionStorage.getItem(this.storageKeyRespuesta(solicitudId)); if (!raw) return null;
      const d = JSON.parse(raw);
      if (d?.solicitudId === solicitudId && typeof d.claveOperacion === 'string' && /^[a-f0-9-]{36}$/i.test(d.claveOperacion)) {
        return { solicitudId, claveOperacion: d.claveOperacion };
      }
    } catch { /* Los datos locales no confirman una actuación. */ }
    return null;
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    this.confirmModalAbierto.set(false);
    this.error.set(problemDetailsMessage(err, 'Error al enviar respuesta'));
  }

  getEstadoDisplay(value: string | undefined): string {
    return (value || '').replaceAll('_', ' ').trim() || 'Sin estado';
  }

  getDiasRestantes(): number | null {
    const value = this.solicitud()?.diasRestantes;
    return typeof value === 'number' ? value : null;
  }

  getDiasRestantesColor(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) return 'var(--muted-foreground)';
    if (dias < 0) return 'var(--brand-700)';
    if (dias <= 3) return 'var(--warning)';
    return 'var(--success)';
  }

  getDiasRestantesDisplay(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) return 'Sin dato';
    if (dias < 0) return `${Math.abs(dias)} días retraso`;
    return `${dias} días`;
  }

  esUrgente(): boolean {
    const dias = this.getDiasRestantes();
    return dias !== null && dias >= 0 && dias <= 3;
  }

  esSilencioAdministrativoAutomatico(): boolean {
    return isSilencioAdministrativo(this.solicitud());
  }

  puedeRegistrarRespuestaManual(): boolean {
    return canSendManualResponse(this.solicitud());
  }

  respuestaConfirmTitle(): string {
    if (this.via() === 'precision') return 'Confirme la solicitud de precisión';
    if (this.via() === 'prorroga') return 'Confirme la ampliación del plazo';
    return 'Confirme la respuesta';
  }

  respuestaConfirmDescription(): string {
    if (this.via() === 'precision') {
      return 'El administrado será notificado por correo y plataforma, y tendrá 2 días hábiles para subsanar. Si no responde, el expediente se archivará automáticamente.';
    }
    if (this.via() === 'prorroga') {
      return 'Se comunicará al administrado la ampliación excepcional del plazo de atención. Esta acción quedará registrada en el expediente.';
    }
    return 'Verifique la decisión y el sustento antes de notificar al ciudadano. Esta acción quedará registrada en el expediente.';
  }

  respuestaConfirmSummary(): ReferenceConfirmSummary[] {
    const sol = this.solicitud();
    const exp = sol?.expediente || '—';
    const ciu = sol?.ciudadanoNombre || 'Ciudadano';

    if (this.via() === 'precision') {
      return [
        { label: 'Expediente', value: exp, mono: true },
        { label: 'Administrado', value: ciu },
        { label: 'Vía', value: 'Solicitud de precisión' },
        { label: 'Plazo subsanación', value: '2 días hábiles' }
      ];
    }

    if (this.via() === 'prorroga') {
      return [
        { label: 'Expediente', value: exp, mono: true },
        { label: 'Administrado', value: ciu },
        { label: 'Tipo', value: this.prorrogaTipo() === 'programada' ? 'Ampliación programada' : 'Ampliación registrada' },
        { label: 'Días hábiles', value: this.prorrogaDias }
      ];
    }

    const decision = this.decision();
    const files = decision === 'denegacion_total' ? this.evidenciaDenegatoria() : this.documentosEntrega();
    const count = files.length;
    const countText = count > 0 ? `${count} ${count === 1 ? 'adjunto' : 'adjuntos'}` : 'sin adjuntos';
    const causalLabel = this.causalesOficiales.find(c => c.value === this.causalDenegatoria)?.label || this.causalDenegatoria || '—';

    const summary: ReferenceConfirmSummary[] = [
      { label: 'Expediente', value: exp, mono: true },
      { label: 'Ciudadano', value: ciu },
      { label: 'Decisión', value: this.encauzar ? `${this.getDecisionTitle()} · Encauzamiento` : this.getDecisionTitle() },
      { label: 'Documentos', value: countText }
    ];

    if (decision === 'denegacion_total' || (decision === 'entrega_parcial' && this.causalDenegatoria)) {
      summary.splice(3, 0, { label: 'Causal', value: causalLabel });
    }

    if (this.encauzar) {
      summary.push({ label: 'Entidad destino', value: this.entidadDestino });
      if (decision === 'entrega_parcial' && this.parteEncauzada) {
        summary.push({ label: 'Extremo derivado', value: this.parteEncauzada });
      }
    }

    if (this.requiereFisico() && this.cuponEnviado) {
      summary.push({ label: 'Cupón de pago', value: `${this.cuponMonto()} · 30 días para recoger` });
    }

    return summary;
  }

  respuestaWarning(): ReferenceConfirmWarning {
    if (this.via() === 'precision') {
      return {
        label: 'Notificación oficial',
        detail: 'El administrado será emplazado a subsanar en 2 días hábiles.'
      };
    }
    if (this.via() === 'prorroga') {
      return {
        label: 'Notificación oficial',
        detail: 'Se comunicará al administrado la prórroga del plazo de atención.'
      };
    }
    const denegacion = this.decision() === 'denegacion_total';
    return {
      label: 'Notificación oficial',
      detail: denegacion
        ? 'El ciudadano podrá apelar al TTAIP dentro de 15 días hábiles.'
        : 'El ciudadano será notificado por correo electrónico al confirmar el envío.'
    };
  }

  respuestaSuccessTone(): ReferenceSuccessTone {
    if (this.documentUploadWarning()) return 'warning';
    if (this.via() === 'precision') return 'brand';
    if (this.via() === 'prorroga') return 'gold';
    return this.decision() === 'denegacion_total' ? 'brand' : 'success';
  }

  respuestaSuccessEyebrow(): string {
    if (this.documentUploadWarning()) return 'Respuesta registrada · Documento pendiente';
    if (this.via() === 'precision') return 'Precisión solicitada';
    if (this.via() === 'prorroga') return 'Plazo ampliado';
    return this.decision() === 'denegacion_total' ? 'Denegatoria registrada' : 'Respuesta entregada';
  }

  respuestaSuccessTitle(): string {
    if (this.documentUploadWarning()) return 'La respuesta se guardó con una incidencia documental';
    if (this.via() === 'precision') return 'Solicitud de precisión notificada';
    if (this.via() === 'prorroga') return 'Ampliación del plazo comunicada';
    return this.decision() === 'denegacion_total' ? 'Denegatoria notificada al ciudadano' : 'Respuesta enviada al ciudadano';
  }

  respuestaSuccessDescription(): string {
    if (this.documentUploadWarning()) return this.documentUploadWarning();
    if (this.via() === 'precision') {
      return 'Se notificó al administrado por correo y plataforma. Dispone de 2 días hábiles para subsanar; si no responde, el expediente se archivará automáticamente.';
    }
    if (this.via() === 'prorroga') {
      return 'Se comunicará al administrado la ampliación del plazo de atención. El expediente continúa en trámite con la nueva fecha límite.';
    }
    return this.decision() === 'denegacion_total'
      ? 'Se ha registrado la denegatoria con su fundamento legal. El ciudadano fue notificado y dispone de su derecho a apelar ante el TTAIP.'
      : 'La información ha sido entregada al ciudadano dentro del plazo legal. La solicitud queda atendida en el expediente.';
  }

  respuestaSuccessMetadata(): ReferenceSuccessMeta[] {
    const sol = this.solicitud();
    const ciu = sol?.ciudadanoNombre || 'Ciudadano';

    if (this.via() === 'precision') {
      return [
        { label: 'Administrado', value: ciu },
        { label: 'Vía', value: 'Solicitud de precisión' },
        { label: 'Plazo', value: '2 días hábiles' }
      ];
    }

    if (this.via() === 'prorroga') {
      return [
        { label: 'Administrado', value: ciu },
        { label: 'Tipo', value: this.prorrogaTipo() === 'programada' ? 'Ampliación programada' : 'Ampliación registrada' },
        { label: 'Días adicionales', value: `${this.prorrogaDias} días hábiles` }
      ];
    }

    const recibida = this.recepcionRespuesta();
    const respuesta = recibida?.respuesta;
    const documentos = recibida?.documentos.map(d => d.nombreOriginal || `Documento ${d.id}`).join(', ') || 'Sin adjuntos seleccionados';
    const metadata: ReferenceSuccessMeta[] = [
      { label: 'Recepción', value: recibida ? `${recibida.id} · respuesta ${respuesta?.id}` : 'No confirmada' },
      { label: 'Ciudadano', value: ciu },
      { label: 'Decisión', value: this.getDecisionTitle() },
      { label: 'Documentos recibidos', value: documentos }
    ];
    if (respuesta?.tipoRespuesta === 'DENEGACION_TOTAL' || respuesta?.tipoRespuesta === 'ENTREGA_PARCIAL') {
      metadata.push({ label: 'Causal registrada', value: respuesta.causalDenegatoria || 'No registrada' },
        { label: 'Fundamento registrado', value: respuesta.fundamentoLegal || 'No registrado' });
    }
    return metadata;
  }

  respuestaNextSteps(): ReferenceSuccessNextStep[] {
    if (this.via() === 'precision') {
      return [
        { label: 'El administrado será notificado en su casilla electrónica y correo.' },
        { label: 'Tiene 2 días hábiles para presentar su subsanación.', hint: '2 días hábiles' },
        { label: 'Si no responde en el plazo, el sistema archivará la solicitud.' }
      ];
    }

    if (this.via() === 'prorroga') {
      return [
        { label: 'El administrado recibirá el informe y cronograma de entregas.' },
        { label: 'La fecha límite de atención en el sistema se ha actualizado.' },
        { label: 'Podrá resolver el fondo antes del nuevo vencimiento.' }
      ];
    }

    if (this.decision() === 'denegacion_total') {
      return [
        { label: 'El ciudadano recibirá la notificación con la causal y el fundamento legal invocado.' },
        { label: 'Podrá apelar ante el TTAIP dentro del plazo legal.', hint: '15 días hábiles' },
        { label: 'De interponerse apelación, su entidad será emplazada por el Tribunal.' }
      ];
    }

    return [
      { label: 'El administrado recibirá los documentos en la modalidad que solicitó.' },
      { label: 'La solicitud quedará cerrada salvo apelación del ciudadano.', hint: '15 días hábiles para apelar' },
      { label: 'El expediente permanece archivado en su panel para consulta.' }
    ];
  }

  irPanelFuncionario(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/funcionario']);
  }

  irDetalleExpediente(): void {
    this.successModalAbierto.set(false);
    const exp = this.solicitud()?.expediente;
    if (exp) {
      this.router.navigate(['/funcionario/solicitud', exp]);
    } else {
      this.router.navigate(['/funcionario']);
    }
  }

  getDecisionTitle(): string {
    const currentDecision = this.decision();
    return this.decisions.find((option) => option.id === currentDecision)?.title || '—';
  }

  getInitials(name: string | undefined): string {
    const source = (name || 'Ciudadano').trim();
    if (!source) return 'CI';
    return source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'CI';
  }
}
