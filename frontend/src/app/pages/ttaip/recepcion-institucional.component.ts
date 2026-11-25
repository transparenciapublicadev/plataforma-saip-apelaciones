import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DocumentListComponent } from '../../shared/document-list.component';
import { ConsultaRecepcion } from './recepcion-institucional.model';

@Component({
  selector: 'app-recepcion-institucional',
  imports: [DocumentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="institutional-receipt-title" [attr.aria-busy]="consulta().estado === 'cargando'">
      <h2 id="institutional-receipt-title" class="eyebrow">Recepción de subsanación</h2>
      <p class="text-sm mt-2" [attr.role]="consulta().estado === 'error' || consulta().estado === 'incompatible' || consulta().estado === 'incompleto' ? 'alert' : 'status'">{{ consulta().mensaje }}</p>
      @if (consulta().estado === 'disponible' && consulta().datos; as receipt) {
        <dl class="text-sm mt-4">
          <dt class="text-muted-foreground">Fecha de registro</dt>
          <dd class="font-medium mt-0.5">{{ fechaLegible(receipt.fechaRecepcion) }}</dd>
        </dl>
        <p class="text-sm whitespace-pre-wrap mt-4 break-words leading-relaxed">{{ receipt.fundamentosAdicionales }}</p>
        <h3 class="text-sm font-semibold mt-5">Escrito enviado por el administrado</h3>
        @if (receipt.documentos.length) {
          <div class="mt-3">
            <app-document-list [documents]="receipt.documentos" [readOnly]="true" emptyMessage="Recepción sin adjuntos. Los archivos son opcionales." />
          </div>
        } @else {
          <p class="text-sm mt-2">Recepción sin adjuntos. Los archivos son opcionales.</p>
        }
        <p class="text-xs text-muted-foreground mt-3">Este registro no acredita entrega, notificación eficaz, firma ni emisión documental.</p>
      }
      @if (consulta().estado === 'ausente') {
        <p class="text-xs text-muted-foreground mt-2">Admisible e improcedente no usan este escrito. Inadmisible lo espera: si el administrado aún no lo presenta, la consulta queda así hasta que llegue.</p>
        <button type="button" class="btn-ghost-brand mt-3" (click)="reintentar.emit()">Actualizar consulta</button>
      }
      @if (consulta().estado === 'error' || consulta().estado === 'incompatible' || consulta().estado === 'incompleto') {
        <button type="button" class="btn-ghost-brand mt-3" (click)="reintentar.emit()">Volver a consultar el contexto</button>
      }
    </section>
  `,
})
export class RecepcionInstitucionalComponent {
  readonly consulta = input.required<ConsultaRecepcion>();
  readonly reintentar = output<void>();

  fechaLegible(valor: string | null | undefined): string {
    const normalizada = (valor || '').trim().replace(/(\.\d{3})\d+/, '$1');
    if (!normalizada || Number.isNaN(Date.parse(normalizada))) return 'Fecha no registrada';
    const fecha = new Date(normalizada);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const hora = String(fecha.getHours()).padStart(2, '0');
    const minuto = String(fecha.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${fecha.getFullYear()}, ${hora}:${minuto}`;
  }
}
