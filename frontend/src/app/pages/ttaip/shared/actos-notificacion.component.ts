import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { LucideMail } from '@lucide/angular';
import { YaikuCargandoComponent } from '../../../shared/yaiku-cargando.component';
import { enOrdenDeEnvio, TtaipDocumentoFilaComponent } from './ttaip-documento-fila.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
import type { DocumentoMetadata } from '../../../models/documento.model';
import {
  ActoNotificacion, ArchivoNotificacion, errorActuacion, ETAPAS, EtapaActuacion, MedioNotificacion, TipoActo, TtaipActuacionesService,
} from '../../../services/ttaip-actuaciones.service';
import { buildDocWord, cartaOficioPdf, cedulaPdf, cedulaVariantForStage, DocContext, downloadBlob } from './official-docs.util';

const ETAPAS_EN_ORDEN: EtapaActuacion[] = ['PRIMERA_CALIFICACION', 'SEGUNDA_CALIFICACION', 'RESOLUCION_FINAL'];

function agruparAnexos(documentos: readonly DocumentoMetadata[]) {
  const grupos = new Map<string, { doc: DocumentoMetadata; etiqueta: string }[]>();
  for (const doc of enOrdenDeEnvio(documentos)) {
    const [titulo, etiqueta] = identificarAnexo(doc);
    const fila = { doc, etiqueta };
    const grupo = grupos.get(titulo);
    if (grupo) grupo.push(fila);
    else grupos.set(titulo, [fila]);
  }
  return Array.from(grupos, ([titulo, filas]) => ({ titulo, filas }));
}

function identificarAnexo(doc: DocumentoMetadata): [string, string] {
  if (doc.resolucionId || doc.tipoDocumento === 'RESOLUCION_TTAIP') return ['Documentos de la resolución', 'Resolución'];
  if (doc.respuestaId || doc.tipoDocumento === 'RESPUESTA_ENTIDAD') return ['Respuesta de la entidad', ''];
  if (doc.solicitudId || doc.tipoDocumento === 'SOLICITUD_ORIGINAL') {
    return ['Solicitud de acceso a la información', doc.tipoDocumento === 'SOLICITUD_ORIGINAL' ? 'Solicitud original' : 'Anexo de la solicitud'];
  }
  if (doc.tipoDocumento === 'SUBSANACION') return ['Apelación', 'Documento de subsanación'];
  if (doc.tipoDocumento === 'RECURSO_APELACION') return ['Apelación', 'Recurso de apelación'];
  if (doc.apelacionId) return ['Apelación', 'Anexo de la apelación'];
  return ['Documentos del expediente', ''];
}

