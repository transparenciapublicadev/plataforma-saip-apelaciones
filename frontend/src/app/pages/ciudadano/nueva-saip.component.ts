import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, Subscription, timeout } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { Entidad } from '../../models/entidad.model';
import { Solicitud, SolicitudCreate } from '../../models/solicitud.model';
import { DocumentoMetadata, DOCUMENTO_ACCEPT, DOCUMENTO_RELATION_KEYS, TipoDocumento, validarDocumento } from '../../models/documento.model';
import { ReferenceConfirmModalComponent, ReferenceConfirmSummary, ReferenceConfirmWarning } from '../../shared/reference-confirm-modal.component';
import { ReferenceSuccessModalComponent, ReferenceSuccessMeta, ReferenceSuccessNextStep } from '../../shared/reference-success-modal.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { GUIA, MODELOS, PLANTILLA_GENERAL } from './saip-form-reference';
import { LucideArrowLeft, LucideShieldCheck, LucideCheckCircle2, LucideHelpCircle, LucideInfo,
  LucideUpload, LucideEye, LucideX, LucideSave, LucideSend, LucideFileText, LucideChevronLeft,
  LucideChevronRight, LucideLightbulb, LucideListChecks } from '@lucide/angular';

export const FORMATOS = [
  { key: 'correo' as const, label: 'Correo electrónico', desc: 'Formato digital (PDF, Excel, Word)' },
  { key: 'copiaSimple' as const, label: 'Copia simple / fotocopia', desc: 'Impreso, previo pago del costo de reproducción aplicable' },
  { key: 'copiaCertificada' as const, label: 'Copia certificada', desc: 'Modalidad solicitada; no acredita certificación de un documento' },
  { key: 'soporteMagnetico' as const, label: 'Soportes magnéticos o digitales', desc: 'Se consigna en la descripción; disponibilidad según la entidad' }
];
export const MEDIOS_NOTIFICACION = [
  { key: 'correo' as const, label: 'Correo electrónico', desc: 'Al correo registrado de la cuenta' },
  { key: 'fisica' as const, label: 'Notificación física', desc: 'Al domicilio registrado, conforme al procedimiento' }
];
interface ArchivoPresentacion {
  file: File; tipo: TipoDocumento; estado: 'seleccionado' | 'subiendo' | 'registrado' | 'rechazado' | 'incierto';
  documento?: DocumentoMetadata;
}
interface Envio { datos: SolicitudCreate; archivos: ArchivoPresentacion[]; }
@Component({
  selector: 'app-nueva-saip',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    DocumentPreviewModalComponent, LucideArrowLeft, LucideShieldCheck, LucideCheckCircle2,
    LucideHelpCircle, LucideInfo, LucideUpload, LucideEye, LucideX, LucideSave, LucideSend, LucideFileText,
    LucideChevronLeft, LucideChevronRight, LucideLightbulb, LucideListChecks],
  templateUrl: './nueva-saip.component.html', styleUrl: './nueva-saip.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaSaipComponent implements OnInit, OnDestroy {
  private readonly solicitudService = inject(SolicitudService);
  private readonly entidadService = inject(EntidadService);
  private readonly authService = inject(AuthService);
  private readonly documentoService = inject(DocumentoService);
  private readonly router = inject(Router);
  readonly formatos = FORMATOS;
  readonly mediosNotificacion = MEDIOS_NOTIFICACION;
  readonly modelos = MODELOS;
  readonly plantillaGeneral = PLANTILLA_GENERAL;
  readonly pasos = [
    { title: 'Qué información pide', short: 'Información' }, { title: 'Entrega y notificación', short: 'Entrega' },
    { title: 'Archivos (opcional)', short: 'Archivos' }, { title: 'Revise antes de enviar', short: 'Revisión' }
  ];
  readonly step = signal(1);
  readonly entidades = signal<Entidad[]>([]);
  readonly estadoEntidades = signal<EstadoConsulta>('cargando');
  readonly errorEntidades = signal('');
  readonly reintentarEntidades = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly errores = signal<Record<string, string>>({});
  readonly estadoEnvio = signal<'lista' | 'rechazada' | 'incierta' | 'parcial' | 'confirmada'>('lista');
  readonly confirmModalAbierto = signal(false);
  readonly successModalAbierto = signal(false);
  readonly draftModalAbierto = signal(false);
  readonly modeloPendiente = signal<{ texto: string; asunto?: string } | null>(null);
  readonly expedienteCreado = signal('');
  readonly solicitudCreada = signal<Solicitud | null>(null);
  readonly archivosEnviados = signal<ArchivoPresentacion[]>([]);
  readonly documentosConsultados = signal<DocumentoMetadata[] | null>(null);
  readonly errorRecuperacion = signal('');
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly isPreviewOpen = signal(false);
  readonly sesionVisual = signal({ nombre: '', dni: '', email: '', tipoPersona: '', ruc: '' });
  readonly esEmpresa = computed(() => this.sesionVisual().tipoPersona === 'JURIDICA');
  readonly docLabel = computed(() => this.esEmpresa() ? 'RUC' : 'DNI');
  readonly docNumero = computed(() => this.esEmpresa() ? this.sesionVisual().ruc : this.sesionVisual().dni);
  readonly correoMask = computed(() => { const [u, d] = this.sesionVisual().email.split('@'); return d ? `${u.slice(0, 2)}***@${d}` : 'No disponible'; });
  readonly bloqueado = computed(() => this.loading() || !!this.solicitudCreada() || this.estadoEnvio() === 'incierta');
  readonly accept = DOCUMENTO_ACCEPT;
  readonly adjunto = signal<File | null>(null);
  readonly anexo1 = signal<File | null>(null);
  readonly anexo2 = signal<File | null>(null);
  readonly fileWarningPrincipal = signal<string | null>(null);
  readonly fileWarningAnexo1 = signal<string | null>(null);
  readonly fileWarningAnexo2 = signal<string | null>(null);
  readonly zonas = [
    { label: 'Archivo principal', file: this.adjunto, warning: this.fileWarningPrincipal, dragging: signal(false) },
    { label: 'Anexo 1', file: this.anexo1, warning: this.fileWarningAnexo1, dragging: signal(false) },
    { label: 'Anexo 2', file: this.anexo2, warning: this.fileWarningAnexo2, dragging: signal(false) }
  ];
  entidadId: number | null = null;
  tema = '';
  oficinaDestinataria = '';
  asunto = '';
  descripcion = '';
  formatoRespuesta = { correo: false, copiaSimple: false, copiaCertificada: false, soporteMagnetico: false };
  medioNotificacion: '' | 'correo' | 'fisica' = '';
  aceptaCorreo = false;
  aceptaFisica = false;
  consentimientoDatosPersonales = false;
  declaraVeracidad = false;
  private consultas = new Subscription();
  private operaciones = new Subscription();
  private generacion = 0;
  private destruido = false;
  private token = this.authService.getToken();
  private revision = this.authService.cambiosSesion();
  private confirmacion: Envio | null = null;
  private envio: Envio | null = null;
  constructor() {
    effect(() => { const revision = this.authService.cambiosSesion(); untracked(() => {
      if (revision !== this.revision || this.token !== this.authService.getToken()) {
        this.revision = revision; this.token = this.authService.getToken(); this.limpiarContexto(); this.cargarSesionVisual(); this.cargarEntidades();
      }
    }); });
  }
  ngOnInit(): void { this.cargarSesionVisual(); this.cargarEntidades(); }
  ngOnDestroy(): void { this.destruido = true; this.limpiarContexto(); }
  private actual(generacion = this.generacion): boolean {
    return !this.destruido && generacion === this.generacion && !!this.token && this.token === this.authService.getToken()
      && this.revision === this.authService.cambiosSesion();
  }
  private idValido(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
  private limpiarContexto(): void {
    this.generacion++; this.consultas.unsubscribe(); this.operaciones.unsubscribe();
    this.consultas = new Subscription(); this.operaciones = new Subscription(); this.entidades.set([]);
    this.resetForm(); this.envio = null; this.confirmacion = null; this.solicitudCreada.set(null);
    this.expedienteCreado.set(''); this.archivosEnviados.set([]); this.documentosConsultados.set(null);
    this.errorRecuperacion.set(''); this.loading.set(false); this.estadoEnvio.set('lista');
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.draftModalAbierto.set(false);
    this.modeloPendiente.set(null); this.cerrarPreview();
  }
  private cargarSesionVisual(): void {
    const s = this.authService.obtenerSesion();
    this.sesionVisual.set({ nombre: s?.nombre?.trim() || s?.nombreCompleto?.trim() || '', dni: s?.dni || '',
      email: s?.email || '', tipoPersona: s?.tipoPersona || '', ruc: s?.ruc || '' });
  }
  cargarEntidades(): void {
    if (this.bloqueado()) return;
    this.consultas.unsubscribe(); this.consultas = new Subscription();
    const gen = this.generacion; this.entidades.set([]); this.errorEntidades.set(''); this.reintentarEntidades.set(false);
    this.estadoEntidades.set('cargando');
    if (!this.actual()) { this.estadoEntidades.set('autenticacion'); this.errorEntidades.set('Inicie sesión para consultar las entidades.'); return; }
    this.consultas.add(this.entidadService.findActivas().subscribe({
      next: data => {
        if (!this.actual(gen)) return;
        if (!Array.isArray(data) || data.some(e => !e || !this.idValido(e.id) || !e.nombre?.trim()) || new Set(data.map(e => e.id)).size !== data.length) {
          this.estadoEntidades.set('error'); this.errorEntidades.set('El catálogo de entidades está incompleto. No se habilitó la selección.'); this.reintentarEntidades.set(true); return;
        }
        this.entidades.set(data); this.estadoEntidades.set(data.length ? 'disponible' : 'vacio');
      },
      error: error => { if (this.actual(gen)) { const fallo = falloConsulta(error, 'las entidades'); this.estadoEntidades.set(fallo.estado);
        this.errorEntidades.set(fallo.mensaje); this.reintentarEntidades.set(fallo.reintentable); } }
    }));
  }
  guia() { return GUIA[this.step()]; }
  temaEfectivo(): string { return this.tema.trim(); }
  getEntidadSeleccionadaNombre(): string { return this.entidades().find(e => e.id === this.entidadId)?.nombre || 'Entidad no disponible'; }
  formatosSeleccionadosLabels(): string[] { return this.formatos.filter(f => this.formatoRespuesta[f.key]).map(f => f.label); }
  revisionLocal(): { label: string; revisado: boolean }[] {
    return [
      { label: 'Entidad identificada en el catálogo consultado', revisado: this.entidades().some(e => e.id === this.entidadId) },
      { label: 'Asunto y descripción incorporados para revisión', revisado: !!this.asunto.trim() && !!this.descripcion.trim() },
      { label: 'Modalidad y canal seleccionados', revisado: !!this.formatosSeleccionadosLabels().length && !!this.medioNotificacion },
      { label: 'Archivos opcionales revisados; todavía no registrados', revisado: this.zonas.every(z => !z.file() || this.validarArchivoConAviso(z.file()!).valid) }
    ];
  }
  seleccionarMedioNotificacion(medio: 'correo' | 'fisica'): void { if (!this.bloqueado()) this.medioNotificacion = medio; }
  private validar(paso: number): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!this.actual() || !this.idValido(this.authService.obtenerSesion()?.ciudadanoId)) errors['sesion'] = 'No se identificó al ciudadano de la sesión. Inicie sesión nuevamente.';
    if (this.estadoEntidades() !== 'disponible' || !this.entidades().some(e => e.id === this.entidadId)) errors['entidad'] = 'Seleccione una entidad del catálogo autorizado.';
    if (!this.asunto.trim() || this.asunto.trim().length > 500) errors['asunto'] = 'Ingrese un asunto de hasta 500 caracteres.';
    if (!this.descripcion.trim()) errors['descripcion'] = 'Describa la información solicitada.';
    if (this.tema.trim().length > 100) errors['tema'] = 'El tema admite hasta 100 caracteres.';
    if (paso >= 2) {
      if (!this.formatosSeleccionadosLabels().length) errors['formato'] = 'Seleccione al menos una modalidad de entrega.';
      if (!['correo', 'fisica'].includes(this.medioNotificacion)) errors['medio'] = 'Seleccione un medio formal de notificación.';
      if (this.medioNotificacion === 'correo' && !this.aceptaCorreo) errors['medio'] = 'Acepte expresamente la notificación por correo.';
      if (this.medioNotificacion === 'fisica' && !this.aceptaFisica) errors['medio'] = 'Revise y acepte el compromiso aplicable a las reproducciones solicitadas.';
    }
    if (paso >= 3) for (const zona of this.zonas) { const file = zona.file(); if (file && !this.validarArchivoConAviso(file).valid) errors['archivos'] = 'Revise los archivos seleccionados.'; }
    if (paso >= 4) {
      if (!this.consentimientoDatosPersonales) errors['consentimiento'] = 'Acepte el tratamiento de datos personales para este procedimiento.';
      if (!this.declaraVeracidad) errors['veracidad'] = 'Confirme la veracidad de la información antes de presentar.';
    }
    return errors;
  }
  canSubmit(): boolean { return !this.bloqueado() && Object.keys(this.validar(4)).length === 0; }
  irPaso(paso: number): void {
    if (!this.actual() || this.bloqueado() || paso < 1 || paso > 4) return;
    const errors = paso > this.step() ? this.validar(Math.min(paso - 1, 3)) : {};
    this.errores.set(errors); this.error.set(Object.keys(errors).length ? 'Revise los campos señalados antes de continuar.' : '');
    if (Object.keys(errors).length) { this.enfocar('saip-errores'); return; }
    this.step.set(paso); this.enfocar('saip-paso-titulo');
  }
  private enfocar(id: string): void { const gen = this.generacion; queueMicrotask(() => { if (this.actual(gen)) document.getElementById(id)?.focus(); }); }
  usarModelo(texto: string, asunto?: string): void {
    if (this.bloqueado() || !this.actual()) return;
    if (this.descripcion.trim()) { this.modeloPendiente.set({ texto, asunto }); return; }
    this.aplicarModelo(texto, asunto);
  }
  confirmarModelo(): void { const m = this.modeloPendiente(); if (m && this.actual() && !this.bloqueado()) this.aplicarModelo(m.texto, m.asunto); this.modeloPendiente.set(null); }
  private aplicarModelo(texto: string, asunto?: string): void { this.descripcion = texto; if (!this.asunto.trim() && asunto) this.asunto = asunto; this.enfocar('saip-descripcion'); }
  avisosCalidad(): string[] {
    const avisos: string[] = [], d = this.descripcion.trim();
    if (d && d.length < 40) avisos.push('La descripción es muy corta. Puede agregar tipo de documento, área y periodo.');
    if (/\[[^\]]*\]/.test(d)) avisos.push('Reemplace los textos entre [corchetes] del modelo.');
    if (/por\s*qu[eé]|opini[oó]n|explique|justifique/i.test(d)) avisos.push('Revise si puede pedir el documento existente en lugar de una opinión o explicación.');
    return avisos;
  }
  validarArchivoConAviso(file: File, _allowZip = false, _isPrincipal = false): { valid: boolean; warning?: string } {
    const warning = !file.size ? 'No se admiten archivos vacíos.' : validarDocumento(file);
    return { valid: !warning, warning: warning ?? undefined };
  }
  seleccionarArchivo(event: Event, indice: number): void {
    const input = event.target as HTMLInputElement; this.agregarArchivo(input.files?.[0], indice); input.value = '';
  }
  arrastrarArchivo(event: DragEvent, indice: number, activo: boolean): void {
    event.preventDefault();
    if (this.actual() && !this.bloqueado()) this.zonas[indice]?.dragging.set(activo);
  }
  soltarArchivo(event: DragEvent, indice: number): void {
    event.preventDefault();
    if (!this.actual() || this.bloqueado()) return;
    this.zonas[indice]?.dragging.set(false);
    if (event.dataTransfer && event.dataTransfer.files.length > 1) {
      this.zonas[indice]?.warning.set('Seleccione un archivo por casillero. No se añadió un subconjunto de los archivos arrastrados.'); return;
    }
    this.agregarArchivo(event.dataTransfer?.files?.[0], indice);
  }
  private agregarArchivo(file: File | undefined, indice: number): void {
    if (!file || this.bloqueado() || !this.actual()) return;
    const zona = this.zonas[indice]; if (!zona) return;
    const check = this.validarArchivoConAviso(file); zona.warning.set(check.warning || null); if (check.valid) zona.file.set(file);
  }
  quitarArchivo(indice: number): void { if (!this.bloqueado() && this.actual()) { this.zonas[indice]?.file.set(null); this.zonas[indice]?.warning.set(null); } }
  abrirSelector(event: KeyboardEvent, input: HTMLInputElement): void { if (!this.bloqueado() && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); input.click(); } }
  formatFileSizeMB(size: number): string { return (size / 1024 / 1024).toFixed(2); }
  previsualizarArchivo(file: File): void {
    if (!this.actual() || !this.zonas.some(z => z.file() === file)) return;
    this.previewTarget.set({ nombre: file.name, blob: file, file, tipo: file.type }); this.isPreviewOpen.set(true);
  }
  cerrarPreview(): void { this.isPreviewOpen.set(false); this.previewTarget.set(null); }
  guardarBorrador(): void { if (this.actual() && !this.bloqueado()) this.draftModalAbierto.set(true); }
  resetForm(): void {
    this.entidadId = null; this.tema = ''; this.oficinaDestinataria = ''; this.asunto = ''; this.descripcion = '';
    this.formatoRespuesta = { correo: false, copiaSimple: false, copiaCertificada: false, soporteMagnetico: false };
    this.medioNotificacion = ''; this.aceptaCorreo = false; this.aceptaFisica = false;
    this.consentimientoDatosPersonales = false; this.declaraVeracidad = false;
    for (const z of this.zonas) { z.file.set(null); z.warning.set(null); z.dragging.set(false); }
    this.step.set(1); this.errores.set({}); this.error.set(''); this.mensaje.set('');
  }
  handleSubmit(isDraft: boolean): void {
    if (isDraft) { this.guardarBorrador(); return; }
    if (this.bloqueado()) return;
    const errors = this.validar(4); this.errores.set(errors);
    if (Object.keys(errors).length) { this.error.set('Revise los campos señalados antes de presentar.'); this.enfocar('saip-errores'); return; }
    this.error.set(''); this.confirmacion = this.capturarEnvio(); this.confirmModalAbierto.set(true);
  }
  private capturarEnvio(): Envio {
    const notas: string[] = [];
    if (this.oficinaDestinataria.trim()) notas.push(`[Oficina destinataria: ${this.oficinaDestinataria.trim()}]`);
    if (this.formatoRespuesta.soporteMagnetico) notas.push('[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]');
    return { datos: { asunto: this.asunto.trim(), descripcion: [...notas, this.descripcion.trim()].join('\n\n'),
      ciudadanoId: this.authService.obtenerSesion()!.ciudadanoId!, entidadId: this.entidadId!, tipoInformacion: this.temaEfectivo() || undefined,
      formatoDigital: this.formatoRespuesta.correo, formatoFisico: this.formatoRespuesta.copiaSimple || this.formatoRespuesta.copiaCertificada || this.formatoRespuesta.soporteMagnetico,
      copiaSimple: this.formatoRespuesta.copiaSimple, copiaCertificada: this.formatoRespuesta.copiaCertificada,
      consentimientoDatosPersonales: this.consentimientoDatosPersonales, canalNotificacion: this.medioNotificacion === 'fisica' ? 'FISICA' : 'CORREO_ELECTRONICO' },
      archivos: this.zonas.flatMap((z, i) => z.file() ? [{ file: z.file()!, tipo: (i ? 'DOCUMENTO_ADJUNTO' : 'SOLICITUD_ORIGINAL') as TipoDocumento, estado: 'seleccionado' as const }] : []) };
  }
  crearSolicitud(): void {
    if (this.bloqueado() || !this.actual()) return;
    const errors = this.validar(4); this.errores.set(errors);
    if (Object.keys(errors).length) { this.error.set('Revise los campos señalados antes de presentar.'); return; }
    const envio = this.capturarEnvio();
    if (this.confirmacion && (JSON.stringify(envio.datos) !== JSON.stringify(this.confirmacion.datos)
      || envio.archivos.length !== this.confirmacion.archivos.length || envio.archivos.some((a, i) => a.file !== this.confirmacion!.archivos[i].file))) {
      this.confirmModalAbierto.set(false); this.confirmacion = null; this.error.set('El contenido cambió. Revise y confirme nuevamente.'); return;
    }
    this.envio = envio; const gen = this.generacion;
    this.archivosEnviados.set(envio.archivos); this.loading.set(true); this.error.set(''); this.mensaje.set('');
    this.operaciones.add(this.solicitudService.crear(envio.datos).pipe(timeout(30_000)).subscribe({
      next: respuesta => {
        if (!this.actual(gen)) return;
        this.confirmModalAbierto.set(false);
        if (!this.respuestaCompatible(respuesta, envio)) { this.incierta('El servidor respondió sin una identidad de solicitud compatible. No repita la creación; revise su panel.'); return; }
        this.solicitudCreada.set(respuesta); this.expedienteCreado.set(respuesta.expediente); this.subirSiguiente(0, gen);
      },
      error: error => {
        if (!this.actual(gen)) return;
        this.loading.set(false); this.confirmModalAbierto.set(false);
        if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500) {
          this.incierta('Resultado incierto: el servidor podría haber registrado la solicitud. No se repetirá el POST. No existe una recuperación inequívoca por operación; revise su panel antes de iniciar otra solicitud.');
        } else {
          this.estadoEnvio.set('rechazada'); this.error.set(error.status === 401 ? 'Su sesión no es válida. Inicie sesión nuevamente.'
            : error.status === 403 ? 'No tiene permiso para presentar esta solicitud.' : 'El servidor rechazó la creación. Revise los campos y las condiciones de presentación.');
        }
      }
    }));
  }
  private respuestaCompatible(r: Solicitud | null, envio: Envio): r is Solicitud {
    return !!r && this.idValido(r.id) && !!r.expediente?.trim() && r.ciudadanoId === envio.datos.ciudadanoId && r.entidadId === envio.datos.entidadId
      && r.asunto === envio.datos.asunto && r.descripcion === envio.datos.descripcion
      && r.consentimientoDatosPersonales === envio.datos.consentimientoDatosPersonales
      && r.canalNotificacion === envio.datos.canalNotificacion
      && r.formatoDigital === envio.datos.formatoDigital && r.formatoFisico === envio.datos.formatoFisico
      && r.copiaSimple === envio.datos.copiaSimple && r.copiaCertificada === envio.datos.copiaCertificada;
  }
  private incierta(mensaje: string): void { this.loading.set(false); this.confirmModalAbierto.set(false); this.estadoEnvio.set('incierta'); this.error.set(mensaje); }
  private subirSiguiente(indice: number, gen: number): void {
    if (!this.actual(gen) || !this.envio || !this.solicitudCreada()) return;
    const item = this.envio.archivos[indice];
    if (!item) { this.loading.set(false); this.estadoEnvio.set('confirmada'); this.successModalAbierto.set(true); return; }
    item.estado = 'subiendo'; this.archivosEnviados.set([...this.envio.archivos]);
    this.operaciones.add(this.documentoService.upload(item.file, item.tipo, { solicitudId: this.solicitudCreada()!.id }).pipe(timeout(30_000)).subscribe({
      next: doc => {
        if (!this.actual(gen)) return;
        if (!this.documentoCompatible(doc, item)) { item.estado = 'incierto'; this.detenerSubidas('La respuesta documental no acredita el archivo vinculado esperado.'); return; }
        item.documento = doc; item.estado = 'registrado'; this.archivosEnviados.set([...this.envio!.archivos]); this.subirSiguiente(indice + 1, gen);
      },
      error: error => {
        if (!this.actual(gen)) return;
        item.estado = error instanceof HttpErrorResponse && error.status > 0 && error.status < 500 ? 'rechazado' : 'incierto';
        this.detenerSubidas('La solicitud está registrada, pero no se confirmó la vinculación de todos los archivos. No se repiten subidas automáticamente.');
      }
    }));
  }
  private documentoCompatible(doc: DocumentoMetadata, item: ArchivoPresentacion): boolean {
    return !!doc && this.idValido(doc.id) && doc.solicitudId === this.solicitudCreada()?.id && doc.tipoDocumento === item.tipo
      && !DOCUMENTO_RELATION_KEYS.some(key => key !== 'solicitudId' && doc[key] != null)
      && doc.estado === 'ACTIVO' && doc.nombreOriginal === item.file.name && doc.sizeBytes === item.file.size
      && !!doc.hashSha256 && /^[a-f0-9]{64}$/i.test(doc.hashSha256)
      && !this.archivosEnviados().some(a => a.documento?.id === doc.id);
  }
  private detenerSubidas(mensaje: string): void {
    this.loading.set(false); this.estadoEnvio.set('parcial'); this.error.set(mensaje); this.archivosEnviados.set([...this.envio!.archivos]);
  }
  comprobarRegistro(): void {
    const creada = this.solicitudCreada(), envio = this.envio;
    if (!this.actual() || this.loading() || !creada || !envio) return;
    const gen = this.generacion; this.loading.set(true); this.errorRecuperacion.set(''); this.documentosConsultados.set(null);
    this.operaciones.add(forkJoin({ solicitud: this.solicitudService.findById(creada.id), documentos: this.documentoService.listByRelation({ solicitudId: creada.id }) }).pipe(timeout(30_000)).subscribe({
      next: ({ solicitud, documentos }) => {
        if (!this.actual(gen)) return;
        this.loading.set(false);
        if (!this.respuestaCompatible(solicitud, envio) || solicitud.id !== creada.id || solicitud.expediente !== creada.expediente
          || !Array.isArray(documentos) || new Set(documentos.map(d => d?.id)).size !== documentos.length
          || documentos.some(d => !this.idValido(d?.id) || d.solicitudId !== creada.id || d.estado !== 'ACTIVO'
            || DOCUMENTO_RELATION_KEYS.some(key => key !== 'solicitudId' && d[key] != null))) {
          this.errorRecuperacion.set('La consulta no acredita este recurso y sus documentos. No se confirmó otro registro.'); return;
        }
        this.solicitudCreada.set(solicitud); this.documentosConsultados.set(documentos);
      },
      error: () => { if (this.actual(gen)) { this.loading.set(false); this.errorRecuperacion.set('No se pudo comprobar el registro y sus documentos. El error no acredita ausencia de archivos.'); } }
    }));
  }
  solicitudConfirmSummary(): ReferenceConfirmSummary[] {
    return [{ label: 'Solicitante', value: this.sesionVisual().nombre || 'Nombre no disponible' }, { label: 'Entidad', value: this.getEntidadSeleccionadaNombre() },
      { label: 'Asunto', value: this.asunto.trim() }, { label: 'Modalidad', value: this.formatosSeleccionadosLabels().join(', ') },
      { label: 'Notificación', value: this.medioNotificacion === 'fisica' ? 'Física' : 'Correo electrónico' },
      { label: 'Archivos seleccionados', value: String(this.zonas.filter(z => z.file()).length) }];
  }
  solicitudWarning(): ReferenceConfirmWarning { return { label: 'Registro y adjuntos', detail: 'La creación y cada archivo se registran por separado. Una subida fallida no revierte la solicitud. Registrar no acredita entrega, notificación eficaz, firma ni emisión formal.' }; }
  solicitudSuccessMetadata(): ReferenceSuccessMeta[] { const r = this.solicitudCreada(); return r ? [
    { label: 'Solicitud', value: String(r.id), mono: true }, { label: 'Entidad', value: r.entidadNombre || this.getEntidadSeleccionadaNombre() },
    { label: 'Fecha registrada', value: r.fechaPresentacion || 'No disponible' }, { label: 'Fecha límite del servidor', value: r.fechaLimite || 'No disponible' },
    { label: 'Documentos vinculados', value: String(this.archivosEnviados().filter(a => a.estado === 'registrado').length) }] : []; }
  solicitudNextSteps(): ReferenceSuccessNextStep[] { return [{ label: 'Consulte el recurso y sus documentos por sus identificadores persistidos.' },
    { label: 'El registro no acredita entrega, notificación eficaz, firma ni emisión formal.' }]; }
  cerrarResultado(): void { this.successModalAbierto.set(false); this.enfocar('saip-resultado'); }
  irPanelCiudadano(): void { if (this.actual()) this.router.navigate(['/ciudadano']); }
  verSolicitudCreada(): void { const r = this.solicitudCreada(); if (this.actual() && r && this.idValido(r.id) && r.expediente) this.router.navigate(['/ciudadano/solicitud', r.expediente]); }
}
