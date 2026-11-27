import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideChevronRight } from '@lucide/angular';

export type PageItem = number | 'gap';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideChevronRight],
  template: `
    @if (total() > 0) {
      <div class="pt-3 mt-1 flex items-center justify-between gap-3 flex-wrap border-t border-border">
        <span class="text-xs text-muted-foreground pt-3">
          Mostrando <span class="font-mono font-semibold text-foreground">{{ rangeFrom() }}–{{ rangeTo() }}</span> de <span class="font-mono font-semibold text-foreground">{{ total() }}</span>
          <span class="mx-2 text-border-strong">·</span>
          Página <span class="font-mono font-semibold text-foreground">{{ page() }}</span> de <span class="font-mono font-semibold text-foreground">{{ totalPages() }}</span>
        </span>
        <div class="flex items-center gap-1.5 pt-3">
          <button
            type="button"
            (click)="onGoTo(page() - 1)"
            [disabled]="page() === 1"
            class="w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-default enabled:hover:bg-[color:var(--brand-subtle)] cursor-pointer"
            style="border: 1px solid var(--border); background: var(--card)"
            aria-label="Página anterior">
            <svg lucideChevronRight class="w-4 h-4 rotate-180" style="color: var(--foreground)"></svg>
          </button>

          @for (item of pageItems(); track $index) {
            @if (item === 'gap') {
              <span class="w-6 text-center text-muted-foreground select-none">…</span>
            } @else {
              <button
                type="button"
                (click)="onGoTo(item)"
                [attr.aria-current]="item === page() ? 'page' : null"
                class="min-w-8 h-8 px-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
                [style.background]="item === page() ? 'var(--brand-700)' : 'var(--card)'"
                [style.color]="item === page() ? '#ffffff' : 'var(--foreground)'"
                [style.border]="item === page() ? '1px solid var(--brand-700)' : '1px solid var(--border)'">
                {{ item }}
              </button>
            }
          }

          <button
            type="button"
            (click)="onGoTo(page() + 1)"
            [disabled]="page() === totalPages()"
            class="w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-default enabled:hover:bg-[color:var(--brand-subtle)] cursor-pointer"
            style="border: 1px solid var(--border); background: var(--card)"
            aria-label="Página siguiente">
            <svg lucideChevronRight class="w-4 h-4" style="color: var(--foreground)"></svg>
          </button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly rangeFrom = input.required<number>();
  readonly rangeTo = input.required<number>();

  readonly goTo = output<number>();

  readonly pageItems = computed<PageItem[]>(() => {
    const total = this.totalPages();
    const curr = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items: PageItem[] = [1];
    const start = Math.max(2, curr - 1);
    const end = Math.min(total - 1, curr + 1);
    if (start > 2) items.push('gap');
    for (let n = start; n <= end; n++) items.push(n);
    if (end < total - 1) items.push('gap');
    items.push(total);
    return items;
  });

  onGoTo(p: number): void {
    if (p >= 1 && p <= this.totalPages() && p !== this.page()) {
      this.goTo.emit(p);
    }
  }
}
