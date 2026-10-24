import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BodyPortalDirective } from './body-portal.directive';
import { ModalFocusDirective } from './modal-focus.directive';

export interface ReferenceConfirmSummary {
  label: string;
  value: string;
  mono?: boolean;
}

export interface ReferenceConfirmWarning {
  label: string;
  detail: string;
}

@Component({
  selector: 'app-reference-confirm-modal',
  standalone: true,
  imports: [CommonModule, BodyPortalDirective, ModalFocusDirective],
  template: `
    @if (open) {
      <ng-container *appBodyPortal>
        <div class="reference-modal-host" role="presentation">
          <button
            type="button"
            class="reference-modal-overlay"
            aria-label="Cerrar modal"
            [disabled]="submitting"
            (click)="close.emit()">
          </button>

          <section
            class="reference-confirm-panel"
            role="dialog"
            tabindex="-1"
            [appModalFocus]="manageFocus"
            (modalEscape)="!submitting && close.emit()"
            aria-modal="true"
            [attr.aria-label]="title">
            <header class="reference-confirm-header">
              <div class="reference-modal-gold-line"></div>
              <div class="reference-confirm-header-inner">
                <div class="reference-confirm-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-width="2" d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
                    <path stroke-width="2" d="m9 12 2 2 4-4" />
                  </svg>
                </div>

                <div class="min-w-0">
                  <div class="reference-confirm-eyebrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="m12 3 1.9 5.8L20 12l-6.1 3.2L12 21l-1.9-5.8L4 12l6.1-3.2L12 3Z" />
                    </svg>
                    {{ eyebrow }}
                  </div>
                  <h2 class="reference-confirm-title">
                    {{ titleLead }}
                    <em>{{ titleEmphasis }}</em>
                  </h2>
                  @if (description) {
                    <p class="reference-confirm-description">{{ description }}</p>
                  }
                </div>
              </div>
            </header>

            <div class="reference-confirm-body custom-scrollbar">
              @if (summary.length > 0) {
                <div>
                  <div class="reference-modal-section-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M8 4h8" />
                      <path stroke-width="2" d="M8 8h8" />
                      <path stroke-width="2" d="M8 12h5" />
                      <rect x="5" y="2" width="14" height="20" rx="2" stroke-width="2" />
                    </svg>
                    Resumen de su solicitud
                  </div>

                  <dl class="reference-confirm-summary">
                    @for (item of summary; track item.label; let i = $index) {
                      <div class="reference-confirm-summary-row" [class.first]="i === 0">
                        <dt>{{ item.label }}</dt>
                        <dd [class.font-mono]="item.mono">{{ item.value }}</dd>
                      </div>
                    }
                  </dl>
                </div>
              }

              @if (warning) {
                <div class="reference-confirm-warning">
                  <div class="reference-confirm-warning-bar"></div>
                  <div class="reference-confirm-warning-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="M12 9v4" />
                      <path stroke-width="2" d="M12 17h.01" />
                      <path stroke-width="2" d="M10.3 4.3 2.8 17.4A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.6L13.7 4.3a2 2 0 0 0-3.4 0Z" />
                    </svg>
                    <div class="reference-confirm-warning-text">
                      <div class="reference-confirm-warning-label">{{ warning.label }}</div>
                      <p>{{ warning.detail }}</p>
                    </div>
                  </div>
                </div>
              }

              <p class="reference-confirm-legal">
                Al confirmar declara que la información proporcionada es veraz. Aún puede volver a revisarla antes de enviarla.
              </p>
            </div>

            <footer class="reference-confirm-footer">
              <div class="reference-confirm-actions">
                <button
                  type="button"
                  class="btn-ghost-brand !py-2.5 flex-1 justify-center"
                  [disabled]="submitting"
                  (click)="close.emit()">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-width="2" d="M12 20h9" />
                    <path stroke-width="2" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  {{ cancelLabel }}
                </button>
                <button
                  type="button"
                  class="btn-brand !py-2.5 flex-1 justify-center disabled:opacity-60"
                  [disabled]="submitting"
                  (click)="confirm.emit()">
                  @if (submitting) {
                    Enviando...
                  } @else {
                    {{ confirmLabel }}
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-width="2" d="m9 18 6-6-6-6" />
                    </svg>
                  }
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
  styles: [`
    :host { display: contents; }
    .reference-modal-host {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 16px;
      width: 100dvw;
      height: 100dvh;
      overflow: hidden;
      isolation: isolate;
    }
    .reference-modal-overlay {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--brand-900) 55%, transparent);
      border: 0;
      backdrop-filter: blur(3px);
      cursor: default;
      animation: referenceOverlayIn 180ms ease both;
    }
    .reference-modal-overlay:disabled {
      opacity: 1;
      cursor: default;
    }
    .reference-confirm-panel {
      position: relative;
      z-index: 1;
      width: min(520px, calc(100vw - 2rem));
      max-height: min(92dvh, calc(100dvh - 32px));
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 12px;
      background: var(--card);
      color: var(--foreground);
      box-shadow: var(--shadow-xl), 0 0 0 1px var(--border);
      animation: referenceModalIn 260ms var(--ease-out-expo) both;
      will-change: opacity, transform;
    }
    .reference-confirm-header {
      position: relative;
      flex-shrink: 0;
      padding: 24px 28px 18px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, var(--brand-subtle), var(--card));
    }
    .reference-modal-gold-line {
      position: absolute;
      inset: 0 0 auto;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
    }
    .reference-confirm-header-inner {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .reference-confirm-icon {
      width: 48px;
      height: 48px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--card);
      border: 1px solid var(--brand-200);
      color: var(--brand-700);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }
    .reference-confirm-icon svg { width: 20px; height: 20px; }
    .reference-confirm-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--brand-700);
      font-weight: 650;
    }
    .reference-confirm-eyebrow svg {
      width: 12px;
      height: 12px;
      color: var(--gold);
    }
    .reference-confirm-title {
      margin-top: 6px;
      font-family: var(--font-serif);
      font-size: 22px;
      line-height: 1.15;
      letter-spacing: -0.018em;
      color: var(--foreground);
      text-wrap: balance;
    }
    .reference-confirm-title em {
      margin-left: 5px;
      color: var(--brand-700);
      font-style: italic;
    }
    .reference-confirm-description {
      margin-top: 8px;
      font-size: 14px;
      line-height: 1.55;
      color: var(--muted-foreground);
    }
    .reference-confirm-body {
      flex: 1;
      min-height: 0;
      max-height: none;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--muted-foreground) 35%, transparent) transparent;
      padding: 18px 28px 24px;
      scroll-padding-bottom: 16px;
    }
    .reference-confirm-body > * + * {
      margin-top: 14px;
    }
    .reference-confirm-body::-webkit-scrollbar { width: 8px; }
    .reference-confirm-body::-webkit-scrollbar-track { background: transparent; }
    .reference-confirm-body::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: color-mix(in srgb, var(--muted-foreground) 35%, transparent);
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .reference-modal-section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: var(--muted-foreground);
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .reference-modal-section-label svg {
      width: 14px;
      height: 14px;
      color: var(--gold-dark, var(--gold));
    }
    .reference-confirm-summary {
      min-height: 0;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--card);
    }
    .reference-confirm-summary-row {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      gap: 12px;
      padding: 10px 16px;
      border-top: 1px dashed var(--border);
    }
    .reference-confirm-summary-row.first { border-top: 0; }
    .reference-confirm-summary dt {
      align-self: center;
      color: var(--muted-foreground);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .reference-confirm-summary dd {
      color: var(--foreground);
      font-size: 14px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .reference-confirm-warning {
      position: relative;
      display: block;
      height: auto;
      min-height: 72px;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 10px;
      border: 1px solid rgba(180, 83, 9, 0.22);
      background: rgba(180, 83, 9, 0.07);
      padding: 14px;
    }
    .reference-confirm-warning-bar {
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--warning, #B45309);
    }
    .reference-confirm-warning-content {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
      padding-left: 8px;
    }
    .reference-confirm-warning-content > svg {
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
      margin-top: 2px;
      color: var(--warning, #B45309);
    }
    .reference-confirm-warning-text {
      min-width: 0;
      overflow: visible;
    }
    .reference-confirm-warning-label {
      color: var(--warning, #B45309);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 650;
    }
    .reference-confirm-warning p {
      margin-top: 2px;
      color: color-mix(in srgb, var(--foreground) 85%, transparent);
      font-size: 13px;
      line-height: 1.35;
      overflow: visible;
    }
    .reference-confirm-legal {
      flex-shrink: 0;
      color: var(--muted-foreground);
      font-size: 12px;
      line-height: 1.55;
      font-style: italic;
    }
    .reference-confirm-footer {
      flex-shrink: 0;
      border-top: 1px solid var(--border);
      background: color-mix(in srgb, var(--brand-subtle) 30%, transparent);
    }
    .reference-confirm-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 28px 10px;
    }
    .reference-modal-signature {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 4px 28px 12px;
      color: var(--muted-foreground);
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-align: center;
    }
    .reference-modal-signature span {
      width: 24px;
      height: 1px;
      background: var(--border);
    }
    @media (max-width: 640px) {
      .reference-confirm-header,
      .reference-confirm-body { padding-left: 20px; padding-right: 20px; }
      .reference-confirm-actions {
        flex-direction: column-reverse;
        padding-left: 20px;
        padding-right: 20px;
      }
      .reference-confirm-summary-row {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
    @media (max-height: 700px) {
      .reference-modal-host {
        padding: 6px;
      }
      .reference-confirm-panel {
        max-height: min(92dvh, calc(100dvh - 12px));
      }
      .reference-confirm-header {
        padding: 20px 24px 16px;
      }
      .reference-confirm-icon {
        width: 44px;
        height: 44px;
      }
      .reference-confirm-title {
        font-size: 21px;
      }
      .reference-confirm-description {
        font-size: 13px;
        line-height: 1.45;
      }
      .reference-confirm-body {
        padding: 14px 24px 16px;
      }
      .reference-confirm-body > * + * {
        margin-top: 12px;
      }
      .reference-confirm-actions {
        padding: 12px 24px 8px;
      }
      .reference-modal-signature {
        padding-bottom: 10px;
      }
    }
    @keyframes referenceOverlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes referenceModalIn {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferenceConfirmModalComponent {
  @Input() open = false;
  @Input() manageFocus = false;
  @Input() submitting = false;
  @Input() title = '¿Confirma el envío?';
  @Input() titleLead = 'Confirma';
  @Input() titleEmphasis = 'el envío';
  @Input() eyebrow = 'Revisión final';
  @Input() description = '';
  @Input() summary: ReferenceConfirmSummary[] = [];
  @Input() warning: ReferenceConfirmWarning | null = null;
  @Input() confirmLabel = 'Confirmar y enviar';
  @Input() cancelLabel = 'Volver a revisar';

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