@Component({
  selector: 'app-actos-notificacion',
  imports: [MultiFileUploadZoneComponent, DatePipe, FormsModule, DocumentPreviewModalComponent, LucideMail, TtaipDocumentoFilaComponent, YaikuCargandoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .revision-dialog {
      margin: auto;
      width: min(28rem, calc(100% - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow: auto;
    }
  `,
  template: `
    <section class="space-y-4">
      @if (encabezado()) {
        <div>
          <span class="eyebrow">Constancias y acuses</span>
          <h3 class="font-display text-base font-semibold mt-1">Notificaciones de la actuación</h3>
        </div>
      }
      @if (error()) {
        <p role="alert" class="text-sm text-destructive">{{ error() }}</p>
        <button type="button" class="btn-ghost-brand" (click)="consultar()">Consultar notificaciones</button>
      }
      @if (ocupado() && !bloques().length) {
        <app-yaiku-cargando mensaje="Comprobando notificaciones…" />
      } @else if (ocupado()) {
        <p role="status" class="text-sm text-muted-foreground">Comprobando notificaciones…</p>
      }
      @for (bloque of bloques(); track bloque.etapa) {
        <section class="overflow-hidden rounded-lg border border-border" [attr.aria-label]="etapas[bloque.etapa]">
          <header class="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <svg aria-hidden="true" lucideMail class="size-4 shrink-0" style="color: var(--brand-700)"></svg>
            <h4 class="font-display text-base font-semibold">{{ etapas[bloque.etapa] }}</h4>
          </header>
          <div class="grid gap-3 p-3" [class]="bloque.actos.length > 1 ? 'xl:grid-cols-2' : ''">
            @for (item of bloque.actos; track item.acto.id) {
              @let acto = item.acto;
              <article class="min-w-0 rounded-lg border border-border bg-card p-4 text-sm space-y-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="eyebrow">{{ acto.destinatario === 'CIUDADANO' ? 'Ciudadano' : 'Entidad pública' }}</p>
                    <h5 class="font-display text-base mt-1 leading-snug">{{ acto.nombre }}</h5>
                  </div>
                  <strong class="pill whitespace-nowrap shrink-0">{{ estado(acto) }}</strong>
                </div>
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="rounded-md px-3 py-2" style="background: var(--background)">
                    <dt class="eyebrow">{{ acto.tipo === 'CARTA' ? 'Número de carta' : 'Número de cédula' }}</dt>
                    <dd class="font-mono mt-1 break-all">{{ acto.numero }}</dd>
                  </div>
                  <div class="rounded-md px-3 py-2" style="background: var(--background)">
                    <dt class="eyebrow">Medio</dt>
                    <dd class="mt-1">{{ medios[acto.medio] || acto.medio || 'Pendiente' }}</dd>
                  </div>
                  @if (acto.direccion) {
                    <div class="rounded-md px-3 py-2 sm:col-span-2" style="background: var(--background)">
                      <dt class="eyebrow">Destino</dt>
                      <dd class="mt-1 break-all">{{ acto.direccion }}</dd>
                    </div>
                  }
                  @if (acto.fechaEficacia) {
                    <div class="rounded-md px-3 py-2 sm:col-span-2" style="background: var(--background)">
                      <dt class="eyebrow">Fecha eficaz</dt>
                      <dd class="mt-1">{{ acto.fechaEficacia | date:'dd/MM/yyyy' }}</dd>
                    </div>
                  }
                </dl>
                @if (editable(acto) && tribunal()) {
                  @if (editando() === acto.id) {
                    <div class="space-y-2">
                      @if (!acto.firmado) {
                        <label class="block">Documento
                          <select class="field-input" [(ngModel)]="tipo">
                            <option value="CEDULA">Cédula de notificación</option><option value="CARTA">Carta de notificación</option>
                          </select>
                        </label>
                      }
                      <label class="block">Medio
                        <select class="field-input" [(ngModel)]="medio">
                          @for (m of opciones; track m) { <option [value]="m">{{ medios[m] }}</option> }
                        </select>
                      </label>
                      @if (medio === 'CORREO_ELECTRONICO' || medio === 'FISICA') {
                        <label class="block">Dirección a notificar<input class="field-input" [type]="medio === 'CORREO_ELECTRONICO' ? 'email' : 'text'" maxlength="500" [(ngModel)]="direccion" /></label>
                      }
                      <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()" (click)="guardarDestino(acto)">Guardar destino</button>
                    </div>
                  } @else if (!acto.cargo && !acto.acuse) {
                    <button type="button" class="btn-ghost-brand" [disabled]="ocupado() || !!error()" (click)="editar(acto)">Editar dirección a notificar</button>
                  }
                  @if (!acto.firmado) {
                    <div class="flex gap-2 flex-wrap">
                      <button type="button" class="btn-ghost-brand" (click)="modelo(acto, false)">PDF</button>
                      <button type="button" class="btn-ghost-brand" (click)="modelo(acto, true)">Word</button>
                    </div>
                    <app-multi-file-upload-zone #firmado [single]="true" [pdfOnly]="true" [keyboardAccessible]="true"
                      [disabled]="ocupado() || !!error()" [label]="acto.tipo === 'CARTA' ? 'Carta firmada' : 'Cédula firmada'" />
                    @if (firmado.files().length) {
                      <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()" (click)="subir(acto, 'FIRMADO', firmado)">Subir documento firmado</button>
                    }
                  }
                }
                @if (acto.firmado; as firmado) {
                  <app-ttaip-documento-fila [documento]="firmado" [etiqueta]="acto.tipo === 'CARTA' ? 'Carta firmada' : 'Cédula firmada'" (abrir)="ver($event)" />
                }
                @for (grupo of item.documentos; track grupo.titulo) {
                  <section class="space-y-2" [attr.aria-label]="grupo.titulo">
                    <h6 class="font-semibold">{{ grupo.titulo }}</h6>
                    @for (fila of grupo.filas; track fila.doc.id) {
                      <app-ttaip-documento-fila [documento]="fila.doc" [etiqueta]="fila.etiqueta" (abrir)="ver($event)" />
                    }
                  </section>
                }
                @if (acto.cargo; as cargo) {
                  <app-ttaip-documento-fila [documento]="cargo" etiqueta="Cargo de notificación" (abrir)="ver($event)" />
                }
                @if (acto.acuse; as acuse) {
                  <app-ttaip-documento-fila [documento]="acuse" etiqueta="Acuse de notificación" (abrir)="ver($event)" />
                }
                @if (acto.requiereExpediente && tribunal()) {
                  <button type="button" class="btn-ghost-brand" (click)="verExpediente.emit()">Ver expediente anexo</button>
                }
                @if (tribunal() && editable(acto)) {
                  @if (acto.firmado && !acto.publicada) {
                    <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()" (click)="publicar(acto)">
                      Enviar nueva notificación en la plataforma
                    </button>
                  }
                  @if (acto.firmado && acto.publicada) {
                    @for (item of evidencias; track item.tipo) {
                      <app-multi-file-upload-zone #adjunto [single]="true" [allowText]="true" [keyboardAccessible]="true"
                        [disabled]="ocupado() || !!error()" [label]="item.label" />
                      @if (adjunto.files().length) {
                        <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()"
                          (click)="subir(acto, item.tipo, adjunto)">{{ item.accion }}</button>
                      }
                    }
                  }
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn-brand" [disabled]="ocupado() || !!error() || !acto.publicada || !acto.cargo || !acto.acuse"
                      (click)="abrirRevision(acto, true, confirmacion)">Validar notificación</button>
                    <button type="button" class="btn-ghost-brand" [disabled]="ocupado() || !!error()"
                      (click)="abrirRevision(acto, false, confirmacion)">Declarar notificación fallida</button>
                  </div>
                }
              </article>
            }
          </div>
        </section>
      } @empty {
        @if (!ocupado() && !error()) { <p class="text-sm text-muted-foreground">Sin notificaciones registradas para este expediente.</p> }
      }
      <dialog #confirmacion class="revision-dialog rounded-lg border border-border bg-card p-5 text-foreground" aria-labelledby="titulo-validacion">
        <h4 id="titulo-validacion" class="font-display text-base font-semibold">{{ validar ? 'Validar notificación' : 'Declarar notificación fallida' }}</h4>
        <p class="text-sm mt-2">{{ validar ? 'Confirme que el cargo y el acuse corresponden al documento y acreditan la notificación.' : 'Se conservará el intento y se asignará un nuevo número al documento de reemplazo.' }}</p>
        @if (validar) {
          <label class="block text-sm mt-3">Fecha eficaz acreditada<input type="date" class="field-input" [(ngModel)]="fechaEficacia" /></label>
        }
        <label class="block text-sm mt-3">Sustento<textarea rows="3" maxlength="1000" class="field-input" [(ngModel)]="observacion"></textarea></label>
        <div class="flex gap-2 mt-3">
          <button type="button" class="btn-brand" [disabled]="!observacion.trim() || (validar && !fechaEficacia)" (click)="revisar(confirmacion)">Confirmar</button>
          <button type="button" class="btn-ghost-brand" (click)="confirmacion.close()">Cancelar</button>
        </div>
      </dialog>
    </section>
    <app-document-preview-modal [doc]="preview()" [open]="!!preview()" [manageFocus]="true" (close)="preview.set(null)" />
  `,
})
export class ActosNotificacionComponent {
  readonly expedienteId = input.required<number>();
  readonly expediente = input.required<string>();
  readonly tribunal = input(false);
  readonly encabezado = input(true);
  readonly actualizado = output<void>();
  readonly verExpediente = output<void>();
  private readonly api = inject(TtaipActuacionesService);
  private readonly destroy = inject(DestroyRef);
  readonly etapas = ETAPAS;
  readonly evidencias = [
    { tipo: 'CARGO', label: 'Cargo de notificación', accion: 'Subir cargo' },
    { tipo: 'ACUSE', label: 'Acuse de notificación', accion: 'Subir acuse' },
  ] as const;
  readonly opciones: MedioNotificacion[] = ['CORREO_ELECTRONICO', 'FISICA', 'CASILLA_ELECTRONICA', 'PLATAFORMA'];
  readonly medios: Record<MedioNotificacion, string> = {
    CORREO_ELECTRONICO: 'Correo electrónico', FISICA: 'Física', CASILLA_ELECTRONICA: 'Casilla electrónica', PLATAFORMA: 'Plataforma',
  };
  readonly actos = signal<ActoNotificacion[]>([]);
  readonly bloques = computed(() => {
    const actos = this.actos();
    return ETAPAS_EN_ORDEN.map(etapa => ({
      etapa,
      actos: actos.filter(acto => acto.etapa === etapa).map(acto => ({ acto, documentos: agruparAnexos(acto.anexos ?? []) })),
    })).filter(bloque => bloque.actos.length > 0);
  });
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  readonly editando = signal<number | null>(null);
  medio: MedioNotificacion = 'CORREO_ELECTRONICO';
  tipo: TipoActo = 'CEDULA';
  direccion = '';
  validar = true;
  observacion = '';
  fechaEficacia = '';
  private objetivo: ActoNotificacion | null = null;

  constructor() {
    effect(() => {
      const id = this.expedienteId();
      this.actos.set([]);
      this.preview.set(null);
      this.editando.set(null);
      this.objetivo = null;
      this.consultar(id);
    });
  }

  consultar(id = this.expedienteId()): void {
    this.ocupado.set(true);
    this.error.set('');
    this.api.actos(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: actos => {
        if (id !== this.expedienteId()) return;
        this.actos.set(actos);
        this.ocupado.set(false);
      },
      error: () => {
        if (id !== this.expedienteId()) return;
        this.ocupado.set(false);
        this.error.set('No se pudo consultar los actos de notificación.');
      },
    });
  }

  estado(acto: ActoNotificacion): string {
    switch (acto.estado) {
      case 'VALIDADA': return 'Validada';
      case 'FALLIDA': return 'Fallida';
      default: return acto.cargo && acto.acuse ? 'Pendiente de validar' : 'Documentos pendientes';
    }
  }

  editable(acto: ActoNotificacion): boolean {
    return !['VALIDADA', 'FALLIDA'].includes(acto.estado);
  }

  editar(acto: ActoNotificacion): void {
    this.medio = acto.medio || 'CORREO_ELECTRONICO';
    this.direccion = acto.direccion ?? '';
    this.tipo = acto.tipo;
    this.editando.set(acto.id);
  }

  publicar(acto: ActoNotificacion): void {
    this.ejecutar(this.api.publicar(this.expedienteId(), acto.id));
  }

  guardarDestino(acto: ActoNotificacion): void {
    this.ejecutar(this.api.destino(this.expedienteId(), acto.id, this.medio, this.direccion, this.tipo));
  }

  subir(acto: ActoNotificacion, tipo: ArchivoNotificacion, selector: MultiFileUploadZoneComponent): void {
    const [archivo] = selector.files();
    if (archivo) this.ejecutar(this.api.archivo(this.expedienteId(), acto.id, tipo, archivo), false, selector);
  }

  abrirRevision(acto: ActoNotificacion, valida: boolean, dialogo: HTMLDialogElement): void {
    this.objetivo = acto;
    this.validar = valida;
    this.observacion = '';
    this.fechaEficacia = '';
    dialogo.showModal();
  }

  revisar(dialogo: HTMLDialogElement): void {
    if (!this.objetivo) return;
    const comando = this.api.revisar(this.expedienteId(), this.objetivo.id, this.validar, this.observacion.trim(), this.validar && this.fechaEficacia ? this.fechaEficacia + 'T00:00:00' : null);
    dialogo.close();
    this.ejecutar(comando, true);
  }

  private ejecutar(comando: Observable<ActoNotificacion>, refrescarDetalle = false, selector?: MultiFileUploadZoneComponent): void {
    if (this.ocupado() || this.error() || !this.tribunal()) return;
    const id = this.expedienteId();
    this.ocupado.set(true);
    comando.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        if (id !== this.expedienteId()) return;
        selector?.files.set([]);
        this.editando.set(null);
        this.consultar(id);
        if (refrescarDetalle) this.actualizado.emit();
      },
      error: e => {
        if (id !== this.expedienteId()) return;
        this.ocupado.set(false);
        this.error.set(errorActuacion(e, 'El resultado es incierto. Consulte las notificaciones antes de repetir la operación.'));
      },
    });
  }

  ver(doc: DocumentoMetadata): void {
    if (doc.id) this.preview.set({ id: doc.id, nombre: doc.nombreOriginal || "Documento", tipo: doc.contentType });
  }

  modelo(acto: ActoNotificacion, word: boolean): void {
    const etapa = acto.etapa === 'PRIMERA_CALIFICACION' ? 'primera' : acto.etapa === 'SEGUNDA_CALIFICACION' ? 'segunda' : 'final';
    const destinatario = acto.destinatario === 'CIUDADANO' ? 'recurrente' : 'entidad';
    const tipo = acto.tipo === 'CARTA' ? 'carta' : 'cedula';
    const ctx: Partial<DocContext> = {
      expediente: this.expediente(), cedulaNro: acto.numero, resolucionNro: acto.numeroResolucion,
      destinoNotificacion: acto.direccion ?? '', medioNotificacion: this.medios[acto.medio],
      destinatarioDocumento: acto.nombre, numeroDocumento: acto.numero, correo: acto.medio === 'CORREO_ELECTRONICO' ? acto.direccion ?? '' : '',
      direccionEntidad: acto.medio === 'FISICA' ? acto.direccion ?? '' : '',
      [destinatario === 'recurrente' ? 'recurrente' : 'entidad']: acto.nombre,
    };
    if (word) {
      const { blob, filename } = buildDocWord(tipo, etapa, acto.decision, ctx, destinatario);
      downloadBlob(blob, filename);
    } else if (tipo === 'carta') {
      cartaOficioPdf('download', 'carta', ctx);
    } else {
      cedulaPdf('download', cedulaVariantForStage(etapa, acto.decision), destinatario, etapa, ctx);
    }
  }
}
