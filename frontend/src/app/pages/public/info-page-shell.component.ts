import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideBookOpen, LucideInfo } from '@lucide/angular';

@Component({
  selector: 'app-info-page-shell',
  imports: [RouterLink, LucideArrowLeft, LucideBookOpen, LucideInfo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="saip-page min-h-screen bg-background info-shell">
      <div class="relative bg-paper border-b border-border overflow-hidden">
        <div class="absolute inset-0 opacity-[0.05] pointer-events-none" aria-hidden="true" style="background: radial-gradient(60% 80% at 80% 0%, var(--brand-500), transparent 70%)"></div>
        <div class="relative max-w-5xl mx-auto px-6 md:px-10 pt-28 pb-12">
          <a routerLink="/" class="info-back"><svg lucideArrowLeft aria-hidden="true"></svg>Volver al inicio</a>
          <div class="info-heading flex items-start gap-5">
            <div class="info-icon w-14 h-14 rounded-lg flex items-center justify-center shrink-0">
              @if (icon() === 'book') { <svg lucideBookOpen class="w-7 h-7 text-white" aria-hidden="true"></svg> }
              @else { <svg lucideInfo class="w-7 h-7 text-white" aria-hidden="true"></svg> }
            </div>
            <div class="min-w-0"><span class="eyebrow">{{ eyebrow() }}</span>
              <h1 class="font-display mt-1.5" tabindex="-1">{{ title() }} <span class="italic" style="color: var(--brand-700)">{{ accent() }}</span></h1>
              <p class="text-muted-foreground mt-2 max-w-2xl">{{ intro() }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="max-w-5xl mx-auto px-6 md:px-10 py-12 space-y-10"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .info-shell { overflow-wrap: anywhere; }
    .info-icon { background: linear-gradient(135deg, var(--brand-500), var(--brand-700)); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), var(--shadow-sm); }
    h1 { font-size: clamp(34px, 4vw, 48px); line-height: 1.05; letter-spacing: -.025em; }
    a:focus-visible, h1:focus-visible { outline: 2px solid var(--brand-700); outline-offset: 4px; }
    .info-back { display: flex; width: fit-content; max-width: 100%; align-items: center; gap: 10px;
      min-height: 40px; padding: 6px 16px 6px 6px; margin: 0 0 24px; border-radius: 999px; border: 1px solid var(--border);
      background: var(--card); color: var(--foreground); font-size: 13.5px; font-weight: 500; line-height: 1.2;
      white-space: nowrap; box-shadow: var(--shadow-sm); transition: border-color .2s, background-color .2s, transform .2s; }
    .info-back:hover { border-color: var(--brand-700); transform: translateX(-2px); }
    .info-back > svg { flex-shrink: 0; width: 28px; height: 28px; padding: 6px; border-radius: 999px; background: var(--brand-subtle); color: var(--brand-700); }
    @media (max-width: 480px) { .info-heading { flex-direction: column; gap: 1rem; } }
    @media (prefers-reduced-motion: reduce) { .info-back { transition: none; } .info-back:hover { transform: none; } }
  `,
})
export class InfoPageShellComponent {
  readonly icon = input<'book' | 'info'>('info');
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly accent = input.required<string>();
  readonly intro = input.required<string>();
}
