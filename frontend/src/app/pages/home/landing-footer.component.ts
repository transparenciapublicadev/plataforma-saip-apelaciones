import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowUpRight } from '@lucide/angular';

@Component({
  selector: 'app-landing-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideArrowUpRight],
  templateUrl: './landing-footer.component.html',
  styles: `
    :host { display: block; }
    footer { overflow-wrap: anywhere; }
    a:focus-visible { outline: 2px solid var(--gold-soft); outline-offset: 4px; }
    .yaiku-brand { display: inline-flex; align-items: center; gap: 9.52px; color: #F3EAD7; }
    .yaiku-word { font-family: Inter, system-ui, sans-serif; font-size: 25.16px; font-weight: 700; letter-spacing: -.035em; line-height: 1; }
    .yaiku-dotless { position: relative; }
    .yaiku-dotless::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: .17em; height: .17em; bottom: .74em; border-radius: 50%; background: #D9B369; }
  `,
})
export class LandingFooterComponent {}
