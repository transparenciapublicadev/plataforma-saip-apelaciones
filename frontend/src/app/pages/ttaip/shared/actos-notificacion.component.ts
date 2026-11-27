import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { YaikuCargandoComponent } from '../../../shared/yaiku-cargando.component';
import { ReferenceSuccessMeta, ReferenceSuccessModalComponent } from '../../../shared/reference-success-modal.component';
import { enOrdenDeEnvio, TtaipDocumentoFilaComponent } from './ttaip-documento-fila.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
import type { DocumentoMetadata } from '../../../models/documento.model';
import {
  ActoNotificacion, ArchivoNotificacion, errorActuacion, ETAPAS, EtapaActuacion, MedioNotificacion, TipoActo, TtaipActuacionesService,
} from '../../../services/ttaip-actuaciones.service';
import { buildDocWord, cartaOficioPdf, cedulaPdf, cedulaVariantForStage, DocContext, downloadBlob } from './official-docs.util';

const ETAPAS_EN_ORDEN: EtapaActuacion[] = ['PRIMERA_CALIFICACION', 'SEGUNDA_CALIFICACION', 'RESOLUCION_FINAL'];
type PasoActo = 'destino' | 'firmado' | 'envio' | 'cargo' | 'acuse' | 'validar';
type EvidenciaRegistrada = 'CARGO' | 'ACUSE';

