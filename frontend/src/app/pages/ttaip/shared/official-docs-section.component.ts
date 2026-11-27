import { MultiFileUploadZoneComponent } from '../../../shared/multi-file-upload-zone.component';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  signal,
  inject,
  Injector,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentoPreparado, errorActuacion, EtapaActuacion, TtaipActuacionesService } from '../../../services/ttaip-actuaciones.service';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../../shared/document-preview-modal.component';
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
  clave?: string;
  numeroPropio?: string;
  preparado?: DocumentoPreparado;
  estado: EntryEstado;
  asunto?: string;
  destinatarioNombre?: string;
  isAutoAdded?: boolean;
}

@Component({
  selector: 'app-official-docs-section',
  standalone: true,
  imports: [
    MultiFileUploadZoneComponent,
    CommonModule,
    FormsModule,
    LucideGavel,
    LucideMail,
    LucideFileText,
    LucideDownload,
    LucideTrash2,
    LucidePlus,
    DocumentPreviewModalComponent,
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
        @if (busy()) { <p role="status" class="text-sm">Comprobando documentos oficiales…</p> }
        @if (requiereConsulta()) {
          <button type="button" class="btn-ghost-brand" (click)="consultar()">Consultar documentos oficiales</button>
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
                } @else if (entry.tipo === 'resolucion' || entry.tipo === 'cedula') {
                  <div class="text-[11px] text-muted-foreground mt-0.5">Número pendiente de reserva</div>
                }
              </div>

              @if (entry.estado === 'borrador' && !entry.isAutoAdded && !entry.preparado) {
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

            @if (entry.tipo === 'resolucion' && !entry.numeroCompleto) {
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
              @if (!entry.numeroCompleto && (entry.tipo === 'resolucion' || entry.tipo === 'cedula')) {
                <button type="button" (click)="guardar(entry)" [disabled]="!expedienteId || !decisionBackend || busy() || requiereConsulta() || (entry.tipo === 'resolucion' && !entry.sala)"
                  class="btn-brand !py-1.5 !px-3 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">Reservar N.°</button>
              }
              @if (entry.tipo === 'oficio' || entry.tipo === 'carta') {
                <label class="text-sm">Número propio
                  <input class="field-input" maxlength="120" [ngModel]="entry.numeroPropio || ''"
                    (ngModelChange)="actualizarNumero(entry, $event)" />
                </label>
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
              @if (expedienteId && (entry.numeroCompleto || entry.numeroPropio?.trim())) {
                @if (entry.preparado?.archivo && entry.preparado.decision === decisionBackend) {
                  <button type="button" class="btn-brand !py-1.5 !px-3 !text-[13px]" (click)="verFirmado(entry)">Ver {{ getTipoLabel(entry.tipo).toLowerCase() }} {{ entry.tipo === 'oficio' ? 'firmado' : 'firmada' }}</button>
                }

              }
              @if (entry.preparado?.archivo && entry.preparado.decision !== decisionBackend) {
                <p class="text-xs text-muted-foreground">Cargue el archivo firmado correspondiente a la decisión seleccionada.</p>
              }
            </div>
            @if (expedienteId && (entry.numeroCompleto || entry.numeroPropio?.trim())) {
              <app-multi-file-upload-zone #firmado [single]="true" [pdfOnly]="true" [keyboardAccessible]="true"
                [disabled]="!decisionBackend || busy() || requiereConsulta()"
                [label]="entry.tipo === 'resolucion' ? 'Resolución firmada' : entry.tipo === 'cedula' ? 'Cédula firmada' : 'Documento firmado'" />
              @if (firmado.files()[0]; as archivo) {
                <button type="button" class="btn-brand" [disabled]="!decisionBackend || busy() || requiereConsulta()"
                  (click)="guardar(entry, archivo, firmado)">
                  Subir {{ entry.tipo === 'resolucion' ? 'resolución firmada' : entry.tipo === 'cedula' ? 'cédula firmada' : 'documento firmado' }}
                </button>
              }
            }
          </div>
        }

        <div class="rounded-lg p-3 flex flex-wrap items-end gap-3" style="background: var(--muted); border: 1px dashed var(--border)">
          <label class="flex flex-col gap-1 min-w-[200px] flex-1">
            <span class="eyebrow">Documento</span>
            <select class="field-input !py-2 !text-[13px]" [ngModel]="pickTipo()" (ngModelChange)="elegirTipo($event)" name="documento-oficial">
              <option value="">Seleccione un documento…</option>
              <option value="carta">Carta</option>
              <option value="oficio">Oficio</option>
            </select>
          </label>
          <button type="button" (click)="agregarSeleccionado()" [disabled]="!puedeAgregar()"
            class="btn-brand !py-2 !px-3 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
            <svg lucidePlus class="w-4 h-4"></svg>
            Agregar
          </button>
        </div>
      </div>
    </section>
    @if (preview(); as documento) {
      <app-document-preview-modal [open]="true" [doc]="documento" [manageFocus]="true" (close)="preview.set(null)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialDocsSectionComponent implements OnInit, OnChanges {
  @Input({ required: true }) expediente = '';
  @Input({ required: true }) stage: OfficialStage = 'primera';
  @Input() decision: string | null | undefined = null;
  @Input() ctx: Partial<DocContext> = {};
  @Input() considerando = "";
  @Input() expedienteId?: number | null;
  @Input() decisionBackend?: string | null;
  private readonly injector = inject(Injector);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false);
  readonly requiereConsulta = signal(false);
  readonly preview = signal<DocumentPreviewTarget | null>(null);
  private registrados: DocumentoPreparado[] = [];

  private get etapa(): EtapaActuacion {
    if (this.decisionBackend === 'TENER_POR_NO_PRESENTADO') return 'PRIMERA_CALIFICACION';
    return this.stage === 'primera' ? 'PRIMERA_CALIFICACION' : this.stage === 'segunda' ? 'SEGUNDA_CALIFICACION' : 'RESOLUCION_FINAL';
  }

  private get api() { return this.injector.get(TtaipActuacionesService); }

  documentosListos(): boolean {
    return !this.expedienteId || (!!this.decisionBackend && !this.busy() && !this.requiereConsulta()
      && this.entries().every(e => e.preparado?.archivo && e.preparado.decision === this.decisionBackend));
  }

  consultar(): void {
    const id = this.expedienteId, etapa = this.etapa;
    if (!id) { this.busy.set(false); return; }
    this.busy.set(true);
    this.draftError.set('');
    this.api.documentos(id, etapa).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: documentos => {
        if (id !== this.expedienteId || etapa !== this.etapa) return;
        this.registrados = documentos;
        this.aplicarPreparados();
        this.requiereConsulta.set(false);
        this.busy.set(false);
      },
      error: () => {
        if (id !== this.expedienteId || etapa !== this.etapa) return;
        this.busy.set(false);
        this.requiereConsulta.set(true);
        this.draftError.set('No se pudieron consultar los documentos oficiales.');
      },
    });
  }

  guardar(entry: DocEntry, archivo?: File, selector?: MultiFileUploadZoneComponent): void {
    const id = this.expedienteId, etapa = this.etapa, decision = this.decisionBackend;
    if (!id || !decision || this.busy() || this.requiereConsulta() || !this.entries().includes(entry)) return;
    const clave = this.clave(entry);
    const sala = entry.sala === 'primera_sala' ? 'PRIMERA SALA' : entry.sala === 'segunda_sala' ? 'SEGUNDA SALA' : undefined;
    this.busy.set(true);
    this.draftError.set('');
    this.api.preparar(id, etapa, clave, decision, sala, entry.numeroPropio, archivo)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: preparado => {
          if (id !== this.expedienteId || etapa !== this.etapa) return;
          this.registrados = [...this.registrados.filter(d => d.clave !== clave), preparado];
          this.aplicarPreparados();
          selector?.files.set([]);
          this.busy.set(false);
        },
        error: e => {
          if (id !== this.expedienteId || etapa !== this.etapa) return;
          this.requiereConsulta.set(true);
          this.busy.set(false);
          this.draftError.set(errorActuacion(e, 'Consulte los documentos oficiales para verificar si se guardó la operación.'));
        },
      });
  }

  actualizarNumero(entry: DocEntry, valor: string): void {
    this.entries.update(entries => entries.map(e => e === entry ? { ...e, numeroPropio: valor } : e));
  }

  verFirmado(entry: DocEntry): void {
    const doc = entry.preparado?.archivo;
    if (doc?.id) this.preview.set({ id: doc.id, nombre: doc.nombreOriginal || 'Documento firmado', tipo: doc.contentType });
  }

  private clave(entry: DocEntry): string {
    if (entry.tipo === 'resolucion') return 'RESOLUCION';
    if (entry.tipo === 'cedula') return entry.destinatario === 'entidad' ? 'ENTIDAD_PUBLICA' : 'CIUDADANO';
    return entry.clave!;
  }

  private aplicarPreparados(): void {
    const entradas = [...this.entries()];
    for (const preparado of this.registrados) {
      if (entradas.some(e => this.clave(e) === preparado.clave)) continue;
      if (!preparado.clave.startsWith('CARTA-') && !preparado.clave.startsWith('OFICIO-')) continue;
      entradas.push({
        localId: this.generarId(), clave: preparado.clave, estado: 'borrador',
        tipo: preparado.clave.startsWith('CARTA-') ? 'carta' : 'oficio', numeroPropio: preparado.numero ?? undefined,
      });
    }
    this.entries.set(entradas.map(entry => {
      const preparado = this.registrados.find(d => d.clave === this.clave(entry));
      if (!preparado) return entry;
      const sala = preparado.sala === 'PRIMERA SALA' ? 'primera_sala'
        : preparado.sala === 'SEGUNDA SALA' ? 'segunda_sala' : entry.sala;
      return { ...entry, preparado, sala, numeroCompleto: preparado.numero ?? undefined };
    }));
  }

  readonly salas = [
    { id: 'primera_sala' as const, label: 'Primera Sala' },
    { id: 'segunda_sala' as const, label: 'Segunda Sala' },
  ];
  readonly pickTipo = signal<'' | 'carta' | 'oficio'>('');
  readonly entries = signal<DocEntry[]>([]);
  readonly draftError = signal('');

  addFormAsunto = '';
  addFormDestinatario = '';

  ngOnInit(): void {
    if (!this.entries().length) this.rebuildDefaultEntries();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.draftError.set('');
    if (changes['expediente'] || changes['stage'] || changes['expedienteId']
        || (changes['decisionBackend'] && [changes['decisionBackend'].previousValue, changes['decisionBackend'].currentValue]
          .includes('TENER_POR_NO_PRESENTADO'))) {
      this.registrados = [];
      this.requiereConsulta.set(false);
      this.preview.set(null);
      this.addFormAsunto = '';
      this.addFormDestinatario = '';
      this.pickTipo.set('');
      this.rebuildDefaultEntries();
      this.consultar();
    } else if (changes['decision']) {
      this.syncEntriesWithDecision();
      this.aplicarPreparados();
    }
  }

  seleccionarSala(localId: string, sala: 'primera_sala' | 'segunda_sala'): void {
    this.entries.update((list) => list.map((entry) => entry.localId === localId ? { ...entry, sala } : entry));
  }

  elegirTipo(valor: string): void {
    this.pickTipo.set(valor === 'carta' || valor === 'oficio' ? valor : '');
  }

  puedeAgregar(): boolean {
    return !!this.pickTipo();
  }

  agregarSeleccionado(): void {
    const tipo = this.pickTipo();
    if (!tipo) return;
    this.entries.update(list => [...list, {
      localId: this.generarId(), clave: tipo.toUpperCase() + '-' + crypto.randomUUID(),
      tipo, destinatario: 'general', estado: 'borrador',
    }]);
    this.pickTipo.set('');
  }

  eliminarEntry(localId: string): void {
    this.entries.update(entries => entries.filter(e => e.localId !== localId || !!e.preparado || !!e.isAutoAdded));
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
      resolucionNro: this.entries().find(e => e.tipo === 'resolucion')?.numeroCompleto?.replace(/^RESOLUCIÓN N.° /, ''),
      cedulaNro: entry.tipo === 'cedula' ? entry.numeroCompleto : undefined,
      numeroDocumento: entry.tipo === 'carta' || entry.tipo === 'oficio' ? entry.numeroPropio || entry.numeroCompleto : undefined,
      sala: entry.sala,
      considerando: this.considerando?.trim(),
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
