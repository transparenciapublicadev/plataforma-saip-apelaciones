import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, OnDestroy, Output, PLATFORM_ID, inject } from '@angular/core';

/** Opt-in for dialogs: contain keyboard focus and return it to the opening control. */
@Directive({ selector: '[appModalFocus]' })
export class ModalFocusDirective implements AfterViewInit, OnDestroy {
  @Input() appModalFocus = false;
  @Output() modalEscape = new EventEmitter<void>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(PLATFORM_ID);
  private previous: HTMLElement | null = null;
  private destroyed = false;
  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); this.modalEscape.emit(); return; }
    if (event.key !== 'Tab') return;
    const controls = this.controls();
    const first = controls[0], last = controls.at(-1), active = this.document.activeElement;
    if (!first || !this.host.nativeElement.contains(active) || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      if (!first) this.host.nativeElement.focus();
    }
  };
  ngAfterViewInit(): void {
    if (!this.appModalFocus || !isPlatformBrowser(this.platform)) return;
    this.previous = this.document.activeElement as HTMLElement | null;
    this.document.addEventListener('keydown', this.onKey);
    queueMicrotask(() => {
      if (!this.destroyed) (this.controls()[0] || this.host.nativeElement).focus();
    });
  }
  private controls(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
    )).filter(el => !el.closest('[hidden], [aria-hidden="true"]'));
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.document.removeEventListener('keydown', this.onKey);
    if (this.previous?.isConnected) this.previous.focus();
  }
}
