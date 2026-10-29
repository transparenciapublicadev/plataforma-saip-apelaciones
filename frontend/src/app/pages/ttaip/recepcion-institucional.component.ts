import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ConsultaRecepcion } from './recepcion-institucional.model';

@Component({
  selector: 'app-recepcion-institucional',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-md p-4 border border-border bg-card" aria-labelledby="institutional-receipt-title" [attr.aria-busy]="consulta().estado === 'cargando'">
      <h2 id="institutional-receipt-title" class="eyebrow">Recepción de subsanación</h2>
      <p class="text-sm mt-2" [attr.role]="consulta().estado === 'error' || consulta().estado === 'incompatible' || consulta().estado === 'incompleto' ? 'alert' : 'status'">{{ consulta().mensaje }}</p>
      @if (consulta().estado === 'disponible' && consulta().datos; as receipt) {
        <dl class="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <div><dt class="text-muted-foreground">Recepción · ID</dt><dd class="font-mono">{{ receipt.recepcionId }}</dd></div>
          <div><dt class="text-muted-foreground">Fecha de registro</dt><dd>{{ receipt.fechaRecepcion }}</dd></div>
        </dl>
        <p class="text-sm whitespace-pre-wrap mt-3 break-words">{{ receipt.fundamentosAdicionales }}</p>
        <h3 class="text-sm font-semibold mt-3">Archivos de esta recepción</h3>
        @if (receipt.documentos.length) {
          <ul class="text-sm mt-2 space-y-1">@for (doc of receipt.documentos; track doc.id) { <li class="break-words">{{ doc.nombreOriginal }} · ID {{ doc.id }}</li> }</ul>
          <p class="text-xs text-muted-foreground mt-2">Consulte y descargue los archivos desde Documentos del expediente, con la autorización existente.</p>
        } @else { <p class="text-sm mt-2">Recepción sin adjuntos. Los archivos son opcionales.</p> }
        <p class="text-xs text-muted-foreground mt-2">Este registro no acredita entrega, notificación eficaz, firma ni emisión documental.</p>
      }
      @if (consulta().estado === 'error' || consulta().estado === 'incompatible' || consulta().estado === 'incompleto' || consulta().estado === 'ausente') {
        <button type="button" class="btn-ghost-brand mt-3" (click)="reintentar.emit()">Volver a consultar el contexto</button>
      }
    </section>
  `,
})
export class RecepcionInstitucionalComponent {
  readonly consulta = input.required<ConsultaRecepcion>();
  readonly reintentar = output<void>();
}