interface PasoVisible {
  id: PasoActo;
  label: string;
  listo: boolean;
}

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
  imports: [MultiFileUploadZoneComponent, DatePipe, FormsModule, DocumentPreviewModalComponent, TtaipDocumentoFilaComponent, YaikuCargandoComponent, ReferenceSuccessModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .revision-dialog {
      margin: auto;
      width: min(28rem, calc(100% - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow: auto;
    }
    .paso-acto {
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--muted-foreground);
    }
    .paso-acto[aria-current='step'] {
      border-color: var(--brand-700);
      background: var(--brand-subtle);
      color: var(--brand-700);
      font-weight: 600;
    }
    .paso-acto.listo {
      color: var(--foreground);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
      @if (bloques().length) {
        <div role="tablist" aria-label="Etapas con notificaciones" class="flex flex-wrap gap-2">
          @for (bloque of bloques(); track bloque.etapa) {
            <button type="button" role="tab" class="rounded-md px-3 py-2 text-sm border border-border"
              [attr.id]="'acto-etapa-' + bloque.etapa"
              [attr.aria-selected]="etapaActiva() === bloque.etapa"
              [style.background]="etapaActiva() === bloque.etapa ? 'var(--brand-subtle)' : 'var(--card)'"
              [style.color]="etapaActiva() === bloque.etapa ? 'var(--brand-700)' : null"
              [style.font-weight]="etapaActiva() === bloque.etapa ? 600 : 400"
              (click)="elegirEtapa(bloque.etapa)">
              {{ etapas[bloque.etapa] }}
              <span class="ml-1 text-[11px]">{{ etapaPendiente(bloque.actos) ? 'Pendiente' : 'Completa' }}</span>
            </button>
          }
        </div>
        <p class="text-xs text-muted-foreground">Siga el paso marcado. El cargo y el acuse se registran después del documento firmado y del envío en la plataforma.</p>
      }
      @if (bloqueActivo(); as bloque) {
        <section class="space-y-3" [attr.aria-label]="etapas[bloque.etapa]">
          <header class="sr-only"><h4>{{ etapas[bloque.etapa] }}</h4></header>
          <div class="grid gap-3" [class]="bloque.actos.length > 1 ? 'xl:grid-cols-2' : ''">
            @for (item of bloque.actos; track item.acto.id) {
              @let acto = item.acto;
              <article class="min-w-0 rounded-lg border border-border bg-card p-4 text-sm space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="eyebrow">{{ acto.destinatario === 'CIUDADANO' ? 'Ciudadano' : 'Entidad pública' }}</p>
                    <h5 class="font-display text-base mt-1 leading-snug">{{ acto.nombre }}</h5>
                    <p class="font-mono text-xs mt-1 break-all">{{ acto.numero }}</p>
                  </div>
                  <strong class="pill whitespace-nowrap shrink-0">{{ estado(acto) }}</strong>
                </div>
                <ol class="flex flex-wrap gap-1.5" [attr.aria-label]="'Pasos de ' + acto.nombre">
                  @for (paso of pasos(acto); track paso.id) {
                    <li>
                      <button type="button" class="paso-acto rounded-full px-2.5 py-1 text-xs"
                        [class.listo]="paso.listo"
                        [attr.aria-current]="pasoAbierto(acto) === paso.id ? 'step' : null"
                        (click)="abrirPaso(acto, paso.id)">{{ paso.listo ? 'Listo · ' : '' }}{{ paso.label }}</button>
                    </li>
                  }
                </ol>
                @switch (pasoAbierto(acto)) {
                  @case ('destino') {
                    <div class="rounded-md p-3 space-y-2" style="background: var(--background)">
                      <p>Medio: {{ medios[acto.medio] || acto.medio || 'Pendiente' }}</p>
                      @if (acto.direccion) { <p class="break-all">Destino: {{ acto.direccion }}</p> }
                      @if (acto.fechaEficacia) { <p>Fecha eficaz: {{ acto.fechaEficacia | date:'dd/MM/yyyy' }}</p> }
                      @if (editable(acto) && tribunal() && !acto.cargo && !acto.acuse) {
                        @if (editando() === acto.id) {
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
                        } @else {
                          <button type="button" class="btn-ghost-brand" [disabled]="ocupado() || !!error()" (click)="editar(acto)">Editar dirección a notificar</button>
                        }
                      }
                    </div>
                  }
                  @case ('firmado') {
                    <div class="space-y-2">
                      @if (acto.firmado; as firmado) {
                        <app-ttaip-documento-fila [documento]="firmado" [etiqueta]="acto.tipo === 'CARTA' ? 'Carta firmada' : 'Cédula firmada'" (abrir)="ver($event)" />
                      } @else if (editable(acto) && tribunal()) {
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
                    </div>
                  }
                  @case ('envio') {
                    <div class="rounded-md p-3" style="background: var(--background)">
                      @if (acto.publicada) {
                        <p>Enviada en la plataforma.</p>
                      } @else if (acto.firmado && tribunal() && editable(acto)) {
                        <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()" (click)="publicar(acto)">Enviar nueva notificación en la plataforma</button>
                      } @else {
                        <p class="text-muted-foreground">Primero registre el documento firmado.</p>
                      }
                    </div>
                  }
                  @case ('cargo') {
                    <div class="space-y-2">
                      @if (acto.cargo; as cargo) {
                        <p class="text-xs font-semibold" style="color: var(--success)">Cargo registrado</p>
                        <app-ttaip-documento-fila [documento]="cargo" etiqueta="Cargo de notificación" (abrir)="ver($event)" />
                      } @else if (acto.firmado && acto.publicada && tribunal() && editable(acto)) {
                        <app-multi-file-upload-zone #cargoZona [single]="true" [allowText]="true" [keyboardAccessible]="true"
                          [disabled]="ocupado() || !!error()" label="Cargo de notificación" />
                        @if (cargoZona.files().length) {
                          <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()" (click)="subir(acto, 'CARGO', cargoZona)">Subir cargo</button>
                        }
                      } @else {
                        <p class="text-muted-foreground">El cargo se sube después del documento firmado y del envío en la plataforma.</p>
                      }
                    </div>
                  }
                  @case ('acuse') {
                    <div class="space-y-2">
                      @if (acto.acuse; as acuse) {
                        <p class="text-xs font-semibold" style="color: var(--success)">Acuse registrado</p>
                        <app-ttaip-documento-fila [documento]="acuse" etiqueta="Acuse de notificación" (abrir)="ver($event)" />
                      } @else if (acto.firmado && acto.publicada && tribunal() && editable(acto)) {
                        <app-multi-file-upload-zone #acuseZona [single]="true" [allowText]="true" [keyboardAccessible]="true"
                          [disabled]="ocupado() || !!error()" label="Acuse de notificación" />
                        @if (acuseZona.files().length) {
                          <button type="button" class="btn-brand" [disabled]="ocupado() || !!error()" (click)="subir(acto, 'ACUSE', acuseZona)">Subir acuse</button>
                        }
                      } @else {
                        <p class="text-muted-foreground">El acuse se sube después del documento firmado y del envío en la plataforma.</p>
                      }
                    </div>
                  }
                  @case ('validar') {
                    <div class="space-y-2">
                      @if (acto.estado === 'VALIDADA') {
                        <p>Notificación validada. El envío técnico no acredita por sí solo la notificación eficaz.</p>
                      } @else if (acto.estado === 'FALLIDA') {
                        <p>Notificación declarada fallida. Se conserva el intento y el reemplazo recibe un número nuevo.</p>
                      } @else if (tribunal() && editable(acto)) {
                        <div class="flex flex-wrap gap-2">
                          <button type="button" class="btn-brand" [disabled]="ocupado() || !!error() || !acto.publicada || !acto.cargo || !acto.acuse"
                            (click)="abrirRevision(acto, true, confirmacion)">Validar notificación</button>
                          <button type="button" class="btn-ghost-brand" [disabled]="ocupado() || !!error()"
                            (click)="abrirRevision(acto, false, confirmacion)">Declarar notificación fallida</button>
                        </div>
                        @if (!acto.publicada || !acto.cargo || !acto.acuse) {
                          <p class="text-xs text-muted-foreground">La validación espera el envío, el cargo y el acuse.</p>
                        }
                      }
                    </div>
                  }
                }
                @if (item.documentos.length) {
                  <details>
                    <summary class="cursor-pointer text-sm font-semibold">Documentos que acompañan</summary>
                    <div class="mt-2 space-y-3">
                      @for (grupo of item.documentos; track grupo.titulo) {
                        <section class="space-y-2" [attr.aria-label]="grupo.titulo">
                          <h6 class="font-semibold">{{ grupo.titulo }}</h6>
                          @for (fila of grupo.filas; track fila.doc.id) {
                            <app-ttaip-documento-fila [documento]="fila.doc" [etiqueta]="fila.etiqueta" (abrir)="ver($event)" />
                          }
                        </section>
                      }
                    </div>
                  </details>
                }
                @if (acto.requiereExpediente && tribunal()) {
                  <button type="button" class="btn-ghost-brand" (click)="verExpediente.emit()">Ver expediente anexo</button>
                }
              </article>
            }
          </div>
        </section>
      } @else if (!ocupado() && !error()) {
        <p class="text-sm text-muted-foreground">Sin notificaciones registradas para este expediente.</p>
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
    <app-reference-success-modal [open]="!!confirmado()" [manageFocus]="true" variant="notificacion" tone="success"
      eyebrow="Documento registrado" [title]="tituloConfirmado()"
      description="Quedó asociado a esta notificación. El envío técnico no acredita por sí solo la notificación eficaz."
      [expediente]="expediente()" [expedienteHint]="confirmado()?.acto.numero || ''" [plazoDias]="null"
      [metadata]="metadataConfirmado()" [nextSteps]="pasosConfirmado()" primaryLabel="Seguir en esta notificación"
      (close)="confirmado.set(null)" (primary)="confirmado.set(null)" />
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
  private readonly etapaElegida = signal<EtapaActuacion | null>(null);
  readonly etapaActiva = computed(() => {
    const bloques = this.bloques();
    const elegida = this.etapaElegida();
    if (elegida && bloques.some(bloque => bloque.etapa === elegida)) return elegida;
    return bloques.find(bloque => this.etapaPendiente(bloque.actos))?.etapa ?? bloques[0]?.etapa ?? null;
  });
  readonly bloqueActivo = computed(() => this.bloques().find(bloque => bloque.etapa === this.etapaActiva()) ?? null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  readonly editando = signal<number | null>(null);
  readonly confirmado = signal<{ tipo: EvidenciaRegistrada; acto: ActoNotificacion } | null>(null);
  private readonly pasoManual = signal<{ acto: number; paso: PasoActo } | null>(null);
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
      this.confirmado.set(null);
      this.etapaElegida.set(null);
      this.pasoManual.set(null);
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

  elegirEtapa(etapa: EtapaActuacion): void {
    this.etapaElegida.set(etapa);
    this.pasoManual.set(null);
    this.editando.set(null);
  }

  etapaPendiente(actos: readonly { acto: ActoNotificacion }[]): boolean {
    return actos.some(item => this.editable(item.acto));
  }

  pasos(acto: ActoNotificacion): PasoVisible[] {
    const destinoListo = !!acto.medio && (acto.medio === 'CASILLA_ELECTRONICA' || acto.medio === 'PLATAFORMA' || !!acto.direccion);
    return [
      { id: 'destino', label: 'Destino', listo: destinoListo },
      { id: 'firmado', label: acto.tipo === 'CARTA' ? 'Carta firmada' : 'Cédula firmada', listo: !!acto.firmado },
      { id: 'envio', label: 'Envío', listo: acto.publicada },
      { id: 'cargo', label: 'Cargo', listo: !!acto.cargo },
      { id: 'acuse', label: 'Acuse', listo: !!acto.acuse },
      { id: 'validar', label: 'Validación', listo: acto.estado === 'VALIDADA' || acto.estado === 'FALLIDA' },
    ];
  }

  pasoAbierto(acto: ActoNotificacion): PasoActo | null {
    if (acto.estado === 'VALIDADA') return this.pasoManual()?.acto === acto.id ? this.pasoManual()!.paso : null;
    const manual = this.pasoManual();
    if (manual?.acto === acto.id) return manual.paso;
    if (acto.estado === 'FALLIDA') return 'validar';
    return this.pasos(acto).find(paso => !paso.listo)?.id ?? null;
  }

  abrirPaso(acto: ActoNotificacion, paso: PasoActo): void {
    this.pasoManual.set({ acto: acto.id, paso });
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
    if (archivo) this.ejecutar(this.api.archivo(this.expedienteId(), acto.id, tipo, archivo), false, selector, tipo === 'CARGO' || tipo === 'ACUSE' ? tipo : undefined);
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

  tituloConfirmado(): string {
    return this.confirmado()?.tipo === 'ACUSE' ? 'Acuse registrado' : 'Cargo registrado';
  }

  metadataConfirmado(): ReferenceSuccessMeta[] {
    const aviso = this.confirmado();
    if (!aviso) return [];
    const archivo = aviso.tipo === 'CARGO' ? aviso.acto.cargo : aviso.acto.acuse;
    return [
      { label: 'Destinatario', value: aviso.acto.nombre },
      { label: aviso.acto.tipo === 'CARTA' ? 'Carta' : 'Cédula', value: aviso.acto.numero, mono: true },
      { label: 'Archivo', value: archivo?.nombreOriginal || 'Documento registrado' },
    ];
  }

  pasosConfirmado(): { label: string }[] {
    const aviso = this.confirmado();
    if (!aviso) return [];
    if (aviso.tipo === 'CARGO' && !aviso.acto.acuse) return [{ label: 'Sigue con el acuse de esta misma notificación.' }];
    if (aviso.tipo === 'ACUSE' && !aviso.acto.cargo) return [{ label: 'Sigue con el cargo de esta misma notificación.' }];
    return [{ label: 'Cargo y acuse ya están en la notificación. Puede validarla cuando correspondan al documento.' }];
  }

  private ejecutar(comando: Observable<ActoNotificacion>, refrescarDetalle = false, selector?: MultiFileUploadZoneComponent, evidencia?: EvidenciaRegistrada): void {
    if (this.ocupado() || this.error() || !this.tribunal()) return;
    const id = this.expedienteId();
    this.ocupado.set(true);
    comando.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: acto => {
        if (id !== this.expedienteId()) return;
        selector?.files.set([]);
        this.editando.set(null);
        if (evidencia) {
          this.confirmado.set({ tipo: evidencia, acto });
          this.pasoManual.set(null);
        }
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
