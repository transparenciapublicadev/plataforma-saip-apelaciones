import { ChangeDetectionStrategy, Component, Injector, OnDestroy, OnInit, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, timeout } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SolicitudService } from '../../services/solicitud.service';
import { EntidadService } from '../../services/entidad.service';
import { AuthService } from '../../services/auth.service';
import { Entidad } from '../../models/entidad.model';
import { Solicitud, SolicitudCreate } from '../../models/solicitud.model';
import { DocumentoMetadata, DOCUMENTO_ACCEPT, DOCUMENTO_RELATION_KEYS, TipoDocumento, validarDocumento } from '../../models/documento.model';
import { ReferenceConfirmModalComponent, ReferenceConfirmSummary, ReferenceConfirmWarning } from '../../shared/reference-confirm-modal.component';
import { ReferenceSuccessModalComponent, ReferenceSuccessMeta, ReferenceSuccessNextStep } from '../../shared/reference-success-modal.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';
import { GUIA, MODELOS, PLANTILLA_GENERAL } from './saip-form-reference';
import type { AltaSaipRecepcionDTO } from '../../api/types';
import { LucideArrowLeft, LucideShieldCheck, LucideCheckCircle2, LucideHelpCircle, LucideInfo,
  LucideUpload, LucideEye, LucideX, LucideSave, LucideSend, LucideFileText, LucideChevronLeft,
  LucideChevronRight, LucideLightbulb, LucideListChecks } from '@lucide/angular';

