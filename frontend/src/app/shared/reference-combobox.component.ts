import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  signal,
  computed,
  ElementRef,
  inject,
  HostListener,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideChevronDown, LucideCheck, LucideSearch, LucideX } from '@lucide/angular';

export interface ReferenceComboboxOption {
  id: any;
  label: string;
  sublabel?: string;
}

/**
 * Componente Combobox / Select institucional con UI/UX idéntica a Radix UI de design-reference.
 * Incluye trigger con ChevronDown animado, popover con sombra y bordes semánticos,
 * buscador reactivo con filtro insensible a acentos, selección con check y cierre por clic externo.
 */
@Component({
  selector: 'app-reference-combobox',
  standalone: true,
  imports: [CommonModule, LucideChevronDown, LucideCheck, LucideSearch, LucideX],
  template: `
    <div class="relative w-full" (click)="$event.stopPropagation()">
      <!-- Trigger Button -->
      <button
        type="button"
        [id]="id()"
        (click)="toggle()"
        [disabled]="disabled()"
        class="field-input !h-auto !py-[11px] flex items-center justify-between gap-2 text-left cursor-pointer transition-all select-none w-full"
        [class.ring-2]="isOpen()"
        [class.ring-[var(--brand-600)]]="isOpen()"
        [class.border-[var(--brand-600)]]="isOpen()"
        [class.opacity-60]="disabled()"
        [class.cursor-not-allowed]="disabled()"
        [attr.aria-expanded]="isOpen()"
        role="combobox"
        aria-haspopup="listbox"
      >
        <span class="truncate text-sm flex-1" [class.text-muted-foreground]="!selectedOption()">
          @if (selectedOption()) {
            <span class="text-foreground font-medium">{{ selectedOption()!.label }}</span>
            @if (selectedOption()!.sublabel) {
              <span class="text-muted-foreground text-xs ml-1.5 font-normal">({{ selectedOption()!.sublabel }})</span>
            }
          } @else {
            {{ placeholder() }}
          }
        </span>

        <div class="flex items-center gap-1 shrink-0">
          @if (!required() && selectedOption() && !disabled()) {
            <span
              role="button"
              tabindex="0"
              (click)="clearSelection($event)"
              class="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Limpiar selección"
            >
              <svg lucideX class="w-3.5 h-3.5"></svg>
            </span>
          }
          <svg
            lucideChevronDown
            class="w-4 h-4 text-muted-foreground transition-transform duration-200"
            [class.rotate-180]="isOpen()"
          ></svg>
        </div>
      </button>

      <!-- Dropdown Popover -->
      @if (isOpen()) {
        <div
          class="absolute z-50 left-0 right-0 mt-1.5 rounded-lg border shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          style="background: var(--card); border-color: var(--border); box-shadow: var(--shadow-lg, 0 12px 30px -4px rgba(0,0,0,0.18)); max-height: 300px;"
        >
          <!-- Buscador integrado (para listas extensas como Entidades) -->
          @if (searchable()) {
            <div class="p-2 border-b border-border bg-muted/40 sticky top-0 z-10">
              <div class="relative flex items-center">
                <svg lucideSearch class="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground"></svg>
                <input
                  #searchInput
                  type="text"
                  [value]="searchQuery()"
                  (input)="onSearchInput($any($event.target).value)"
                  [placeholder]="searchPlaceholder()"
                  class="w-full pl-8 pr-7 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-[var(--brand-600)] text-foreground placeholder:text-muted-foreground/70"
                  (click)="$event.stopPropagation()"
                />
                @if (searchQuery()) {
                  <button
                    type="button"
                    (click)="searchQuery.set(''); searchInput.focus()"
                    class="absolute right-2 text-muted-foreground hover:text-foreground"
                  >
                    <svg lucideX class="w-3.5 h-3.5"></svg>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Lista de opciones scrollable -->
          <div class="overflow-y-auto p-1 space-y-0.5 max-h-60" role="listbox">
            @for (opt of filteredOptions(); track opt.id) {
              <div
                role="option"
                [attr.aria-selected]="isSelected(opt)"
                (click)="selectOption(opt)"
                class="flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors"
                [style.background]="isSelected(opt) ? 'color-mix(in srgb, var(--brand-50) 80%, var(--card))' : 'transparent'"
                [style.color]="isSelected(opt) ? 'var(--brand-700)' : 'var(--foreground)'"
                [class.hover:bg-muted]="!isSelected(opt)"
              >
                <div class="min-w-0 flex-1 pr-2">
                  <span class="block truncate" [class.font-semibold]="isSelected(opt)">{{ opt.label }}</span>
                  @if (opt.sublabel) {
                    <span class="block text-xs text-muted-foreground truncate">{{ opt.sublabel }}</span>
                  }
                </div>
                @if (isSelected(opt)) {
                  <svg lucideCheck class="w-4 h-4 shrink-0 text-[var(--brand-700)]" strokeWidth="2.5"></svg>
                }
              </div>
            } @empty {
              <div class="px-4 py-6 text-center text-xs text-muted-foreground">
                No se encontraron opciones que coincidan
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferenceComboboxComponent {
  private readonly elementRef = inject(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly options = input<ReferenceComboboxOption[]>([]);
  readonly value = model<any>(null);
  readonly placeholder = input<string>('Seleccione una opción');
  readonly searchPlaceholder = input<string>('Buscar...');
  readonly searchable = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly id = input<string>('');

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  isOpen = signal<boolean>(false);
  searchQuery = signal<string>('');

  selectedOption = computed(() => {
    const val = this.value();
    const opts = this.options();
    if (val === null || val === undefined || val === '') return null;
    const found = opts.find((opt) => opt.id === val || String(opt.id) === String(val));
    if (found) return found;
    if (typeof val === 'string' && val.trim() !== '') {
      return { id: val, label: val };
    }
    return null;
  });

  filteredOptions = computed(() => {
    const query = this.normalize(this.searchQuery().trim());
    const opts = this.options();
    if (!query) return opts;
    return opts.filter((opt) => {
      const labelNorm = this.normalize(opt.label);
      const subNorm = opt.sublabel ? this.normalize(opt.sublabel) : '';
      return labelNorm.includes(query) || subNorm.includes(query);
    });
  });

  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  toggle(): void {
    if (this.disabled()) return;
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.searchQuery.set('');
      if (this.searchable()) {
        setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
      }
    }
    this.cdr.markForCheck();
  }

  close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.searchQuery.set('');
      this.cdr.markForCheck();
    }
  }

  selectOption(opt: ReferenceComboboxOption): void {
    this.value.set(opt.id);
    this.close();
    this.cdr.markForCheck();
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    this.value.set(null);
    this.close();
    this.cdr.markForCheck();
  }

  isSelected(opt: ReferenceComboboxOption): boolean {
    const val = this.value();
    if (val === null || val === undefined || val === '') return false;
    return val === opt.id || String(val) === String(opt.id);
  }

  onSearchInput(val: string): void {
    this.searchQuery.set(val);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
