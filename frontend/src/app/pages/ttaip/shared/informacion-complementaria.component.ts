import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { LucideFileQuestion } from '@lucide/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
import { errorActuacion, ETAPAS, InformacionComplementaria, SolicitudComplementaria, TtaipActuacionesService } from '../../../services/ttaip-actuaciones.service';
import { ReferenceSuccessMeta, ReferenceSuccessModalComponent } from '../../../shared/reference-success-modal.component';
import { AuthService } from '../../../services/auth.service';
import { TtaipDocumentoFilaComponent } from './ttaip-documento-fila.component';
import type { DocumentoMetadata } from '../../../models/documento.model';

@Component({
  selector: 'app-informacion-complementaria',
  imports: [MultiFileUploadZoneComponent, DatePipe, ReactiveFormsModule, DocumentPreviewModalComponent, ReferenceSuccessModalComponent, LucideFileQuestion, TtaipDocumentoFilaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3">
      <h3 class="font-display text-base font-semibold flex items-center gap-2">
        <svg aria-hidden="true" lucideFileQuestion class="h-4 w-4 text-[var(--brand-700)]"></svg> Información complementaria
      </h3>
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
          <article class="rounded-md border border-border bg-card p-4 text-sm space-y-2">
            <div class="flex justify-between gap-2 flex-wrap">
              <strong>{{ etapas[item.etapa] }}</strong><span>{{ item.estado }}</span>
            </div>
            <p class="whitespace-pre-wrap">{{ item.solicitud }}</p>
            <p class="text-muted-foreground">Respuesta de la entidad hasta el {{ item.fechaLimite | date:'dd/MM/yyyy' }} · 3 días hábiles</p>
            @for (doc of item.adjuntos; track doc.id) {
              <app-ttaip-documento-fila [documento]="doc" (abrir)="ver($event)" />
            }
            @if (item.respuesta) {
              <p class="font-semibold">Respuesta de la entidad</p>
              <p class="whitespace-pre-wrap">{{ item.respuesta }}</p>
              @for (doc of item.adjuntosRespuesta; track doc.id) {
                <app-ttaip-documento-fila [documento]="doc" (abrir)="ver($event)" />
              }
            } @else if (!tribunal() && (item.estado === 'PENDIENTE' || item.estado === 'VENCIDA')) {
              <button type="button" class="btn-ghost-brand" [disabled]="ocupado()" (click)="abrir(item.id)">Responder al Tribunal</button>
            }
          </article>
        } @empty {
          <p class="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No hay solicitudes de información complementaria registradas.</p>
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
    <app-reference-success-modal [open]="!!confirmado()" [manageFocus]="true" variant="calificacion-1ra"
      eyebrow="Información complementaria"
      [title]="tribunal() ? 'Solicitud de información complementaria enviada' : 'Información complementaria presentada'"
      [description]="tribunal() ? 'El requerimiento quedó registrado en el expediente.' : 'La respuesta quedó registrada en el expediente.'"
      [metadata]="detalleConfirmacion()" [plazoDias]="null" primaryLabel="Aceptar"
      (close)="confirmado.set(null)" (primary)="confirmado.set(null)" />
  `,
})
export class InformacionComplementariaComponent {
  readonly expedienteId = input.required<number>();
  readonly tribunal = input(false);
  private readonly api = inject(TtaipActuacionesService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly etapas = ETAPAS;
  readonly datos = signal<InformacionComplementaria | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly confirmado = signal<SolicitudComplementaria | null>(null);
  readonly detalleConfirmacion = computed<ReferenceSuccessMeta[]>(() => {
    const solicitud = this.confirmado();
    if (!solicitud) return [];
    const esSolicitud = this.tribunal();
    const fecha = esSolicitud ? solicitud.fechaSolicitud : solicitud.fechaRespuesta;
    const texto = esSolicitud ? solicitud.solicitud : solicitud.respuesta;
    const archivos = esSolicitud ? solicitud.adjuntos : solicitud.adjuntosRespuesta;
    const detalle: ReferenceSuccessMeta[] = [
      { label: 'N.º de requerimiento', value: String(solicitud.id), mono: true },
      { label: 'Etapa', value: ETAPAS[solicitud.etapa] },
    ];
    if (fecha) detalle.push({ label: 'Fecha de registro', value: formatDate(fecha, esSolicitud ? 'dd/MM/yyyy' : 'dd/MM/yyyy HH:mm', 'en-US') });
    if (esSolicitud && solicitud.fechaLimite) detalle.push({ label: 'Fecha límite para responder', value: formatDate(solicitud.fechaLimite, 'dd/MM/yyyy', 'en-US') });
    if (texto) detalle.push({ label: 'Detalle', value: texto });
    archivos.forEach((doc, i) => {
      if (doc.nombreOriginal) detalle.push({ label: 'Adjunto ' + (i + 1), value: doc.nombreOriginal });
    });
    return detalle;
  });
  readonly formulario = signal<number | null | undefined>(undefined);
  readonly texto = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] });
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  archivos: File[] = [];
  private pendiente: { previos: Set<number>; objetivo: number | null; texto: string } | null = null;

  constructor() {
    effect(() => {
      const id = this.expedienteId();
      this.auth.cambiosSesion?.();
      this.datos.set(null);
      this.formulario.set(undefined);
      this.confirmado.set(null);
      this.preview.set(null);
      this.pendiente = null;
      this.consultar(id);
    });
  }

  consultar(id = this.expedienteId()): void {
    const sesion = this.auth.cambiosSesion?.();
    this.ocupado.set(true);
    this.error.set('');
    this.api.informacion(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: datos => {
        if (id !== this.expedienteId() || sesion !== this.auth.cambiosSesion?.()) return;
        this.datos.set(datos);
        this.verificarRecepcion(datos, true);
        this.ocupado.set(false);
      },
      error: () => {
        if (id !== this.expedienteId() || sesion !== this.auth.cambiosSesion?.()) return;
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
    const texto = this.texto.value.trim();
    const sesion = this.auth.cambiosSesion?.();
    this.pendiente = { previos: new Set(datos.solicitudes.map(s => s.id)), objetivo, texto };
    this.api.enviarInformacion(id, texto, this.archivos, objetivo ?? undefined)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: consulta => {
          if (id !== this.expedienteId() || sesion !== this.auth.cambiosSesion?.()) return;
          this.datos.set(consulta);
          this.ocupado.set(false);
          this.verificarRecepcion(consulta, false);
        },
        error: e => {
          if (id !== this.expedienteId() || sesion !== this.auth.cambiosSesion?.()) return;
          this.ocupado.set(false);
          this.error.set(errorActuacion(e, 'El resultado es incierto. Consulte los requerimientos antes de volver a enviar.'));
        },
      });
  }

  private verificarRecepcion(datos: InformacionComplementaria, consultada: boolean): void {
    const pendiente = this.pendiente;
    if (!pendiente) return;
    const coincidencias = datos.solicitudes.filter(s => pendiente.objetivo == null
      ? !pendiente.previos.has(s.id) && s.solicitud === pendiente.texto
      : s.id === pendiente.objetivo && s.estado === 'RESPONDIDA' && s.respuesta === pendiente.texto);
    if (coincidencias.length === 1) {
      this.pendiente = null;
      this.formulario.set(undefined);
      this.confirmado.set(coincidencias[0]);
    } else if (coincidencias.length > 1) {
      this.error.set('Hay varios registros con el mismo detalle. Revise los requerimientos antes de volver a enviar.');
    } else if (consultada) {
      this.pendiente = null;
    } else {
      this.error.set('Todavía no se encontró la recepción. Consulte los requerimientos para comprobar el resultado.');
    }
  }

  ver(doc: DocumentoMetadata): void {
    if (doc.id) this.preview.set({ id: doc.id, nombre: doc.nombreOriginal || "Documento", tipo: doc.contentType });
  }
}
