import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideEye } from '@lucide/angular';
import type { DocumentoMetadata } from '../../../models/documento.model';

/** Conserva la secuencia de registro usando el identificador cuando coinciden las fechas. */
export function enOrdenDeEnvio(documentos: readonly DocumentoMetadata[]): DocumentoMetadata[] {
  return [...documentos].sort((a, b) =>
    (a.fechaCreacion ?? '').localeCompare(b.fechaCreacion ?? '') || (a.id ?? 0) - (b.id ?? 0));
}

@Component({
  selector: 'app-ttaip-documento-fila',
  imports: [LucideEye],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <div class="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2">
      <div class="min-w-0 flex-1 break-words">
        @if (etiqueta()) { <p class="font-semibold">{{ etiqueta() }}</p> }
        <p [class.text-muted-foreground]="etiqueta()" [class.text-xs]="etiqueta()">{{ documento().nombreOriginal || 'Documento registrado' }}</p>
      </div>
      <button type="button" class="btn-ghost-brand shrink-0 !p-2"
        [attr.aria-label]="'Previsualizar ' + (documento().nombreOriginal || etiqueta() || 'documento')"
        title="Previsualizar documento" [disabled]="!documento().id" (click)="abrir.emit(documento())">
        <svg aria-hidden="true" lucideEye class="size-4"></svg>
      </button>
    </div>
  `,
})
export class TtaipDocumentoFilaComponent {
  readonly documento = input.required<DocumentoMetadata>();
  readonly etiqueta = input('');
  readonly abrir = output<DocumentoMetadata>();
}
