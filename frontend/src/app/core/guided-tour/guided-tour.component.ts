import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuidedTourService } from './guided-tour.service';
import { TourStep } from './guided-tour.model';
import { ModalFocusDirective } from '../../shared/modal-focus.directive';
import { tourLayout, tourScrollTop } from './guided-tour-layout';
import {
  LucideCompass,
  LucideX,
  LucideArrowRight,
  LucideArrowLeft,
  LucideCheck
} from '@lucide/angular';

@Component({
  selector: 'app-guided-tour',
  standalone: true,
  imports: [
    CommonModule,
    ModalFocusDirective,
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
        @if (spotGeometry(); as spot) {
          <div
            class="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out"
            aria-hidden="true"
            [style.top.px]="spot.top"
            [style.left.px]="spot.left"
            [style.width.px]="spot.width"
            [style.height.px]="spot.height"
            [style.boxShadow]="spotShadow()"
            [style.transitionDuration]="instant() || reducedMotion() ? '0ms' : '300ms'"
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
          role="dialog" aria-modal="true" aria-labelledby="guided-tour-title" aria-describedby="guided-tour-body"
          tabindex="-1" [appModalFocus]="true" (modalEscape)="tourService.endTour()" (keydown)="onCardKey($event)"
          class="guided-tour-card absolute rounded-xl p-5 transition-all duration-300 ease-out overflow-y-auto custom-scrollbar"
          [style.top.px]="placementGeometry().top"
          [style.left.px]="placementGeometry().left"
          [style.width.px]="tipWidth()"
          [style.maxHeight.px]="layout().maxHeight"
          [style.transitionDuration]="instant() || reducedMotion() ? '0ms' : '280ms'"
          style="
            background: var(--card);
            color: var(--card-foreground);
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
          "
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <span class="eyebrow flex items-center gap-1.5" style="color: var(--brand-700)" aria-live="polite">
              <svg aria-hidden="true" lucideCompass class="w-3 h-3"></svg> Paso {{ tourService.activeStepIndex() + 1 }} de {{ tourService.steps().length }}
            </span>
            <button
              type="button"
              (click)="tourService.endTour()"
              class="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[color:var(--muted)] transition-colors"
              title="Cerrar tutorial"
              aria-label="Cerrar tutorial"
            >
              <svg aria-hidden="true" lucideX class="w-4 h-4 text-muted-foreground"></svg>
            </button>
          </div>

          <!-- Body Title & Text -->
          <div>
            <h3 id="guided-tour-title" class="font-display" style="font-size: 18px; letter-spacing: -0.01em; line-height: 1.2">
              {{ step.title }}
            </h3>
            <p id="guided-tour-body" class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {{ step.body }}
            </p>
          </div>

          @if (targetMessage()) {
            <p role="status" aria-live="polite" class="text-xs text-muted-foreground mt-3 p-3 rounded-lg border border-border">{{ targetMessage() }}</p>
          }

          <!-- Progress Pill Dots -->
          <div class="flex items-center gap-1.5 mt-4" aria-hidden="true">
            @for (s of tourService.steps(); track $index) {
              <span
                class="h-1.5 rounded-full transition-all duration-300"
                [style.width.px]="$index === tourService.activeStepIndex() ? 18 : 6"
                [style.background]="$index === tourService.activeStepIndex() ? 'var(--brand-700)' : 'var(--border)'"
              ></span>
            }
          </div>

          <!-- Action Buttons -->
          <div class="guided-tour-actions flex items-center justify-between mt-4 gap-2 flex-wrap">
            <button
              type="button"
              (click)="tourService.endTour()"
              class="text-xs min-h-6 px-1 text-muted-foreground hover:text-foreground transition-colors"
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
                  <svg aria-hidden="true" lucideArrowLeft class="w-3.5 h-3.5"></svg> Anterior
                </button>
              }

              <button
                type="button"
                (click)="tourService.nextStep()"
                class="btn-brand !px-4 !py-2 !text-[13px] inline-flex items-center gap-1"
              >
                @if (isLastStep()) {
                  Finalizar <svg aria-hidden="true" lucideCheck class="w-3.5 h-3.5"></svg>
                } @else {
                  Siguiente <svg aria-hidden="true" lucideArrowRight class="w-3.5 h-3.5"></svg>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .guided-tour-card { overflow-wrap: anywhere; overscroll-behavior: contain; }
    .guided-tour-actions > div { flex-wrap: wrap; }
    @media (prefers-reduced-motion: reduce) {
      .guided-tour-card, .guided-tour-card *, .guided-tour-card ~ * { transition: none !important; animation: none !important; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuidedTourComponent implements OnDestroy {
  readonly tourService = inject(GuidedTourService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');
  readonly rect = signal<DOMRect | null>(null);
  readonly vp = signal({ w: typeof window !== 'undefined' ? window.innerWidth : 1200,
    h: typeof window !== 'undefined' ? window.innerHeight : 800 });
  readonly tipSize = signal({ w: 340, h: 210 });
  readonly headerBottom = signal(96);
  readonly isDark = signal(false);
  readonly reducedMotion = signal(false);
  readonly instant = signal(false);
  readonly targetState = signal<'waiting' | 'missing' | 'outside' | 'ready'>('waiting');
  readonly currentStep = computed(() => this.tourService.currentStep());
  readonly isLastStep = computed(() => this.tourService.activeStepIndex() === this.tourService.steps().length - 1);
  readonly layout = computed(() => tourLayout(this.rect(), this.vp(), this.tipSize().h, this.headerBottom()));
  readonly spotGeometry = computed(() => this.layout().spot);
  readonly placementGeometry = computed(() => this.layout().placement);
  readonly tipWidth = computed(() => this.layout().width);
  readonly targetMessage = computed(() => this.targetState() === 'ready' ? ''
    : this.targetState() === 'waiting' ? 'Buscando el elemento de este paso. Puede estar cargando. Puede continuar o cerrar el tutorial.'
    : this.targetState() === 'outside' ? 'El elemento está fuera de la vista. Desplácese para verlo, continúe o cierre el tutorial.'
    : 'El elemento de este paso no está visible. Puede estar filtrado, pendiente de carga o en una pestaña cerrada. Puede continuar o cerrar el tutorial.');
  readonly scrimColor = computed(() => this.isDark() ? 'rgba(2, 6, 23, 0.74)' : 'rgba(9, 14, 26, 0.82)');
  readonly spotShadow = computed(() => (this.isDark() ? [
    '0 0 0 2px rgba(255, 236, 179, 0.95)', '0 0 0 5px #FFC53D',
    '0 0 18px 3px rgba(255, 197, 61, 0.75)', '0 0 46px 12px rgba(255, 176, 32, 0.70)',
    '0 0 80px 24px rgba(255, 197, 61, 0.35)',
  ] : ['0 0 0 2px var(--gold)', '0 0 0 5px rgba(212, 168, 83, 0.30)', '0 0 30px 6px rgba(212, 168, 83, 0.30)'])
    .concat(`0 0 0 9999px ${this.scrimColor()}`).join(', '));

  constructor() {
    effect(onCleanup => {
      const step = this.currentStep(), open = this.tourService.isOpen();
      if (!open || !step) { this.rect.set(null); return; }
      untracked(() => this.trackStep(step, onCleanup));
    });
    effect(onCleanup => {
      const card = this.cardRef()?.nativeElement;
      if (!card) return;
      untracked(() => this.measureCard());
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.measureCard());
      observer?.observe(card);
      onCleanup(() => observer?.disconnect());
    });
  }

  ngOnDestroy(): void { this.tourService.endTour(); }

  onCardKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'ArrowRight') this.tourService.nextStep(); else this.tourService.prevStep();
  }

  private measureCard(): void {
    const box = this.cardRef()?.nativeElement.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0
      && (Math.abs(box.height - this.tipSize().h) > 1 || Math.abs(box.width - this.tipSize().w) > 1)) {
      this.tipSize.set({ w: box.width, h: box.height });
    }
  }

  private trackStep(step: TourStep, onCleanup: (cleanup: () => void) => void): void {
    if (typeof window === 'undefined') return;
    this.rect.set(null); this.targetState.set('waiting'); this.instant.set(false);
    // Panel callbacks only reveal local sections; they must never submit an act.
    step.onEnter?.();
    let active = true, firstScroll = true;
    let target: HTMLElement | null = null, frame = 0, waitFrame = 0;
    const deadline = performance.now() + 1600;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const valid = () => active && this.tourService.isOpen() && this.currentStep() === step;
    // Previous disappears on the first step. Recover focus after Angular removes
    // that control, without stealing it from a newer dialog or abandoned context.
    queueMicrotask(() => {
      const card = this.cardRef()?.nativeElement;
      if (valid() && card && !card.contains(document.activeElement) && !this.tourService.hasBlockingDialog(this.host.nativeElement)) {
        (card.querySelector<HTMLElement>('button') || card).focus({ preventScroll: true });
      }
    });
    const motion = () => this.reducedMotion.set(!!media?.matches);
    motion();
    const targetObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule());
    const refresh = () => {
      if (!valid()) return;
      if (this.tourService.hasBlockingDialog(this.host.nativeElement)) { this.tourService.endTour(); return; }
      const nextVp = { w: window.innerWidth, h: window.innerHeight };
      if (nextVp.w !== this.vp().w || nextVp.h !== this.vp().h) this.vp.set(nextVp);
      const header = document.querySelector('.saip-header')?.getBoundingClientRect().bottom;
      this.headerBottom.set(header && header > 0 ? header : 96);
      this.isDark.set(document.documentElement.classList.contains('dark'));
      let el: HTMLElement | null = null;
      try { el = document.querySelector<HTMLElement>(step.selector); } catch { /* Invalid selectors are unavailable targets. */ }
      const box = el?.getBoundingClientRect();
      const style = el ? getComputedStyle(el) : null;
      const visible = !!el && !!box && box.width > 0 && box.height > 0
        && !el.closest('[hidden], [aria-hidden="true"], [inert]') && style?.display !== 'none' && style?.visibility !== 'hidden';
      if (!visible) {
        targetObserver?.disconnect(); target = null; this.rect.set(null);
        this.targetState.set(performance.now() < deadline ? 'waiting' : 'missing');
        return;
      }
      if (target !== el) { targetObserver?.disconnect(); targetObserver?.observe(el!); target = el; }
      if (firstScroll) {
        firstScroll = false;
        window.scrollTo({ top: tourScrollTop(box!, window.scrollY, nextVp.h, this.headerBottom(), this.tipSize().h, step.align),
          behavior: this.reducedMotion() ? 'instant' : 'smooth' });
      }
      const previous = this.rect();
      if (!previous || previous.top !== box!.top || previous.left !== box!.left
        || previous.width !== box!.width || previous.height !== box!.height) this.rect.set(box!);
      this.targetState.set(this.layout().spot ? 'ready' : 'outside');
      this.measureCard();
    };
    const schedule = () => {
      if (!valid() || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; this.instant.set(true); refresh(); });
    };
    const wait = () => {
      waitFrame = 0; refresh();
      if (valid() && !target && performance.now() < deadline) waitFrame = requestAnimationFrame(wait);
    };
    const mutations = new MutationObserver(records => {
      if (records.some(record => !this.host.nativeElement.contains(record.target))) schedule();
    });
    mutations.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'inert', 'open'] });
    window.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule);
    media?.addEventListener?.('change', motion);
    refresh();
    if (!target) waitFrame = requestAnimationFrame(wait);
    onCleanup(() => {
      active = false; cancelAnimationFrame(frame); cancelAnimationFrame(waitFrame);
      mutations.disconnect(); targetObserver?.disconnect();
      window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule);
      media?.removeEventListener?.('change', motion);
    });
  }
}
