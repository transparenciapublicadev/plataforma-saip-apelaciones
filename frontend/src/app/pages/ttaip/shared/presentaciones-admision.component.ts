import { DatePipe, formatDate } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, input, output, signal, untracked, viewChild } from '@angular/core';
import { LucideFileText, LucideMic, LucideFolderOpen } from '@lucide/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { DocumentoMetadata } from '../../../models/documento.model';
import { AuthService } from '../../../services/auth.service';
import { ConsultaAdmision, errorActuacion, PresentacionAdmision, TipoPresentacionAdmision, TtaipActuacionesService } from '../../../services/ttaip-actuaciones.service';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import { ReferenceSuccessMeta, ReferenceSuccessModalComponent } from '../../../shared/reference-success-modal.component';
import { TtaipDocumentoFilaComponent } from './ttaip-documento-fila.component';

type Formulario = { tipo: TipoPresentacionAdmision; descargoId?: number; respuestaId?: number };
type Operacion = { id: string; body: FormData; tipo: TipoPresentacionAdmision; respuestaId?: number };

@Component({
  selector: 'app-presentaciones-admision',
  imports: [DatePipe, ReactiveFormsModule, DocumentPreviewModalComponent, MultiFileUploadZoneComponent, TtaipDocumentoFilaComponent, ReferenceSuccessModalComponent, LucideFileText, LucideMic, LucideFolderOpen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './presentaciones-admision.component.html',
})
export class PresentacionesAdmisionComponent {
  readonly expedienteId = input.required<number>();
  readonly contexto = input.required<'ciudadano' | 'entidad' | 'tribunal'>();
  readonly vista = input<'todo' | 'descargos' | 'solicitudes'>('todo');
  readonly numeroExpediente = input('');
  readonly actualizacion = input('');
  readonly ocultarSinAdmision = input(false);
  readonly disponibilidad = output<boolean>();
  private readonly api = inject(TtaipActuacionesService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formularioEnvio = viewChild<ElementRef<HTMLFormElement>>('formularioEnvio');
  readonly consulta = signal<ConsultaAdmision | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly recibo = signal<{ titulo: string; detalle: ReferenceSuccessMeta[] } | null>(null);
  readonly formulario = signal<Formulario | null>(null);
  readonly pendiente = signal<Operacion | null>(null);
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  readonly texto = new FormControl('', { nonNullable: true });
  readonly oficio = new FormControl('', { nonNullable: true });
  readonly decision = new FormControl<'aceptar' | 'denegar' | ''>('', { nonNullable: true });
  readonly campos = new FormGroup({ texto: this.texto, oficio: this.oficio, decision: this.decision });
  readonly archivo = signal<File | null>(null);
  readonly archivoPrincipal = computed(() => {
    const archivo = this.archivo();
    return archivo ? [archivo] : [];
  });
  readonly anexos = signal<File[]>([]);
  readonly descargos = computed(() => this.consulta()?.presentaciones.filter(p => p.tipo === 'DESCARGOS') ?? []);
  readonly solicitudes = computed(() => this.consulta()?.presentaciones.filter(p => p.tipo !== 'DESCARGOS') ?? []);
  readonly mostrarSolicitudes = computed(() => !!this.consulta()?.puedePresentarSolicitudes || !!this.solicitudes().length || !!this.error());
  readonly categoriasSolicitudes = [
    { tipo: 'INFORME_ORAL', titulo: 'Informe oral',
      descripcion: 'Es una audiencia, generalmente virtual, en la que el administrado y la entidad pueden exponer sus argumentos y sustentar sus documentos ante los vocales del Tribunal.',
      primeraAccion: 'Solicitar informe oral', otraAccion: 'Presentar otra solicitud de informe oral',
      vacio: 'No hay solicitudes de informe oral registradas.' },
    { tipo: 'DOCUMENTACION_ADICIONAL', titulo: 'Documentación adicional',
      descripcion: 'Adjunte un escrito para que el Tribunal lo incorpore al expediente.',
      primeraAccion: 'Presentar documentación adicional', otraAccion: 'Presentar más documentación adicional',
      vacio: 'No hay documentación adicional registrada.' },
  ] as const;
  readonly solicitudesPorTipo = computed(() => ({
    INFORME_ORAL: this.solicitudes().filter(p => p.tipo === 'INFORME_ORAL'),
    DOCUMENTACION_ADICIONAL: this.solicitudes().filter(p => p.tipo === 'DOCUMENTACION_ADICIONAL'),
  }));
  private revision = 0;

  constructor() {
    effect(() => {
      if (this.consulta() || this.error()) this.disponibilidad.emit(this.mostrarSolicitudes());
    });
    effect(() => {
      this.actualizacion();
      const id = this.expedienteId();
      const sesion = this.auth.cambiosSesion?.();
      this.revision++;
      this.consulta.set(null);
      this.formulario.set(null);
      this.pendiente.set(null);
      this.preview.set(null);
      this.recibo.set(null);
      this.mensaje.set('');
      untracked(() => this.cargar(id, sesion));
    });
  }

  consultar(): void {
    this.cargar(this.expedienteId(), this.auth.cambiosSesion?.());
  }

  private cargar(expedienteId: number, sesion: number | undefined): void {
    const vigente = this.vigencia(expedienteId, sesion);
    this.ocupado.set(true);
    this.error.set('');
    this.api.presentacionesAdmision(expedienteId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: consulta => {
        if (!vigente()) return;
        this.consulta.set(consulta);
        this.ocupado.set(false);
        const pendiente = this.pendiente();
        if (!pendiente) return;
        const recibida = consulta.presentaciones.find(p =>
          pendiente.respuestaId == null ? p.operacion === pendiente.id : p.id === pendiente.respuestaId && p.operacionRespuesta === pendiente.id);
        if (recibida) this.confirmar(pendiente, recibida);
        else this.mensaje.set('Todavía no aparece la recepción. Puede reintentar con la misma identificación de operación.');
      },
      error: () => {
        if (!vigente()) return;
        this.ocupado.set(false);
        this.error.set('No se pudieron consultar las actuaciones de este expediente.');
      },
    });
  }

  abrir(tipo: TipoPresentacionAdmision, descargoId?: number, respuestaId?: number): void {
    this.campos.reset();
    this.archivo.set(null);
    this.anexos.set([]);
    this.mensaje.set('');
    this.error.set('');
    this.formulario.set({ tipo, descargoId, respuestaId });
    afterNextRender(() => this.formularioEnvio()?.nativeElement.focus(), { injector: this.injector });
  }

  enviar(): void {
    const f = this.formulario();
    if (!f || this.ocupado() || this.pendiente()) return;
    const archivo = this.archivo();
    const cuerpo = new FormData();
    if (f.respuestaId != null) {
      if (!this.decision.value || !archivo) return this.error.set('Seleccione una decisión y adjunte el documento de respuesta.');
      cuerpo.set('aceptada', String(this.decision.value === 'aceptar'));
    } else {
      const texto = this.texto.value.trim();
      const oficio = this.oficio.value.trim();
      if (this.requiereOficio(f) && !oficio) return this.error.set('Ingrese el número de oficio.');
      if (this.requiereTexto(f) && !texto) return this.error.set('Ingrese el detalle de su solicitud.');
      if (f.tipo !== 'INFORME_ORAL' && !archivo) return this.error.set('Seleccione el documento principal.');
      cuerpo.set('tipo', f.tipo);
      if (oficio) cuerpo.set('numeroOficio', oficio);
      if (texto) cuerpo.set('texto', texto);
      if (f.descargoId != null) cuerpo.set('descargoId', String(f.descargoId));
      this.anexos().forEach(anexo => cuerpo.append('anexos', anexo));
    }
    if (archivo) cuerpo.set('archivo', archivo);
    const id = crypto.randomUUID();
    cuerpo.set('operacion', id);
    this.guardar({ id, body: cuerpo, tipo: f.tipo, respuestaId: f.respuestaId });
  }

  reintentar(): void {
    const pendiente = this.pendiente();
    if (pendiente && !this.ocupado() && !this.error()) this.guardar(pendiente);
  }

  private guardar(operacion: Operacion): void {
    const id = this.expedienteId();
    const vigente = this.vigencia(id, this.auth.cambiosSesion?.());
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.api.enviarPresentacionAdmision(id, operacion.body, operacion.respuestaId)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: respuesta => {
          if (!vigente()) return;
          this.ocupado.set(false);
          const operacionDevuelta = operacion.respuestaId == null ? respuesta?.operacion : respuesta?.operacionRespuesta;
          if (respuesta && operacionDevuelta === operacion.id) this.confirmar(operacion, respuesta);
          else this.pendiente.set(operacion);
          this.consultar();
        },
        error: err => {
          if (!vigente()) return;
          this.ocupado.set(false);
          if (!(err instanceof HttpErrorResponse) || !err.status || err.status >= 500 || this.pendiente()) {
            this.pendiente.set(operacion);
            this.consultar();
            return;
          }
          this.error.set(errorActuacion(err, 'El Tribunal no recibió la presentación. Revise los datos e inténtelo nuevamente.'));
        },
      });
  }

  private confirmar(operacion: Operacion, presentacion: PresentacionAdmision): void {
    this.pendiente.set(null);
    this.formulario.set(null);
    const esRespuesta = operacion.respuestaId != null;
    const titulos: Record<TipoPresentacionAdmision, string> = {
      DESCARGOS: 'Descargos presentados',
      INFORME_ORAL: 'Solicitud de informe oral presentada',
      DOCUMENTACION_ADICIONAL: 'Documentación adicional presentada',
    };
    const titulo = esRespuesta ? 'Respuesta publicada en el expediente' : titulos[operacion.tipo];
    const detalle: ReferenceSuccessMeta[] = [{ label: 'N.º de registro', value: String(presentacion.id), mono: true }];
    const fecha = esRespuesta ? presentacion.fechaRespuesta : presentacion.fechaPresentacion;
    if (fecha) detalle.push({ label: 'Fecha y hora', value: formatDate(fecha, 'dd/MM/yyyy HH:mm', 'en-US') });
    if (!esRespuesta && presentacion.numeroOficio) detalle.push({ label: 'N.º de oficio', value: presentacion.numeroOficio });
    if (!esRespuesta && presentacion.texto) detalle.push({ label: 'Detalle', value: presentacion.texto });
    const documentos = esRespuesta ? (presentacion.respuesta ? [presentacion.respuesta] : []) : presentacion.documentos;
    documentos.forEach((doc, i) => {
      if (doc.nombreOriginal) detalle.push({ label: i === 0 ? 'Documento' : 'Anexo ' + i, value: doc.nombreOriginal });
    });
    this.mensaje.set(titulo + '.');
    this.recibo.set({ titulo, detalle });
  }

  private vigencia(expedienteId: number, sesion: number | undefined): () => boolean {
    const revision = ++this.revision;
    return () => revision === this.revision && this.expedienteId() === expedienteId && this.auth.cambiosSesion?.() === sesion;
  }

  requiereOficio(f: Formulario): boolean {
    return f.respuestaId == null && (f.tipo === 'DESCARGOS' || this.contexto() === 'entidad' && f.tipo === 'DOCUMENTACION_ADICIONAL');
  }

  requiereTexto(f: Formulario): boolean {
    return f.respuestaId == null && (f.tipo === 'INFORME_ORAL' || this.contexto() === 'entidad' && f.tipo === 'DOCUMENTACION_ADICIONAL');
  }

  yaPresento(tipo: 'INFORME_ORAL' | 'DOCUMENTACION_ADICIONAL'): boolean {
    return this.solicitudesPorTipo()[tipo].some(p => p.operacion != null);
  }

  ver(doc: DocumentoMetadata): void {
    if (doc.id) this.preview.set({ id: doc.id, nombre: doc.nombreOriginal || "Documento registrado", tipo: doc.contentType, expediente: this.numeroExpediente() });
  }
}
