import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BodyPortalDirective } from './body-portal.directive';

export type ReferenceSuccessTone = 'success' | 'warning' | 'brand' | 'gold';

export interface ReferenceSuccessMeta {
  label: string;
  value: string;
  mono?: boolean;
}

export interface ReferenceSuccessNextStep {
  label: string;
  hint?: string;
}

@Component({
  selector: 'app-reference-success-modal',
  standalone: true,
  imports: [CommonModule, BodyPortalDirective],
  template: `
    @if (open) {
      <ng-container *appBodyPortal>
        <div class="reference-modal-host" role="presentation">
        <button
          type="button"
          class="reference-modal-overlay"
          aria-label="Cerrar modal"
          (click)="close.emit()">
        </button>

        <section
          class="reference-success-panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title"
          [attr.data-tone]="tone">
          <header class="reference-success-hero">
            <div class="reference-success-paper"></div>
            <div class="reference-success-glow"></div>
            <div class="reference-success-gold-line"></div>
            @if (tone !== 'warning') {
              <div class="reference-confetti" aria-hidden="true">
                @for (piece of confettiPieces; track piece.id) {
                  <span
                    [class]="'shape-' + piece.shape"
                    [style.left.%]="piece.left"
                    [style.--piece-delay]="piece.delay + 'ms'"
                    [style.--piece-duration]="piece.duration + 'ms'"
                    [style.--piece-drift]="piece.drift + 'px'"
                    [style.--piece-rotate]="piece.rotate + 'deg'"
                    [style.--piece-size]="piece.size + 'px'"
                    [style.--piece-color]="piece.color">
                  </span>
                }
              </div>
            }

            <button
              type="button"
              class="reference-success-close"
              aria-label="Cerrar"
              (click)="close.emit()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-width="2" d="M18 6 6 18" />
                <path stroke-width="2" d="m6 6 12 12" />
              </svg>
            </button>

            <div class="reference-success-hero-inner">
              <div class="reference-success-icon" aria-hidden="true">
                @switch (variant) {
                  @case ('saip-creada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M22 2 11 13" />
                      <path stroke-width="2" d="m22 2-7 20-4-9-9-4Z" />
                    </svg>
                  }
                  @case ('apelacion-presentada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M12 3v18" />
                      <path stroke-width="2" d="M5 7h14" />
                      <path stroke-width="2" d="M7 21h10" />
                    </svg>
                  }
                  @case ('respuesta-entidad') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M3 21h18" />
                      <path stroke-width="2" d="M5 21V7l7-4 7 4v14" />
                    </svg>
                  }
                  @case ('calificacion-1ra') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="m14 9-7 7" />
                      <path stroke-width="2" d="m17 6 3 3" />
                      <path stroke-width="2" d="m3 21 6-6" />
                    </svg>
                  }
                  @case ('calificacion-2da') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z" />
                      <path stroke-width="2" d="m3 12.5 9 4.5 9-4.5" />
                    </svg>
                  }
                  @case ('resolucion-final') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M12 3v18" />
                      <path stroke-width="2" d="M7 21h10" />
                      <path stroke-width="2" d="M5 7h14" />
                    </svg>
                  }
                  @case ('subsanacion-enviada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path stroke-width="2" d="M14 2v6h6" />
                      <path stroke-width="2" d="M8 13h8" />
                      <path stroke-width="2" d="M8 17h5" />
                    </svg>
                  }
                  @case ('cuenta-creada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="m9 12 2 2 4-4" />
                      <circle cx="12" cy="12" r="10" stroke-width="2" />
                    </svg>
                  }
                  @case ('sesion-iniciada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
                    </svg>
                  }
                  @default {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="m9 12 2 2 4-4" />
                      <circle cx="12" cy="12" r="10" stroke-width="2" />
                    </svg>
                  }
                }
                <span></span>
              </div>

              <div class="reference-success-eyebrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-width="2" d="m12 3 1.9 5.8L20 12l-6.1 3.2L12 21l-1.9-5.8L4 12l6.1-3.2L12 3Z" />
                </svg>
                {{ eyebrow }}
              </div>
              <h2>{{ title }}</h2>
              @if (description) {
                <p>{{ description }}</p>
              }
            </div>
          </header>

          <div class="reference-success-body custom-scrollbar">
            @if (expediente) {
              <div class="reference-expediente-card">
                <div class="reference-expediente-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-width="2" d="M7 3h8l5 5v13H7z" />
                    <path stroke-width="2" d="M15 3v6h6" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="reference-small-label">Nro. de expediente</div>
                  <div class="reference-expediente-value">{{ expediente }}</div>
                  @if (expedienteHint) {
                    <div class="reference-expediente-hint">{{ expedienteHint }}</div>
                  }
                </div>
                <button type="button" (click)="copyExpediente()">Copiar</button>
              </div>
            }

            @if (metadata.length > 0) {
              <div class="reference-success-meta">
                @for (item of metadata; track item.label) {
                  <div>
                    <div class="reference-small-label">{{ item.label }}</div>
                    <div class="reference-meta-value" [class.font-mono]="item.mono">{{ item.value }}</div>
                  </div>
                }
              </div>
            }

            @if (plazoDias !== null && plazoDescripcion) {
              <div class="reference-plazo-card">
                <div class="reference-plazo-bar"></div>
                <div class="reference-plazo-days">
                  <span>{{ plazoDias }}</span>
                  <small>días {{ plazoTipo }}</small>
                </div>
                <div class="reference-plazo-separator"></div>
                <div class="min-w-0 flex-1">
                  <div class="reference-plazo-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M6 3h12" />
                      <path stroke-width="2" d="M6 21h12" />
                      <path stroke-width="2" d="M8 3v5a4 4 0 0 0 2 3.5L12 13l2-1.5A4 4 0 0 0 16 8V3" />
                    </svg>
                    Plazo aplicable
                  </div>
                  <p>{{ plazoDescripcion }}</p>
                  @if (plazoNorma) {
                    <small>{{ plazoNorma }}</small>
                  }
                </div>
              </div>
            }

            @if (nextSteps.length > 0) {
              <div>
                <div class="reference-next-label">
                  <span></span>
                  Próximos pasos
                </div>
                <ul class="reference-next-list">
                  @for (step of nextSteps; track step.label; let i = $index) {
                    <li>
                      <span>{{ i + 1 }}</span>
                      <div>
                        <div>{{ step.label }}</div>
                        @if (step.hint) {
                          <small>{{ step.hint }}</small>
                        }
                      </div>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>

          <footer class="reference-success-footer">
            <div class="reference-success-actions">
              @if (secondaryLabel) {
                <button type="button" class="btn-ghost-brand !py-2.5 flex-1 justify-center" (click)="secondary.emit()">
                  {{ secondaryLabel }}
                </button>
              }
              <button type="button" class="btn-brand !py-2.5 flex-1 justify-center" (click)="primary.emit()">
                {{ primaryLabel }}
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-width="2" d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
            <div class="reference-modal-signature">
              <span></span>
              TTAIP · República del Perú
              <span></span>
            </div>
          </footer>
        </section>
        </div>
      </ng-container>
    }
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferenceSuccessModalComponent {
  @Input() open = false;
  @Input() variant = 'generic';
  @Input() tone: ReferenceSuccessTone = 'success';
  @Input() eyebrow = 'Operación completada';
  @Input() title = 'Acción realizada';
  @Input() description = '';
  @Input() expediente = '';
  @Input() expedienteHint = '';
  @Input() plazoDias: number | null = null;
  @Input() plazoTipo = 'hábiles';
  @Input() plazoDescripcion = '';
  @Input() plazoNorma = '';
  @Input() metadata: ReferenceSuccessMeta[] = [];
  @Input() nextSteps: ReferenceSuccessNextStep[] = [];
  @Input() primaryLabel = 'Continuar';
  @Input() secondaryLabel = '';

  @Output() close = new EventEmitter<void>();
  @Output() primary = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();

  readonly confettiPieces = [
    { id: 1, left: 5, delay: 20, duration: 2850, rotate: 180, drift: 32, size: 8, shape: 'ribbon', color: 'var(--brand-700)' },
    { id: 2, left: 9, delay: 90, duration: 3300, rotate: -220, drift: -24, size: 6, shape: 'dot', color: 'var(--gold)' },
    { id: 3, left: 13, delay: 130, duration: 2950, rotate: 260, drift: 42, size: 7, shape: 'diamond', color: 'var(--gold-soft)' },
    { id: 4, left: 17, delay: 60, duration: 3600, rotate: -140, drift: -36, size: 5, shape: 'spark', color: '#ffffff' },
    { id: 5, left: 21, delay: 170, duration: 3100, rotate: 340, drift: 28, size: 10, shape: 'ribbon', color: 'var(--brand-800)' },
    { id: 6, left: 25, delay: 40, duration: 3450, rotate: -260, drift: -30, size: 7, shape: 'dot', color: '#ffffff' },
    { id: 7, left: 29, delay: 210, duration: 3000, rotate: 220, drift: 44, size: 8, shape: 'diamond', color: 'var(--gold)' },
    { id: 8, left: 33, delay: 80, duration: 3700, rotate: -320, drift: -26, size: 4, shape: 'spark', color: 'var(--gold-soft)' },
    { id: 9, left: 37, delay: 145, duration: 3220, rotate: 190, drift: 34, size: 9, shape: 'ribbon', color: 'var(--brand-700)' },
    { id: 10, left: 41, delay: 30, duration: 3550, rotate: -210, drift: -38, size: 6, shape: 'dot', color: 'var(--gold-soft)' },
    { id: 11, left: 45, delay: 260, duration: 3380, rotate: 250, drift: 30, size: 6, shape: 'diamond', color: '#ffffff' },
    { id: 12, left: 49, delay: 300, duration: 3720, rotate: -180, drift: -40, size: 8, shape: 'ribbon', color: 'var(--gold)' },
    { id: 13, left: 53, delay: 270, duration: 3440, rotate: 280, drift: 35, size: 6, shape: 'dot', color: 'var(--brand-700)' },
    { id: 14, left: 57, delay: 240, duration: 3180, rotate: -120, drift: -20, size: 5, shape: 'spark', color: '#ffffff' },
    { id: 15, left: 61, delay: 110, duration: 3860, rotate: 410, drift: 50, size: 11, shape: 'ribbon', color: 'var(--gold-soft)' },
    { id: 16, left: 65, delay: 190, duration: 3020, rotate: -310, drift: -42, size: 7, shape: 'dot', color: 'var(--brand-800)' },
    { id: 17, left: 69, delay: 65, duration: 3650, rotate: 155, drift: 24, size: 8, shape: 'diamond', color: '#ffffff' },
    { id: 18, left: 73, delay: 335, duration: 3330, rotate: -265, drift: -34, size: 4, shape: 'spark', color: 'var(--gold)' },
    { id: 19, left: 77, delay: 155, duration: 3900, rotate: 300, drift: 38, size: 9, shape: 'ribbon', color: 'var(--brand-700)' },
    { id: 20, left: 81, delay: 45, duration: 3160, rotate: -190, drift: -18, size: 7, shape: 'dot', color: 'var(--gold)' },
    { id: 21, left: 85, delay: 280, duration: 3520, rotate: 235, drift: 30, size: 7, shape: 'diamond', color: 'var(--gold-soft)' },
    { id: 22, left: 89, delay: 120, duration: 3740, rotate: -345, drift: -46, size: 5, shape: 'spark', color: '#ffffff' },
    { id: 23, left: 93, delay: 215, duration: 3090, rotate: 205, drift: 20, size: 8, shape: 'ribbon', color: 'var(--brand-800)' },
    { id: 24, left: 7, delay: 360, duration: 3420, rotate: -240, drift: -35, size: 6, shape: 'dot', color: '#ffffff' },
    { id: 25, left: 15, delay: 395, duration: 3980, rotate: 320, drift: 45, size: 9, shape: 'diamond', color: 'var(--gold)' },
    { id: 26, left: 23, delay: 250, duration: 3280, rotate: -160, drift: -26, size: 4, shape: 'spark', color: 'var(--gold-soft)' },
    { id: 27, left: 31, delay: 410, duration: 3610, rotate: 375, drift: 36, size: 10, shape: 'ribbon', color: 'var(--brand-700)' },
    { id: 28, left: 39, delay: 205, duration: 3070, rotate: -285, drift: -32, size: 7, shape: 'dot', color: 'var(--gold-soft)' },
    { id: 29, left: 47, delay: 455, duration: 3830, rotate: 215, drift: 27, size: 6, shape: 'diamond', color: '#ffffff' },
    { id: 30, left: 55, delay: 315, duration: 3480, rotate: -225, drift: -43, size: 5, shape: 'spark', color: '#ffffff' },
    { id: 31, left: 63, delay: 425, duration: 3700, rotate: 295, drift: 41, size: 8, shape: 'ribbon', color: 'var(--gold)' },
    { id: 32, left: 71, delay: 375, duration: 3200, rotate: -330, drift: -29, size: 6, shape: 'dot', color: 'var(--brand-700)' },
    { id: 33, left: 79, delay: 470, duration: 3940, rotate: 255, drift: 44, size: 8, shape: 'diamond', color: 'var(--gold-soft)' },
    { id: 34, left: 87, delay: 290, duration: 3360, rotate: -175, drift: -22, size: 4, shape: 'spark', color: 'var(--gold)' },
    { id: 35, left: 95, delay: 445, duration: 3580, rotate: 225, drift: 26, size: 9, shape: 'ribbon', color: 'var(--brand-800)' },
    { id: 36, left: 12, delay: 505, duration: 3860, rotate: -305, drift: -37, size: 6, shape: 'dot', color: '#ffffff' },
    { id: 37, left: 52, delay: 490, duration: 3650, rotate: 330, drift: 33, size: 7, shape: 'diamond', color: 'var(--gold)' },
    { id: 38, left: 92, delay: 520, duration: 4010, rotate: -250, drift: -39, size: 5, shape: 'spark', color: '#ffffff' }
  ];

  copyExpediente(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard && this.expediente) {
      void navigator.clipboard.writeText(this.expediente);
    }
  }
}