export const FORMATOS = [
  { key: 'correo' as const, label: 'Correo electrónico', desc: 'Formato digital (PDF, Excel, Word)' },
  { key: 'copiaSimple' as const, label: 'Copia simple / fotocopia', desc: 'Impreso, previo pago del costo de reproducción aplicable' },
  { key: 'copiaCertificada' as const, label: 'Copia certificada', desc: 'Copia con certificación de la entidad' },
  { key: 'soporteMagnetico' as const, label: 'Soportes magnéticos o digitales', desc: 'CD, DVD o USB, según disponibilidad de la entidad' }
];
export const MEDIOS_NOTIFICACION = [
  { key: 'correo' as const, label: 'Correo electrónico', desc: 'Al correo registrado de la cuenta' },
  { key: 'fisica' as const, label: 'Notificación física', desc: 'Al domicilio registrado, conforme al procedimiento' }
];
interface ArchivoPresentacion {
  file: File; tipo: TipoDocumento; estado: 'seleccionado' | 'subiendo' | 'registrado' | 'rechazado' | 'incierto';
  documento?: DocumentoMetadata;
}
interface Envio { clave: string; datos: SolicitudCreate; declaraVeracidad: boolean; archivos: ArchivoPresentacion[]; }
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
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
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
  readonly estadoEnvio = signal<'lista' | 'rechazada' | 'incierta' | 'sin-recepcion' | 'confirmada'>('lista');
  readonly operacionPendiente = signal(false);
  readonly claveOperacion = signal('');
  readonly recepcionId = signal<number | null>(null);
  private recepcionEsperada: AltaSaipRecepcionDTO | null = null;
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
  readonly bloqueado = computed(() => this.loading() || !!this.solicitudCreada() || this.operacionPendiente());
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
    this.successModalAbierto.set(false);
    this.resetForm();
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
          this.estadoEntidades.set('error'); this.errorEntidades.set('No se pudo cargar la lista completa de entidades. Vuelva a consultarla.'); this.reintentarEntidades.set(true); return;
        }
        this.entidades.set(data); this.estadoEntidades.set(data.length ? 'disponible' : 'vacio');
      },
      error: error => { if (this.actual(gen)) { const fallo = falloConsulta(error, 'las entidades'); this.estadoEntidades.set(fallo.estado);
        this.errorEntidades.set(fallo.estado === 'red' ? 'Compruebe su conexión y vuelva a consultar las entidades.'
          : fallo.estado === 'servidor' ? 'No se pudo cargar la lista de entidades. Inténtelo nuevamente.' : fallo.mensaje);
        this.reintentarEntidades.set(fallo.reintentable); } }
    }));
  }
  guia() { return GUIA[this.step()]; }
  temaEfectivo(): string { return this.tema.trim(); }
  getEntidadSeleccionadaNombre(): string { return this.entidades().find(e => e.id === this.entidadId)?.nombre || 'Entidad no disponible'; }
  formatosSeleccionadosLabels(): string[] { return this.formatos.filter(f => this.formatoRespuesta[f.key]).map(f => f.label); }
  revisionLocal(): { label: string; revisado: boolean }[] {
    return [
      { label: 'Elegí la entidad a la que se dirige mi solicitud', revisado: this.entidades().some(e => e.id === this.entidadId) },
      { label: 'El asunto y la descripción indican qué información solicito', revisado: !!this.asunto.trim() && !!this.descripcion.trim() },
      { label: 'Elegí la forma de entrega y el medio de notificación', revisado: !!this.formatosSeleccionadosLabels().length && !!this.medioNotificacion },
      { label: 'Revisé los archivos que deseo adjuntar', revisado: this.zonas.every(z => !z.file() || this.validarArchivoConAviso(z.file()!).valid) }
    ];
  }
  seleccionarMedioNotificacion(medio: 'correo' | 'fisica'): void { if (!this.bloqueado()) this.medioNotificacion = medio; }
  private validar(paso: number): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!this.actual() || !this.idValido(this.authService.obtenerSesion()?.ciudadanoId)) errors['sesion'] = 'No se identificó al ciudadano de la sesión. Inicie sesión nuevamente.';
    if (this.estadoEntidades() !== 'disponible' || !this.entidades().some(e => e.id === this.entidadId)) errors['entidad'] = 'Seleccione la entidad a la que dirige su solicitud.';
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
    if (Object.keys(errors).length) { this.subir('saip-errores'); return; }
    this.step.set(paso); this.subir('saip-paso-titulo');
  }
  private subir(id: string): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    this.enfocar(id);
  }
  private enfocar(id: string): void {
    const gen = this.generacion;
    afterNextRender(() => {
      if (!this.actual(gen) || typeof document === 'undefined') return;
      const nodo = document.getElementById(id);
      if (!nodo) return;
      try { nodo.scrollIntoView({ block: 'start' }); } catch { /* el entorno de prueba no desplaza la vista */ }
      nodo.focus();
    }, { injector: this.injector });
  }
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
    this.solicitudCreada.set(null);
    this.expedienteCreado.set('');
    this.estadoEnvio.set('lista');
    this.operacionPendiente.set(false);
    this.loading.set(false);
    this.claveOperacion.set('');
    this.recepcionId.set(null);
    this.recepcionEsperada = null;
    this.envio = null;
    this.confirmacion = null;
    this.archivosEnviados.set([]);
    this.documentosConsultados.set(null);
    this.errorRecuperacion.set('');
    this.confirmModalAbierto.set(false);
    this.draftModalAbierto.set(false);
    this.modeloPendiente.set(null);
    this.cerrarPreview();
  }
  handleSubmit(isDraft: boolean): void {
    if (isDraft) { this.guardarBorrador(); return; }
    if (this.bloqueado()) return;
    const errors = this.validar(4); this.errores.set(errors);
    if (Object.keys(errors).length) { this.error.set('Revise los campos señalados antes de presentar.'); this.enfocar('saip-errores'); return; }
    this.error.set(''); this.confirmacion = this.capturarEnvio(); this.confirmModalAbierto.set(true);
  }
  private capturarEnvio(clave: string = crypto.randomUUID()): Envio {
    const notas: string[] = [];
    if (this.oficinaDestinataria.trim()) notas.push(`[Oficina destinataria: ${this.oficinaDestinataria.trim()}]`);
    if (this.formatoRespuesta.soporteMagnetico) notas.push('[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]');
    return { clave, declaraVeracidad: this.declaraVeracidad, datos: { asunto: this.asunto.trim(), descripcion: [...notas, this.descripcion.trim()].join('\n\n'),
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
    const envio = this.capturarEnvio(this.confirmacion?.clave);
    if (this.confirmacion && (JSON.stringify(envio.datos) !== JSON.stringify(this.confirmacion.datos)
      || envio.declaraVeracidad !== this.confirmacion.declaraVeracidad || envio.archivos.length !== this.confirmacion.archivos.length || envio.archivos.some((a, i) => a.file !== this.confirmacion!.archivos[i].file))) {
      this.confirmModalAbierto.set(false); this.confirmacion = null; this.error.set('El contenido cambió. Revise y confirme nuevamente.'); return;
    }
    this.envio = envio; this.claveOperacion.set(envio.clave); this.operacionPendiente.set(true); this.recepcionEsperada = null;
    this.enviarOperacion(envio, this.generacion);
  }
  private enviarOperacion(envio: Envio, gen: number): void {
    if (!this.actual(gen) || this.envio !== envio) return;
    this.archivosEnviados.set(envio.archivos); this.loading.set(true); this.error.set(''); this.mensaje.set('');
    this.estadoEnvio.set('lista');
    this.operaciones.add(this.solicitudService.registrarAlta(envio.clave, envio.datos, envio.declaraVeracidad, envio.archivos).pipe(timeout(30_000)).subscribe({
      next: respuesta => {
        if (!this.actual(gen) || this.envio !== envio) return;
        this.confirmModalAbierto.set(false);
        if (!this.recepcionCompatible(respuesta, envio) || !this.mismaRecepcionEsperada(respuesta)) {
          this.incierta('Aún no se confirmó el registro de su solicitud. Compruébelo antes de volver a enviarla.');
          return;
        }
        this.recepcionEsperada = respuesta;
        this.recepcionId.set(respuesta.id);
        this.solicitudCreada.set(respuesta.solicitud as Solicitud);
        this.expedienteCreado.set(respuesta.solicitud.expediente!);
        envio.archivos.forEach((a, i) => { a.estado = 'registrado'; a.documento = respuesta.documentos[i]; });
        this.archivosEnviados.set([...envio.archivos]);
        this.documentosConsultados.set(respuesta.documentos);
        this.operacionPendiente.set(false);
        this.loading.set(false);
        this.estadoEnvio.set('confirmada');
        this.error.set('');
        this.successModalAbierto.set(true);
      },
      error: error => {
        if (!this.actual(gen) || this.envio !== envio) return;
        this.loading.set(false); this.confirmModalAbierto.set(false);
        if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500) {
          this.incierta('Su solicitud y sus archivos podrían haberse registrado. Compruebe el envío antes de volver a intentarlo.');
        } else {
          this.estadoEnvio.set('rechazada'); this.error.set(error.status === 401 ? 'Su sesión no es válida. Inicie sesión nuevamente.'
            : error.status === 403 ? 'No tiene permiso para presentar esta solicitud.' : error.status === 409
              ? 'No se pudo confirmar el envío. Compruebe el registro antes de presentar otra solicitud.'
              : 'No se pudo presentar la solicitud. Revise los datos e inténtelo de nuevo.');
          if (error.status !== 409) { this.operacionPendiente.set(false); this.envio = null; this.confirmacion = null; }
        }
      }
    }));
  }
  private respuestaCompatible(r: AltaSaipRecepcionDTO['solicitud'] | null | undefined, envio: Envio): boolean {
    if (!r || !this.idValido(r.id) || !r.expediente?.trim()) return false;
    const sesionId = this.authService.obtenerSesion()?.ciudadanoId;
    const cIdOk = !envio.datos.ciudadanoId || r.ciudadanoId === envio.datos.ciudadanoId || (!!sesionId && r.ciudadanoId === sesionId);
    if (!cIdOk) return false;
    if (r.entidadId !== envio.datos.entidadId) return false;
    const norm = (s: string | null | undefined) => (s ?? '').replace(/\r\n/g, '\n').trim();
    if (norm(r.asunto) !== norm(envio.datos.asunto)) return false;
    if (norm(r.descripcion) !== norm(envio.datos.descripcion)) return false;
    if (r.consentimientoDatosPersonales !== envio.datos.consentimientoDatosPersonales) return false;
    if (r.canalNotificacion !== envio.datos.canalNotificacion) return false;
    if (r.formatoDigital !== envio.datos.formatoDigital || r.formatoFisico !== envio.datos.formatoFisico) return false;
    if (r.copiaSimple !== envio.datos.copiaSimple || r.copiaCertificada !== envio.datos.copiaCertificada) return false;
    if ((r.tipoInformacion || undefined) !== (envio.datos.tipoInformacion || undefined)) return false;
    return true;
  }
  private incierta(mensaje: string): void { this.loading.set(false); this.confirmModalAbierto.set(false); this.estadoEnvio.set('incierta'); this.error.set(mensaje); }
  private documentoCompatible(doc: DocumentoMetadata, item: ArchivoPresentacion, solicitudId: number): boolean {
    return !!doc && this.idValido(doc.id) && doc.solicitudId === solicitudId && doc.tipoDocumento === item.tipo
      && !DOCUMENTO_RELATION_KEYS.some(key => key !== 'solicitudId' && doc[key] != null)
      && doc.estado === 'ACTIVO' && doc.nombreOriginal === item.file.name && doc.sizeBytes === item.file.size
      && !!doc.hashSha256 && /^[a-f0-9]{64}$/i.test(doc.hashSha256);
  }
  private recepcionCompatible(r: AltaSaipRecepcionDTO | null, envio: Envio): r is AltaSaipRecepcionDTO {
    return !!r && this.idValido(r.id) && r.claveOperacion === envio.clave && r.declaraVeracidad === envio.declaraVeracidad
      && typeof r.fechaRecepcion === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.fechaRecepcion) && Number.isFinite(Date.parse(r.fechaRecepcion))
      && this.respuestaCompatible(r.solicitud, envio) && Array.isArray(r.documentos) && r.documentos.length === envio.archivos.length
      && new Set(r.documentos.map(d => d?.id)).size === r.documentos.length
      && r.documentos.every((d, i) => this.documentoCompatible(d, envio.archivos[i], r.solicitud.id!));
  }
  comprobarRegistro(): void {
    if (!this.actual() || this.loading() || !this.envio) return;
    this.consultarRecepcion(this.envio, this.generacion);
  }
  private mismaRecepcionEsperada(r: AltaSaipRecepcionDTO): boolean {
    const anterior = this.recepcionEsperada;
    if (!anterior) return true;
    const f1 = Date.parse(r.fechaRecepcion);
    const f2 = Date.parse(anterior.fechaRecepcion);
    const fechasCoinciden = r.fechaRecepcion === anterior.fechaRecepcion || (!isNaN(f1) && !isNaN(f2) && f1 === f2);
    return r.id === anterior.id && fechasCoinciden
      && r.solicitud.id === anterior.solicitud.id && r.documentos.every((d, i) => d.id === anterior.documentos[i]?.id);
  }
  reintentarAlta(): void {
    if (!this.actual() || this.loading() || this.estadoEnvio() !== 'sin-recepcion' || !this.envio) return;
    this.enviarOperacion(this.envio, this.generacion);
  }
  private consultarRecepcion(envio: Envio, gen: number): void {
    const yaConfirmada = this.estadoEnvio() === 'confirmada';
    this.loading.set(true); this.errorRecuperacion.set(''); this.documentosConsultados.set(null);
    this.operaciones.add(this.solicitudService.obtenerRecepcionAlta(envio.clave).pipe(timeout(30_000)).subscribe({
      next: r => {
        if (!this.actual(gen) || this.envio !== envio) return;
        this.loading.set(false);
        if (!this.recepcionCompatible(r, envio) || !this.mismaRecepcionEsperada(r)) {
          if (!yaConfirmada) this.incierta('Aún no podemos confirmar el registro de su solicitud y sus archivos.');
          this.errorRecuperacion.set('No se pudo comprobar el envío. Consulte nuevamente antes de reintentar.'); return;
        }
        this.recepcionEsperada = r; this.recepcionId.set(r.id); this.solicitudCreada.set(r.solicitud as Solicitud); this.expedienteCreado.set(r.solicitud.expediente!);
        envio.archivos.forEach((a, i) => { a.estado = 'registrado'; a.documento = r.documentos[i]; });
        this.archivosEnviados.set([...envio.archivos]); this.documentosConsultados.set(r.documentos); this.operacionPendiente.set(false);
        this.estadoEnvio.set('confirmada'); this.error.set(''); if (!yaConfirmada) this.successModalAbierto.set(true);
      },
      error: error => { if (this.actual(gen) && this.envio === envio) {
        this.loading.set(false);
        if (!yaConfirmada && error?.status === 404) {
          this.estadoEnvio.set('sin-recepcion'); this.error.set('Todavía no encontramos un registro de este envío. Si elige reintentar, se conservarán los datos y archivos que ya confirmó.');
        } else {
          if (!yaConfirmada) this.incierta('No se pudo comprobar el envío. Permanezca en esta página y vuelva a consultar.');
          this.errorRecuperacion.set('No se pudo comprobar el registro de la solicitud y sus archivos.');
        }
      } }
    }));
  }
  solicitudConfirmSummary(): ReferenceConfirmSummary[] {
    const s = this.sesionVisual();
    const items: ReferenceConfirmSummary[] = [
      { label: 'Solicitante', value: s.nombre || '—' },
      { label: this.docLabel(), value: this.docNumero() || '—', mono: true },
      { label: 'Entidad', value: this.getEntidadSeleccionadaNombre() || '—' }
    ];
    if (this.temaEfectivo()) {
      items.push({ label: 'Tema o materia', value: this.temaEfectivo() });
    }
    if (this.oficinaDestinataria.trim()) {
      items.push({ label: 'Oficina destinataria', value: this.oficinaDestinataria.trim() });
    }
    items.push(
      { label: 'Asunto', value: this.asunto.trim() || '—' },
      { label: 'Modalidad de entrega', value: this.formatosSeleccionadosLabels().join(', ') || '—' },
      { label: 'Medio de notificación', value: this.medioNotificacion === 'fisica' ? 'Notificación física' : 'Correo electrónico' }
    );
    if (this.zonas.some(z => z.file())) {
      items.push({ label: 'Archivos seleccionados', value: String(this.zonas.filter(z => z.file()).length) });
    }
    return items;
  }
  solicitudWarning(): ReferenceConfirmWarning {
    return {
      label: 'Plazo legal',
      detail: 'La entidad tendrá 10 días hábiles para responder como plazo ordinario de atención (Ley N° 27806).'
    };
  }
  solicitudSuccessDescription(): string {
    const ent = this.getEntidadSeleccionadaNombre();
    return `Su solicitud para ${ent} quedó registrada. Puede seguir su trámite con el número de expediente.`;
  }
  solicitudSuccessHint(): string {
    const r = this.solicitudCreada();
    return r?.fechaPresentacion ? `Presentada el ${this.fechaVisible(r.fechaPresentacion)}` : 'Solicitud presentada';
  }
  solicitudSuccessMetadata(): ReferenceSuccessMeta[] {
    const r = this.solicitudCreada();
    const s = this.sesionVisual();
    return [
      { label: 'Entidad receptora', value: r?.entidadNombre || this.getEntidadSeleccionadaNombre() || '—' },
      { label: 'Asunto', value: r?.asunto || this.asunto.trim() || '—' },
      { label: 'Modalidad', value: this.formatosSeleccionadosLabels().join(', ') || 'No definida' },
      { label: 'Solicitante', value: s.nombre || '—' },
      { label: 'Fecha de presentación', value: this.fechaVisible(r?.fechaPresentacion) },
      { label: 'Fecha límite de atención', value: this.fechaVisible(r?.fechaLimite) }
    ];
  }
  private fechaVisible(fecha?: string | null): string {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || '');
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : 'No disponible';
  }
  solicitudNextSteps(): ReferenceSuccessNextStep[] {
    return [
      { label: 'Revise su expediente para consultar los avances y la fecha de atención.' },
      { label: 'Si vence el plazo sin respuesta, puede presentar una apelación ante el TTAIP.' },
      { label: 'Conserve el número de expediente para consultar su solicitud.' }
    ];
  }
  cerrarResultado(): void {
    this.successModalAbierto.set(false);
    this.solicitudCreada.set(null);
    this.expedienteCreado.set('');
    this.estadoEnvio.set('lista');
    this.resetForm();
  }
  irPanelCiudadano(): void { if (this.actual()) this.router.navigate(['/ciudadano']); }
  verSolicitudCreada(): void { const r = this.solicitudCreada(); if (this.actual() && r && this.idValido(r.id) && r.expediente) this.router.navigate(['/ciudadano/solicitud', r.expediente]); }
}
