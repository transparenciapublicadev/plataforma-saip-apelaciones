import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Yaiku mark shared by editorial pages, the shell and their footer. */
@Component({
  selector: 'app-yaiku-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="yaiku-brand" [class.yaiku-auto]="tone() === 'auto'" role="img" aria-label="Yaiku" [style.gap.px]="height() * .28">
      <svg aria-hidden="true" viewBox="0 0 64 64" [attr.width]="height()" [attr.height]="height()" class="shrink-0">
        <defs><linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="seal-start"/><stop offset="1" class="seal-end"/></linearGradient></defs>
        <rect [attr.x]="tone() === 'auto' ? 0 : 1" [attr.y]="tone() === 'auto' ? 0 : 1" [attr.width]="tone() === 'auto' ? 64 : 62" [attr.height]="tone() === 'auto' ? 64 : 62" [attr.rx]="tone() === 'auto' ? 16 : 15" [attr.fill]="'url(#' + gradientId() + ')'" [attr.stroke]="tone() === 'auto' ? null : 'rgba(251,244,230,.45)'" stroke-width="2"/>
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.5">
          <path d="M30.5 38 L30.5 50" stroke="#FBF4E6"/><path d="M19 26.5 L30.5 38" stroke="#FBF4E6"/><path d="M45.5 15 L30.5 38" class="seal-gold"/>
        </g>
      </svg>
      <span aria-hidden="true" class="yaiku-word" [style.font-size.px]="height() * .74">Ya<span class="yaiku-dotless">ı</span>ku</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .yaiku-brand { display: inline-flex; align-items: center; color: #F3EAD7; --seal-start: #C8243A; --seal-end: #93192A; --seal-gold: #E6C27A; --word-dot: #D9B369; }
    .yaiku-auto { color: var(--foreground); --seal-start: #A81E2C; --seal-end: #7E1520; --seal-gold: #D9B369; --word-dot: #B08842; }
    :host-context(.dark) .yaiku-auto { --seal-start: #C8243A; --seal-end: #93192A; --seal-gold: #E6C27A; --word-dot: #D9B369; }
    .seal-start { stop-color: var(--seal-start); } .seal-end { stop-color: var(--seal-end); } .seal-gold { stroke: var(--seal-gold); }
    .yaiku-word { font-family: Inter, system-ui, sans-serif; font-weight: 700; letter-spacing: -.035em; line-height: 1; }
    .yaiku-dotless { position: relative; }
    .yaiku-dotless::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: .17em; height: .17em; bottom: .74em; border-radius: 50%; background: var(--word-dot); }
  `,
})
export class YaikuLogoComponent {
  readonly height = input(34);
  readonly tone = input<'auto' | 'dark'>('dark');
  readonly gradientId = input.required<string>();
}
