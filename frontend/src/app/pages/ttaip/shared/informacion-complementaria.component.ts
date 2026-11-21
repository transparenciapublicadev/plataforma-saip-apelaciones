import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
import { errorActuacion, ETAPAS, InformacionComplementaria, TtaipActuacionesService } from '../../../services/ttaip-actuaciones.service';
import { ReferenceSuccessModalComponent } from '../../../shared/reference-success-modal.component';
import type { DocumentoMetadata } from '../../../models/documento.model';

@Component({
  selector: 'app-informacion-complementaria',
  imports: [MultiFileUploadZoneComponent, DatePipe, ReactiveFormsModule, DocumentPreviewModalComponent, ReferenceSuccessModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3">
      <h3 class="font-display text-base font-semibold">Información complementaria</h3>
      @if (error()) {
        <p role="alert" class="text-sm text-destructive">{{ error() }}</p>
        <button type="button" class="btn-ghost-brand" (click)="consultar()">Consultar requerimientos</button>
      }
      @if (!datos() && ocupado()) { <p role="status">Consultando requerimientos…</p> }
      @if (datos(); as consulta) {
        @if (consulta.fechaLimiteCalificacion) {
          <p class="text-sm">Fecha límite de la etapa
            <strong>{{ consulta.fechaLimiteCalificacion | date:'dd/MM/yyyy' }}</strong>
          </p>
        }
        @if (consulta.diasSuspendidos) {
          <p class="text-sm">Suspensión de {{ consulta.diasSuspendidos }} días hábiles en esta etapa.</p>
        }
        @if (tribunal() && consulta.puedeSolicitar && formulario() === undefined) {
          <button type="button" class="btn-ghost-brand" [disabled]="ocupado()" (click)="abrir(null)">Solicitar información complementaria</button>
        }
        @for (item of consulta.solicitudes; track item.id) {
          <article class="rounded-lg border border-border p-3 text-sm space-y-2">
            <div class="flex justify-between gap-2 flex-wrap">
              <strong>{{ etapas[item.etapa] }}</strong><span>{{ item.estado }}</span>
            </div>
            <p class="whitespace-pre-wrap">{{ item.solicitud }}</p>
            <p class="text-muted-foreground">Respuesta de la entidad hasta el {{ item.fechaLimite | date:'dd/MM/yyyy' }} · 3 días hábiles</p>
            @for (doc of item.adjuntos; track doc.id) {
              <button type="button" class="btn-ghost-brand" (click)="ver(doc)">{{ doc.nombreOriginal }}</button>
            }
            @if (item.respuesta) {
              <p class="font-semibold">Respuesta de la entidad</p>
              <p class="whitespace-pre-wrap">{{ item.respuesta }}</p>
              @for (doc of item.adjuntosRespuesta; track doc.id) {
                <button type="button" class="btn-ghost-brand" (click)="ver(doc)">{{ doc.nombreOriginal }}</button>
              }
            } @else if (!tribunal() && (item.estado === 'PENDIENTE' || item.estado === 'VENCIDA')) {
              <button type="button" class="btn-ghost-brand" [disabled]="ocupado()" (click)="abrir(item.id)">Responder al Tribunal</button>
            }
          </article>
        } @empty {
          <p class="text-sm text-muted-foreground">No hay solicitudes de información complementaria registradas.</p>
        }
        @if (formulario() !== undefined) {
          <div class="rounded-lg border border-border p-3 space-y-2">
            <label class="block text-sm">{{ tribunal() ? 'Información solicitada' : 'Respuesta al Tribunal' }}
              <textarea rows="4" class="field-input" maxlength="5000" [formControl]="texto"></textarea>
            </label>
            <app-multi-file-upload-zone label="Adjuntos" [batch]="true" [allowText]="true" [keyboardAccessible]="true"
              [disabled]="ocupado()" [(files)]="archivos" />
            <p class="text-xs text-muted-foreground">La solicitud añade una suspensión de 3 días hábiles a esta etapa.</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-brand" [disabled]="ocupado() || error() || !texto.value.trim()" (click)="enviar()">
                {{ tribunal() ? 'Solicitar información complementaria a ' + consulta.entidad : 'Enviar respuesta al Tribunal' }}
              </button>
              <button type="button" class="btn-ghost-brand" [disabled]="ocupado()" (click)="formulario.set(undefined)">Cancelar</button>
            </div>
          </div>
        }
      }
    </section>
    <app-document-preview-modal [doc]="preview()" [open]="!!preview()" [manageFocus]="true" (close)="preview.set(null)" />
    <app-reference-success-modal [open]="confirmado()" [manageFocus]="true" variant="calificacion-1ra"
      eyebrow="Información complementaria" [title]="tribunal() ? 'Solicitud registrada' : 'Respuesta registrada'"
      description="El requerimiento suspende esta etapa por 3 días hábiles."
      [plazoDias]="null" primaryLabel="Aceptar" (close)="confirmado.set(false)" (primary)="confirmado.set(false)" />
  `,
})
export class InformacionComplementariaComponent {
  readonly expedienteId = input.required<number>();
  readonly tribunal = input(false);
  private readonly api = inject(TtaipActuacionesService);
  private readonly destroy = inject(DestroyRef);
  readonly etapas = ETAPAS;
  readonly datos = signal<InformacionComplementaria | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly confirmado = signal(false);
  readonly formulario = signal<number | null | undefined>(undefined);
  readonly texto = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] });
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  archivos: File[] = [];
  private previo: Set<number> | null = null;

  constructor() {
    effect(() => {
      const id = this.expedienteId();
      this.datos.set(null);
      this.formulario.set(undefined);
      this.confirmado.set(false);
      this.preview.set(null);
      this.previo = null;
      this.consultar(id);
    });
  }

  consultar(id = this.expedienteId()): void {
    this.ocupado.set(true);
    this.error.set('');
    this.api.informacion(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: datos => {
        if (id !== this.expedienteId()) return;
        this.datos.set(datos);
        if (this.previo && datos.solicitudes.some(s => this.formulario() == null
          ? !this.previo!.has(s.id) : s.id === this.formulario() && s.estado === 'RESPONDIDA')) this.confirmar();
        this.previo = null;
        this.ocupado.set(false);
      },
      error: () => {
        if (id !== this.expedienteId()) return;
        this.ocupado.set(false);
        this.error.set('No se pudo consultar la información complementaria.');
      },
    });
  }

  abrir(solicitud: number | null): void {
    this.texto.reset();
    this.archivos = [];
    this.formulario.set(solicitud);
  }

  enviar(): void {
    const objetivo = this.formulario(), datos = this.datos(), id = this.expedienteId();
    if (objetivo === undefined || this.ocupado() || this.error() || this.texto.invalid || !this.texto.value.trim() || !datos) return;
    this.ocupado.set(true);
    this.previo = new Set(datos.solicitudes.map(s => s.id));
    this.api.enviarInformacion(id, this.texto.value.trim(), this.archivos, objetivo ?? undefined)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: consulta => {
          if (id !== this.expedienteId()) return;
          this.datos.set(consulta);
          this.ocupado.set(false);
          this.previo = null;
          this.confirmar();
        },
        error: e => {
          if (id !== this.expedienteId()) return;
          this.ocupado.set(false);
          this.error.set(errorActuacion(e, 'El resultado es incierto. Consulte los requerimientos antes de volver a enviar.'));
        },
      });
  }

  private confirmar(): void {
    this.formulario.set(undefined);
    this.confirmado.set(true);
  }

  ver(doc: DocumentoMetadata): void {
    if (doc.id) this.preview.set({ id: doc.id, nombre: doc.nombreOriginal || "Documento", tipo: doc.contentType });
  }
}
