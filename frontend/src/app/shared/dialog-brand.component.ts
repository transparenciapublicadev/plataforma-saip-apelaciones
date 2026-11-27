import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Editorial footer from design-reference's confirmation and result dialogs. */
@Component({
  selector: 'app-dialog-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="signature">
      <span class="line" aria-hidden="true"></span>
      <span class="name">Yaiku</span>
      <span aria-hidden="true">·</span>
      <span class="tagline">Pide, sigue y apela. Todo en un solo lugar.</span>
      <span class="line" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .signature {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 4px 28px 16px; color: var(--muted-foreground); text-align: center;
      font-size: 10px;
    }
    .line { width: 24px; height: 1px; flex-shrink: 0; background: var(--border); }
    .name { font-size: 11px; font-weight: 600; color: color-mix(in srgb, var(--foreground) 80%, transparent); }
    .tagline { min-width: 0; font-family: var(--font-serif); font-style: italic; font-size: 11.5px; }
  `,
})
export class DialogBrandComponent {}
