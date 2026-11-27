import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BodyPortalDirective } from './body-portal.directive';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  LucideUpload,
  LucideCheckCircle2,
  LucideFileText,
  LucideEye,
  LucideX,
  LucidePlus
} from '@lucide/angular';

export interface MultiFileSlot {
  id: number;
  file: File | null;
  dragging: boolean;
  objectUrl: string | null;
  error?: string | null;
}

@Component({
  selector: 'app-multi-file-upload-zone',
  standalone: true,
  imports: [
    CommonModule,
    BodyPortalDirective,
    LucideUpload,
    LucideCheckCircle2,
    LucideFileText,
    LucideEye,
    LucideX,
    LucidePlus
  ],
  template: `
    <div class="space-y-3">
      <!-- Encabezado con label, asterisco y contador -->
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm font-semibold text-foreground">
          {{ label() }}
          @if (required()) {
            <span class="text-[#D91E18]">*</span>
          }
        </label>
        @if (cargados() > 0) {
          <span class="text-[11px] text-muted-foreground">{{ cargados() }} documento(s) adjunto(s)</span>
        }
      </div>

      @if (description()) {
        <p class="text-sm text-muted-foreground">{{ description() }}</p>
      }

      <!-- Ranuras de archivos (Slots) -->
      <div class="space-y-3">
        @for (slot of slots(); track slot.id; let idx = $index) {
          <div class="relative">
            <div
              (dragover)="handleDragOver($event, slot.id)"
              (dragleave)="handleDragLeave($event, slot.id)"
              (drop)="handleDrop($event, slot.id)"
              class="border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer"
              [style.border-color]="slot.file ? '#059669' : null"
              [class.reference-upload-feedback]="!slot.file"
              [class.is-dragging]="slot.dragging"
              [ngClass]="{
                'border-[var(--brand-600)] bg-[color:var(--brand-subtle)]': slot.dragging,
                'border-border': !slot.dragging && !slot.file,
                'bg-[color:var(--success-soft,rgba(34,197,94,0.10))] border-emerald-300 dark:border-emerald-800': !!slot.file,
                'bg-[color:var(--card)]': !slot.file && !slot.dragging
              }"
              (click)="onSlotClick(slot)"
              [attr.role]="keyboardAccessible() && !slot.file ? 'button' : null"
              [attr.tabindex]="keyboardAccessible() && !slot.file && !disabled() ? 0 : null"
              [attr.aria-disabled]="disabled() ? true : null"
              [attr.aria-label]="keyboardAccessible() && !slot.file ? label() + ': seleccionar archivo ' + (idx + 1) : null"
              (keydown)="onSlotKey($event, slot)"
            >
              @if (!slot.file) {
                <div class="space-y-2">
                  <svg lucideUpload class="w-8 h-8 mx-auto text-muted-foreground"></svg>
                  <p class="text-sm">
                    Arrastra tu archivo aquí o <span class="text-[color:var(--brand-700)] font-medium">haz clic para seleccionar</span>
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatos() }} (máx. 10 MB)
                  </p>
                  @if (slot.error) {
                    <p class="text-xs text-destructive font-medium mt-1">{{ slot.error }}</p>
                  }
                </div>
              } @else {
                <div class="space-y-3" (click)="$event.stopPropagation()">
                  <div class="flex items-center justify-center gap-2">
                    <svg lucideCheckCircle2 class="w-6 h-6 text-[#10B981]"></svg>
                    <svg lucideFileText class="w-6 h-6 text-muted-foreground"></svg>
                  </div>
                  <p class="font-medium text-foreground truncate max-w-md mx-auto">{{ slot.file.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ (slot.file.size / 1024 / 1024).toFixed(2) }} MB
                  </p>
                  <div class="flex items-center justify-center gap-2">
                    @if (showPreview()) {
                      <button
                        type="button"
                        class="btn-outline !py-1 !px-3 !text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        (click)="abrirPrevisualizacion(slot)"
                      >
                        <svg lucideEye class="w-3.5 h-3.5"></svg>
                        Previsualizar
                      </button>
                    }
                    <button
                      type="button"
                      class="btn-outline !py-1 !px-3 !text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      [disabled]="disabled()"
                      (click)="eliminarArchivo(slot.id)"
                    >
                      <svg lucideX class="w-3.5 h-3.5"></svg>
                      Eliminar
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Botón flotante para quitar la ranura si hay más de una -->
            @if (!single() && slots().length > 1) {
              <button
                type="button"
                (click)="quitarSlot(slot.id)"
                [disabled]="disabled()"
                class="absolute -top-2 -right-2 z-10 text-[11px] px-2 py-0.5 rounded-full transition-colors hover:bg-muted cursor-pointer"
                style="background: var(--card); border: 1px solid var(--border); color: var(--muted-foreground)"
              >
                Quitar documento {{ idx + 1 }}
              </button>
            }

            <!-- Input de archivo oculto por slot -->
            <input
              type="file"
              [attr.data-slot-id]="slot.id"
              class="hidden"
              [accept]="acceptTypes()"
              [multiple]="batch() && !single()"
              [disabled]="disabled()"
              (change)="onFileInputChange($event, slot.id)"
            />
          </div>
        }
      </div>

      @if (!single()) {
        <button
          type="button"
          (click)="agregarSlot()"
          [disabled]="disabled() || !puedeAgregar()"
          class="inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style="color: var(--brand-700)"
        >
          <svg lucidePlus class="w-4 h-4"></svg>
          {{ addLabel() }}
        </button>
      }

      <!-- Modal in-page de previsualización (réplica de FileUploadZone.tsx) -->
      @if (previewModalOpen() && previewSlot()) {
        <ng-container *appBodyPortal>
        <div
          class="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style="background: rgba(0,0,0,0.55)"
          (click)="cerrarPrevisualizacion()"
        >
          <div
            role="dialog" aria-modal="true" [attr.aria-label]="previewSlot()?.file?.name || 'Documento'"
            class="w-full max-w-3xl rounded-lg overflow-hidden flex flex-col"
            style="background: var(--card); border: 1px solid var(--border); box-shadow: var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35)); height: min(80vh, calc(100vh - 2rem)); max-height: calc(100vh - 2rem)"
            (click)="$event.stopPropagation()"
          >
            <!-- Cabecera del visor -->
            <div class="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
              <div class="flex items-center gap-2.5 min-w-0">
                <svg lucideFileText class="w-4.5 h-4.5 flex-shrink-0" style="color: var(--brand-700)"></svg>
                <span class="text-sm font-medium truncate">{{ previewSlot()?.file?.name }}</span>
              </div>
              <button
                type="button"
                (click)="cerrarPrevisualizacion()"
                class="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[color:var(--muted)] cursor-pointer"
                style="border: 1px solid var(--border)"
              >
                <svg lucideX class="w-4 h-4"></svg>
              </button>
            </div>

            <!-- Contenido del visor -->
            <div class="flex-1 min-h-0 overflow-auto" style="background: var(--muted)">
              @if (isPdf(previewSlot()?.file) && previewSafeUrl()) {
                <iframe
                  [src]="previewSafeUrl()"
                  [title]="previewSlot()?.file?.name || 'Documento'"
                  class="block w-full h-full"
                  style="border: none"
                ></iframe>
              } @else if (isImage(previewSlot()?.file) && previewRawUrl()) {
                <div class="p-4 flex items-center justify-center min-h-[50vh]">
                  <img
                    [src]="previewRawUrl()"
                    [alt]="previewSlot()?.file?.name || 'Imagen'"
                    class="max-w-full max-h-[70vh] rounded-md object-contain shadow-sm"
                  />
                </div>
              } @else {
                <div class="p-10 flex flex-col items-center justify-center text-center" style="min-height: 50vh">
                  <div class="w-16 h-16 rounded-xl flex items-center justify-center mb-4" style="background: var(--brand-subtle); border: 1px solid var(--brand-200)">
                    <svg lucideFileText class="w-8 h-8" style="color: var(--brand-700)"></svg>
                  </div>
                  <div class="font-display text-lg text-foreground">{{ previewSlot()?.file?.name }}</div>
                  <p class="text-sm text-muted-foreground mt-1.5 max-w-sm">
                    No se puede previsualizar este tipo de archivo directamente en el navegador.
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
        </ng-container>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiFileUploadZoneComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly elRef = inject(ElementRef);

  constructor() {
    effect(() => {
      const incoming = this.files();
      untracked(() => this.rehidratar(incoming));
    });
  }

  readonly label = input<string>('');
  readonly required = input<boolean>(false);
  readonly keyboardAccessible = input(false);
  readonly description = input<string>('');
  readonly showPreview = input<boolean>(true);
  readonly allowZip = input<boolean>(false);
  readonly allowText = input(false);
  readonly pdfOnly = input(false);
  readonly disabled = input(false);
  readonly batch = input(false);
  readonly addLabel = input<string>('Añadir otro documento');
  readonly single = input(false);

  readonly files = model<File[]>([]);

  readonly slots = signal<MultiFileSlot[]>([{ id: 0, file: null, dragging: false, objectUrl: null }]);
  private nextId = 1;

  readonly previewModalOpen = signal<boolean>(false);
  readonly previewSlot = signal<MultiFileSlot | null>(null);
  readonly previewSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly previewRawUrl = signal<string | null>(null);

  readonly acceptTypes = computed(() => this.pdfOnly() ? '.pdf'
    : '.pdf,.jpg,.jpeg,.png' + (this.allowText() ? ',.txt' : '') + (this.allowZip() ? ',.zip' : ''));
  readonly formatos = computed(() => {
    if (this.pdfOnly()) return 'PDF';
    const formatos = ['PDF', 'JPG', 'PNG'];
    if (this.allowText()) formatos.push('TXT');
    if (this.allowZip()) formatos.push('ZIP');
    return formatos.slice(0, -1).join(', ') + ' o ' + formatos.at(-1);
  });

  readonly cargados = computed(() => this.slots().filter((s) => !!s.file).length);
  readonly puedeAgregar = computed(() => this.slots().every((s) => !!s.file));

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.previewModalOpen()) {
      this.cerrarPrevisualizacion();
    }
  }

  onSlotKey(event: KeyboardEvent, slot: MultiFileSlot): void {
    if (this.keyboardAccessible() && !slot.file && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); this.onSlotClick(slot);
    }
  }

  onSlotClick(slot: MultiFileSlot): void {
    if (slot.file || this.disabled()) return;
    const inputEl = this.elRef.nativeElement.querySelector(`input[data-slot-id="${slot.id}"]`) as HTMLInputElement | null;
    if (inputEl) {
      inputEl.click();
    }
  }

  handleDragOver(e: DragEvent, slotId: number): void {
    e.preventDefault();
    if (this.disabled()) return;
    this.slots.update((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, dragging: true } : s))
    );
  }

  handleDragLeave(e: DragEvent, slotId: number): void {
    e.preventDefault();
    this.slots.update((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, dragging: false } : s))
    );
  }

  handleDrop(e: DragEvent, slotId: number): void {
    e.preventDefault();
    this.processFiles(Array.from(e.dataTransfer?.files ?? []), slotId);
  }

  onFileInputChange(e: Event, slotId: number): void {
    const inputEl = e.target as HTMLInputElement;
    this.processFiles(Array.from(inputEl.files ?? []), slotId);
    inputEl.value = '';
  }

  private processFiles(files: File[], slotId: number): void {
    if (this.disabled()) return;
    this.processFile(files[0] ?? null, slotId);
    if (!this.batch() || this.single()) return;
    for (const file of files.slice(1)) {
      const id = this.nextId++;
      this.slots.update(slots => [...slots, { id, file: null, objectUrl: null, dragging: false }]);
      this.processFile(file, id);
    }
  }

  private processFile(file: File | null, slotId: number): void {
    if (!file) {
      this.slots.update((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, dragging: false } : s))
      );
      return;
    }

    const validTypes = this.pdfOnly() ? ['application/pdf'] : ['application/pdf', 'image/jpeg', 'image/png'];
    if (!this.pdfOnly() && this.allowText()) validTypes.push('text/plain');
    const zipTypes = ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'];
    const isZip = !this.pdfOnly() && this.allowZip() && (zipTypes.includes(file.type) || file.name.toLowerCase().endsWith('.zip'));
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type) && !isZip) {
      this.slots.update((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? {
                ...s,
                dragging: false,
                error: 'Formato permitido: ' + this.formatos()
              }
            : s
        )
      );
      return;
    }

    if (file.size > maxSize) {
      this.slots.update((prev) =>
        prev.map((s) =>
          s.id === slotId ? { ...s, dragging: false, error: 'El archivo no debe superar los 10MB' } : s
        )
      );
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    this.slots.update((prev) =>
      prev.map((s) => {
        if (s.id === slotId) {
          if (s.objectUrl) URL.revokeObjectURL(s.objectUrl);
          return { ...s, file, objectUrl, dragging: false, error: null };
        }
        return s;
      })
    );

    this.emitChange();
  }

  eliminarArchivo(slotId: number): void {
    if (this.disabled()) return;
    this.slots.update((prev) =>
      prev.map((s) => {
        if (s.id === slotId) {
          if (s.objectUrl) URL.revokeObjectURL(s.objectUrl);
          return { ...s, file: null, objectUrl: null, error: null };
        }
        return s;
      })
    );
    this.emitChange();
  }

  agregarSlot(): void {
    if (this.single() || this.disabled() || !this.puedeAgregar()) return;
    this.slots.update((prev) => [...prev, { id: this.nextId++, file: null, dragging: false, objectUrl: null }]);
  }

  quitarSlot(slotId: number): void {
    if (this.disabled()) return;
    this.slots.update((prev) => {
      const target = prev.find((s) => s.id === slotId);
      if (target?.objectUrl) URL.revokeObjectURL(target.objectUrl);
      const remaining = prev.filter((s) => s.id !== slotId);
      return remaining.length > 0 ? remaining : [{ id: this.nextId++, file: null, dragging: false, objectUrl: null }];
    });
    this.emitChange();
  }

  private rehidratar(incoming: File[]): void {
    if (this.single() && incoming.length > 1) incoming = incoming.slice(0, 1);
    const actuales = this.slots().map((slot) => slot.file).filter((file): file is File => !!file);
    if (actuales.length === incoming.length && actuales.every((file, index) => file === incoming[index])) return;
    for (const slot of this.slots()) {
      if (slot.objectUrl) URL.revokeObjectURL(slot.objectUrl);
    }
    this.slots.set(incoming.length
      ? incoming.map((file) => ({ id: this.nextId++, file, dragging: false, objectUrl: URL.createObjectURL(file), error: null }))
      : [{ id: this.nextId++, file: null, dragging: false, objectUrl: null }]);
  }

  private emitChange(): void {
    const activeFiles = this.slots()
      .map((s) => s.file)
      .filter((f): f is File => !!f);
    this.files.set(activeFiles);
  }

  abrirPrevisualizacion(slot: MultiFileSlot): void {
    if (!slot.file || !slot.objectUrl) return;
    this.previewSlot.set(slot);
    this.previewRawUrl.set(slot.objectUrl);
    const vista = this.isPdf(slot.file) ? `${slot.objectUrl}#page=1&navpanes=0&view=FitH` : slot.objectUrl;
    this.previewSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(vista));
    this.previewModalOpen.set(true);
  }

  cerrarPrevisualizacion(): void {
    this.previewModalOpen.set(false);
    this.previewSlot.set(null);
    this.previewSafeUrl.set(null);
    this.previewRawUrl.set(null);
  }

  isPdf(file?: File | null): boolean {
    return !!file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  }

  isImage(file?: File | null): boolean {
    return !!file && (file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name));
  }

  ngOnDestroy(): void {
    for (const slot of this.slots()) {
      if (slot.objectUrl) {
        URL.revokeObjectURL(slot.objectUrl);
      }
    }
  }
}
