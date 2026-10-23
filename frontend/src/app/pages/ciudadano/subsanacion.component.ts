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
import { Documento, validarDocumento } from '../../models/documento.model';
import { Subscription, TimeoutError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SubsanacionTtaipService, RecepcionSubsanacionTtaip, RequerimientoSubsanacionTtaip } from '../../services/subsanacion-ttaip.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';


interface ObservacionSubsanacion {
  numero: number;
  descripcion: string;
}

import { LucideArrowLeft, LucideSend, LucideEye } from '@lucide/angular';
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from '../../shared/document-preview-modal.component';

@Component({
  selector: 'app-subsanacion',
  imports: [
    CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    LucideArrowLeft, LucideSend, LucideEye, DocumentPreviewModalComponent
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
  readonly formularioBloqueado = computed(() => this.loading() || this.loadingRequerimiento()
    || this.estadoEnvio() === 'incierta' || this.congelado() || !!this.recepcion());

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
    'Prepare los documentos que subsanan las observaciones.',
    'Describa claramente las correcciones realizadas.',
    'Adjunte los documentos complementarios.',
    'Envíe la subsanación antes del plazo límite.'
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

  constructor() {
    effect(() => {
      this.authService.cambiosSesion();
      untracked(() => {
        const token = this.authService.getToken();
        if (token !== this.tokenActual) {
          this.tokenActual = token;
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
    this.generacion++;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
  }

  cargarApelacion(expediente: string): void {
    this.expedienteActual = expediente;
    this.consultas.unsubscribe();
    this.descargas.unsubscribe();
    this.consultas = new Subscription();
    this.descargas = new Subscription();
    const generacion = ++this.generacion;
    const token = this.authService.getToken();
    this.apelacion.set(null);
    this.requerimiento.set(null);
    this.recepcion.set(null);
    this.intento = null;
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
    this.loading.set(false);
    this.puedeReintentarConsulta.set(false);
    this.loadingApelacion.set(false);
    if (!expediente.trim()) {
      this.estadoConsulta.set('validacion');
      this.error.set('No se recibió el identificador del expediente para subsanar.');
      return;
    }
    if (!token) {
      this.estadoConsulta.set('autenticacion');
      this.error.set('Su sesión no es válida. Inicie sesión nuevamente.');
      return;
    }
    this.loadingApelacion.set(true);
    this.estadoConsulta.set('cargando');
    this.consultas.add(this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loadingApelacion.set(false);
        if (!data) {
          this.estadoConsulta.set('vacio');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        if (!data.id || data.expediente !== expediente) {
          this.estadoConsulta.set('error');
          this.error.set('El servidor devolvió una apelación que no corresponde al expediente consultado.');
          this.puedeReintentarConsulta.set(true);
          return;
        }
        this.apelacion.set(data);
        this.estadoConsulta.set('disponible');
        this.cargarRequerimiento();
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token)) return;
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

  private esConsultaActual(generacion: number, token: string | null): boolean {
    return generacion === this.generacion && token === this.authService.getToken();
  }

  cargarRequerimiento(): void {
    const ap = this.apelacion();
    if (!ap) return;
    const generacion = this.generacion, token = this.authService.getToken();
    this.loadingRequerimiento.set(true);
    this.requerimiento.set(null);
    this.consultas.add(this.recepcionService.requerimiento(ap.id).subscribe({
      next: r => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loadingRequerimiento.set(false);
        if (!r?.requerimientoId || r.apelacionId !== ap.id) {
          this.error.set('No se pudo identificar el requerimiento vigente. No se habilitó la presentación.');
          return;
        }
        this.requerimiento.set(r);
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
        this.error.set(falloConsulta(error, 'el requerimiento de subsanación').mensaje);
      }
    }));
  }

  calcularDiasRestantes(): number | null {
    return this.requerimiento()?.plazo?.diasHabilesRestantes ?? null;
  }

  plazoPendienteInicio(): boolean {
    const plazo = this.requerimiento()?.plazo;
    return !plazo || plazo.estado === 'PENDIENTE_INICIO';
  }

  getPlazoSubsanacionDias(): number { return this.requerimiento()?.diasSubsanacion ?? this.apelacion()?.diasSubsanacion ?? 2; }
  getFechaNotificacion(): Date | null { return this.fecha(this.requerimiento()?.plazo?.fechaEficacia?.slice(0, 10)); }
  getFechaLimite(): Date | null { return this.fecha(this.requerimiento()?.plazo?.fechaLimite); }
  private fecha(value?: string | null): Date | null { return value ? new Date(`${value.slice(0, 10)}T00:00:00`) : null; }

  seleccionarDocumento(event: Event): void {
    if (this.formularioBloqueado()) return;
    const input = event.target as HTMLInputElement;
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
        this.documentosSeleccionados.update(prev => [...prev, ...filesToAdd]);
      }
    }
    input.value = '';
  }

  removerDocumento(index: number): void {
    if (this.formularioBloqueado()) return;
    this.documentosSeleccionados.update(prev => prev.filter((_, i) => i !== index));
    this.error.set('');
  }

  formatFileSize(size: number): string {
    return (size / 1024).toFixed(1);
  }

  abrirConfirmacionSubsanacion(): void {
    if (!this.validarSubsanacion()) {
      return;
    }

    if (!this.loading() && !this.recepcion()) this.confirmModalAbierto.set(true);
  }

  previsualizarDocumento(doc: Documento): void {
    this.documentoError.set('');
    this.cerrarPreview();
    if (!doc.id || !this.apelacion()) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    this.previewTarget.set({ id: doc.id, nombre: doc.nombreArchivo || 'Documento sin nombre', tipo: doc.tipoArchivo });
    this.isPreviewOpen.set(true);
  }

  previsualizarArchivoLocal(file: File): void {
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
    if (!doc.id || !this.apelacion()) {
      this.documentoError.set('Este documento no dispone de un archivo recuperable.');
      return;
    }
    const generacion = this.generacion;
    const token = this.authService.getToken();
    this.descargas.add(this.documentoService.download(doc.id, doc.nombreArchivo || 'documento').subscribe({
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
    this.consultas.add(this.recepcionService.enviar(intento.apelacionId, intento.requerimientoId,
      intento.clave, intento.texto, intento.archivos).subscribe({
      next: recibida => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loading.set(false);
        if (!this.confirmarRecepcion(recibida)) {
          this.estadoEnvio.set('incierta'); this.comprobarRecepcion();
        }
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token)) return;
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
    if (!intento || this.loading()) return;
    const generacion = this.generacion, token = this.authService.getToken();
    this.loading.set(true); this.estadoEnvio.set('incierta'); this.error.set('');
    this.consultas.add(this.recepcionService.consultar(intento.apelacionId, intento.requerimientoId, intento.clave).subscribe({
      next: recibida => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loading.set(false);
        if (!this.confirmarRecepcion(recibida)) this.error.set('La respuesta no acredita esta recepción. Compruebe nuevamente antes de reenviar.');
      },
      error: (error: unknown) => {
        if (!this.esConsultaActual(generacion, token)) return;
        this.loading.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.estadoEnvio.set(intento.conflicto ? 'rechazada' : 'lista');
          this.congelado.set(!!intento.archivos);
          this.error.set(intento.conflicto
            ? 'El servidor rechazó esta presentación por un conflicto de estado o contenido. Actualice la consulta antes de presentar nuevamente.'
            : 'No hay recepción confirmada para esta operación. Puede reintentar con la misma clave y contenido original.');
        } else {
          this.error.set('Resultado incierto: no se pudo comprobar la recepción. Compruebe de nuevo antes de reenviar.');
        }
      }
    }));
  }

  private confirmarRecepcion(r: RecepcionSubsanacionTtaip | null): boolean {
    const intento = this.intento;
    if (!r || !intento || !r.id || r.apelacionId !== intento.apelacionId || r.requerimientoId !== intento.requerimientoId
        || r.claveOperacion !== intento.clave || r.estado !== 'RECIBIDA' || !r.fechaRecepcion
        || !Array.isArray(r.documentos) || r.documentos.length !== intento.numeroArchivos
        || r.documentos.some(d => !d.id || d.apelacionId !== intento.apelacionId)
        || intento.texto !== undefined && r.fundamentosAdicionales !== intento.texto) return false;
    this.recepcion.set(r); this.estadoEnvio.set('confirmada'); this.congelado.set(true);
    this.mensaje.set(`Recepción ${r.id} registrada por el servidor el ${r.fechaRecepcion}.`);
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
      { label: 'Observaciones', value: `${this.observacionesTtaip().length} observaciones del TTAIP` },
      { label: 'Descripción', value: `${this.fundamentosAdicionales.trim().length} caracteres` },
      { label: 'Documentos', value: docValue }
    ];
  }

  subsanacionWarning(): ReferenceConfirmWarning {
    return {
      label: 'Plazo de subsanación',
      detail: `Cuenta con ${this.getPlazoSubsanacionDias()} días hábiles desde la notificación. Una subsanación incompleta puede causar el archivo del expediente.`
    };
  }

  subsanacionSuccessMetadata(): ReferenceSuccessMeta[] {
    const r = this.recepcion();
    return r ? [
      { label: 'Recepción', value: String(r.id), mono: true },
      { label: 'Requerimiento', value: String(r.requerimientoId), mono: true },
      { label: 'Archivos registrados', value: String(r.documentos.length) },
      { label: 'Fecha de recepción', value: r.fechaRecepcion }
    ] : [];
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
    const documentos = this.apelacion()?.documentos ?? [];
    return documentos.filter(doc => doc.tipoDocumento !== 'SUBSANACION');
  }

  subsanacionNextSteps(): ReferenceSuccessNextStep[] {
    return [{ label: 'Puede recuperar esta recepción y sus archivos desde esta pantalla.' },
      { label: 'Consulte el estado del trámite en su panel.' }];
  }

  irPanelCiudadano(): void {
    this.successModalAbierto.set(false);
    this.router.navigate(['/ciudadano']);
  }

  esSubsanacionVencida(): boolean {
    return this.requerimiento()?.plazo?.estado === 'VENCIDO';
  }

  private validarSubsanacion(): boolean {
    if (!this.apelacion() || !this.requerimiento() || !this.requerimiento()?.admitePresentacion && !this.intento) {
      this.error.set('No hay un requerimiento vigente habilitado por el servidor para presentar.');
      return false;
    }

    if (this.esSubsanacionVencida() && !this.intento) {
      this.error.set('El plazo legal de 2 días hábiles para subsanar ha vencido. No es posible enviar observaciones.');
      return false;
    }

    if (!this.fundamentosAdicionales.trim()) {
      this.error.set('Debe ingresar los fundamentos adicionales o correcciones');
      return false;
    }

    this.error.set('');
    return true;
  }
}
