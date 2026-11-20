import { falloConsulta } from '../../utils/consulta-remota.util';
import { ReferenceTabsDirective } from '../../shared/reference-tabs.directive';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, effect, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SolicitudService } from '../../services/solicitud.service';
import { RespuestaSaipRecepcion, RespuestaService } from '../../services/respuesta.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import {
  AmpliacionPlazoSolicitud,
  CronogramaEntregaParcial,
  DecisionEntregaProgramada,
  LiquidacionCostoSolicitud,
  PrevisionAmpliacion,
  Solicitud
} from '../../models/solicitud.model';
import type { CrearRespuestaRequest } from '../../api/types';
import { Entidad } from '../../models/entidad.model';
import { Respuesta } from '../../models/respuesta.model';
import {
  DOCUMENTO_ACCEPT,
  DocumentoRelation,
  validarDocumento
} from '../../models/documento.model';
import { DocumentoService } from '../../services/documento.service';
import { catchError, firstValueFrom, of, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
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
import {
  CronogramaEntregasPanelComponent,
  HitoPanelMessage,
  RegistroEntregaHitoEvent
} from '../../shared/cronograma-entregas-panel.component';
import { habilesEntre, hoyLima, sumarHabiles, Tarifas } from '../../models/calendario.model';
import { descripcionSinNotasInternas, formatosEntregaSolicitados, pideSoporteMagnetico, requiereCuponReproduccion } from '../../utils/modalidad-entrega.util';

const DIAS_HABILES_ENCAUZAMIENTO = 4;

export interface HitoCronogramaItem {
  fecha: string;
  entregable: string;
  cierre?: boolean;
}
import {
  LucideArrowLeft, LucideAlertTriangle, LucideCalendar, LucideClock,
  LucideFileText, LucideInfo, LucideCheckCircle2,
  LucideSend, LucideUser, LucideScale,
  LucideHelpCircle, LucideArrowRightLeft, LucideReceipt, LucideMail,
  LucidePhone, LucideIdCard, LucideCalendarClock,
  LucideEye, LucideDownload, LucideXCircle
} from '@lucide/angular';

interface IntentoRespuesta {
  solicitudId: number;
  claveOperacion: string;
  datos?: CrearRespuestaRequest;
  archivos?: readonly File[];
}

type ResponseTabId = 'responder' | 'solicitud' | 'ciudadano' | 'adjuntos';
type DecisionId = 'entrega_total' | 'entrega_parcial' | 'denegacion_total';
type ViaProcesal = 'responder' | 'cronograma' | 'precision' | 'prorroga';

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
  { value: 'no_posee', label: 'La entidad no posee la información y no está obligada a poseerla' },
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
    ReferenceTabsDirective, CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    ReferenceConfirmModalComponent,
    ReferenceSuccessModalComponent,
    ReferenceComboboxComponent,
    MultiFileUploadZoneComponent,
    DocumentPreviewModalComponent,
    AreaResponsablePanelComponent,
    CronogramaEntregasPanelComponent,
    LucideArrowLeft, LucideAlertTriangle, LucideCalendar, LucideClock,
    LucideFileText, LucideInfo, LucideCheckCircle2,
    LucideSend, LucideUser, LucideScale,
    LucideHelpCircle, LucideArrowRightLeft, LucideReceipt, LucideMail,
    LucidePhone, LucideIdCard, LucideCalendarClock,
    LucideEye, LucideDownload, LucideXCircle
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
  private readonly http = inject(HttpClient, { optional: true });

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
        this.documentosEntrega.set([]); this.documentosEntregaParcial.set([]); this.evidenciaDenegatoria.set([]); this.previewTarget.set(null);
        this.resetFormularioRespuesta();
        this.limpiarAmpliacion();
        this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.loading.set(false); this.loadingSolicitud.set(false);
        this.consultaReintentable.set(false); this.error.set('La sesión cambió. Abra nuevamente el expediente con la cuenta actual.');
      }
    });
    effect(onCleanup => {
      const id = this.solicitud()?.id;
      const dias = this.prorrogaDiasNum();
      if (!id || this.via() !== 'prorroga' || !dias || this.ampliacionRegistrada()) return;
      this.revisionPrevision();
      const sesion = this.claveSesion();
      const generacion = this.generacionRespuesta;
      this.prevision.set(null);
      this.errorPrevision.set('');
      const consulta = this.solicitudService.preverAmpliacion(id, dias).subscribe({
        next: datos => {
          if (this.contextoAmpliacionVigente(generacion, sesion) && this.prorrogaDiasNum() === dias) {
            this.prevision.set({ dias, datos });
          }
        },
        error: err => {
          if (this.contextoAmpliacionVigente(generacion, sesion) && this.prorrogaDiasNum() === dias) {
            this.errorPrevision.set(problemDetailsMessage(err, 'No se pudo consultar el nuevo plazo.'));
          }
        }
      });
      onCleanup(() => consulta.unsubscribe());
    });
    effect(() => {
      const limite = this.nuevaFechaLimite() ?? '';
      const activo = this.usarCronograma() || this.cronogramaRequerido();
      if (!activo || !limite) return;
      const requerido = this.cronogramaRequerido();
      this.hitos.update(lista => cronogramaConCierre(lista, limite, requerido));
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
  private actuacionAmpliacion?: Subscription;
  private consultaTarifas?: Subscription;
  private destruido = false;

  ngOnDestroy(): void {
    this.destruido = true;
    this.navegacion?.unsubscribe();
    this.consultaSolicitud?.unsubscribe();
    this.actuacionAmpliacion?.unsubscribe();
    this.consultaTarifas?.unsubscribe();
  }

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

  // Vía de precisión: cada punto se conserva y se envía junto en el motivo existente.
  readonly precisionPuntos = signal<string[]>(['']);

  precisionTexto(): string {
    return this.precisionPuntos()
      .map(value => value.trim())
      .filter(Boolean)
      .map((value, index) => `${index + 1}. ${value}`)
      .join('\n');
  }

  setPrecisionPunto(index: number, value: string): void {
    if (this.loading()) return;
    this.precisionPuntos.update(list => list.map((item, i) => i === index ? value : item));
  }

  addPrecisionPunto(): void {
    if (this.loading()) return;
    this.precisionPuntos.update(list => [...list, '']);
  }

  removePrecisionPunto(index: number): void {
    if (this.loading()) return;
    this.precisionPuntos.update(list => list.length > 1 ? list.filter((_, i) => i !== index) : list);
  }

  // Vía de prórroga / ampliación
  private readonly diasAdicionales = signal('5');
  get prorrogaDias(): string { return this.diasAdicionales(); }
  set prorrogaDias(valor: string) { this.diasAdicionales.set(valor ?? ''); }
  readonly prorrogaDiasNum = computed(() => {
    const dias = Number(this.diasAdicionales());
    return Number.isSafeInteger(dias) && dias >= 1 && dias <= 2_147_483_647 ? dias : 0;
  });
  prorrogaMotivo = '';
  prorrogaCronograma = '';
  hitos = signal<HitoCronogramaItem[]>([{ fecha: '', entregable: '' }]);
  usarCronograma = signal<boolean>(false);
  private readonly prevision = signal<{ dias: number; datos: PrevisionAmpliacion } | null>(null);
  readonly errorPrevision = signal('');
  private readonly revisionPrevision = signal(0);
  readonly previsionVigente = computed(() => {
    const prevision = this.prevision();
    return prevision?.dias === this.prorrogaDiasNum() ? prevision.datos : null;
  });
  readonly cronogramaIncumplido = computed(() => this.ampliacionRegistrada()?.cronograma?.some(h => h.incumplida) ?? false);
  readonly reciboAmpliacion = signal<AmpliacionPlazoSolicitud | null>(null);
  readonly ampliacionRegistrada = computed(() => {
    const sol = this.solicitud();
    const recibo = this.reciboAmpliacion();
    if (recibo && recibo.solicitudId === sol?.id) return recibo;
    return sol?.ampliacionesPlazo?.find(a => a.solicitudId === sol.id && a.estadoAmpliacion !== 'CANCELADA') ?? null;
  });
  readonly ampliacionIncierta = signal(false);
  readonly fechaEntrega = signal<Record<number, string>>({});
  readonly archivosPorHito = signal<Record<number, File[]>>({});
  readonly hitoRegistrandoId = signal<number | null>(null);
  readonly hitoExitoId = signal<number | null>(null);
  readonly cronogramaHitoError = signal<HitoPanelMessage | null>(null);
  readonly cronogramaTotal = computed(() => this.ampliacionRegistrada()?.cronograma?.length ?? 0);
  readonly cronogramaEntregadas = computed(
    () => (this.ampliacionRegistrada()?.cronograma ?? []).filter(h => h.estado === 'ENTREGADA').length
  );
  readonly tieneCronogramaActivo = computed(() => this.cronogramaTotal() > 0);
  readonly tieneHitosPendientes = computed(
    () => (this.ampliacionRegistrada()?.cronograma ?? []).some(h => h.estado !== 'ENTREGADA' && h.estado !== 'CANCELADA')
  );
  readonly adjuntarAdicionalesEnCierre = signal<boolean>(false);
  readonly cronogramaDocumentosEntregados = computed(() => {
    const hitos = [...(this.ampliacionRegistrada()?.cronograma ?? [])].sort(
      (a, b) => a.numeroEntrega - b.numeroEntrega
    );
    const docs: {
      id: number;
      nombre: string;
      tamano: string;
      tipo: string;
      entregaNumero: number;
      fechaEntregaReal?: string | null;
      raw: any;
    }[] = [];
    for (const hito of hitos) {
      if (hito.estado !== 'ENTREGADA') continue;
      for (const doc of hito.documentos ?? []) {
        if (!doc?.id) continue;
        docs.push({
          id: doc.id,
          nombre: doc.nombreOriginal || `Documento #${doc.id}`,
          tamano: this.tamanoDoc(doc),
          tipo: doc.contentType || 'application/pdf',
          entregaNumero: hito.numeroEntrega,
          fechaEntregaReal: hito.fechaEntregaReal,
          raw: doc
        });
      }
    }
    return docs;
  });

  private limpiarAmpliacion(): void {
    this.actuacionAmpliacion?.unsubscribe();
    this.prevision.set(null);
    this.errorPrevision.set('');
    this.reciboAmpliacion.set(null);
    this.ampliacionIncierta.set(false);
    this.fechaEntrega.set({});
    this.archivosPorHito.set({});
    this.hitoRegistrandoId.set(null);
    this.hitoExitoId.set(null);
    this.cronogramaHitoError.set(null);
    this.adjuntarAdicionalesEnCierre.set(false);
    this.via.set('responder');
    this.prorrogaDias = '5';
    this.prorrogaMotivo = '';
    this.prorrogaCronograma = '';
    this.usarCronograma.set(false);
    this.hitos.set([{ fecha: '', entregable: '' }]);
  }

  private contextoAmpliacionVigente(generacion: number, sesion: string): boolean {
    return !this.destruido && generacion === this.generacionRespuesta && sesion === this.claveSesion();
  }

  reintentarPrevision(): void {
    this.revisionPrevision.update(revision => revision + 1);
  }

  agregarHito(): void {
    this.hitos.update(prev => {
      const cierre = prev.find(h => h.cierre);
      if (!cierre) return prev.length < 12 ? [...prev, { fecha: '', entregable: '' }] : prev;
      const parciales = prev.filter(h => !h.cierre);
      return parciales.length >= 11 ? prev : [...parciales, { fecha: '', entregable: '' }, cierre];
    });
  }

  quitarHito(index: number): void {
    if (!this.puedeQuitarHito(index)) return;
    this.hitos.update(prev => prev.filter((_, i) => i !== index));
  }

  puedeAgregarParcial(): boolean {
    return this.prorrogaPermitida() && this.hitos().filter(h => !h.cierre).length < 11;
  }

  puedeQuitarHito(index: number): boolean {
    const hitos = this.hitos();
    const hito = hitos[index];
    if (!hito || hito.cierre) return false;
    const parciales = hitos.filter(h => !h.cierre).length;
    if (this.cronogramaRequerido() && parciales <= 1) return false;
    return hitos.some(h => h.cierre) || hitos.length > 1;
  }

  actualizarHitoFecha(index: number, fecha: string): void {
    if (this.hitos()[index]?.cierre) return;
    this.hitos.update(prev => prev.map((h, i) => i === index ? { ...h, fecha } : h));
  }

  actualizarHitoEntregable(index: number, entregable: string): void {
    this.hitos.update(prev => prev.map((h, i) => i === index ? { ...h, entregable } : h));
  }

  textoFecha(iso: string | null | undefined): string {
    return iso ? fechaDmy(iso) : '';
  }

  indiceParcial(index: number): number {
    return this.hitos().slice(0, index + 1).filter(h => !h.cierre).length;
  }

  minFechaParcial(index: number): string | null {
    const hoy = this.previsionVigente()?.hoy ?? null;
    const previa = this.fechaParcialVecina(index, -1);
    let min = previa ? desplazarDia(previa, 1) : hoy;
    const limite = this.nuevaFechaLimite();
    if (previa && limite && this.esUltimaParcial(index)) {
      const antesDelVencimiento = desplazarDia(limite, -DIAS_CALENDARIO_ENTRE_ENTREGAS);
      const topeTreinta = desplazarDia(previa, DIAS_CALENDARIO_ENTRE_ENTREGAS);
      const antesDelCierre = desplazarDia(limite, -1);
      const maxAlcanzable = topeTreinta < antesDelCierre ? topeTreinta : antesDelCierre;
      if (antesDelVencimiento <= maxAlcanzable && (!min || antesDelVencimiento > min)) min = antesDelVencimiento;
    }
    return hoy && min && min < hoy ? hoy : min;
  }

  maxFechaParcial(index: number): string | null {
    const limite = this.nuevaFechaLimite();
    if (!limite) return null;
    const hoy = this.previsionVigente()?.hoy ?? null;
    const previa = this.fechaParcialVecina(index, -1);
    const ancla = previa ?? hoy;
    let max = ancla ? desplazarDia(ancla, DIAS_CALENDARIO_ENTRE_ENTREGAS) : desplazarDia(limite, -1);
    const antesDelCierre = desplazarDia(limite, -1);
    if (max > antesDelCierre) max = antesDelCierre;
    const posterior = this.fechaParcialVecina(index, 1);
    if (posterior) {
      const anteriorALaSiguiente = desplazarDia(posterior, -1);
      if (anteriorALaSiguiente < max) max = anteriorALaSiguiente;
    }
    return max;
  }

  fechaParcialSeleccionable(index: number): boolean {
    if (this.hitos().slice(0, index).some(h => !h.cierre && !h.fecha)) return false;
    const min = this.minFechaParcial(index);
    const max = this.maxFechaParcial(index);
    return !min || !max || min <= max;
  }

  pistaFechaParcial(index: number): string {
    const max = this.maxFechaParcial(index);
    const min = this.minFechaParcial(index);
    const limite = this.nuevaFechaLimite();
    if (!max || !limite) return 'Espere el cálculo del nuevo vencimiento.';
    if (min && min > max) {
      const previa = this.fechaParcialVecina(index, -1);
      const tope = previa ? desplazarDia(previa, DIAS_CALENDARIO_ENTRE_ENTREGAS) : null;
      const desdeVencimiento = this.esUltimaParcial(index) ? desplazarDia(limite, -DIAS_CALENDARIO_ENTRE_ENTREGAS) : null;
      if (tope && desdeVencimiento && tope < desdeVencimiento) {
        return 'Hay más de 30 días entre la entrega anterior y el vencimiento. Añada una entrega intermedia.';
      }
      return 'No queda un día entre la entrega anterior y el vencimiento. Quite esta entrega o aumente los días de la ampliación.';
    }
    const previaVacia = this.hitos().slice(0, index).some(h => !h.cierre && !h.fecha);
    if (previaVacia) return `Complete antes la fecha de la entrega anterior. El ${fechaDmy(limite)} queda reservado para la última entrega.`;
    const hoy = this.previsionVigente()?.hoy;
    if (!this.fechaParcialVecina(index, -1) && hoy && min === hoy) {
      return `Desde hoy, ${fechaDmy(hoy)}, hasta el ${fechaDmy(max)}. Este calendario admite como máximo 30 días. Si desde esa fecha no alcanza el vencimiento, añada otra entrega.`;
    }
    return `Elija del ${fechaDmy(min ?? max)} al ${fechaDmy(max)}. Entre una entrega y la siguiente no pueden pasar más de 30 días.`;
  }

  private esUltimaParcial(index: number): boolean {
    return this.hitos().slice(index + 1).every(h => !!h.cierre);
  }

  private fechaParcialVecina(index: number, sentido: -1 | 1): string | null {
    const hitos = this.hitos();
    for (let i = index + sentido; i >= 0 && i < hitos.length; i += sentido) {
      if (!hitos[i].cierre && hitos[i].fecha) return hitos[i].fecha;
    }
    return null;
  }

  // Decisión de fondo (respaldados por signals para reactividad inmediata bajo OnPush)
  private readonly descripcionAceptacionSignal = signal('');
  get descripcionAceptacion(): string { return this.descripcionAceptacionSignal(); }
  set descripcionAceptacion(v: string) { this.descripcionAceptacionSignal.set(v ?? ''); }

  private readonly descripcionAceptacionParcialSignal = signal('');
  get descripcionAceptacionParcial(): string { return this.descripcionAceptacionParcialSignal(); }
  set descripcionAceptacionParcial(v: string) { this.descripcionAceptacionParcialSignal.set(v ?? ''); }

  private readonly descripcionDenegacionSignal = signal('');
  get descripcionDenegacion(): string { return this.descripcionDenegacionSignal(); }
  set descripcionDenegacion(v: string) { this.descripcionDenegacionSignal.set(v ?? ''); }

  private readonly causalDenegatoriaSignal = signal('');
  get causalDenegatoria(): string { return this.causalDenegatoriaSignal(); }
  set causalDenegatoria(v: string) { this.causalDenegatoriaSignal.set(v ?? ''); }

  private readonly fundamentoLegalSignal = signal('');
  get fundamentoLegal(): string { return this.fundamentoLegalSignal(); }
  set fundamentoLegal(v: string) { this.fundamentoLegalSignal.set(v ?? ''); }

  // Encauzamiento
  private readonly encauzarSignal = signal(false);
  get encauzar(): boolean { return this.encauzarSignal(); }
  set encauzar(v: boolean) { this.encauzarSignal.set(Boolean(v)); }

  private readonly entidadDestinoSignal = signal('');
  get entidadDestino(): string { return this.entidadDestinoSignal(); }
  set entidadDestino(v: string) { this.entidadDestinoSignal.set(v ?? ''); }

  private readonly motivoEncauzamientoSignal = signal('');
  get motivoEncauzamiento(): string { return this.motivoEncauzamientoSignal(); }
  set motivoEncauzamiento(v: string) { this.motivoEncauzamientoSignal.set(v ?? ''); }

  private readonly parteEncauzadaSignal = signal('');
  get parteEncauzada(): string { return this.parteEncauzadaSignal(); }
  set parteEncauzada(v: string) { this.parteEncauzadaSignal.set(v ?? ''); }

  private readonly borradorPorDecision = new Map<DecisionId, {
    causal: string;
    fundamento: string;
    encauzar: boolean;
    entidad: string;
    motivo: string;
    parte: string;
  }>();
  readonly derivacionTotalRegistrada = signal(false);

  // Cupón de pago (entrega física)
  readonly tarifasConfig = signal<Tarifas>({ copiaSimple: 0.10, copiaCertificada: 0.50, soporteDigital: 1.00 });
  readonly sinCobroReproduccion = signal(false);
  readonly cuponError = signal('');
  private tarifasEditadas = false;

  private readonly cuponEnviadoSignal = signal(false);
  get cuponEnviado(): boolean { return this.cuponEnviadoSignal(); }
  set cuponEnviado(v: boolean) { this.cuponEnviadoSignal.set(Boolean(v)); this.cuponError.set(''); }

  private readonly cuponLugarSignal = signal('');
  get cuponLugar(): string { return this.cuponLugarSignal(); }
  set cuponLugar(v: string) { this.cuponLugarSignal.set(v ?? ''); this.cuponError.set(''); }

  private readonly liqFoliosSignal = signal<string | number>('');
  get liqFolios(): string { return String(this.liqFoliosSignal() ?? ''); }
  set liqFolios(v: string | number) { this.liqFoliosSignal.set(v ?? ''); this.cuponError.set(''); }

  private readonly liqCostoFolioSignal = signal<string | number>('0.10');
  get liqCostoFolio(): string { return String(this.liqCostoFolioSignal() ?? ''); }
  set liqCostoFolio(v: string | number) { this.tarifasEditadas = true; this.liqCostoFolioSignal.set(v ?? ''); this.cuponError.set(''); }

  private readonly liqCertificadasSignal = signal<string | number>('');
  get liqCertificadas(): string { return String(this.liqCertificadasSignal() ?? ''); }
  set liqCertificadas(v: string | number) { this.liqCertificadasSignal.set(v ?? ''); this.cuponError.set(''); }

  private readonly liqCostoCertSignal = signal<string | number>('0.50');
  get liqCostoCert(): string { return String(this.liqCostoCertSignal() ?? ''); }
  set liqCostoCert(v: string | number) { this.tarifasEditadas = true; this.liqCostoCertSignal.set(v ?? ''); this.cuponError.set(''); }

  private readonly liqSoporteSignal = signal<string | number>('0');
  get liqSoporte(): string { return String(this.liqSoporteSignal() ?? ''); }
  set liqSoporte(v: string | number) { this.liqSoporteSignal.set(v ?? ''); this.cuponError.set(''); }

  private resetFormularioRespuesta(): void {
    const tarifas = this.tarifasConfig();
    this.tarifasEditadas = false;
    this.descripcionAceptacion = '';
    this.descripcionAceptacionParcial = '';
    this.descripcionDenegacion = '';
    this.causalDenegatoria = '';
    this.fundamentoLegal = '';
    this.encauzar = false;
    this.entidadDestino = '';
    this.motivoEncauzamiento = '';
    this.parteEncauzada = '';
    this.cuponEnviado = false;
    this.cuponLugar = '';
    this.liqFolios = '';
    this.liqCostoFolioSignal.set(tarifas.copiaSimple.toFixed(2));
    this.liqCertificadas = '';
    this.liqCostoCertSignal.set(tarifas.copiaCertificada.toFixed(2));
    this.liqSoporte = '0';
    this.sinCobroReproduccion.set(false);
    this.cuponError.set('');
    this.adjuntarAdicionalesEnCierre.set(false);
    this.precisionPuntos.set(['']);
  }

  documentosEntrega = signal<File[]>([]);
  documentosEntregaParcial = signal<File[]>([]);
  evidenciaDenegatoria = signal<File[]>([]);
  readonly documentAccept = DOCUMENTO_ACCEPT;
  readonly causalesOficiales = CAUSALES_DENEGATORIA;
  readonly causalesOptions: ReferenceComboboxOption[] = CAUSALES_DENEGATORIA.map(c => ({
    id: c.value,
    label: c.label
  }));

  previewTarget = signal<DocumentPreviewTarget | null>(null);

  readonly formatosSolicitados = computed(() => formatosEntregaSolicitados(this.solicitud()));

  readonly pideCopiaSimple = computed(() => this.solicitud()?.copiaSimple === true);
  readonly pideCopiaCertificada = computed(() => this.solicitud()?.copiaCertificada === true);
  readonly pideSoporte = computed(() => pideSoporteMagnetico(this.solicitud()));
  readonly requiereFisico = computed(() => requiereCuponReproduccion(this.solicitud()));
  readonly conceptosCupon = computed(() => {
    const conceptos: string[] = [];
    if (this.pideCopiaSimple()) conceptos.push('copia simple');
    if (this.pideCopiaCertificada()) conceptos.push('copia certificada');
    if (this.pideSoporte()) conceptos.push('soporte CD/USB');
    return conceptos;
  });

  descripcionVisible(): string {
    return descripcionSinNotasInternas(this.solicitud()?.descripcion) || 'Descripción no registrada';
  }

  readonly yaPreciso = computed(() => {
    const sol = this.solicitud();
    return sol?.observaciones?.some(o => o.estado === 'SUBSANADA') ?? false;
  });

  readonly diasTranscurridos = computed(() => {
    const inicio = fechaIso(this.solicitud()?.fechaPresentacion);
    return inicio ? habilesEntre(inicio, hoyIso()) : 0;
  });

  readonly fechaLimiteProrroga = computed(() => this.previsionVigente()?.fechaMaximaComunicacion || '');
  readonly prorrogaPermitida = computed(() => this.previsionVigente()?.disponible === true && !this.ampliacionRegistrada());
  readonly nuevaFechaLimite = computed(() => this.previsionVigente()?.fechaLimiteAmpliada ?? null);
  readonly cronogramaRequerido = computed(() => this.previsionVigente()?.requiereCronograma ?? false);

  readonly nuevaFechaLimiteDMY = computed<string>(() => {
    const iso = this.nuevaFechaLimite();
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  });

  readonly hitosValidos = computed(() => {
    return this.hitos().filter(h => h.fecha && h.entregable.trim().length > 0);
  });

  readonly erroresFechaHitos = computed(() => {
    const hoy = this.previsionVigente()?.hoy;
    const limite = this.nuevaFechaLimite();
    const hitos = this.hitos();
    if (hitos.some(h => h.cierre)) {
      return hitos.map((hito, index) => this.errorFechaConCierre(hito, index, hoy, limite));
    }
    return hitos.map(({ fecha }, index) => {
      if (!fecha || !hoy || !limite) return null;
      if (fecha < hoy) return 'Las fechas del cronograma no pueden ser anteriores a hoy.';
      if (fecha > limite) return `Las entregas deben programarse hasta la nueva fecha límite (${fechaDmy(limite)}).`;
      const anterior = hitos[index - 1]?.fecha;
      if (anterior && fecha <= anterior) return `Elija una fecha posterior a la entrega ${index} (${fechaDmy(anterior)}).`;
      if (anterior && diasEntre(anterior, fecha) > DIAS_CALENDARIO_ENTRE_ENTREGAS) {
        return `Hay más de 30 días entre esta entrega y la anterior (${fechaDmy(anterior)}).`;
      }
      if (index === hitos.length - 1 && fecha !== limite) {
        return `La última entrega debe coincidir con la nueva fecha límite (${fechaDmy(limite)}).`;
      }
      return null;
    });
  });

  private errorFechaConCierre(hito: HitoCronogramaItem, index: number, hoy: string | undefined, limite: string | null): string | null {
    if (hito.cierre) {
      if (!limite || !hito.fecha || hito.fecha !== limite) return limite ? `La última entrega queda el ${fechaDmy(limite)}.` : null;
      const inmediata = this.hitos()[index - 1];
      if (inmediata?.fecha && diasEntre(inmediata.fecha, limite) > DIAS_CALENDARIO_ENTRE_ENTREGAS) {
        return `La última entrega queda a más de 30 días de la anterior (${fechaDmy(inmediata.fecha)}). Acerque esa fecha o añada una entrega intermedia.`;
      }
      return null;
    }
    if (!hito.fecha || !hoy || !limite) return null;
    if (hito.fecha < hoy) return 'Esta entrega no puede ser anterior a hoy.';
    const max = this.maxFechaParcial(index);
    const min = this.minFechaParcial(index);
    if (max && hito.fecha > max) {
      const previa = this.fechaParcialVecina(index, -1);
      const ancla = previa ?? hoy;
      const topeTreinta = ancla ? desplazarDia(ancla, DIAS_CALENDARIO_ENTRE_ENTREGAS) : null;
      if (topeTreinta && hito.fecha > topeTreinta && hito.fecha < limite) {
        return previa
          ? `Cada entrega puede quedar hasta 30 días después de la anterior (${fechaDmy(previa)}). Elija hasta el ${fechaDmy(topeTreinta)}.`
          : `Esta entrega solo puede programarse dentro de los 30 días desde hoy (${fechaDmy(ancla!)}). Elija hasta el ${fechaDmy(topeTreinta)}.`;
      }
      const posterior = this.fechaParcialVecina(index, 1);
      if (posterior && hito.fecha >= posterior && hito.fecha < limite) {
        return `Elija una fecha anterior a la siguiente entrega (${fechaDmy(posterior)}).`;
      }
      return `Esta fecha llega al vencimiento o lo pasa. Elija hasta el ${fechaDmy(max)}; la última entrega ya queda el ${fechaDmy(limite)}.`;
    }
    if (min && hito.fecha < min) {
      const previa = this.fechaParcialVecina(index, -1);
      const desdeVencimiento = desplazarDia(limite, -DIAS_CALENDARIO_ENTRE_ENTREGAS);
      if (this.esUltimaParcial(index) && hito.fecha < desdeVencimiento && (!previa || hito.fecha > previa)) {
        return `Esta entrega queda a más de 30 días del vencimiento (${fechaDmy(limite)}). Elija desde el ${fechaDmy(desdeVencimiento)} o añada una entrega intermedia.`;
      }
      return previa ? `Elija una fecha posterior al ${fechaDmy(previa)}.` : `Elija una fecha desde el ${fechaDmy(min)}.`;
    }
    return null;
  }

  readonly errorEstructuraCronograma = computed<string | null>(() => {
    if (!this.cronogramaRequerido() && !this.usarCronograma()) return null;

    const todos = this.hitos();
    const cierre = todos.find(h => h.cierre);
    if (cierre) {
      const parciales = todos.filter(h => !h.cierre);
      if (this.cronogramaRequerido() && parciales.length < 1) return 'Registre al menos una entrega parcial antes del vencimiento.';
      if (!cierre.fecha || cierre.entregable.trim().length === 0 || parciales.some(h => !h.fecha || h.entregable.trim().length === 0)) {
        return 'Complete la fecha y el entregable de cada entrega. La última queda en el vencimiento.';
      }
      return null;
    }

    const validos = this.hitosValidos();
    if (validos.length === 0) return 'Registre al menos una entrega con fecha y descripción.';

    if (todos.some(h => !h.fecha || h.entregable.trim().length === 0)) {
      return 'Complete la fecha y entregable de cada hito agregado o elimine los hitos vacíos.';
    }

    if (this.cronogramaRequerido() && validos.length < 2) return 'Registre al menos dos entregas.';
    return null;
  });

  readonly errorHitos = computed(() => this.cronogramaRequerido() || this.usarCronograma()
    ? this.errorEstructuraCronograma() || this.erroresFechaHitos().find(error => error !== null) || null
    : null);

  readonly dentroPlazoEncauzamiento = computed(() => {
    const inicio = fechaIso(this.solicitud()?.fechaPresentacion);
    if (!inicio) return true;
    return hoyIso() <= sumarHabiles(inicio, DIAS_HABILES_ENCAUZAMIENTO);
  });

  readonly liquidacionActiva = computed<LiquidacionCostoSolicitud | null>(() => {
    const sol = this.solicitud();
    const list = (sol?.liquidacionesCosto ?? []).filter(item => item?.id > 0 && item.solicitudId === sol?.id);
    return list.find(item =>
      item.estadoLiquidacion === 'EMITIDA'
      || item.estadoLiquidacion === 'NOTIFICADA'
      || item.estadoLiquidacion === 'PAGADA'
      || item.estadoLiquidacion === 'RECOGIDA'
    ) ?? null;
  });

  readonly liqFoliosNum = computed(() => Math.max(0, Math.floor(Number(this.liqFoliosSignal()) || 0)));
  readonly liqCostoFolioNum = computed(() => Math.max(0, Number(String(this.liqCostoFolioSignal()).replace(',', '.')) || 0));
  readonly liqCertificadasNum = computed(() => Math.max(0, Math.floor(Number(this.liqCertificadasSignal()) || 0)));
  readonly liqCostoCertNum = computed(() => Math.max(0, Number(String(this.liqCostoCertSignal()).replace(',', '.')) || 0));
  readonly liqSoporteNum = computed(() => Math.max(0, Number(String(this.liqSoporteSignal()).replace(',', '.')) || 0));

  readonly liqFoliosSubtotal = computed(() => Math.round(this.liqFoliosNum() * this.liqCostoFolioNum() * 100) / 100);
  readonly liqCertificadasSubtotal = computed(() => Math.round(this.liqCertificadasNum() * this.liqCostoCertNum() * 100) / 100);

  readonly liqTotal = computed(() => {
    if (this.sinCobroReproduccion()) return 0;
    const simple = this.pideCopiaSimple() ? this.liqFoliosSubtotal() : 0;
    const certificada = this.pideCopiaCertificada() ? this.liqCertificadasSubtotal() : 0;
    const soporte = this.pideSoporte() ? this.liqSoporteNum() : 0;
    return Math.round((simple + certificada + soporte) * 100) / 100;
  });

  readonly cuponMonto = computed(() => {
    const total = this.liqTotal();
    return total > 0 ? `S/ ${total.toFixed(2)}` : '';
  });

  readonly desgloseLiquidacion = computed<string[]>(() => {
    const partes: string[] = [];
    if (this.pideCopiaSimple() && this.liqFoliosNum() > 0 && this.liqFoliosSubtotal() > 0) {
      partes.push(`${this.liqFoliosNum()} folios simples (S/ ${this.liqFoliosSubtotal().toFixed(2)})`);
    }
    if (this.pideCopiaCertificada() && this.liqCertificadasNum() > 0 && this.liqCertificadasSubtotal() > 0) {
      partes.push(`${this.liqCertificadasNum()} copias certificadas (S/ ${this.liqCertificadasSubtotal().toFixed(2)})`);
    }
    if (this.pideSoporte() && this.liqSoporteNum() > 0) {
      partes.push(`Soporte CD/USB (S/ ${this.liqSoporteNum().toFixed(2)})`);
    }
    return partes;
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
    return this.cronogramaRequerido() || this.usarCronograma() ? 'programada' : 'registrada';
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
    this.cargarTarifasCalendario();
  }

  private cargarTarifasCalendario(): void {
    if (!this.http) return;
    this.consultaTarifas?.unsubscribe();
    this.consultaTarifas = this.http
      .get<{ tarifas?: Partial<Tarifas> }>(`${environment.apiUrl}/calendario`)
      .pipe(catchError(() => of(null)))
      .subscribe(cfg => {
        if (this.destruido || !cfg?.tarifas) return;
        const tarifas: Tarifas = {
          copiaSimple: Number(cfg.tarifas.copiaSimple ?? 0.10),
          copiaCertificada: Number(cfg.tarifas.copiaCertificada ?? 0.50),
          soporteDigital: Number(cfg.tarifas.soporteDigital ?? 1.00)
        };
        this.tarifasConfig.set(tarifas);
        if (!this.tarifasEditadas) {
          this.liqCostoFolioSignal.set(tarifas.copiaSimple.toFixed(2));
          this.liqCostoCertSignal.set(tarifas.copiaCertificada.toFixed(2));
        }
      });
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
    this.documentosEntrega.set([]); this.documentosEntregaParcial.set([]); this.evidenciaDenegatoria.set([]);
    this.resetFormularioRespuesta();
    this.limpiarAmpliacion();
    this.loadingSolicitud.set(true); this.error.set('');
    this.consultaSolicitud = this.solicitudService.findByExpediente(expediente).subscribe({
      next: data => {
        if (this.destruido || generacion !== this.generacionRespuesta || sesion !== this.claveSesion()) return;
        this.solicitud.set(data); this.loadingSolicitud.set(false);
        this.inicializarCronogramaSolicitud(data);
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

  private inicializarCronogramaSolicitud(data: Solicitud | null): void {
    const ampliacion = data?.ampliacionesPlazo?.find(a => a.solicitudId === data.id && a.estadoAmpliacion !== 'CANCELADA');
    const cronograma = ampliacion?.cronograma ?? [];
    if (!cronograma.length) return;
    const hoy = hoyLima();
    const min = ampliacion?.fechaNotificacionAmpliacion;
    const fechaDefecto = min && min > hoy ? min : hoy;
    const fechasIniciales: Record<number, string> = {};
    let hayPendientes = false;
    for (const hito of cronograma) {
      if (hito.estado !== 'ENTREGADA' && hito.estado !== 'CANCELADA') {
        fechasIniciales[hito.id] = fechaDefecto;
        hayPendientes = true;
      }
    }
    this.fechaEntrega.set(fechasIniciales);
    if (hayPendientes && this.puedeRegistrarRespuestaManual()) {
      this.via.set('cronograma');
    }
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
    if (this.loading() || (v === 'prorroga' && this.ampliacionRegistrada())) return;
    if (v === 'cronograma' && !this.tieneCronogramaActivo()) return;
    this.via.set(v);
    this.error.set('');
    this.cuponError.set('');
  }

  aplicarArea(actualizada: Solicitud): void {
    this.solicitud.set(actualizada);
  }

  seleccionarDecision(value: DecisionId): void {
    const actual = this.decision();
    if (actual && actual !== value) {
      this.borradorPorDecision.set(actual, {
        causal: this.causalDenegatoria,
        fundamento: this.fundamentoLegal,
        encauzar: this.encauzar,
        entidad: this.entidadDestino,
        motivo: this.motivoEncauzamiento,
        parte: this.parteEncauzada
      });
      const siguiente = this.borradorPorDecision.get(value);
      this.causalDenegatoria = siguiente?.causal ?? '';
      this.fundamentoLegal = siguiente?.fundamento ?? '';
      this.encauzar = siguiente?.encauzar ?? false;
      this.entidadDestino = siguiente?.entidad ?? '';
      this.motivoEncauzamiento = siguiente?.motivo ?? '';
      this.parteEncauzada = siguiente?.parte ?? '';
    }
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

  readonly cuponRequiereEmision = computed(() => {
    const d = this.decision();
    return this.requiereFisico()
      && (d === 'entrega_total' || d === 'entrega_parcial')
      && !this.liquidacionActiva()
      && !this.sinCobroReproduccion();
  });

  readonly cuponValido = computed(() => {
    if (!this.requiereFisico()) return true;
    const d = this.decision();
    if (d !== 'entrega_total' && d !== 'entrega_parcial') return true;
    if (this.liquidacionActiva() || this.sinCobroReproduccion()) return true;
    return this.cuponEnviado && this.liqTotal() > 0 && this.cuponLugar.trim().length > 0;
  });

  readonly faltantesRespuesta = computed<string[]>(() => {
    if (this.via() !== 'responder') return [];
    const curDecision = this.decision();
    if (!curDecision) return [];
    const faltantes: string[] = [];

    if (curDecision === 'entrega_total' && !this.descripcionAceptacion.trim()) {
      faltantes.push('Complete la descripción de la aceptación.');
    }
    if (curDecision === 'entrega_parcial') {
      if (!this.descripcionAceptacionParcial.trim()) faltantes.push('Complete la descripción de lo que se entrega parcialmente.');
      if (!this.causalDenegatoria) faltantes.push('Seleccione la causal legal del extremo reservado o denegado.');
    }
    if (curDecision === 'denegacion_total') {
      if (!this.causalDenegatoria) faltantes.push('Seleccione la causal legal de denegatoria.');
      if (!this.descripcionDenegacion.trim()) faltantes.push('Complete la descripción / sustento de la denegatoria.');
      if (!this.fundamentoLegal.trim()) faltantes.push('Ingrese el fundamento legal que respalda la denegación.');
    }

    if (this.encauzamientoElegido()) {
      if (!this.entidadDestinoId()) faltantes.push('Seleccione la entidad destino para el encauzamiento.');
      if (this.motivoEncauzamiento.trim().length < 10) faltantes.push('Indique el motivo del encauzamiento (mínimo 10 caracteres).');
      if (curDecision === 'entrega_parcial' && this.parteEncauzada.trim().length < 10) {
        faltantes.push('Indique el extremo que se deriva a la otra entidad (mínimo 10 caracteres).');
      }
    }

    if (this.cuponRequiereEmision()) {
      if (this.liqTotal() <= 0) {
        faltantes.push('Ingrese cantidades/costos de reproducción (o marque entrega sin cobro de reproducción).');
      }
      if (!this.cuponLugar.trim()) {
        faltantes.push('Indique el lugar de pago del cupón.');
      }
      if (!this.cuponEnviado) {
        faltantes.push('Confirme la emisión y envío del cupón de pago al administrado.');
      }
    }

    return faltantes;
  });

  readonly avisosEnvio = computed(() => {
    if (this.via() !== 'responder' || !this.decision()) return [];
    const avisos = [...this.faltantesRespuesta()];
    if (this.respuestaPendienteVerificacion()) {
      avisos.push('Hay un envío anterior sin confirmar. Espere esa verificación antes de enviar otra respuesta.');
    }
    const motivo = this.motivoRespuestaNoDisponible();
    if (motivo) avisos.push(motivo);
    return avisos;
  });

  canSubmit(): boolean {
    if (this.loading() || this.respuestaPendienteVerificacion()) return false;
    if (this.via() === 'cronograma') return false;
    if (this.via() === 'responder' && (this.motivoRespuestaNoDisponible() || !this.puedeRegistrarRespuestaManual())) return false;
    if (this.via() === 'precision') {
      const detalle = this.precisionTexto();
      return detalle.length >= 10 && detalle.length <= 3000;
    }

    if (this.via() === 'prorroga') {
      return !this.ampliacionIncierta() && this.prorrogaPermitida() && !!this.nuevaFechaLimite()
        && !!this.previsionVigente()?.hoy
        && this.prorrogaMotivo.trim().length >= 10 && !this.errorHitos();
    }

    // via === 'responder'
    const curDecision = this.decision();
    if (!curDecision) return false;

    const encauzamientoValido = !this.encauzamientoElegido() || (
      !!this.entidadDestinoId() &&
      this.motivoEncauzamiento.trim().length >= 10 &&
      (curDecision !== 'entrega_parcial' || this.parteEncauzada.trim().length >= 10)
    );

    const cuponValido = this.cuponValido();

    if (curDecision === 'entrega_total') {
      return this.descripcionAceptacion.trim().length > 0 &&
        encauzamientoValido &&
        cuponValido;
    }

    if (curDecision === 'entrega_parcial') {
      return this.descripcionAceptacionParcial.trim().length > 0 &&
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
    if (!sol || !sesion || this.loading()) return;

    if (this.via() === 'precision') {
      this.loading.set(true);
      this.solicitudService.observar(sol.id, {
        motivoObservacion: this.precisionTexto(),
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
      if (!this.canSubmit()) return;
      const dias = this.prorrogaDiasNum();
      const generacion = this.generacionRespuesta;
      const claveSesion = this.claveSesion();
      this.loading.set(true);
      const vencimiento = this.nuevaFechaLimite();
      const hitosAEnviar = this.prorrogaTipo() === 'programada'
        ? this.hitosValidos().map((h, i) => ({
            numeroEntrega: i + 1,
            descripcion: h.entregable.trim(),
            fechaProgramada: h.cierre && vencimiento ? vencimiento : h.fecha,
            observacion: this.prorrogaCronograma.trim() || undefined
          }))
        : [];

      this.actuacionAmpliacion = this.solicitudService.registrarAmpliacion(sol.id, {
        motivoAmpliacion: this.prorrogaMotivo.trim(),
        informeAmpliacion: this.prorrogaCronograma.trim() || this.prorrogaMotivo.trim(),
        fechaNotificacionAmpliacion: this.previsionVigente()?.hoy ?? '',
        diasHabilesAdicionales: dias,
        responsable: sesion.nombre || 'Funcionario responsable',
        cronograma: hitosAEnviar
      }).subscribe({
        next: ampliacion => {
          if (!this.contextoAmpliacionVigente(generacion, claveSesion)) return;
          this.loading.set(false);
          this.confirmModalAbierto.set(false);
          if (!ampliacion?.id || ampliacion.solicitudId !== sol.id || !fechaIso(ampliacion.fechaLimiteAmpliada)
              || !Array.isArray(ampliacion.cronograma)) {
            this.ampliacionIncierta.set(true);
            this.error.set('Consulte el expediente para comprobar si la ampliación quedó registrada.');
            return;
          }
          this.reciboAmpliacion.set(ampliacion);
          this.successModalAbierto.set(true);
        },
        error: err => {
          if (!this.contextoAmpliacionVigente(generacion, claveSesion)) return;
          this.handleError(err);
          if (!err?.status || err.status >= 500 || err.status === 409) {
            this.ampliacionIncierta.set(true);
            this.confirmModalAbierto.set(false);
            this.error.set('Consulte el expediente antes de intentar registrar la ampliación otra vez.');
          }
        }
      });
      return;
    }

    // Decisión de fondo
    this.enviarRespuesta();
  }

  actualizarFechaEntrega(hitoId: number, fecha: string): void {
    this.fechaEntrega.update(fechas => ({ ...fechas, [hitoId]: fecha }));
    if (this.cronogramaHitoError()?.hitoId === hitoId) {
      this.cronogramaHitoError.set(null);
    }
  }

  actualizarArchivosHito(hitoId: number, archivos: File[]): void {
    this.archivosPorHito.update(prev => ({ ...prev, [hitoId]: archivos }));
    if (this.cronogramaHitoError()?.hitoId === hitoId) {
      this.cronogramaHitoError.set(null);
    }
  }

  registrarEntregaDesdePanel(event: RegistroEntregaHitoEvent): void {
    const ampliacion = this.ampliacionRegistrada();
    if (!ampliacion) return;
    this.actualizarFechaEntrega(event.hito.id, event.fecha);
    this.registrarHito(ampliacion, event.hito, event.archivos, event.decision, event.fundamentoDecision);
  }

  registrarHito(ampliacion: AmpliacionPlazoSolicitud, hito: CronogramaEntregaParcial, archivosExplicitos?: File[],
    decision?: DecisionEntregaProgramada, fundamentoDecision = ''): void {
    const sol = this.solicitud();
    const hoy = hoyLima();
    const min = ampliacion.fechaNotificacionAmpliacion;
    const fecha = hito.fechaEntregaReal || this.fechaEntrega()[hito.id] || (min && min > hoy ? min : hoy);
    const archivos = archivosExplicitos ?? this.archivosPorHito()[hito.id] ?? [];

    if (!sol || this.loading() || this.hitoRegistrandoId() !== null || this.ampliacionIncierta()
        || ampliacion.id !== this.ampliacionRegistrada()?.id
        || hito.ampliacionId !== ampliacion.id || (hito.estado === 'ENTREGADA' && !!hito.documentos?.length)
        || hito.estado === 'CANCELADA') return;

    if (!fecha) {
      this.cronogramaHitoError.set({ hitoId: hito.id, mensaje: 'Indique la fecha real de entrega.' });
      return;
    }
    if (!archivos.length) {
      this.cronogramaHitoError.set({
        hitoId: hito.id,
        mensaje: 'Adjunta al menos un documento de sustento (PDF, JPG, PNG o TXT) para registrar esta entrega.'
      });
      return;
    }

    if (!decision || (decision !== 'ENTREGA_TOTAL' && !fundamentoDecision.trim())) return;

    const generacion = this.generacionRespuesta;
    const sesion = this.claveSesion();
    this.hitoRegistrandoId.set(hito.id);
    this.cronogramaHitoError.set(null);
    this.hitoExitoId.set(null);
    this.error.set('');

    this.actuacionAmpliacion = this.solicitudService.registrarDocumentosEntregaParcial(
      sol.id, ampliacion.id, hito.id, fecha, archivos, decision, fundamentoDecision
    ).subscribe({
      next: guardado => {
        if (!this.contextoAmpliacionVigente(generacion, sesion)) return;
        this.hitoRegistrandoId.set(null);
        if (guardado?.id !== hito.id || guardado.ampliacionId !== ampliacion.id || guardado.estado !== 'ENTREGADA'
            || guardado.decision !== decision || guardado.documentos?.length !== archivos.length) {
          this.ampliacionIncierta.set(true);
          this.cronogramaHitoError.set({
            hitoId: hito.id,
            mensaje: 'No se pudo confirmar la respuesta del servidor. Consulte el expediente antes de reintentar.'
          });
          return;
        }
        this.aplicarHitoGuardadoEnEstado(sol.id, ampliacion.id, guardado);
        this.archivosPorHito.update(prev => {
          const { [hito.id]: _, ...rest } = prev;
          return rest;
        });
        this.hitoExitoId.set(hito.id);
        this.refrescarSolicitudSilencioso(sol.expediente, generacion, sesion);
      },
      error: err => {
        if (!this.contextoAmpliacionVigente(generacion, sesion)) return;
        this.hitoRegistrandoId.set(null);
        const mensaje = problemDetailsMessage(err, 'No se pudo registrar la entrega parcial con sus documentos.');
        this.cronogramaHitoError.set({ hitoId: hito.id, mensaje });
        if (!err?.status || err.status >= 500 || err.status === 409) {
          this.ampliacionIncierta.set(true);
        }
      }
    });
  }

  private aplicarHitoGuardadoEnEstado(solicitudId: number, ampliacionId: number, guardado: CronogramaEntregaParcial): void {
    const actualizarCrono = (amp: AmpliacionPlazoSolicitud): AmpliacionPlazoSolicitud => {
      if (amp.id !== ampliacionId) return amp;
      const crono = (amp.cronograma ?? []).map(item => (item.id === guardado.id ? guardado : item));
      const pendientes = crono.some(item => item.estado !== 'ENTREGADA' && item.estado !== 'CANCELADA');
      return {
        ...amp,
        estadoAmpliacion: pendientes ? amp.estadoAmpliacion : 'COMPLETADA',
        cronograma: crono
      };
    };

    const recibo = this.reciboAmpliacion();
    if (recibo && recibo.id === ampliacionId && recibo.solicitudId === solicitudId) {
      this.reciboAmpliacion.set(actualizarCrono(recibo));
    }
    this.solicitud.update(actual => {
      if (!actual || actual.id !== solicitudId) return actual;
      return {
        ...actual,
        ampliacionesPlazo: (actual.ampliacionesPlazo ?? []).map(actualizarCrono)
      };
    });
  }

  private refrescarSolicitudSilencioso(expediente: string, generacion: number, sesion: string): void {
    this.solicitudService.findByExpediente(expediente).subscribe({
      next: actualizada => {
        if (!this.contextoAmpliacionVigente(generacion, sesion) || !actualizada) return;
        this.solicitud.set(actualizada);
      },
      error: () => { /* Se conserva la actualización ya devuelta por POST cronograma */ }
    });
  }

  revisarAmpliacion(): void {
    if (this.expedienteActual && !this.loading()) this.cargarSolicitud(this.expedienteActual);
  }

  abrirPlanAmpliacion(): void {
    this.successModalAbierto.set(false);
    this.via.set(this.tieneCronogramaActivo() ? 'cronograma' : 'responder');
    this.revisarAmpliacion();
  }

  encauzamientoElegido(): boolean {
    const decision = this.decision();
    const porCompetencia = decision === 'entrega_parcial'
      || (decision === 'denegacion_total' && this.causalDenegatoria === 'no_posee');
    return this.encauzar && this.dentroPlazoEncauzamiento() && porCompetencia;
  }

  private entidadDestinoId(): number | null {
    const nombre = this.entidadDestino.trim();
    if (!nombre) return null;
    const entidad = this.entidades().find(item => item.nombre === nombre && typeof item.id === 'number');
    return entidad?.id ?? null;
  }

  private async registrarEncauzamientoDeLaRespuesta(solicitudId: number, responsable: string, decision: DecisionId): Promise<boolean> {
    const entidadDestinoId = this.entidadDestinoId();
    if (!entidadDestinoId || this.motivoEncauzamiento.trim().length < 10) {
      this.error.set('Seleccione la entidad destino e indique el motivo del encauzamiento (mínimo 10 caracteres).');
      return false;
    }
    if (decision === 'entrega_parcial' && this.parteEncauzada.trim().length < 10) {
      this.error.set('Indique el extremo que se deriva a la otra entidad (mínimo 10 caracteres).');
      return false;
    }
    const sustento = decision === 'denegacion_total'
      ? [this.descripcionDenegacion.trim(), this.fundamentoLegal.trim()].filter(Boolean).join('\n\n')
      : this.parteEncauzada.trim();
    try {
      await firstValueFrom(this.solicitudService.registrarEncauzamiento(solicitudId, {
        entidadDestinoId,
        motivoEncauzamiento: this.motivoEncauzamiento.trim(),
        alcance: decision === 'denegacion_total' ? 'TOTAL' : 'PARCIAL',
        responsable,
        observacionSustento: sustento || undefined
      }));
      return true;
    } catch (err: unknown) {
      const msg = problemDetailsMessage(err, 'No se pudo registrar el encauzamiento.');
      if (/encauzamiento activo/i.test(msg)) return true;
      this.error.set(msg);
      return false;
    }
  }

  motivoRespuestaNoDisponible(): string {
    const sol = this.solicitud();
    if (sol?.observaciones?.some(o => o.estado === 'PENDIENTE_SUBSANACION')) return 'Existe una observación pendiente. Recupere la recepción de precisión y el estado vigente antes de responder.';
    if (sol && !this.puedeRegistrarRespuestaManual()) return 'El estado actual del expediente no permite registrar otra respuesta. Consulte la respuesta y sus documentos desde el detalle.';
    return '';
  }

  private construirConceptoLiquidacion(): string {
    const partes = this.desgloseLiquidacion();
    const resumen = partes.length ? partes.join(', ') : 'Costo de reproducción física';
    return `Cupón de reproducción — ${resumen}`.slice(0, 240);
  }

  async enviarRespuesta(): Promise<void> {
    const sesion = this.authService.obtenerSesion(); const sol = this.solicitud(); const decision = this.decision();
    if (!sesion?.funcionarioId || !sol || !decision || this.loading() || this.respuestaPendienteVerificacion()) return;
    const motivo = this.motivoRespuestaNoDisponible();
    if (motivo || !this.puedeRegistrarRespuestaManual()) {
      this.error.set(motivo || 'El estado del expediente no permite registrar una respuesta. Recupere su estado actual.'); return;
    }
    this.derivacionTotalRegistrada.set(false);
    if (this.encauzamientoElegido()) {
      this.loading.set(true);
      this.error.set('');
      const derivado = await this.registrarEncauzamientoDeLaRespuesta(
        sol.id, sesion.nombre || 'Funcionario de entidad', decision);
      if (!derivado || this.destruido || this.solicitud()?.id !== sol.id) {
        this.loading.set(false);
        this.confirmModalAbierto.set(false);
        return;
      }
      if (decision === 'denegacion_total') {
        this.derivacionTotalRegistrada.set(true);
        this.loading.set(false);
        this.confirmModalAbierto.set(false);
        this.successModalAbierto.set(true);
        return;
      }
      this.loading.set(false);
    }
    const generacion = this.generacionRespuesta; const sesionClave = this.claveSesion();

    if (this.cuponRequiereEmision()) {
      if (!this.cuponValido()) {
        this.cuponError.set('Complete el monto, lugar de pago y confirme el envío del cupón de pago.');
        return;
      }
      this.loading.set(true);
      this.error.set('');
      this.cuponError.set('');
      try {
        const liquidacion = await firstValueFrom(this.solicitudService.emitirLiquidacion(sol.id, {
          monto: Number(this.liqTotal().toFixed(2)),
          moneda: 'PEN',
          concepto: this.construirConceptoLiquidacion(),
          fechaNotificacion: hoyLima(),
          medioNotificacion: sol.canalNotificacion || 'CORREO_ELECTRONICO',
          responsable: sesion.nombre || 'Funcionario de entidad',
          observacion: `Lugar de pago: ${this.cuponLugar.trim()}`
        }));
        if (this.destruido || this.generacionRespuesta !== generacion || this.claveSesion() !== sesionClave
            || this.solicitud()?.id !== sol.id) {
          this.loading.set(false);
          return;
        }
        this.solicitud.update(actual => actual && actual.id === sol.id
          ? { ...actual, liquidacionesCosto: [...(actual.liquidacionesCosto ?? []), liquidacion] }
          : actual);
      } catch (err: unknown) {
        if (this.destruido || this.generacionRespuesta !== generacion || this.claveSesion() !== sesionClave
            || this.solicitud()?.id !== sol.id) return;
        const msg = problemDetailsMessage(err, 'No se pudo emitir el cupón de pago en el servidor.');
        this.cuponError.set(msg);
        this.error.set(msg);
        this.loading.set(false);
        this.confirmModalAbierto.set(false);
        return;
      }
    }

    const datos: CrearRespuestaRequest = {
      solicitudId: sol.id, funcionarioId: sesion.funcionarioId,
      tipoRespuesta: decision === 'entrega_total' ? 'ENTREGA_TOTAL' : decision === 'entrega_parcial' ? 'ENTREGA_PARCIAL' : 'DENEGACION_TOTAL',
      contenido: (decision === 'denegacion_total' ? this.descripcionDenegacion : decision === 'entrega_parcial' ? this.descripcionAceptacionParcial : this.descripcionAceptacion).trim(),
      causalDenegatoria: decision !== 'entrega_total' ? this.causalDenegatoria || undefined : undefined,
      fundamentoLegal: decision !== 'entrega_total' ? this.fundamentoLegal.trim() || undefined : undefined
    };
    const archivos = [...(decision === 'denegacion_total' ? this.evidenciaDenegatoria()
      : decision === 'entrega_parcial' ? this.documentosEntregaParcial() : this.documentosEntrega())];
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
    if (this.encauzamientoElegido() && this.decision() === 'denegacion_total') return 'Confirme el encauzamiento';
    return 'Confirme la respuesta';
  }

  respuestaConfirmDescription(): string {
    if (this.via() === 'precision') {
      return 'El administrado será notificado por correo y plataforma, y tendrá 2 días hábiles para subsanar. Si no responde, el expediente se archivará automáticamente.';
    }
    if (this.via() === 'prorroga') {
      return 'Revise el nuevo vencimiento y las entregas antes de registrar la ampliación en el expediente.';
    }
    if (this.encauzamientoElegido() && this.decision() === 'denegacion_total') {
      return 'La solicitud se derivará a la entidad indicada. En esta entidad no se registra una denegatoria: el expediente continúa en la entidad competente.';
    }
    if (this.encauzamientoElegido() && this.decision() === 'entrega_parcial') {
      return 'Se registrará la entrega parcial de lo que corresponde a esta entidad y el encauzamiento del extremo indicado.';
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
        { label: 'Puntos', value: String(this.precisionPuntos().map(punto => punto.trim()).filter(Boolean).length) },
        { label: 'Plazo subsanación', value: '2 días hábiles' }
      ];
    }

    if (this.via() === 'prorroga') {
      return [
        { label: 'Expediente', value: exp, mono: true },
        { label: 'Administrado', value: ciu },
        { label: 'Tipo', value: this.prorrogaTipo() === 'programada' ? 'Ampliación programada' : 'Ampliación registrada' },
        { label: 'Nueva fecha límite', value: this.nuevaFechaLimiteDMY() },
        ...(this.prorrogaTipo() === 'programada'
          ? this.hitosValidos().map((hito, index) => ({ label: `Entrega ${index + 1} · ${fechaDmy(hito.fecha)}`, value: hito.entregable.trim() }))
          : [{ label: 'Entregas programadas', value: 'Sin cronograma' }])
      ];
    }

    const decision = this.decision();
    const files = decision === 'denegacion_total' ? this.evidenciaDenegatoria()
      : decision === 'entrega_parcial' ? this.documentosEntregaParcial() : this.documentosEntrega();
    const count = files.length;
    const cronogramaDocsCount = decision === 'denegacion_total' ? 0 : this.cronogramaDocumentosEntregados().length;
    const countText = count > 0
      ? (cronogramaDocsCount > 0
        ? `${count} adicional${count === 1 ? '' : 'es'} + ${cronogramaDocsCount} en cronograma`
        : `${count} ${count === 1 ? 'adjunto' : 'adjuntos'}`)
      : (cronogramaDocsCount > 0
        ? `${cronogramaDocsCount} entregados en el cronograma (sin adjuntos adicionales)`
        : 'sin adjuntos');
    const causalLabel = this.causalesOficiales.find(c => c.value === this.causalDenegatoria)?.label || this.causalDenegatoria || '—';

    const summary: ReferenceConfirmSummary[] = [
      { label: 'Expediente', value: exp, mono: true },
      { label: 'Ciudadano', value: ciu },
      { label: 'Decisión', value: this.encauzamientoElegido() ? `${this.getDecisionTitle()} · Encauzamiento` : this.getDecisionTitle() },
      { label: 'Documentos', value: countText }
    ];

    if (decision === 'denegacion_total' || (decision === 'entrega_parcial' && this.causalDenegatoria)) {
      summary.splice(3, 0, { label: 'Causal', value: causalLabel });
    }

    if (this.encauzamientoElegido()) {
      summary.push({ label: 'Entidad destino', value: this.entidadDestino });
      if (decision === 'entrega_parcial' && this.parteEncauzada) {
        summary.push({ label: 'Extremo derivado', value: this.parteEncauzada });
      }
    }

    if (this.requiereFisico() && (decision === 'entrega_total' || decision === 'entrega_parcial')) {
      const activa = this.liquidacionActiva();
      if (activa) {
        summary.push({
          label: 'Cupón de pago',
          value: `${activa.codigoLiquidacion || 'Emitido'} · S/ ${Number(activa.monto).toFixed(2)} (${activa.estadoLiquidacion})`
        });
      } else if (this.sinCobroReproduccion()) {
        summary.push({ label: 'Cupón de pago', value: 'Sin cobro de reproducción física' });
      } else if (this.cuponEnviado) {
        summary.push({ label: 'Cupón de pago', value: `${this.cuponMonto()} · ${this.cuponLugar.trim()} · 30 días calendario` });
      }
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
        label: 'Comunicación al administrado',
        detail: 'Verifique la fecha que declaró y conserve la constancia de comunicación en el expediente.'
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
    if (this.derivacionTotalRegistrada()) return 'Solicitud derivada';
    if (this.documentUploadWarning()) return 'Respuesta registrada · Documento pendiente';
    if (this.via() === 'precision') return 'Precisión solicitada';
    if (this.via() === 'prorroga') return 'Plazo ampliado';
    return this.decision() === 'denegacion_total' ? 'Denegatoria registrada' : 'Respuesta entregada';
  }

  respuestaSuccessTitle(): string {
    if (this.derivacionTotalRegistrada()) return 'Solicitud derivada a la entidad competente';
    if (this.documentUploadWarning()) return 'La respuesta se guardó con una incidencia documental';
    if (this.via() === 'precision') return 'Solicitud de precisión notificada';
    if (this.via() === 'prorroga') return 'Ampliación del plazo registrada';
    return this.decision() === 'denegacion_total' ? 'Denegatoria notificada al ciudadano' : 'Respuesta enviada al ciudadano';
  }

  respuestaSuccessDescription(): string {
    if (this.derivacionTotalRegistrada()) {
      return 'La solicitud quedó en trámite en la entidad de destino. Aquí no se registró una denegatoria.';
    }
    if (this.documentUploadWarning()) return this.documentUploadWarning();
    if (this.via() === 'precision') {
      return 'Se notificó al administrado por correo y plataforma. Dispone de 2 días hábiles para subsanar; si no responde, el expediente se archivará automáticamente.';
    }
    if (this.via() === 'prorroga') {
      return 'La solicitud sigue en trámite con la nueva fecha límite. Verifique la comunicación de la ampliación al administrado.';
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
      const ampliacion = this.reciboAmpliacion();
      return [
        { label: 'Administrado', value: ciu },
        { label: 'Nueva fecha límite', value: ampliacion ? fechaDmy(ampliacion.fechaLimiteAmpliada) : 'No disponible' },
        { label: 'Entregas programadas', value: String(ampliacion?.cronograma.length ?? 0) }
      ];
    }

    const recibida = this.recepcionRespuesta();
    const respuesta = recibida?.respuesta;
    const cronogramaDocsCount = respuesta?.tipoRespuesta === 'DENEGACION_TOTAL' ? 0 : this.cronogramaDocumentosEntregados().length;
    const documentos = recibida?.documentos.map(d => d.nombreOriginal || `Documento ${d.id}`).join(', ')
      || (cronogramaDocsCount > 0
        ? `${cronogramaDocsCount} documento(s) entregados previamente en el cronograma`
        : 'Sin adjuntos seleccionados');
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
    const liq = this.liquidacionActiva();
    if (liq) {
      metadata.push({
        label: 'Liquidación / Cupón',
        value: `${liq.codigoLiquidacion || 'Registrado'} · S/ ${Number(liq.monto).toFixed(2)}`
      });
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
        { label: 'Si hay un cronograma, registre cada entrega en su fecha. Un hito incumplido habilita la apelación.' },
        { label: 'Registre la respuesta final según el resultado de la atención: total, parcial o denegatoria.' }
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

function fechaIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const barra = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto);
  if (!barra) return null;
  return `${barra[3]}-${barra[2].padStart(2, '0')}-${barra[1].padStart(2, '0')}`;
}

function hoyIso(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

function fechaDmy(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

const DIAS_CALENDARIO_ENTRE_ENTREGAS = 30;

function diasEntre(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((fin - inicio) / 86_400_000);
}

function desplazarDia(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
  const mesTexto = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const diaTexto = String(fecha.getUTCDate()).padStart(2, '0');
  return `${fecha.getUTCFullYear()}-${mesTexto}-${diaTexto}`;
}

function cronogramaConCierre(lista: HitoCronogramaItem[], limite: string, requerido: boolean): HitoCronogramaItem[] {
  const cierrePrevio = lista.find(h => h.cierre);
  let parciales = lista.filter(h => !h.cierre);
  if (!cierrePrevio && parciales.length === 1 && !parciales[0].fecha && !parciales[0].entregable) {
    parciales = [{ fecha: '', entregable: '' }];
  }
  parciales = parciales.map(h => h.fecha >= limite ? { fecha: '', entregable: h.entregable } : { fecha: h.fecha, entregable: h.entregable });
  if (requerido && parciales.length === 0) parciales = [{ fecha: '', entregable: '' }];
  const siguiente: HitoCronogramaItem[] = [
    ...parciales,
    { fecha: limite, entregable: cierrePrevio?.entregable ?? '', cierre: true }
  ];
  const igual = lista.length === siguiente.length && lista.every((h, i) =>
    h.fecha === siguiente[i].fecha && h.entregable === siguiente[i].entregable && !!h.cierre === !!siguiente[i].cierre);
  return igual ? lista : siguiente;
}
