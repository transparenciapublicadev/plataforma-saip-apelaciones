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
  LucideX,
  LucideArrowLeft,
  LucideChevronRight,
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
    LucideX,
    LucideArrowLeft,
    LucideChevronRight,
  ],
  template: `
    <section class="form-shell">
      <div class="form-section-header">
        <span class="eyebrow">Plantillas documentales</span>
        <h2 class="form-section-title">Borradores para revisión</h2>
      </div>

      <div class="p-5 space-y-3">
        <p id="emision-no-disponible" role="note" class="text-sm text-muted-foreground">
          Borradores locales sin emisión ni firma verificada. Reservar numeración, emitir y archivar
          una versión final no está disponible: falta una operación documental persistida y verificable.
          Los archivos registrados se consultan en los documentos de cada resolución o cédula.
        </p>
        @if (draftError()) {
          <p role="alert" class="text-sm" style="color: var(--danger)">{{ draftError() }}</p>
        }
        @if (entries().length === 0) {
          <div
            class="rounded-md p-3 text-sm text-muted-foreground"
            style="background: var(--muted); border: 1px dashed var(--border)"
          >
            Seleccione una decisión para que se preparen borradores de cédula, o agregue
            documentos manualmente.
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
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-widest font-semibold"
                    [style.background]="getEstadoBadgeBg(entry.estado)"
                    [style.color]="getEstadoColor(entry.estado)"
                  >
                    {{ getEstadoLabel(entry.estado) }}
                  </span>
                </div>

                <div class="text-[11px] text-muted-foreground mt-0.5">Sin numeración oficial asignada</div>
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

            <!-- Selector de Sala colegiada (solo en resolución pendiente) -->
            @if (entry.tipo === 'resolucion' && entry.estado === 'borrador') {
              <div class="space-y-1.5">
                <span class="eyebrow">Sala del borrador (selección local)</span>
                <div class="flex gap-2">
                  <button
                    type="button"
                    (click)="seleccionarSala('primera_sala')"
                    class="flex-1 rounded-md py-2 text-[13px] font-medium transition-all"
                    [style.background]="
                      selectedSala() === 'primera_sala' ? 'var(--brand-subtle)' : 'var(--card)'
                    "
                    [style.border]="
                      '1.5px solid ' +
                      (selectedSala() === 'primera_sala' ? 'var(--brand-700)' : 'var(--border)')
                    "
                    [style.color]="
                      selectedSala() === 'primera_sala'
                        ? 'var(--brand-700)'
                        : 'var(--muted-foreground)'
                    "
                  >
                    Primera Sala
                  </button>

                  <button
                    type="button"
                    (click)="seleccionarSala('segunda_sala')"
                    class="flex-1 rounded-md py-2 text-[13px] font-medium transition-all"
                    [style.background]="
                      selectedSala() === 'segunda_sala' ? 'var(--brand-subtle)' : 'var(--card)'
                    "
                    [style.border]="
                      '1.5px solid ' +
                      (selectedSala() === 'segunda_sala' ? 'var(--brand-700)' : 'var(--border)')
                    "
                    [style.color]="
                      selectedSala() === 'segunda_sala'
                        ? 'var(--brand-700)'
                        : 'var(--muted-foreground)'
                    "
                  >
                    Segunda Sala
                  </button>
                </div>
              </div>
            }

            <div class="flex items-center gap-2 flex-wrap pt-1">
              <button type="button" disabled aria-describedby="emision-no-disponible"
                class="btn-brand !py-1.5 !px-3 !text-[13px] disabled:opacity-50">Reservar N.°</button>
              <button type="button" (click)="descargarPdf(entry)"
                class="btn-ghost-brand !py-1.5 !px-3 !text-[13px] inline-flex items-center gap-1.5"
                title="Descargar borrador PDF sin emisión ni firma verificada">
                <svg lucideDownload class="w-3.5 h-3.5"></svg> PDF borrador
              </button>
              <button type="button" (click)="descargarWord(entry)"
                class="btn-ghost-brand !py-1.5 !px-3 !text-[13px] inline-flex items-center gap-1.5"
                title="Descargar borrador Word editable">
                <svg lucideFileText class="w-3.5 h-3.5"></svg> Word borrador
              </button>
              <button type="button" disabled aria-describedby="emision-no-disponible"
                class="btn-brand !py-1.5 !px-3 !text-[13px] disabled:opacity-50">Emitir</button>
            </div>
          </div>
        }

        <!-- Botón para modal Agregar borrador -->
        <button
          type="button"
          (click)="abrirAddModal()"
          class="btn-ghost-brand !py-2 !text-[13px] w-full justify-center inline-flex items-center gap-1.5"
        >
          <svg lucidePlus class="w-4 h-4"></svg>
          Agregar borrador
        </button>
      </div>
    </section>

    <!-- Modal "Agregar borrador" -->
    @if (showAddModal()) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
        (click)="cerrarAddModal()"
      >
        <div
          class="w-full max-w-sm rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
          style="
            background: var(--card);
            border: 1px solid var(--border);
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          "
          (click)="$event.stopPropagation()"
        >
          <!-- Header Modal -->
          <div
            class="flex items-center justify-between gap-3 px-5 py-4 border-b"
            style="border-color: var(--border)"
          >
            <div class="flex items-center gap-2.5">
              @if (addModalStep() !== 'select') {
                <button
                  type="button"
                  (click)="addModalStep.set('select')"
                  class="w-7 h-7 rounded-md flex items-center justify-center"
                  style="border: 1px solid var(--border)"
                  title="Volver"
                >
                  <svg lucideArrowLeft class="w-3.5 h-3.5"></svg>
                </button>
              }
              <span class="text-sm font-semibold">
                {{
                  addModalStep() === 'select'
                    ? 'Agregar borrador'
                    : addModalStep() === 'carta'
                      ? 'Nueva Carta'
                      : 'Nuevo Oficio'
                }}
              </span>
            </div>

            <button
              type="button"
              (click)="cerrarAddModal()"
              class="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[color:var(--muted)]"
              style="border: 1px solid var(--border)"
              title="Cerrar"
            >
              <svg lucideX class="w-3.5 h-3.5"></svg>
            </button>
          </div>

          <!-- Contenido Modal -->
          @if (addModalStep() === 'select') {
            <div class="p-4 space-y-2">
              <button
                type="button"
                [disabled]="tieneResolucion()"
                (click)="agregarResolucionManual()"
                class="w-full rounded-lg p-3.5 text-left flex items-center gap-3 transition-colors hover:bg-[color:var(--muted)] disabled:opacity-50"
                style="background: var(--background); border: 1px solid var(--border)"
              >
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style="background: rgba(139,26,26,0.12); border: 1px solid rgba(139,26,26,0.25)"
                >
                  <svg lucideGavel class="w-4 h-4" style="color: var(--brand-700)"></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">Resolución</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5">
                    {{
                      tieneResolucion()
                        ? 'La resolución ya fue creada'
                        : 'Resolución colegiada del acto'
                    }}
                  </div>
                </div>
                <svg lucideChevronRight class="w-4 h-4 text-muted-foreground"></svg>
              </button>

              <button
                type="button"
                [disabled]="tieneCedulaRecurrente()"
                (click)="agregarCedulaManual('recurrente')"
                class="w-full rounded-lg p-3.5 text-left flex items-center gap-3 transition-colors hover:bg-[color:var(--muted)] disabled:opacity-50"
                style="background: var(--background); border: 1px solid var(--border)"
              >
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style="background: rgba(176,136,66,0.12); border: 1px solid rgba(176,136,66,0.25)"
                >
                  <svg lucideMail class="w-4 h-4" style="color: var(--gold-dark)"></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">Cédula · Administrado</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5">
                    Cédula de notificación al ciudadano recurrente
                  </div>
                </div>
                <svg lucideChevronRight class="w-4 h-4 text-muted-foreground"></svg>
              </button>

              @if (!esInadmisible()) {
                <button
                  type="button"
                  [disabled]="tieneCedulaEntidad()"
                  (click)="agregarCedulaManual('entidad')"
                  class="w-full rounded-lg p-3.5 text-left flex items-center gap-3 transition-colors hover:bg-[color:var(--muted)] disabled:opacity-50"
                  style="background: var(--background); border: 1px solid var(--border)"
                >
                  <div
                    class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style="
                      background: rgba(176,136,66,0.12);
                      border: 1px solid rgba(176,136,66,0.25);
                    "
                  >
                    <svg lucideMail class="w-4 h-4" style="color: var(--gold-dark)"></svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium">Cédula · Entidad</div>
                    <div class="text-[11px] text-muted-foreground mt-0.5">
                      Cédula de notificación a la entidad emplazada
                    </div>
                  </div>
                  <svg lucideChevronRight class="w-4 h-4 text-muted-foreground"></svg>
                </button>
              }

              <button
                type="button"
                (click)="addModalStep.set('carta')"
                class="w-full rounded-lg p-3.5 text-left flex items-center gap-3 transition-colors hover:bg-[color:var(--muted)]"
                style="background: var(--background); border: 1px solid var(--border)"
              >
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style="background: rgba(29,78,216,0.12); border: 1px solid rgba(29,78,216,0.25)"
                >
                  <svg lucideFileText class="w-4 h-4" style="color: var(--info)"></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">Carta</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5">
                    Comunicación complementaria
                  </div>
                </div>
                <svg lucideChevronRight class="w-4 h-4 text-muted-foreground"></svg>
              </button>

              <button
                type="button"
                (click)="addModalStep.set('oficio')"
                class="w-full rounded-lg p-3.5 text-left flex items-center gap-3 transition-colors hover:bg-[color:var(--muted)]"
                style="background: var(--background); border: 1px solid var(--border)"
              >
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style="background: rgba(29,78,216,0.12); border: 1px solid rgba(29,78,216,0.25)"
                >
                  <svg lucideFileText class="w-4 h-4" style="color: var(--info)"></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">Oficio</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5">
                    Requerimiento formal institucional
                  </div>
                </div>
                <svg lucideChevronRight class="w-4 h-4 text-muted-foreground"></svg>
              </button>
            </div>
          } @else {
            <div class="p-4 space-y-3">
              <div class="field">
                <label class="field-label">Asunto <span class="req">*</span></label>
                <input
                  type="text"
                  class="field-input w-full"
                  placeholder="Ej. Solicitud de información complementaria"
                  [(ngModel)]="addFormAsunto"
                />
              </div>

              <div class="field">
                <label class="field-label">Destinatario <span class="req">*</span></label>
                <input
                  type="text"
                  class="field-input w-full"
                  placeholder="Ej. Entidad emplazada / Órgano de Control"
                  [(ngModel)]="addFormDestinatario"
                />
              </div>

              <button
                type="button"
                (click)="confirmarAgregarCartaOficio()"
                class="btn-brand w-full !py-2.5 justify-center mt-2"
              >
                Agregar borrador
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialDocsSectionComponent implements OnInit, OnChanges {
  @Input({ required: true }) expediente = '';
  @Input({ required: true }) stage: OfficialStage = 'primera';
  @Input() decision: string | null | undefined = null;
  @Input() ctx: Partial<DocContext> = {};

  readonly selectedSala = signal<'primera_sala' | 'segunda_sala'>('segunda_sala');
  readonly entries = signal<DocEntry[]>([]);
  readonly draftError = signal('');
  readonly showAddModal = signal<boolean>(false);
  readonly addModalStep = signal<'select' | 'carta' | 'oficio'>('select');

  addFormAsunto = '';
  addFormDestinatario = '';

  ngOnInit(): void {
    this.rebuildDefaultEntries();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.draftError.set('');
    if (changes['expediente'] || changes['stage']) {
      this.cerrarAddModal();
      this.addFormAsunto = '';
      this.addFormDestinatario = '';
      this.selectedSala.set('segunda_sala');
      this.rebuildDefaultEntries();
    } else if (changes['decision']) {
      this.syncEntriesWithDecision();
    }
  }

  seleccionarSala(sala: 'primera_sala' | 'segunda_sala'): void {
    this.selectedSala.set(sala);
  }

  eliminarEntry(localId: string): void {
    this.entries.set(this.entries().filter((e) => e.localId !== localId));
  }

  abrirAddModal(): void {
    this.addModalStep.set('select');
    this.addFormAsunto = '';
    this.addFormDestinatario = '';
    this.showAddModal.set(true);
  }

  cerrarAddModal(): void {
    this.showAddModal.set(false);
  }

  agregarResolucionManual(): void {
    this.entries.update((p) => [
      ...p,
      {
        localId: this.generarId(),
        tipo: 'resolucion',
        sala: this.selectedSala(),
        estado: 'borrador',
        isAutoAdded: false,
      },
    ]);
    this.cerrarAddModal();
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
    this.cerrarAddModal();
  }

  confirmarAgregarCartaOficio(): void {
    if (!this.addFormAsunto.trim() || !this.addFormDestinatario.trim()) return;
    const tipo = this.addModalStep() as 'carta' | 'oficio';
    this.entries.update((p) => [
      ...p,
      {
        localId: this.generarId(),
        tipo,
        destinatario: 'general',
        asunto: this.addFormAsunto.trim(),
        destinatarioNombre: this.addFormDestinatario.trim(),
        estado: 'borrador',
      },
    ]);
    this.cerrarAddModal();
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
        sala: this.selectedSala(),
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
        sala: this.selectedSala(),
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
      sala: this.selectedSala(),
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
        return 'Resolución TTAIP';
      case 'cedula':
        return 'Cédula de Notificación';
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
