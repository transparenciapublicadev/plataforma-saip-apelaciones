import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Existing dark-tone Yaiku mark shared by editorial pages and their footer. */
@Component({
  selector: 'app-yaiku-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="yaiku-brand" role="img" aria-label="Yaiku" [style.gap.px]="height() * .28">
      <svg aria-hidden="true" viewBox="0 0 64 64" [attr.width]="height()" [attr.height]="height()" class="shrink-0">
        <defs><linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C8243A"/><stop offset="1" stop-color="#93192A"/></linearGradient></defs>
        <rect x="1" y="1" width="62" height="62" rx="15" [attr.fill]="'url(#' + gradientId() + ')'" stroke="rgba(251,244,230,.45)" stroke-width="2"/>
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="6.5">
          <path d="M30.5 38 L30.5 50" stroke="#FBF4E6"/><path d="M19 26.5 L30.5 38" stroke="#FBF4E6"/><path d="M45.5 15 L30.5 38" stroke="#E6C27A"/>
        </g>
      </svg>
      <span aria-hidden="true" class="yaiku-word" [style.font-size.px]="height() * .74">Ya<span class="yaiku-dotless">ı</span>ku</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .yaiku-brand { display: inline-flex; align-items: center; color: #F3EAD7; }
    .yaiku-word { font-family: Inter, system-ui, sans-serif; font-weight: 700; letter-spacing: -.035em; line-height: 1; }
    .yaiku-dotless { position: relative; }
    .yaiku-dotless::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: .17em; height: .17em; bottom: .74em; border-radius: 50%; background: #D9B369; }
  `,
})
export class YaikuLogoComponent {
  readonly height = input(34);
  readonly gradientId = input.required<string>();
}
