import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {
  LucideAlertTriangle,
  LucideCheckCircle2,
  LucideClock,
  LucideEye,
  LucideFileText,
  LucideLoader2,
  LucidePlus,
  LucideScale,
  LucideSend,
  LucideTrash2,
  LucideUpload
} from '@lucide/angular';
import { hoyLima } from '../models/calendario.model';
import { DOCUMENTO_ACCEPT, validarDocumento } from '../models/documento.model';
import {
  AmpliacionPlazoSolicitud,
  CronogramaEntregaParcial,
  DECISIONES_ENTREGA,
  DecisionEntregaProgramada
} from '../models/solicitud.model';
import { DocumentListComponent } from './document-list.component';
import {
  DocumentPreviewModalComponent,
  DocumentPreviewTarget
} from './document-preview-modal.component';

export interface HitoPanelMessage {
  hitoId: number;
  mensaje: string;
}

export interface RegistroEntregaHitoEvent {
  hito: CronogramaEntregaParcial;
  fecha: string;
  archivos: File[];
  decision: DecisionEntregaProgramada;
  fundamentoDecision: string;
}

@Component({
  selector: 'app-cronograma-entregas-panel',
  standalone: true,
  imports: [
    CommonModule,
    DocumentListComponent,
    DocumentPreviewModalComponent,
    LucideAlertTriangle,
    LucideCheckCircle2,
    LucideClock,
    LucideEye,
    LucideFileText,
    LucideLoader2,
    LucidePlus,
    LucideScale,
    LucideSend,
    LucideTrash2,
    LucideUpload
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    @keyframes hitoEnter {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .hito-staged-row {
      animation: hitoEnter 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .hito-staged-row { animation: none; }
    }
  `],
  template: `
    <section
      class="rounded-xl border border-border overflow-hidden shadow-xs"
      style="background: var(--card); border-left: 3px solid"
      [style.border-left-color]="todasEntregadas() ? 'var(--success)' : hayHitoIncumplido() ? 'var(--brand-700)' : 'var(--gold)'"
      aria-label="Cronograma de entregas parciales"
    >
      <!-- Cabecera editorial con barra de progreso -->
      <div
        class="px-5 py-4 border-b border-border space-y-3"
        [style.background]="todasEntregadas() ? 'color-mix(in srgb, var(--success) 6%, var(--card))' : 'color-mix(in srgb, var(--gold) 7%, var(--card))'"
      >
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span
              class="eyebrow"
              [style.color]="todasEntregadas() ? 'var(--success)' : 'var(--gold-dark)'"
            >
              {{ todasEntregadas() ? 'Cronograma completado · decisiones registradas' : 'Ampliación programada · cronograma de entregas' }}
            </span>
            <h3 class="font-display mt-0.5 text-lg text-foreground">
              Cronograma de entregas parciales
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Nueva fecha límite:
              <span class="font-mono font-semibold text-foreground">{{ ampliacion().fechaLimiteAmpliada | date:'dd/MM/yyyy' }}</span>
              @if (ampliacion().fechaNotificacionAmpliacion) {
                <span> · Comunicación declarada el {{ ampliacion().fechaNotificacionAmpliacion | date:'dd/MM/yyyy' }}</span>
              }
            </p>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-center">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-semibold border"
              [style.background]="todasEntregadas() ? 'color-mix(in srgb, var(--success) 10%, var(--card))' : 'var(--card)'"
              [style.border-color]="todasEntregadas() ? 'color-mix(in srgb, var(--success) 35%, transparent)' : 'var(--border)'"
              [style.color]="todasEntregadas() ? 'var(--success)' : 'var(--foreground)'"
            >
              @if (todasEntregadas()) {
                <svg aria-hidden="true" lucideCheckCircle2 class="w-3.5 h-3.5"></svg>
              } @else {
                <svg aria-hidden="true" lucideClock class="w-3.5 h-3.5 text-muted-foreground"></svg>
              }
              {{ entregadasCount() }} de {{ hitos().length }} hitos respondidos
            </span>
          </div>
        </div>

        @if (hitos().length > 0) {
          <div class="space-y-1">
            <div class="h-1.5 w-full rounded-full overflow-hidden" style="background: var(--border-subtle, var(--muted))">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out"
                [style.width.%]="porcentajeAvance()"
                [style.background]="todasEntregadas() ? 'var(--success)' : 'var(--gold-dark)'"
              ></div>
            </div>
            @if (!readonly() && pendientesCount() > 0) {
              <p class="text-xs text-muted-foreground leading-relaxed">
                Seleccione la decisión para cada hito y revise sus documentos antes de registrar la respuesta.
              </p>
            }
          </div>
        }
      </div>

      <!-- Lista de hitos -->
      <div class="p-5 space-y-4">
        @if (hitos().length === 0) {
          <div class="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Esta ampliación no tiene entregas parciales programadas en el cronograma.
          </div>
        } @else {
          <div class="space-y-4">
            @for (hito of hitos(); track hito.id) {
              @let staged = archivosHito(hito.id);
              @let errMsg = errorMensaje(hito.id);
              @let registrando = hitoRegistrandoId() === hito.id;
              @let entregado = hito.estado === 'ENTREGADA';
              @let cancelado = hito.estado === 'CANCELADA';
              @let puedeCompletar = !readonly() && !cancelado && (!entregado || (!hito.documentos?.length && !!hito.fechaEntregaReal));
              @let decision = decisionesPorHito()[hito.id];
              @let esDrag = dragOverHitoId() === hito.id;

              <article
                class="rounded-lg border p-4 space-y-3 transition-colors"
                [attr.data-hito-id]="hito.id"
                [style.border-color]="entregado ? 'color-mix(in srgb, var(--success) 32%, var(--border))' : hito.incumplida ? 'var(--brand-300)' : 'var(--border)'"
                [style.border-left-width]="'3px'"
                [style.border-left-color]="entregado ? 'var(--success)' : hito.incumplida ? 'var(--brand-700)' : 'var(--gold)'"
                [style.background]="entregado ? 'color-mix(in srgb, var(--success) 4%, var(--card))' : 'var(--card)'"
              >
                <!-- Cabecera del hito -->
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div class="space-y-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="eyebrow">Entrega parcial {{ hito.numeroEntrega }}</span>
                      @if (entregado) {
                        <span
                          class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style="background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success)"
                        >
                          <svg aria-hidden="true" lucideCheckCircle2 class="w-3 h-3"></svg>
                          {{ hito.decision ? etiquetasDecision[hito.decision] : 'Registrada' }} · {{ hito.fechaEntregaReal | date:'dd/MM/yyyy' }}
                          @if (hito.fechaEntregaReal === hoy()) {
                            <span>(hoy)</span>
                          }
                        </span>
                      } @else if (hito.incumplida) {
                        <span
                          class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style="background: var(--brand-subtle); color: var(--brand-700); border: 1px solid var(--brand-200)"
                        >
                          <svg aria-hidden="true" lucideAlertTriangle class="w-3 h-3"></svg>
                          Fuera de plazo
                        </span>
                      } @else if (cancelado) {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                          Cancelada
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                          <svg aria-hidden="true" lucideClock class="w-3 h-3"></svg>
                          Pendiente de confirmación
                        </span>
                      }
                      @if (entregado && hito.incumplida) {
                        <span class="text-xs font-medium text-muted-foreground">Fuera de plazo</span>
                      }
                    </div>
                    <p class="text-sm font-medium text-foreground break-words">{{ hito.descripcion }}</p>
                    @if (hito.fundamentoDecision) {
                      <p class="text-sm text-muted-foreground whitespace-pre-line break-words">{{ hito.fundamentoDecision }}</p>
                    }
                    <p class="text-xs text-muted-foreground">
                      Fecha programada: <span class="font-mono font-medium">{{ hito.fechaProgramada | date:'dd/MM/yyyy' }}</span>
                      @if (hito.observacion) {
                        <span> · {{ hito.observacion }}</span>
                      }
                    </p>
                  </div>
                </div>

                @if (hitoExitoId() === hito.id && entregado) {
                  <div
                    role="status"
                    class="rounded-md px-3.5 py-2.5 text-xs flex items-center gap-2 hito-staged-row"
                    style="background: color-mix(in srgb, var(--success) 10%, var(--card)); border: 1px solid color-mix(in srgb, var(--success) 30%, transparent); color: var(--success)"
                  >
                    <svg aria-hidden="true" lucideCheckCircle2 class="w-4 h-4 shrink-0"></svg>
                    <span class="font-medium">
                      Respuesta del hito {{ hito.numeroEntrega }} registrada el {{ hito.fechaEntregaReal | date:'dd/MM/yyyy' }}
                      @if (hito.documentos?.length) {
                        con {{ hito.documentos!.length }} {{ hito.documentos!.length === 1 ? 'documento' : 'documentos' }}.
                      }
                    </span>
                  </div>
                }

                <!-- Hito ya entregado -->
                @if (entregado) {
                  <div class="pt-1 space-y-2">
                    @if (hito.documentos?.length) {
                      <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Documentos de la respuesta ({{ hito.documentos!.length }})
                      </span>
                      <app-document-list
                        [documents]="hito.documentos!"
                        [readOnly]="true"
                        emptyMessage="No se registraron documentos para esta entrega."
                      />
                    } @else {
                      <p class="text-xs text-muted-foreground rounded-md px-3 py-2 border border-border bg-muted/40">
                        Registro anterior sin documentos asociados.
                      </p>
                    }
                  </div>
                }
                @if (puedeCompletar) {
                  <!-- Controles pendientes: Fecha + Staging + Confirmación explícita -->
                  <div class="pt-3 border-t border-border/60 space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div class="field">
                        <label class="field-label" [for]="'hito-decision-' + hito.id">Decisión sobre este hito <span class="req">*</span></label>
                        <select class="field-input" [id]="'hito-decision-' + hito.id" [value]="decision || ''"
                          [disabled]="disabled() || registrando" (change)="seleccionarDecision(hito.id, $any($event.target).value)">
                          <option value="">Seleccione una decisión</option>
                          @for (opcion of opcionesDecision; track opcion) {
                            <option [value]="opcion">{{ etiquetasDecision[opcion] }}</option>
                          }
                        </select>
                      </div>
                      @if (decision && decision !== 'ENTREGA_TOTAL') {
                        <div class="field">
                          <label class="field-label" [for]="'hito-fundamento-' + hito.id">Fundamento de lo no entregado <span class="req">*</span></label>
                          <textarea class="field-input" [id]="'hito-fundamento-' + hito.id" rows="3" maxlength="3000"
                            [value]="fundamentosPorHito()[hito.id] || ''" [disabled]="disabled() || registrando"
                            (input)="actualizarFundamento(hito.id, $any($event.target).value)"></textarea>
                        </div>
                        @if (decision === 'ENTREGA_PARCIAL') {
                          <p class="text-xs text-muted-foreground sm:col-span-2">Si corresponde, adjunte la versión con la información protegida ya tachada.</p>
                        }
                      }
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-start">
                      <div class="field">
                        <label class="field-label" [for]="'hito-fecha-' + hito.id">
                          Fecha de {{ decision === 'DENEGACION_TOTAL' ? 'la denegación' : 'la entrega' }}
                        </label>
                        <input
                          [id]="'hito-fecha-' + hito.id"
                          type="date"
                          class="field-input font-mono !py-2 !text-sm"
                          [value]="hito.fechaEntregaReal || fechaRealValue(hito.id)"
                          [attr.min]="minFecha()"
                          [attr.max]="hoy()"
                          [disabled]="disabled() || registrando || entregado"
                          (input)="onFechaChange(hito.id, $any($event.target).value)"
                        />
                      </div>

                      <div class="field">
                        <span class="field-label">{{ decision === 'DENEGACION_TOTAL' ? 'Oficio o sustento de la denegación' : 'Documentos de la entrega' }} <span class="req">*</span></span>
                        <input
                          [id]="'hito-file-' + hito.id"
                          type="file"
                          class="sr-only"
                          multiple
                          [attr.data-hito-file-input]="hito.id"
                          [accept]="documentAccept"
                          [disabled]="disabled() || registrando"
                          (change)="onFilesSelected(hito.id, $event)"
                        />
                        <div
                          role="button"
                          [attr.tabindex]="disabled() || registrando ? -1 : 0"
                          [attr.aria-label]="'Seleccionar o arrastrar documentos para entrega parcial ' + hito.numeroEntrega"
                          [attr.data-hito-dropzone]="hito.id"
                          (click)="!(disabled() || registrando) && abrirSelectorArchivos(hito.id)"
                          (keydown.enter)="!(disabled() || registrando) && abrirSelectorArchivos(hito.id)"
                          (keydown.space)="$event.preventDefault(); !(disabled() || registrando) && abrirSelectorArchivos(hito.id)"
                          (dragover)="onDragOver($event, hito.id)"
                          (dragleave)="onDragLeave($event, hito.id)"
                          (drop)="onDrop($event, hito.id)"
                          class="reference-upload-feedback rounded-lg border-2 border-dashed px-4 py-3 text-left transition-all cursor-pointer flex items-center gap-3 min-h-[44px]"
                          [class.is-dragging]="esDrag"
                          [attr.aria-disabled]="disabled() || registrando"
                          [class.opacity-50]="disabled() || registrando"
                          [class.cursor-not-allowed]="disabled() || registrando"
                          [style.border-color]="esDrag ? 'var(--brand-700)' : staged.length > 0 ? 'var(--gold)' : 'var(--border)'"
                          [style.background]="esDrag ? 'var(--brand-subtle)' : staged.length > 0 ? 'color-mix(in srgb, var(--gold) 5%, var(--card))' : 'var(--muted)'"
                        >
                          <div
                            class="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                            [style.background]="staged.length > 0 ? 'color-mix(in srgb, var(--gold) 14%, var(--card))' : 'var(--card)'"
                            [style.border]="'1px solid var(--border)'"
                          >
                            @if (staged.length > 0) {
                              <svg aria-hidden="true" lucidePlus class="w-4 h-4" style="color: var(--gold-dark)"></svg>
                            } @else {
                              <svg aria-hidden="true" lucideUpload class="w-4 h-4" style="color: var(--brand-700)"></svg>
                            }
                          </div>
                          <div class="min-w-0 text-xs leading-relaxed">
                            <span class="font-semibold text-foreground block">
                              {{ staged.length > 0 ? 'Añadir otro documento a esta entrega' : 'Arrastra tus archivos aquí o haz clic para seleccionar' }}
                            </span>
                            <span class="text-muted-foreground">
                              PDF, JPG, PNG o TXT (máx. 10 MB) · Podrás revisar o quitar antes de confirmar
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Archivos en borrador (revisar, previsualizar, eliminar) -->
                    @if (staged.length > 0) {
                      <div
                        class="rounded-lg border p-3.5 space-y-2.5 hito-staged-row"
                        style="background: color-mix(in srgb, var(--gold) 5%, var(--card)); border-color: color-mix(in srgb, var(--gold) 32%, var(--border))"
                      >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <span class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--gold-dark)">
                            Archivos listos para revisar ({{ staged.length }}) · aún no enviados
                          </span>
                          <span class="text-[11px] text-muted-foreground">
                            Verifica que correspondan al hito antes de confirmar
                          </span>
                        </div>

                        <ul class="space-y-2">
                          @for (file of staged; track file.name + ':' + file.size + ':' + file.lastModified) {
                            <li class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs bg-card">
                              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <div class="w-8 h-8 rounded flex items-center justify-center shrink-0" style="background: var(--brand-subtle); border: 1px solid var(--brand-200)">
                                  <svg aria-hidden="true" lucideFileText class="w-4 h-4" style="color: var(--brand-700)"></svg>
                                </div>
                                <div class="min-w-0">
                                  <div class="font-medium text-foreground truncate">{{ file.name }}</div>
                                  <div class="font-mono text-[11px] text-muted-foreground">{{ formatSize(file.size) }}</div>
                                </div>
                              </div>

                              <div class="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  class="btn-ghost-brand !py-1 !px-2.5 !text-xs inline-flex items-center gap-1"
                                  [disabled]="disabled() || registrando"
                                  [attr.aria-label]="'Previsualizar ' + file.name"
                                  (click)="previsualizarArchivoLocal(file)"
                                >
                                  <svg aria-hidden="true" lucideEye class="w-3.5 h-3.5"></svg>
                                  <span>Ver</span>
                                </button>
                                <button
                                  type="button"
                                  class="btn-ghost-brand !py-1 !px-2.5 !text-xs inline-flex items-center gap-1"
                                  [disabled]="disabled() || registrando"
                                  [attr.aria-label]="'Quitar ' + file.name"
                                  (click)="quitarArchivo(hito.id, $index)"
                                >
                                  <svg aria-hidden="true" lucideTrash2 class="w-3.5 h-3.5"></svg>
                                  <span>Quitar</span>
                                </button>
                              </div>
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    @if (errMsg) {
                      <div
                        role="alert"
                        class="rounded-md px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 hito-staged-row"
                        style="background: color-mix(in srgb, var(--destructive) 8%, var(--card)); border: 1px solid color-mix(in srgb, var(--destructive) 25%, transparent); color: var(--destructive)"
                      >
                        <svg aria-hidden="true" lucideAlertTriangle class="w-4 h-4 shrink-0 mt-0.5"></svg>
                        <span>{{ errMsg }}</span>
                      </div>
                    }

                    <!-- Botón explícito de confirmación -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
                      <p class="text-[11px] text-muted-foreground">
                        @if (staged.length > 0) {
                          Al confirmar, esta entrega parcial y {{ staged.length === 1 ? 'su archivo quedarán registrados' : 'sus archivos quedarán registrados' }} en el expediente.
                        } @else {
                          Adjunta al menos un archivo para habilitar el registro de esta entrega.
                        }
                      </p>
                      <button
                        type="button"
                        [attr.data-hito-confirm]="hito.id"
                        [class]="staged.length > 0 ? 'btn-brand !py-2 !px-4 !text-xs shrink-0' : 'btn-ghost-brand !py-2 !px-4 !text-xs shrink-0'"
                        [disabled]="disabled() || registrando || !puedeConfirmar(hito)"
                        (click)="onConfirmarEntrega(hito)"
                      >
                        @if (registrando) {
                          <svg aria-hidden="true" lucideLoader2 class="w-3.5 h-3.5 animate-spin"></svg>
                          <span>Registrando entrega…</span>
                        } @else if (staged.length > 0) {
                          <svg aria-hidden="true" lucideCheckCircle2 class="w-3.5 h-3.5"></svg>
                          <span>Registrar respuesta del hito {{ hito.numeroEntrega }} ({{ staged.length }})</span>
                        } @else {
                          <svg aria-hidden="true" lucideSend class="w-3.5 h-3.5"></svg>
                          <span>Registrar respuesta del hito {{ hito.numeroEntrega }}</span>
                        }
                      </button>
                    </div>
                  </div>
                }
              </article>
            }
          </div>
        }

        @if (!readonly() && mostrarAccionRespuestaFinal() && hitos().length > 0) {
          <div
            class="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors"
            [style.background]="todasEntregadas() ? 'color-mix(in srgb, var(--success) 7%, var(--card))' : 'var(--brand-subtle)'"
            [style.border-color]="todasEntregadas() ? 'color-mix(in srgb, var(--success) 32%, transparent)' : 'var(--brand-200)'"
            [style.border-left-width]="'3px'"
            [style.border-left-color]="todasEntregadas() ? 'var(--success)' : 'var(--brand-700)'"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                [style.background]="todasEntregadas() ? 'var(--success)' : 'var(--brand-700)'"
              >
                @if (todasEntregadas()) {
                  <svg aria-hidden="true" lucideCheckCircle2 class="w-4 h-4 text-white"></svg>
                } @else {
                  <svg aria-hidden="true" lucideScale class="w-4 h-4 text-white"></svg>
                }
              </div>
              <div class="space-y-0.5 text-sm">
                <p class="font-semibold text-foreground">
                  {{ todasEntregadas()
                    ? 'Cronograma concluido · listo para cierre del expediente'
                    : 'Resolución definitiva del expediente' }}
                </p>
                <p class="text-xs text-muted-foreground leading-relaxed">
                  {{ todasEntregadas()
                    ? 'Todos los hitos tienen una respuesta registrada. Registre la decisión final de la solicitud para concluir la SAIP.'
                    : 'Cuando finalices las entregas programadas —o si deseas emitir entrega parcial o denegatoria— continúa con la respuesta final.' }}
                </p>
              </div>
            </div>
            <button
              type="button"
              [class]="todasEntregadas() ? 'btn-brand shrink-0' : 'btn-ghost-brand shrink-0'"
              (click)="irARespuestaFinal.emit()"
            >
              Continuar con respuesta final
            </button>
          </div>
        }
      </div>

      <app-document-preview-modal
        [open]="localPreviewTarget() !== null"
        [doc]="localPreviewTarget()"
        [manageFocus]="true"
        (close)="localPreviewTarget.set(null)"
      ></app-document-preview-modal>
    </section>
  `
})
export class CronogramaEntregasPanelComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly ampliacion = input.required<AmpliacionPlazoSolicitud>();
  readonly fechasReales = input<Record<number, string>>({});
  readonly archivosPorHito = input<Record<number, File[]>>({});
  readonly hitoRegistrandoId = input<number | null>(null);
  readonly hitoExitoId = input<number | null>(null);
  readonly hitoError = input<HitoPanelMessage | null>(null);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly mostrarAccionRespuestaFinal = input<boolean>(false);

  readonly fechaChange = output<{ hitoId: number; fecha: string }>();
  readonly archivosChange = output<{ hitoId: number; archivos: File[] }>();
  readonly registrarEntrega = output<RegistroEntregaHitoEvent>();
  readonly irARespuestaFinal = output<void>();

  readonly documentAccept = DOCUMENTO_ACCEPT;
  readonly etiquetasDecision = DECISIONES_ENTREGA;
  readonly opcionesDecision = Object.keys(DECISIONES_ENTREGA) as DecisionEntregaProgramada[];
  readonly decisionesPorHito = signal<Record<number, DecisionEntregaProgramada | undefined>>({});
  readonly fundamentosPorHito = signal<Record<number, string>>({});
  readonly dragOverHitoId = signal<number | null>(null);
  readonly localPreviewTarget = signal<DocumentPreviewTarget | null>(null);
  private readonly errorLocalPorHito = signal<Record<number, string>>({});

  readonly hitos = computed(() =>
    [...(this.ampliacion()?.cronograma ?? [])].sort((a, b) => a.numeroEntrega - b.numeroEntrega)
  );

  readonly entregadasCount = computed(
    () => this.hitos().filter(h => h.estado === 'ENTREGADA').length
  );

  readonly pendientesCount = computed(
    () => this.hitos().filter(h => h.estado !== 'ENTREGADA' && h.estado !== 'CANCELADA').length
  );

  readonly todasEntregadas = computed(
    () => this.hitos().length > 0 && this.entregadasCount() === this.hitos().length
  );

  readonly porcentajeAvance = computed(() => {
    const total = this.hitos().length;
    return total > 0 ? Math.round((this.entregadasCount() / total) * 100) : 0;
  });

  readonly hayHitoIncumplido = computed(
    () => this.hitos().some(h => h.incumplida === true)
  );

  hoy(): string {
    return hoyLima();
  }

  minFecha(): string | null {
    return this.ampliacion()?.fechaNotificacionAmpliacion || null;
  }

  fechaRealValue(hitoId: number): string {
    const actual = this.fechasReales()[hitoId];
    if (actual) return actual;
    const min = this.minFecha();
    const hoy = this.hoy();
    return min && min > hoy ? min : hoy;
  }

  archivosHito(hitoId: number): File[] {
    return this.archivosPorHito()[hitoId] ?? [];
  }

  errorMensaje(hitoId: number): string {
    const externo = this.hitoError();
    if (externo && externo.hitoId === hitoId) return externo.mensaje;
    return this.errorLocalPorHito()[hitoId] || '';
  }

  formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  abrirSelectorArchivos(hitoId: number): void {
    const inputEl = this.host.nativeElement.querySelector<HTMLInputElement>(
      `input[data-hito-file-input="${hitoId}"]`
    );
    inputEl?.click();
  }

  previsualizarArchivoLocal(file: File): void {
    this.localPreviewTarget.set({
      file,
      nombre: file.name,
      tipo: file.type || 'application/pdf'
    });
  }

  onFechaChange(hitoId: number, fecha: string): void {
    this.limpiarErrorLocal(hitoId);
    this.fechaChange.emit({ hitoId, fecha });
  }

  onDragOver(event: DragEvent, hitoId: number): void {
    event.preventDefault();
    if (this.disabled() || this.hitoRegistrandoId() === hitoId) return;
    this.dragOverHitoId.set(hitoId);
  }

  onDragLeave(event: DragEvent, hitoId: number): void {
    event.preventDefault();
    if (this.dragOverHitoId() === hitoId) {
      this.dragOverHitoId.set(null);
    }
  }

  onDrop(event: DragEvent, hitoId: number): void {
    event.preventDefault();
    this.dragOverHitoId.set(null);
    if (this.disabled() || this.hitoRegistrandoId() === hitoId) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) {
      this.procesarArchivosSeleccionados(hitoId, files);
    }
  }

  onFilesSelected(hitoId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length > 0) {
      this.procesarArchivosSeleccionados(hitoId, files);
    }
  }

  private procesarArchivosSeleccionados(hitoId: number, nuevos: File[]): void {
    const validos: File[] = [];
    let primerError = '';
    for (const file of nuevos) {
      const error = validarDocumento(file);
      if (error) {
        if (!primerError) primerError = error;
      } else {
        validos.push(file);
      }
    }

    if (primerError) {
      this.errorLocalPorHito.update(prev => ({ ...prev, [hitoId]: primerError }));
    } else {
      this.limpiarErrorLocal(hitoId);
    }

    if (!validos.length) return;

    const existentes = this.archivosHito(hitoId);
    const claves = new Set(existentes.map(f => `${f.name}:${f.size}:${f.lastModified}`));
    const unicosNuevos = validos.filter(f => !claves.has(`${f.name}:${f.size}:${f.lastModified}`));
    const siguientes = [...existentes, ...unicosNuevos];

    this.archivosChange.emit({ hitoId, archivos: siguientes });
  }

  quitarArchivo(hitoId: number, index: number): void {
    this.limpiarErrorLocal(hitoId);
    const actual = this.archivosHito(hitoId);
    this.archivosChange.emit({
      hitoId,
      archivos: actual.filter((_, i) => i !== index)
    });
  }

  seleccionarDecision(hitoId: number, decision: DecisionEntregaProgramada | ''): void {
    this.decisionesPorHito.update(prev => ({ ...prev, [hitoId]: decision || undefined }));
  }

  actualizarFundamento(hitoId: number, fundamento: string): void {
    this.fundamentosPorHito.update(prev => ({ ...prev, [hitoId]: fundamento }));
  }

  puedeConfirmar(hito: CronogramaEntregaParcial): boolean {
    const decision = this.decisionesPorHito()[hito.id];
    const fecha = hito.fechaEntregaReal || this.fechaRealValue(hito.id);
    return !!decision && this.archivosHito(hito.id).length > 0 && !!fecha
      && (hito.estado === 'ENTREGADA' || (fecha <= this.hoy() && fecha >= (this.minFecha() || '')))
      && (decision === 'ENTREGA_TOTAL' || !!this.fundamentosPorHito()[hito.id]?.trim());
  }

  onConfirmarEntrega(hito: CronogramaEntregaParcial): void {
    const decision = this.decisionesPorHito()[hito.id];
    if (this.readonly() || this.disabled() || this.hitoRegistrandoId() !== null || !decision || !this.puedeConfirmar(hito)) return;
    const fecha = hito.fechaEntregaReal || this.fechaRealValue(hito.id);
    const archivos = this.archivosHito(hito.id);
    const fundamentoDecision = this.fundamentosPorHito()[hito.id]?.trim() || '';
    this.limpiarErrorLocal(hito.id);
    this.registrarEntrega.emit({ hito, fecha, archivos, decision, fundamentoDecision });
  }

  private limpiarErrorLocal(hitoId: number): void {
    if (!this.errorLocalPorHito()[hitoId]) return;
    this.errorLocalPorHito.update(prev => {
      const { [hitoId]: _, ...rest } = prev;
      return rest;
    });
  }
}
