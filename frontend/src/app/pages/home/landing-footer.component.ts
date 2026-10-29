import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowUpRight } from '@lucide/angular';
import { YaikuLogoComponent } from '../../shared/yaiku-logo.component';

@Component({
  selector: 'app-landing-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideArrowUpRight, YaikuLogoComponent],
  templateUrl: './landing-footer.component.html',
  styles: `
    :host { display: block; }
    footer { overflow-wrap: anywhere; }
    a:focus-visible { outline: 2px solid var(--gold-soft); outline-offset: 4px; }
  `,
})
/** Shared Yaiku footer; retains its original selector for existing consumers. */
export class LandingFooterComponent {}
