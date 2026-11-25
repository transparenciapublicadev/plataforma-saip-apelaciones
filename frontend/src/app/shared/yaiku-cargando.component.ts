import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { YaikuLogoComponent } from './yaiku-logo.component';

let siguienteMarca = 0;

@Component({
  selector: 'app-yaiku-cargando',
  imports: [YaikuLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-live="polite" class="yaiku-cargando" [class.yaiku-cargando-compacto]="compacto()">
      <div class="yaiku-cargando-marca">
        <span class="yaiku-cargando-anillo" aria-hidden="true"></span>
        <app-yaiku-logo [height]="compacto() ? 32 : 46" tone="auto" [gradientId]="marca" />
      </div>
      <p>{{ mensaje() }}</p>
    </div>
  `,
  styles: `
    :host { display: block; }
    .yaiku-cargando {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1.1rem; padding: 4.5rem 1.5rem; text-align: center;
    }
    .yaiku-cargando p { margin: 0; font-size: 0.9rem; color: var(--muted-foreground); }
    .yaiku-cargando-compacto { gap: 0.7rem; padding: 1.25rem 1rem; }
    .yaiku-cargando-compacto p { font-size: 0.8rem; }
    .yaiku-cargando-marca { position: relative; display: grid; place-items: center; padding: 0.85rem; }
    .yaiku-cargando-anillo {
      position: absolute; inset: 0; border-radius: 999px;
      border: 2px solid color-mix(in srgb, var(--brand-200) 75%, transparent);
      border-top-color: var(--brand-700);
      animation: yaiku-giro 0.9s linear infinite;
    }
    @keyframes yaiku-giro { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .yaiku-cargando-anillo { animation: none; }
    }
  `,
})
export class YaikuCargandoComponent {
  readonly mensaje = input('Cargando…');
  readonly compacto = input(false);
  readonly marca = `yaiku-carga-${++siguienteMarca}`;
}
