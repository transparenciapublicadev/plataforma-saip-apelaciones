import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideGavel,
  LucideMail,
  LucideFileText,
  LucideDownload,
  LucideTrash2,
  LucidePlus,
} from '@lucide/angular';
import {
  DocContext,
  OfficialStage,
  buildDocWord,
  cedulaPdf,
  cedulaVariantForStage,
  downloadBlob,
  recipientsForResolution,
  resolucionPdf,
  cartaOficioPdf,
} from './official-docs.util';

export type EntryEstado = 'borrador';

export interface DocEntry {
  localId: string;
  tipo: 'resolucion' | 'cedula' | 'carta' | 'oficio';
  sala?: 'primera_sala' | 'segunda_sala';
  destinatario?: 'recurrente' | 'entidad' | 'general';
  numeroCompleto?: string;
  estado: EntryEstado;
  asunto?: string;
  destinatarioNombre?: string;
  isAutoAdded?: boolean;
}

@Component({
  selector: 'app-official-docs-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideGavel,
    LucideMail,
    LucideFileText,
    LucideDownload,
    LucideTrash2,
    LucidePlus,
  ],
  template: `
    <section class="form-shell">
      <div class="form-section-header">
        <span class="eyebrow">Documentos oficiales</span>
        <h2 class="form-section-title">Numeración y archivo</h2>
      </div>

      <div class="p-5 space-y-3">
        @if (draftError()) {
          <p role="alert" class="text-sm" style="color: var(--danger)">{{ draftError() }}</p>
        }
        @if (entries().length === 0) {
          <div
            class="rounded-md p-3 text-sm text-muted-foreground"
            style="background: var(--muted); border: 1px dashed var(--border)"
          >
            Aún no hay documentos. Elija un documento en la lista y presione «Agregar» para preparar su borrador.
          </div>
        }

        @for (entry of entries(); track entry.localId) {
          <div
            class="rounded-lg p-4 space-y-3"
            [style.background]="'var(--card)'"
            [style.border]="'1px solid var(--border)'"
            [style.borderLeft]="'3px solid ' + getTipoColor(entry.tipo)"
          >
            <!-- Header row -->
            <div class="flex items-center gap-3 flex-wrap">
              <div
                class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                [style.background]="getTipoIconBg(entry.tipo)"
                [style.border]="'1px solid ' + getTipoColor(entry.tipo)"
              >
                @switch (entry.tipo) {
                  @case ('resolucion') {
                    <svg lucideGavel class="w-4 h-4" [style.color]="getTipoColor(entry.tipo)"></svg>
                  }
                  @case ('cedula') {
                    <svg lucideMail class="w-4 h-4" [style.color]="getTipoColor(entry.tipo)"></svg>
                  }
                  @default {
                    <svg lucideFileText class="w-4 h-4" [style.color]="getTipoColor(entry.tipo)"></svg>
                  }
                }
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold">{{ getTipoLabel(entry.tipo) }}</span>
                  @if (entry.destinatario && entry.tipo === 'cedula') {
                    <span
                      class="text-[11px] px-1.5 py-0.5 rounded"
                      style="background: var(--muted); color: var(--muted-foreground)"
                    >
                      {{ entry.destinatario === 'recurrente' ? 'Administrado' : 'Entidad' }}
                    </span>
                  }
                </div>

                @if (entry.numeroCompleto) {
                  <div class="font-mono text-[11px] text-muted-foreground mt-0.5">{{ entry.numeroCompleto }}</div>
                } @else {
                  <div class="text-[11px] text-muted-foreground mt-0.5">Número pendiente de reserva</div>
                }
              </div>

              @if (entry.estado === 'borrador' && !entry.isAutoAdded) {
                <button
                  type="button"
                  (click)="eliminarEntry(entry.localId)"
                  class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[color:var(--muted)]"
                  style="border: 1px solid var(--border)"
                  title="Eliminar"
                >
                  <svg lucideTrash2 class="w-3.5 h-3.5 text-muted-foreground"></svg>
                </button>
              }
            </div>

            @if (entry.tipo === 'resolucion' && entry.estado === 'borrador') {
              <div class="space-y-1.5">
                <span class="eyebrow">Sala colegiada <span style="color: var(--brand-600)">*</span></span>
                <div class="flex gap-2">
                  @for (sala of salas; track sala.id) {
                    <button
                      type="button"
                      (click)="seleccionarSala(entry.localId, sala.id)"
                      class="flex-1 rounded-md py-2 text-[13px] font-medium transition-all"
                      [style.background]="entry.sala === sala.id ? 'var(--brand-subtle)' : 'var(--card)'"
                      [style.border]="'1.5px solid ' + (entry.sala === sala.id ? 'var(--brand-700)' : 'var(--border)')"
                      [style.color]="entry.sala === sala.id ? 'var(--brand-700)' : 'var(--muted-foreground)'"
                    >{{ sala.label }}</button>
                  }
                </div>
              </div>
            }

            <div class="flex items-center gap-2 flex-wrap">
              @if (!entry.numeroCompleto) {
                <button type="button" disabled title="La reserva del correlativo requiere la operación documental persistida"
                  class="btn-brand !py-1.5 !px-3 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">Reservar N.°</button>
              }
              <button type="button" (click)="descargarPdf(entry)"
                class="btn-ghost-brand !py-1.5 !px-3 !text-[13px] inline-flex items-center gap-1.5"
                title="Descargar PDF">
                <svg lucideDownload class="w-3.5 h-3.5"></svg> PDF
              </button>
              <button type="button" (click)="descargarWord(entry)"
                class="btn-ghost-brand !py-1.5 !px-3 !text-[13px] inline-flex items-center gap-1.5"
                title="Descargar formato Word editable">
                <svg lucideFileText class="w-3.5 h-3.5"></svg> Word
              </button>
            </div>
          </div>
        }

        <div class="rounded-lg p-3 flex flex-wrap items-end gap-3" style="background: var(--muted); border: 1px dashed var(--border)">
          <label class="flex flex-col gap-1 min-w-[200px] flex-1">
            <span class="eyebrow">Documento</span>
            <select class="field-input !py-2 !text-[13px]" [ngModel]="pickTipo()" (ngModelChange)="elegirTipo($event)" name="documento-oficial">
              <option value="">Seleccione un documento…</option>
              <option value="resolucion">Resolución</option>
              <option value="cedula_recurrente">Cédula — Administrado</option>
              @if (!esInadmisible()) { <option value="cedula_entidad">Cédula — Entidad</option> }
              <option value="carta">Carta</option>
              <option value="oficio">Oficio</option>
            </select>
          </label>
          @if (pickTipo() === 'resolucion') {
            <label class="flex flex-col gap-1 min-w-[160px]">
              <span class="eyebrow">Sala <span style="color: var(--brand-600)">*</span></span>
              <select class="field-input !py-2 !text-[13px]" [ngModel]="pickSala()" (ngModelChange)="elegirSala($event)" name="sala-oficial">
                <option value="">Seleccione…</option>
                <option value="primera_sala">Primera Sala</option>
                <option value="segunda_sala">Segunda Sala</option>
              </select>
            </label>
          }
          <button type="button" (click)="agregarSeleccionado()" [disabled]="!puedeAgregar()"
            class="btn-brand !py-2 !px-3 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
            <svg lucidePlus class="w-4 h-4"></svg>
            Agregar
          </button>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialDocsSectionComponent implements OnInit, OnChanges {
  @Input({ required: true }) expediente = '';
  @Input({ required: true }) stage: OfficialStage = 'primera';
  @Input() decision: string | null | undefined = null;
  @Input() ctx: Partial<DocContext> = {};

  readonly salas = [
    { id: 'primera_sala' as const, label: 'Primera Sala' },
    { id: 'segunda_sala' as const, label: 'Segunda Sala' },
  ];
  readonly pickTipo = signal<'' | 'resolucion' | 'cedula_recurrente' | 'cedula_entidad' | 'carta' | 'oficio'>('');
  readonly pickSala = signal<'' | 'primera_sala' | 'segunda_sala'>('');
  readonly entries = signal<DocEntry[]>([]);
  readonly draftError = signal('');

  addFormAsunto = '';
  addFormDestinatario = '';

  ngOnInit(): void {
    this.rebuildDefaultEntries();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.draftError.set('');
    if (changes['expediente'] || changes['stage']) {
      this.addFormAsunto = '';
      this.addFormDestinatario = '';
      this.pickTipo.set('');
      this.pickSala.set('');
      this.rebuildDefaultEntries();
    } else if (changes['decision']) {
      this.syncEntriesWithDecision();
    }
  }

  seleccionarSala(localId: string, sala: 'primera_sala' | 'segunda_sala'): void {
    this.entries.update((list) => list.map((entry) => entry.localId === localId ? { ...entry, sala } : entry));
  }

  elegirTipo(valor: string): void {
    const tipo = valor === 'resolucion' || valor === 'cedula_recurrente' || valor === 'cedula_entidad' || valor === 'carta' || valor === 'oficio' ? valor : '';
    this.pickTipo.set(tipo);
    this.pickSala.set('');
  }

  elegirSala(valor: string): void {
    this.pickSala.set(valor === 'primera_sala' || valor === 'segunda_sala' ? valor : '');
  }

  puedeAgregar(): boolean {
    const tipo = this.pickTipo();
    if (tipo === 'resolucion') return this.pickSala() !== '' && !this.tieneResolucion();
    if (tipo === 'cedula_recurrente') return !this.tieneCedulaRecurrente();
    if (tipo === 'cedula_entidad') return !this.esInadmisible() && !this.tieneCedulaEntidad();
    return tipo === 'carta' || tipo === 'oficio';
  }

  agregarSeleccionado(): void {
    if (!this.puedeAgregar()) return;
    const tipo = this.pickTipo();
    if (tipo === 'resolucion') {
      const sala = this.pickSala();
      if (sala !== 'primera_sala' && sala !== 'segunda_sala') return;
      this.entries.update((list) => [...list, {
        localId: this.generarId(), tipo: 'resolucion', sala, estado: 'borrador', isAutoAdded: false,
      }]);
    } else if (tipo === 'cedula_recurrente') {
      this.agregarCedulaManual('recurrente');
    } else if (tipo === 'cedula_entidad') {
      this.agregarCedulaManual('entidad');
    } else if (tipo === 'carta' || tipo === 'oficio') {
      this.entries.update((list) => [...list, {
        localId: this.generarId(), tipo, destinatario: 'general', estado: 'borrador',
      }]);
    }
    this.pickTipo.set('');
    this.pickSala.set('');
  }

  eliminarEntry(localId: string): void {
    this.entries.set(this.entries().filter((e) => e.localId !== localId));
  }

  agregarCedulaManual(destinatario: 'recurrente' | 'entidad'): void {
    this.entries.update((p) => [
      ...p,
      {
        localId: this.generarId(),
        tipo: 'cedula',
        destinatario,
        estado: 'borrador',
        isAutoAdded: false,
      },
    ]);
  }

  descargarPdf(entry: DocEntry): void {
    this.downloadDraft(entry, () => {
      const ctx = this.buildEntryContext(entry);
      if (entry.tipo === 'resolucion') {
        resolucionPdf('download', this.stage, this.decision || undefined, ctx);
      } else if (entry.tipo === 'cedula') {
        cedulaPdf('download', cedulaVariantForStage(this.stage, this.decision || undefined),
          entry.destinatario === 'entidad' ? 'entidad' : 'recurrente', this.stage, ctx);
      } else {
        cartaOficioPdf('download', entry.tipo, ctx);
      }
    });
  }

  descargarWord(entry: DocEntry): void {
    this.downloadDraft(entry, () => {
      const { blob, filename } = buildDocWord(entry.tipo, this.stage, this.decision || undefined,
        this.buildEntryContext(entry), entry.destinatario === 'entidad' ? 'entidad' : 'recurrente');
      downloadBlob(blob, filename);
    });
  }

  private downloadDraft(entry: DocEntry, action: () => void): void {
    this.draftError.set('');
    if (!this.expediente.trim() || !this.entries().includes(entry)
        || (this.ctx.expediente && this.ctx.expediente !== this.expediente)) {
      this.draftError.set('No se puede preparar el borrador: compruebe el expediente seleccionado.');
      return;
    }
    try {
      action();
    } catch {
      this.draftError.set('No se pudo descargar el borrador. Reintente. No se ha emitido ningún documento.');
    }
  }

  esInadmisible(): boolean {
    const d = (this.decision || '').toLowerCase();
    return (this.stage === 'primera' || this.stage === 'segunda') && d.startsWith('inadm');
  }

  tieneResolucion(): boolean {
    return this.entries().some((e) => e.tipo === 'resolucion');
  }

  tieneCedulaRecurrente(): boolean {
    return this.entries().some((e) => e.tipo === 'cedula' && e.destinatario === 'recurrente');
  }

  tieneCedulaEntidad(): boolean {
    return this.entries().some((e) => e.tipo === 'cedula' && e.destinatario === 'entidad');
  }

  private rebuildDefaultEntries(): void {
    const recipients = recipientsForResolution(this.stage, this.decision || undefined);
    const list: DocEntry[] = [
      {
        localId: this.generarId(),
        tipo: 'resolucion',
        estado: 'borrador',
        isAutoAdded: true,
      },
      {
        localId: this.generarId(),
        tipo: 'cedula',
        destinatario: 'recurrente',
        estado: 'borrador',
        isAutoAdded: true,
      },
    ];
    if (recipients.includes('entidad')) {
      list.push({
        localId: this.generarId(),
        tipo: 'cedula',
        destinatario: 'entidad',
        estado: 'borrador',
        isAutoAdded: true,
      });
    }
    this.entries.set(list);
  }

  private syncEntriesWithDecision(): void {
    const current = this.entries();
    const recipients = recipientsForResolution(this.stage, this.decision || undefined);
    let next = [...current];

    if (!next.some((e) => e.tipo === 'resolucion')) {
      next.unshift({
        localId: this.generarId(),
        tipo: 'resolucion',
        estado: 'borrador',
        isAutoAdded: true,
      });
    }

    if (recipients.includes('recurrente') && !next.some((e) => e.tipo === 'cedula' && e.destinatario === 'recurrente')) {
      next.push({
        localId: this.generarId(),
        tipo: 'cedula',
        destinatario: 'recurrente',
        estado: 'borrador',
        isAutoAdded: true,
      });
    }

    if (recipients.includes('entidad')) {
      if (!next.some((e) => e.tipo === 'cedula' && e.destinatario === 'entidad')) {
        next.push({
          localId: this.generarId(),
          tipo: 'cedula',
          destinatario: 'entidad',
          estado: 'borrador',
          isAutoAdded: true,
        });
      }
    } else {
      // Suprimir cédula entidad (DISC-11)
      next = next.filter(
        (e) => !(e.tipo === 'cedula' && e.destinatario === 'entidad' && e.estado === 'borrador')
      );
    }

    this.entries.set(next);
  }

  private buildEntryContext(entry: DocEntry): Partial<DocContext> {
    return {
      ...this.ctx,
      expediente: this.expediente,
      // No registered numbers are assigned to a new draft or another document type.
      resolucionNro: undefined,
      cedulaNro: undefined,
      sala: entry.sala,
      sumilla: entry.asunto || this.ctx.sumilla,
      destinatarioDocumento: entry.destinatarioNombre,
    };
  }

  getTipoColor(tipo: DocEntry['tipo']): string {
    switch (tipo) {
      case 'resolucion':
        return 'var(--brand-700)';
      case 'cedula':
        return 'var(--gold-dark)';
      default:
        return 'var(--info)';
    }
  }

  getTipoIconBg(tipo: DocEntry['tipo']): string {
    switch (tipo) {
      case 'resolucion':
        return 'rgba(139,26,26,0.12)';
      case 'cedula':
        return 'rgba(176,136,66,0.12)';
      default:
        return 'rgba(29,78,216,0.12)';
    }
  }

  getTipoLabel(tipo: DocEntry['tipo']): string {
    switch (tipo) {
      case 'resolucion':
        return 'Resolución';
      case 'cedula':
        return 'Cédula';
      case 'carta':
        return 'Carta';
      case 'oficio':
        return 'Oficio';
    }
  }

  getEstadoLabel(_estado: EntryEstado): string { return 'BORRADOR'; }
  getEstadoColor(_estado: EntryEstado): string { return 'var(--muted-foreground)'; }
  getEstadoBadgeBg(_estado: EntryEstado): string { return 'rgba(100,116,139,0.12)'; }

  private generarId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}
