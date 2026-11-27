import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const BARRAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

@Component({
  selector: 'app-yaiku-cargando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-live="polite" class="yaiku-cargando" [class.yaiku-cargando-compacto]="compacto()">
      <div class="actividad" aria-hidden="true">
        @for (barra of barras; track barra) {
          <span [style.transform]="'rotate(' + barra * 30 + 'deg)'" [style.animation-delay]="retraso(barra)"></span>
        }
      </div>
      <p>{{ mensaje() }}</p>
    </div>
  `,
  styles: `
    :host { display: block; }
    .yaiku-cargando {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.9rem; padding: 4.5rem 1.5rem; text-align: center;
    }
    .yaiku-cargando p { margin: 0; font-size: 0.9rem; color: var(--muted-foreground); }
    .yaiku-cargando-compacto { gap: 0.65rem; padding: 1.25rem 1rem; }
    .yaiku-cargando-compacto p { font-size: 0.8rem; }
    .yaiku-cargando-compacto .actividad { width: 1.35rem; height: 1.35rem; }
    .actividad { position: relative; width: 1.75rem; height: 1.75rem; }
    .actividad span {
      position: absolute; left: 50%; top: 0; width: 2px; height: 28%;
      margin-left: -1px; border-radius: 999px; background: var(--brand-700);
      transform-origin: 1px 0.875rem; animation: yaiku-actividad 0.9s linear infinite;
    }
    .yaiku-cargando-compacto .actividad span { transform-origin: 1px 0.675rem; }
    @keyframes yaiku-actividad {
      0% { opacity: 1; }
      100% { opacity: 0.16; }
    }
    @media (prefers-reduced-motion: reduce) {
      .actividad span { animation: none; opacity: 0.28; }
      .actividad span:nth-child(-n + 4) { opacity: 1; }
    }
  `,
})
export class YaikuCargandoComponent {
  readonly mensaje = input('Cargando…');
  readonly compacto = input(false);
  readonly barras = BARRAS;
  retraso(barra: number): string { return `${-0.9 + barra * 0.075}s`; }
}
