import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, DestroyRef, computed, effect, untracked, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';
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
import { DocumentoService } from '../../services/documento.service';
import { Documento, DocumentoListItem, DOCUMENTO_MAX_BYTES, DOCUMENTO_RELATION_KEYS, validarDocumento } from '../../models/documento.model';
import { Subscription, TimeoutError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SubsanacionTtaipService, RecepcionSubsanacionTtaip, RequerimientoSubsanacionTtaip } from '../../services/subsanacion-ttaip.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { YaikuCargandoComponent } from '../../shared/yaiku-cargando.component';


interface ObservacionSubsanacion {
  numero: number;
  descripcion: string;
}

import { LucideArrowLeft, LucideSend, LucideEye, LucideClock, LucideAlertCircle, LucideInfo,
  LucideFileText, LucideUpload, LucideDownload, LucideCheckCircle2 } from '@lucide/angular';
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from '../../shared/document-preview-modal.component';

@Component({
  selector: 'app-subsanacion',
  imports: [
    CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    LucideArrowLeft, LucideSend, LucideEye, LucideClock, LucideAlertCircle, LucideInfo,
    LucideFileText, LucideUpload, LucideDownload, LucideCheckCircle2, DocumentPreviewModalComponent, YaikuCargandoComponent
  ],
  templateUrl: './subsanacion.component.html',
  styleUrl: './subsanacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubsanacionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);
  private readonly documentoService = inject(DocumentoService);
  private readonly recepcionService = inject(SubsanacionTtaipService);
  readonly requerimiento = signal<RequerimientoSubsanacionTtaip | null>(null);
  readonly loadingRequerimiento = signal(false);
  readonly recepcion = signal<RecepcionSubsanacionTtaip | null>(null);
  readonly estadoEnvio = signal<'lista' | 'rechazada' | 'incierta' | 'confirmada'>('lista');
  private readonly congelado = signal(false);
  private intento: { apelacionId: number; requerimientoId: number; clave: string; numeroArchivos: number;
    texto?: string; archivos?: File[]; cache: string; conflicto?: boolean } | null = null;
  readonly formularioBloqueado = computed(() => !this.formularioDisponible() || this.loading() || this.loadingRequerimiento()
    || this.estadoEnvio() === 'incierta' || this.congelado() || !!this.recepcion());
  readonly estadoRequerimiento = signal<EstadoConsulta>('cargando');
  readonly puedeReintentarRequerimiento = signal(false);
  readonly fundamentosError = signal('');
  readonly archivosError = signal('');

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  confirmModalAbierto = signal<boolean>(false);
  successModalAbierto = signal<boolean>(false);
  documentosSeleccionados = signal<File[]>([]);
  previewTarget = signal<DocumentPreviewTarget | null>(null);
  isPreviewOpen = signal<boolean>(false);

  fundamentosAdicionales = '';

  readonly pasosSubsanacion: string[] = [
    'Lea cada observación señalada por el TTAIP.',
    'Prepare los documentos complementarios que desee presentar.',
    'Describa claramente las correcciones realizadas.',
    'Los adjuntos son opcionales; todos los seleccionados se enviarán juntos.',
    'Revise la notificación eficaz y la fecha límite antes de presentar.'
  ];

  readonly estadoConsulta = signal<EstadoConsulta>('cargando');
  readonly puedeReintentarConsulta = signal(false);
  readonly documentoError = signal('');
  private readonly destroyRef = inject(DestroyRef);
  private consultas = new Subscription();
  private descargas = new Subscription();
  private generacion = 0;
  private expedienteActual: string | null = null;
  private tokenActual = this.authService.getToken();
  private revisionSesion = this.authService.cambiosSesion();
  private tokenDetalle: string | null = null;
  private sesionDetalle = -1;
  private destruido = false;
  private flujo = new Subscription();
  private confirmacion: { generacion: number; requerimientoId: number; texto: string; archivos: File[] } | null = null;

  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      untracked(() => {
        const token = this.authService.getToken();
        if (token !== this.tokenActual || revision !== this.revisionSesion) {
          this.tokenActual = token;
          this.revisionSesion = revision;
          if (this.expedienteActual !== null) this.cargarApelacion(this.expedienteActual);
        }
      });
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.cargarApelacion(params.get('expediente') || '');
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.generacion++;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
    this.flujo.unsubscribe();
    this.intento = null; this.confirmacion = null;
    this.documentosSeleccionados.set([]); this.fundamentosAdicionales = '';
    this.cerrarPreview();
  }

  cargarApelacion(expediente: string): void {
    if (this.destruido) return;
    this.expedienteActual = expediente;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
    this.flujo.unsubscribe();
    this.consultas = new Subscription();
    this.descargas = new Subscription();
    const generacion = ++this.generacion;
    const token = this.authService.getToken();
    const revision = this.authService.cambiosSesion();
    this.tokenDetalle = null; this.sesionDetalle = -1;
    this.apelacion.set(null);
    this.requerimiento.set(null);
    this.recepcion.set(null);
    this.intento = null;
    this.confirmacion = null;
    this.congelado.set(false);
    this.estadoEnvio.set('lista');
    this.loadingRequerimiento.set(false);
    this.cerrarPreview();
    this.documentosSeleccionados.set([]);
    this.fundamentosAdicionales = '';
    this.confirmModalAbierto.set(false);
    this.successModalAbierto.set(false);
    this.mensaje.set('');
    this.documentoError.set('');
    this.error.set('');
    this.fundamentosError.set(''); this.archivosError.set('');
    this.estadoRequerimiento.set('cargando'); this.puedeReintentarRequerimiento.set(false);
    this.loading.set(false);
    this.puedeReintentarConsulta.set(false);
    this.loadingApelacion.set(false);
    if (!expediente.trim()) {
      this.estadoConsulta.set('validacion');
      this.error.set('No se recibió el identificador del expediente para subsanar.');
      return;
    }
    if (!token) {
      if (this.authService.cerrandoSesion?.()) { this.loadingApelacion.set(true); return; }
      this.estadoConsulta.set('autenticacion');
      this.error.set('Su sesión no es válida. Inicie sesión nuevamente.');
      return;
    }
    this.loadingApelacion.set(true);
    this.estadoConsulta.set('cargando');
    this.consultas.add(this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        if (!this.esConsultaActual(generacion, token, revision)) return;
        this.loadingApelacion.set(false);
        if (!data) {
          this.estadoConsulta.set('vacio');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        if (!this.idValido(data.id) || data.expediente !== expediente ||
          (data.ciudadanoId != null && data.ciudadanoId !== this.authService.obtenerSesion()?.usuarioId)) {
          this.estadoConsulta.set('error');
          this.error.set('La apelación recibida no corresponde al expediente consultado.');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        this.apelacion.set(data);
        this.tokenDetalle = token; this.sesionDetalle = revision;
        this.estadoConsulta.set('disponible');
        this.cargarRequerimiento();
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token, revision)) return;
        const fallo = falloConsulta(error, 'la apelación');
        this.estadoConsulta.set(fallo.estado);
        this.error.set(fallo.mensaje);
        this.puedeReintentarConsulta.set(fallo.reintentable);
        this.loadingApelacion.set(false);
      }
    }));
  }

  reintentarConsulta(): void {
    if (this.expedienteActual !== null) this.cargarApelacion(this.expedienteActual);
  }

  private esConsultaActual(generacion: number, token: string | null, revision = this.sesionDetalle): boolean {
    return !this.destruido && generacion === this.generacion && token === this.authService.getToken()
      && revision === this.authService.cambiosSesion();
  }

  private idValido(id: unknown): id is number { return typeof id === 'number' && Number.isSafeInteger(id) && id > 0; }

  private detalleActual(): boolean {
    return !this.destruido && !!this.apelacion() && !!this.tokenDetalle && this.tokenDetalle === this.authService.getToken()
      && this.sesionDetalle === this.authService.cambiosSesion();
  }

  private intentoActual(): boolean {
    return this.detalleActual() && this.intento?.apelacionId === this.apelacion()?.id
      && this.intento?.requerimientoId === this.requerimiento()?.requerimientoId;
  }

  formularioDisponible(): boolean {
    const r = this.requerimiento();
    return this.detalleActual() && !this.loadingRequerimiento() && this.apelacion()?.estado === 'EN_SUBSANACION'
      && !!r && this.idValido(r.requerimientoId) && r.apelacionId === this.apelacion()?.id
      && !!r.observaciones?.trim() && (!r.plazo || r.plazo.requerimientoId === r.requerimientoId)
      && (r.admitePresentacion || this.intentoActual()) && (!this.esSubsanacionVencida() || this.intentoActual());
  }

  cargarRequerimiento(): void {
    const ap = this.apelacion();
    if (!ap || !this.detalleActual()) return;
    const generacion = ++this.generacion, token = this.authService.getToken();
    this.flujo.unsubscribe(); this.flujo = new Subscription();
    this.descargas.unsubscribe(); this.descargas = new Subscription(); this.cerrarPreview();
    this.recepcion.set(null); this.intento = null; this.confirmacion = null;
    this.fundamentosAdicionales = ''; this.documentosSeleccionados.set([]);
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false);
    this.estadoEnvio.set('lista'); this.congelado.set(false); this.loading.set(false);
    this.mensaje.set(''); this.error.set(''); this.fundamentosError.set(''); this.archivosError.set('');
    this.estadoRequerimiento.set('cargando'); this.puedeReintentarRequerimiento.set(false);
    this.loadingRequerimiento.set(true);
    this.requerimiento.set(null);
    this.flujo.add(this.recepcionService.requerimiento(ap.id).subscribe({
      next: r => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loadingRequerimiento.set(false);
        if (!r) { this.estadoRequerimiento.set('vacio'); this.puedeReintentarRequerimiento.set(true); return; }
        if (!this.idValido(r.requerimientoId) || r.apelacionId !== ap.id || typeof r.admitePresentacion !== 'boolean') {
          this.estadoRequerimiento.set('error');
          this.error.set('No se pudo identificar el requerimiento vigente. No se habilitó la presentación.');
          return;
        }
        this.requerimiento.set(r);
        this.estadoRequerimiento.set('disponible');
        const cache = this.claveCache(ap.id, r.requerimientoId);
        try {
          const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(cache) : null;
          if (raw) {
            const saved = JSON.parse(raw) as { clave?: string; numeroArchivos?: number };
            if (saved.clave && Number.isInteger(saved.numeroArchivos) && saved.numeroArchivos! >= 0) {
              this.intento = { apelacionId: ap.id, requerimientoId: r.requerimientoId,
                clave: saved.clave, numeroArchivos: saved.numeroArchivos!, cache };
              this.estadoEnvio.set('incierta');
              this.comprobarRecepcion();
            }
          }
        } catch { this.error.set('No se pudo recuperar la comprobación local. Revise la recepción desde su panel.'); }
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loadingRequerimiento.set(false);
        const fallo = falloConsulta(error, 'el requerimiento de subsanación');
        this.estadoRequerimiento.set(fallo.estado); this.puedeReintentarRequerimiento.set(fallo.reintentable);
        this.error.set(fallo.mensaje);
      }
    }));
  }

  calcularDiasRestantes(): number | null {
    const plazo = this.reloj();
    return plazo && plazo.estado !== 'PENDIENTE_INICIO' && Number.isInteger(plazo.diasHabilesRestantes)
      ? plazo.diasHabilesRestantes! : null;
  }

  plazoPendienteInicio(): boolean {
    return this.reloj()?.estado === 'PENDIENTE_INICIO';
  }

  private reloj() {
    const r = this.requerimiento(), p = r?.plazo;
    return p && p.requerimientoId === r?.requerimientoId && ['PENDIENTE_INICIO', 'EN_CURSO', 'VENCIDO'].includes(p.estado) ? p : null;
  }

  relojIncompleto(): boolean {
    const p = this.reloj();
    return !!this.requerimiento()?.plazo && (!p || !this.idValido(p.diasHabiles) ||
      (p.estado !== 'PENDIENTE_INICIO' && (!this.idValido(p.notificacionId) ||
        !this.fecha(p.fechaEficacia) || !this.fecha(p.fechaLimite) || !Number.isInteger(p.diasHabilesRestantes))));
  }

  getPlazoSubsanacionDias(): number | null {
    const dias = this.reloj()?.diasHabiles ?? this.requerimiento()?.diasSubsanacion;
    return this.idValido(dias) ? dias : null;
  }
  etiquetaPlazo(estado?: string | null): string {
    if (estado === 'EN_CURSO') return 'En curso';
    if (estado === 'VENCIDO') return 'Vencido';
    if (estado === 'PENDIENTE_INICIO') return 'Pendiente de inicio';
    return 'No informado';
  }

  getFechaNotificacion(): Date | null { return this.reloj()?.estado !== 'PENDIENTE_INICIO' && !this.relojIncompleto() ? this.fecha(this.reloj()?.fechaEficacia) : null; }
  getFechaLimite(): Date | null { return this.reloj()?.estado !== 'PENDIENTE_INICIO' && !this.relojIncompleto() ? this.fecha(this.reloj()?.fechaLimite) : null; }
  private fecha(value?: string | null): Date | null {
    if (!value) return null;
    const fecha = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  seleccionarDocumento(event: Event): void {
    if (this.formularioBloqueado()) return;
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const filesToAdd: File[] = [];
      let lastError = '';
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const errorMsg = !file.size ? 'No se admiten archivos vacíos.' : validarDocumento(file);
        if (errorMsg) {
          lastError = errorMsg;
        } else {
          filesToAdd.push(file);
        }
      }
      if (lastError) {
        this.archivosError.set(`No se añadió esta selección: ${lastError}`);
      } else {
        const total = [...this.documentosSeleccionados(), ...filesToAdd].reduce((sum, file) => sum + file.size, 0);
        if (total > DOCUMENTO_MAX_BYTES) this.archivosError.set('No se añadió esta selección: el total de adjuntos supera 10 MB.');
        else {
          this.archivosError.set(''); this.error.set('');
          this.documentosSeleccionados.update(prev => [...prev, ...filesToAdd]);
        }
      }
    }
    input.value = '';
  }

  removerDocumento(index: number): void {
    if (this.formularioBloqueado()) return;
    this.documentosSeleccionados.update(prev => prev.filter((_, i) => i !== index));
    this.error.set('');
    this.archivosError.set('');
  }

  abrirSelector(event: KeyboardEvent, input: HTMLInputElement): void {
    if (!this.formularioBloqueado() && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); input.click(); }
  }

  formatFileSize(size: number): string {
    return (size / 1024).toFixed(1);
  }

  abrirConfirmacionSubsanacion(): void {
    if (!this.validarSubsanacion()) {
      return;
    }

    if (!this.loading() && !this.recepcion()) {
      this.confirmacion = { generacion: this.generacion, requerimientoId: this.requerimiento()!.requerimientoId,
        texto: this.fundamentosAdicionales.trim(), archivos: [...this.documentosSeleccionados()] };
      this.confirmModalAbierto.set(true);
    }
  }

  confirmarDesdeDialogo(): void {
    const c = this.confirmacion;
    if (!c || !this.confirmModalAbierto() || !this.detalleActual() || c.generacion !== this.generacion ||
      c.requerimientoId !== this.requerimiento()?.requerimientoId) return;
    if (c.texto !== this.fundamentosAdicionales.trim() || !this.mismosArchivos(c.archivos, this.documentosSeleccionados())) {
      this.confirmModalAbierto.set(false); this.error.set('El contenido cambió. Revise y confirme nuevamente.'); return;
    }
    this.enviarSubsanacion();
  }

  private mismosArchivos(a: File[], b: File[]): boolean { return a.length === b.length && a.every((file, i) => file === b[i]); }

  private documentoActual(id?: number): boolean {
    return this.detalleActual() && this.idValido(id) && [...this.documentosOriginales(), ...(this.recepcion()?.documentos ?? [])].some(doc => doc.id === id);
  }

  previsualizarDocumento(doc: Documento): void {
    this.documentoError.set('');
    this.cerrarPreview();
    if (!this.documentoActual(doc.id)) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    this.previewTarget.set({ id: doc.id, nombre: doc.nombreArchivo || 'Documento sin nombre', tipo: doc.tipoArchivo });
    this.isPreviewOpen.set(true);
  }

  previsualizarArchivoLocal(file: File): void {
    if (!this.detalleActual() || !this.documentosSeleccionados().includes(file)) return;
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
  }

  descargarDocumento(doc: Documento): void {
    this.documentoError.set('');
    if (!this.documentoActual(doc.id)) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.descargas.add(this.documentoService.download(doc.id!, doc.nombreArchivo || 'documento').subscribe({
      next: ({ blob, filename }) => {
        if (!this.esConsultaActual(generacion, token)) return;
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (error: unknown) => {
        if (this.esConsultaActual(generacion, token)) this.documentoError.set(falloConsulta(error, 'el documento').mensaje);
      }
    }));
  }

  enviarSubsanacion(): void {
    if (this.loading() || this.recepcion()) return;
    if (this.intento?.conflicto && this.estadoEnvio() === 'rechazada') return;
    if (this.estadoEnvio() === 'incierta') { this.comprobarRecepcion(); return; }
    const ap = this.apelacion(), r = this.requerimiento();
    if (!ap || !r?.requerimientoId || !this.validarSubsanacion()) return;
    if (!this.intento) {
      const clave = crypto.randomUUID();
      this.intento = { apelacionId: ap.id, requerimientoId: r.requerimientoId, clave,
        numeroArchivos: this.documentosSeleccionados().length, cache: this.claveCache(ap.id, r.requerimientoId),
        texto: this.fundamentosAdicionales.trim(), archivos: [...this.documentosSeleccionados()] };
    }
    const intento = this.intento;
    if (intento.texto === undefined || intento.archivos === undefined) {
      if (this.documentosSeleccionados().length !== intento.numeroArchivos) {
        this.error.set('Vuelva a seleccionar los adjuntos originales antes de reintentar con la misma clave.'); return;
      }
      intento.texto = this.fundamentosAdicionales.trim(); intento.archivos = [...this.documentosSeleccionados()];
    }
    // Only the operation key/count are stored locally, never bytes, JWT or personal text.
    try { sessionStorage.setItem(intento.cache, JSON.stringify({ clave: intento.clave, numeroArchivos: intento.numeroArchivos })); }
    catch { this.error.set('No se pudo conservar la identificación del envío. Habilite el almacenamiento de esta pestaña antes de enviar.'); return; }
    const generacion = this.generacion, token = this.authService.getToken();
    this.loading.set(true); this.error.set(''); this.mensaje.set(''); this.congelado.set(true);
    this.flujo.add(this.recepcionService.enviar(intento.apelacionId, intento.requerimientoId,
      intento.clave, intento.texto, intento.archivos).subscribe({
      next: recibida => {
        if (!this.esConsultaActual(generacion, token) || !this.intentoActual()) return;
        this.loading.set(false);
        if (!this.confirmarRecepcion(recibida)) {
          this.estadoEnvio.set('incierta'); this.comprobarRecepcion();
        }
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token) || !this.intentoActual()) return;
        this.loading.set(false); this.confirmModalAbierto.set(false);
        if (error instanceof TimeoutError || !(error instanceof HttpErrorResponse)
            || error.status === 0 || error.status === 409 || error.status >= 500) {
          if (error instanceof HttpErrorResponse && error.status === 409) intento.conflicto = true;
          this.estadoEnvio.set('incierta'); this.comprobarRecepcion();
        } else {
          this.estadoEnvio.set('rechazada'); this.congelado.set(false);
          this.error.set(falloConsulta(error, 'la recepción de subsanación').mensaje);
          try { sessionStorage.removeItem(intento.cache); } catch { /* No server operation is repeated here. */ }
          this.intento = null;
        }
      }
    }));
  }

  comprobarRecepcion(): void {
    const intento = this.intento;
    if (!intento || this.loading() || !this.intentoActual()) return;
    const generacion = this.generacion, token = this.authService.getToken();
    this.loading.set(true); this.estadoEnvio.set('incierta'); this.error.set('');
    this.flujo.add(this.recepcionService.consultar(intento.apelacionId, intento.requerimientoId, intento.clave).subscribe({
      next: recibida => {
        if (!this.esConsultaActual(generacion, token) || !this.intentoActual()) return;
        this.loading.set(false);
        if (!this.confirmarRecepcion(recibida)) this.error.set('La respuesta no acredita esta recepción. Compruebe nuevamente antes de reenviar.');
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token) || !this.intentoActual()) return;
        this.loading.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.estadoEnvio.set(intento.conflicto ? 'rechazada' : 'lista');
          this.congelado.set(!!intento.archivos);
          this.error.set(intento.conflicto
            ? 'Esta presentación no fue aceptada por un conflicto de estado o contenido. Actualice la consulta antes de presentar nuevamente.'
            : this.formularioDisponible() && this.requerimiento()?.admitePresentacion
              ? 'No hay recepción confirmada para esta operación. Puede reintentar con la misma clave y contenido original.'
              : 'No se recuperó esta recepción y no se habilita otra presentación. Consulte el expediente; no se repetirá el envío automáticamente.');
        } else {
          this.error.set('Resultado incierto: no se pudo comprobar la recepción. Compruebe de nuevo antes de reenviar.');
        }
      }
    }));
  }

  private confirmarRecepcion(r: RecepcionSubsanacionTtaip | null): boolean {
    const intento = this.intento;
    if (!r || !intento || !this.idValido(r.id) || r.apelacionId !== intento.apelacionId || r.requerimientoId !== intento.requerimientoId
        || r.expediente !== this.apelacion()?.expediente
        || r.claveOperacion !== intento.clave || r.estado !== 'RECIBIDA' || !r.fechaRecepcion
        || Number.isNaN(Date.parse(r.fechaRecepcion)) || !r.fundamentosAdicionales?.trim()
        || !Array.isArray(r.documentos) || r.documentos.length !== intento.numeroArchivos
        || new Set(r.documentos.map(d => d?.id)).size !== r.documentos.length
        || r.documentos.some(d => !d || !this.idValido(d.id) || d.apelacionId !== intento.apelacionId
          || d.tipoDocumento !== 'SUBSANACION' || d.estado !== 'ACTIVO' || !d.nombreOriginal
          || !this.idValido(d.sizeBytes) || !/^[a-f0-9]{64}$/i.test(d.hashSha256 || ''))
        || intento.texto !== undefined && r.fundamentosAdicionales !== intento.texto) return false;
    this.recepcion.set(r); this.estadoEnvio.set('confirmada'); this.congelado.set(true);
    this.mensaje.set(`El escrito quedó registrado el ${this.fechaLegible(r.fechaRecepcion)}.`);
    this.fundamentosAdicionales = r.fundamentosAdicionales;
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(true);
    return true;
  }

  private claveCache(apelacionId: number, requerimientoId: number): string {
    return `ttaip:subsanacion:v1:${this.authService.obtenerSesion()?.usuarioId}:${apelacionId}:${requerimientoId}`;
  }

  subsanacionConfirmSummary(): ReferenceConfirmSummary[] {
    const ap = this.apelacion();
    const files = this.documentosSeleccionados();
    const docValue = files.length > 0 ? `${files.length} documento(s) seleccionado(s)` : 'Ninguno';
    return [
      { label: 'Expediente', value: ap?.expediente || '—', mono: true },
      { label: 'Resolución', value: this.requerimiento()?.numeroResolucion || 'Numeración no registrada', mono: true },
      { label: 'Observaciones', value: this.textoObservaciones() },
      { label: 'Descripción', value: `${this.fundamentosAdicionales.trim().length} caracteres` },
      { label: 'Documentos', value: docValue }
    ];
  }

  subsanacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Plazo de subsanación',
      detail: this.plazoPendienteInicio() ? 'El plazo todavía no inicia: falta la notificación eficaz acreditada. Puede presentar si el trámite lo habilita. No se calcula otra fecha.'
        : !this.requerimiento()?.plazo || this.relojIncompleto() ? 'El plazo no está disponible o está incompleto. La recepción se comprueba con el escrito y los archivos enviados.'
        : 'Las fechas corresponden a la notificación eficaz registrada. Recibir el escrito no sustituye esa notificación, una firma ni una emisión formal.'
    };
  }

  subsanacionSuccessMetadata(): ReferenceSuccessMeta[] {
    const r = this.recepcion();
    return r ? [
      { label: 'Resolución', value: this.requerimiento()?.numeroResolucion || 'Numeración no registrada', mono: true },
      { label: 'Archivos registrados', value: String(r.documentos.length) },
      { label: 'Fecha de recepción', value: this.fechaLegible(r.fechaRecepcion) }
    ] : [];
  }

  private textoObservaciones(): string {
    const items = this.observacionesTtaip();
    if (!items.length) return 'Sin observaciones registradas';
    const texto = items.map(item => `${item.numero}. ${item.descripcion}`).join(' ');
    return texto.length > 400 ? `${texto.slice(0, 397)}…` : texto;
  }

  private fechaLegible(value?: string | null): string {
    const iso = value?.slice(0, 10) ?? '';
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : 'No registrada';
  }

  observacionesTtaip(): ObservacionSubsanacion[] {
    const observaciones = this.requerimiento()?.observaciones?.trim();
    if (!observaciones) {
      return [];
    }

    return observaciones
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((descripcion, index) => ({ numero: index + 1, descripcion }));
  }

  documentosOriginales(): ReadonlyArray<Documento> {
    const ap = this.apelacion();
    const docs: readonly DocumentoListItem[] = ap?.documentosMetadata ?? ap?.documentos ?? [];
    return docs.filter(doc => {
      if (!doc || !this.idValido(doc.id) || doc.tipoDocumento === 'SUBSANACION') return false;
      const metadata = doc as Record<string, unknown>;
      return !DOCUMENTO_RELATION_KEYS.some(key => metadata[key] != null) || metadata['apelacionId'] === ap?.id;
    }).map(doc => {
      if ('nombreOriginal' in doc) return { id: doc.id, nombreArchivo: doc.nombreOriginal || 'Nombre no registrado',
        tipoArchivo: doc.contentType, tamanio: doc.sizeBytes, fechaSubida: doc.fechaCreacion, tipoDocumento: doc.tipoDocumento };
      return doc;
    });
  }

  documentosIncompletos(): boolean {
    const ap = this.apelacion(), docs = ap?.documentosMetadata ?? ap?.documentos;
    return !Array.isArray(docs) || docs.filter(d => d.tipoDocumento !== 'SUBSANACION').length !== this.documentosOriginales().length;
  }

  subsanacionNextSteps(): ReferenceSuccessNextStep[] {
    return [{ label: 'El escrito quedó en el expediente. Puede volver a esta pantalla para consultar los archivos registrados.' },
      { label: 'El Tribunal continúa con la segunda calificación. Consulte el estado en su panel.' }];
  }

  irPanelCiudadano(): void {
    if (!this.detalleActual()) return;
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  esSubsanacionVencida(): boolean {
    return this.reloj()?.estado === 'VENCIDO';
  }

  rutaRegreso(): string[] {
    const ap = this.apelacion();
    return this.idValido(ap?.solicitudId) && ap?.solicitudExpediente ? ['/ciudadano/solicitud', ap.solicitudExpediente] : ['/ciudadano'];
  }

  verExpediente(): void { if (this.detalleActual()) { this.successModalAbierto.set(false); this.router.navigate(this.rutaRegreso()); } }

  cerrarResultado(): void {
    this.successModalAbierto.set(false);
    const generacion = this.generacion, token = this.authService.getToken();
    queueMicrotask(() => { if (this.esConsultaActual(generacion, token)) document.getElementById('subsanacion-recepcion')?.focus(); });
  }

  private validarSubsanacion(): boolean {
    this.fundamentosError.set('');
    if (!this.detalleActual() || !this.formularioDisponible() || !this.requerimiento()?.admitePresentacion && !this.intentoActual()) {
      this.error.set('No hay un requerimiento vigente habilitado para presentar.');
      return false;
    }

    if (this.esSubsanacionVencida() && !this.intento) {
      this.error.set('El plazo de subsanación ha vencido. No se ha registrado otra presentación.');
      return false;
    }

    if (!this.fundamentosAdicionales.trim()) {
      this.fundamentosError.set('Describa las correcciones o fundamentos adicionales.');
      this.error.set('Debe ingresar los fundamentos adicionales o correcciones');
      return false;
    }
    if (this.congelado() && this.intento?.texto !== undefined && this.intento.archivos &&
        (this.intento.texto !== this.fundamentosAdicionales.trim() || !this.mismosArchivos(this.intento.archivos, this.documentosSeleccionados()))) {
      this.error.set('Conserve los mismos fundamentos y archivos, en el mismo orden, para reintentar esta operación.'); return false;
    }
    const archivos = this.documentosSeleccionados();
    if (archivos.some(file => !file.size || !!validarDocumento(file)) || archivos.reduce((sum, file) => sum + file.size, 0) > DOCUMENTO_MAX_BYTES) {
      this.archivosError.set('Revise los archivos seleccionados y su límite total de 10 MB.'); this.error.set(this.archivosError()); return false;
    }

    this.error.set('');
    return true;
  }
}
