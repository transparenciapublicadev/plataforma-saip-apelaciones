import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, OnDestroy, Output, PLATFORM_ID, inject } from '@angular/core';

const activeDialogs = new WeakMap<Document, ModalFocusDirective[]>();

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
  private registered = false;
  private isTop(): boolean { return activeDialogs.get(this.document)?.at(-1) === this; }
  private readonly onKey = (event: KeyboardEvent) => {
    if (!this.isTop()) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); this.modalEscape.emit(); return;
    }
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
    const stack = activeDialogs.get(this.document) || [];
    stack.push(this); activeDialogs.set(this.document, stack); this.registered = true;
    // Capture before keyboard handlers on the underlying overlay/page.
    this.document.addEventListener('keydown', this.onKey, true);
    queueMicrotask(() => {
      if (!this.destroyed && this.isTop()) (this.controls()[0] || this.host.nativeElement).focus();
    });
  }
  private controls(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
    )).filter(el => !el.closest('[hidden], [aria-hidden="true"]'));
  }
  ngOnDestroy(): void {
    const wasTop = this.isTop();
    this.destroyed = true;
    this.document.removeEventListener('keydown', this.onKey, true);
    if (!this.registered) return;
    const stack = activeDialogs.get(this.document)!;
    stack.splice(stack.indexOf(this), 1);
    // If an underlying dialog is destroyed first, retain the return path without
    // stealing focus from a child that is still open (including body portals).
    for (const dialog of stack) {
      if (dialog.previous && this.host.nativeElement.contains(dialog.previous)) dialog.previous = this.previous;
    }
    if (!stack.length) activeDialogs.delete(this.document);
    if (!wasTop) return;
    const next = stack.at(-1);
    if (this.previous?.isConnected && (!next || next.host.nativeElement.contains(this.previous))) this.previous.focus();
    else if (next) (next.controls()[0] || next.host.nativeElement).focus();
  }
}
