import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuidedTourService } from './guided-tour.service';
import { TourStep } from './guided-tour.model';
import {
  LucideCompass,
  LucideX,
  LucideArrowRight,
  LucideArrowLeft,
  LucideCheck
} from '@lucide/angular';

const HEADER_OFFSET = 96;
const GAP = 24;
const EDGE = 20;
const PAD = 8;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

@Component({
  selector: 'app-guided-tour',
  standalone: true,
  imports: [
    CommonModule,
    LucideCompass,
    LucideX,
    LucideArrowRight,
    LucideArrowLeft,
    LucideCheck
  ],
  template: `
    @if (tourService.isOpen() && currentStep(); as step) {
      <div class="fixed inset-0 z-[150]" style="overscroll-behavior: contain">
        <!-- Spotlight / Scrim Overlay -->
        @if (rect(); as r) {
          <div
            class="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out"
            [style.top.px]="spotGeometry().top"
            [style.left.px]="spotGeometry().left"
            [style.width.px]="spotGeometry().width"
            [style.height.px]="spotGeometry().height"
            [style.boxShadow]="spotShadow()"
            [style.transitionDuration]="instant() ? '0ms' : '300ms'"
          ></div>
        } @else {
          <div
            class="absolute inset-0 transition-opacity duration-300"
            [style.background]="scrimColor()"
          ></div>
        }

        <!-- Tooltip Card -->
        <div
          #cardRef
          class="absolute rounded-xl p-5 transition-all duration-300 ease-out border border-amber-500/30 dark:border-amber-400/40 shadow-2xl shadow-black/60 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar"
          [style.top.px]="placementGeometry().top"
          [style.left.px]="placementGeometry().left"
          [style.width.px]="tipWidth()"
          [style.transitionDuration]="instant() ? '0ms' : '280ms'"
          style="
            background: var(--card);
            color: var(--card-foreground);
          "
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <span class="eyebrow flex items-center gap-1.5" style="color: var(--brand-700)">
              <svg lucideCompass class="w-3 h-3"></svg> Paso {{ tourService.activeStepIndex() + 1 }} de {{ tourService.steps().length }}
            </span>
            <button
              type="button"
              (click)="tourService.endTour()"
              class="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[color:var(--muted)] transition-colors"
              title="Cerrar tutorial"
            >
              <svg lucideX class="w-4 h-4 text-muted-foreground"></svg>
            </button>
          </div>

          <!-- Body Title & Text -->
          <div>
            <h3 class="font-display" style="font-size: 18px; letter-spacing: -0.01em; line-height: 1.2">
              {{ step.title }}
            </h3>
            <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {{ step.body }}
            </p>
          </div>

          <!-- Progress Pill Dots -->
          <div class="flex items-center gap-1.5 mt-4">
            @for (s of tourService.steps(); track $index) {
              <span
                class="h-1.5 rounded-full transition-all duration-300"
                [style.width.px]="$index === tourService.activeStepIndex() ? 18 : 6"
                [style.background]="$index === tourService.activeStepIndex() ? 'var(--brand-700)' : 'var(--border)'"
              ></span>
            }
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between mt-4">
            <button
              type="button"
              (click)="tourService.endTour()"
              class="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Omitir
            </button>

            <div class="flex items-center gap-2">
              @if (tourService.activeStepIndex() > 0) {
                <button
                  type="button"
                  (click)="tourService.prevStep()"
                  class="btn-ghost-brand !px-3 !py-2 !text-[13px] inline-flex items-center gap-1"
                >
                  <svg lucideArrowLeft class="w-3.5 h-3.5"></svg> Anterior
                </button>
              }

              <button
                type="button"
                (click)="tourService.nextStep()"
                class="btn-brand !px-4 !py-2 !text-[13px] inline-flex items-center gap-1"
              >
                @if (isLastStep()) {
                  Finalizar <svg lucideCheck class="w-3.5 h-3.5"></svg>
                } @else {
                  Siguiente <svg lucideArrowRight class="w-3.5 h-3.5"></svg>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuidedTourComponent implements OnInit, OnDestroy {
  readonly tourService = inject(GuidedTourService);
  readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');

  readonly rect = signal<DOMRect | null>(null);
  readonly vp = signal<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1200,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  });
  readonly tipSize = signal<{ w: number; h: number }>({ w: 340, h: 210 });
  readonly isDark = signal<boolean>(false);
  readonly instant = signal<boolean>(false);

  readonly currentStep = computed(() => this.tourService.currentStep());
  readonly isLastStep = computed(() => {
    return this.tourService.activeStepIndex() === this.tourService.steps().length - 1;
  });

  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private rafId: number = 0;

  readonly scrimColor = computed(() =>
    this.isDark() ? 'rgba(2, 6, 23, 0.74)' : 'rgba(9, 14, 26, 0.82)'
  );

  readonly spotShadow = computed(() => {
    const scrim = this.scrimColor();
    if (this.isDark()) {
      return [
        '0 0 0 2px rgba(255, 236, 179, 0.95)',
        '0 0 0 5px #FFC53D',
        '0 0 18px 3px rgba(255, 197, 61, 0.75)',
        '0 0 46px 12px rgba(255, 176, 32, 0.70)',
        '0 0 80px 24px rgba(255, 197, 61, 0.35)',
        `0 0 0 9999px ${scrim}`
      ].join(', ');
    }
    return [
      '0 0 0 2px var(--gold)',
      '0 0 0 5px rgba(212, 168, 83, 0.30)',
      '0 0 30px 6px rgba(212, 168, 83, 0.30)',
      `0 0 0 9999px ${scrim}`
    ].join(', ');
  });

  readonly spotGeometry = computed(() => {
    const r = this.rect();
    const v = this.vp();
    if (!r) return { top: 0, left: 0, width: 0, height: 0 };

    const top = clamp(r.top - PAD, EDGE, v.h - EDGE);
    const bottom = clamp(r.top + r.height + PAD, EDGE, v.h - EDGE);
    const height = Math.max(0, bottom - top);
    const left = clamp(r.left - PAD, EDGE, v.w - EDGE);
    const right = clamp(r.left + r.width + PAD, EDGE, v.w - EDGE);
    const width = Math.max(0, right - left);

    return { top, left, width, height };
  });

  readonly tipWidth = computed(() => Math.min(340, this.vp().w - EDGE * 2));

  readonly placementGeometry = computed(() => {
    const spot = this.spotGeometry();
    const v = this.vp();
    const r = this.rect();
    const tipW = this.tipWidth();
    const tipH = this.tipSize().h;

    if (!r) {
      const rawTop = v.h / 2 - tipH / 2;
      const rawLeft = v.w / 2 - tipW / 2;
      const maxTop = v.h - tipH - 24;
      const minTop = HEADER_OFFSET;
      const maxLeft = v.w - tipW - 20;
      const minLeft = 20;
      return {
        top: Math.max(minTop, Math.min(rawTop, maxTop)),
        left: Math.max(minLeft, Math.min(rawLeft, maxLeft))
      };
    }

    const { top, left, width, height } = spot;
    const cx = left + width / 2;
    const cy = top + height / 2;
    const centerLeft = clamp(cx - tipW / 2, EDGE, v.w - tipW - EDGE);
    const centerTop = clamp(cy - tipH / 2, EDGE, v.h - tipH - EDGE);

    const spaceBelow = v.h - (top + height);
    const spaceAbove = top - HEADER_OFFSET;
    const spaceRight = v.w - (left + width);
    const spaceLeft = left;

    let calculatedTop: number;
    let calculatedLeft: number;

    // 1. Check Below Target
    if (spaceBelow >= tipH + GAP + 24) {
      calculatedTop = top + height + GAP;
      calculatedLeft = centerLeft;
    }
    // 2. Check Above Target (considering fixed header offset)
    else if (spaceAbove >= tipH + GAP + 24) {
      calculatedTop = top - tipH - GAP;
      calculatedLeft = centerLeft;
    }
    // 3. Check Right of Target
    else if (spaceRight >= tipW + GAP + 20) {
      calculatedTop = centerTop;
      calculatedLeft = left + width + GAP;
    }
    // 4. Check Left of Target
    else if (spaceLeft >= tipW + GAP + 20) {
      calculatedTop = centerTop;
      calculatedLeft = left - tipW - GAP;
    }
    // 5. Fallback for Tall / Full-Screen Elements: Place at bottom right without covering spotlight center
    else {
      calculatedTop = v.h - tipH - 24;
      calculatedLeft = v.w - tipW - 20;
    }

    // Strict Viewport Clamping
    const maxTop = v.h - tipH - 24; // 24px bottom edge buffer
    const minTop = HEADER_OFFSET;   // HEADER_OFFSET buffer (96px)
    const finalTop = Math.max(minTop, Math.min(calculatedTop, maxTop));

    const maxLeft = v.w - tipW - 20;
    const minLeft = 20;
    const finalLeft = Math.max(minLeft, Math.min(calculatedLeft, maxLeft));

    return { top: finalTop, left: finalLeft };
  });

  constructor() {
    effect(() => {
      const step = this.currentStep();
      if (step) {
        this.instant.set(false);
        step.onEnter?.();
        this.waitForAndAttachTarget(step);
      } else {
        this.rect.set(null);
      }
    });
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      const el = document.documentElement;
      this.isDark.set(el.classList.contains('dark'));
      this.mutationObserver = new MutationObserver(() => {
        this.isDark.set(el.classList.contains('dark'));
      });
      this.mutationObserver.observe(el, { attributes: true, attributeFilter: ['class'] });

      window.addEventListener('scroll', this.onWinScrollOrResize, true);
      window.addEventListener('resize', this.onWinScrollOrResize);
    }
  }

  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.onWinScrollOrResize, true);
      window.removeEventListener('resize', this.onWinScrollOrResize);
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.tourService.isOpen()) return;
    if (e.key === 'Escape') {
      this.tourService.endTour();
    } else if (e.key === 'ArrowRight') {
      this.tourService.nextStep();
    } else if (e.key === 'ArrowLeft') {
      this.tourService.prevStep();
    }
  }

  private onWinScrollOrResize = (): void => {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.instant.set(true);
      this.remeasure();
    });
  };

  private remeasure(): void {
    const step = this.currentStep();
    if (!step || typeof document === 'undefined') return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) {
      this.rect.set(el.getBoundingClientRect());
      this.vp.set({ w: window.innerWidth, h: window.innerHeight });
      this.remeasureCard();
    }
  }

  private remeasureCard(): void {
    if (typeof document === 'undefined') return;
    const cardEl = this.cardRef()?.nativeElement;
    if (cardEl) {
      const cr = cardEl.getBoundingClientRect();
      if (cr.height > 0 && cr.width > 0) {
        this.tipSize.set({ w: cr.width, h: cr.height });
      }
    }
  }

  private scrollToEl(targetEl: HTMLElement, step: TourStep): void {
    if (typeof window === 'undefined') return;
    const rect = targetEl.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;

    if (absoluteTop < 300 || step.selector === '[data-tour="nueva"]' || step.selector.includes('hero')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const targetScrollY = Math.max(0, absoluteTop - HEADER_OFFSET - 20);
      window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    }
  }

  private waitForAndAttachTarget(step: TourStep): void {
    if (typeof document === 'undefined') return;
    this.resizeObserver?.disconnect();

    let cancelled = false;
    let raf = 0;
    const deadline = performance.now() + 1600;
    const timers: number[] = [];

    const attach = (el: HTMLElement) => {
      if (cancelled) return;
      this.scrollToEl(el, step);

      this.rect.set(el.getBoundingClientRect());
      this.vp.set({ w: window.innerWidth, h: window.innerHeight });
      this.remeasureCard();

      this.resizeObserver = new ResizeObserver(() => {
        if (!cancelled) {
          this.rect.set(el.getBoundingClientRect());
          this.remeasureCard();
        }
      });
      this.resizeObserver.observe(el);

      [80, 180, 350, 600].forEach(ms => {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled) {
              this.rect.set(el.getBoundingClientRect());
              this.remeasureCard();
            }
          }, ms)
        );
      });
    };

    const waitForEl = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        attach(el);
        return;
      }
      if (performance.now() < deadline) {
        raf = requestAnimationFrame(waitForEl);
      } else {
        this.rect.set(null);
      }
    };

    const kickoff = window.setTimeout(
      () => {
        raf = requestAnimationFrame(waitForEl);
      },
      step.onEnter ? 90 : 0
    );
  }
}

