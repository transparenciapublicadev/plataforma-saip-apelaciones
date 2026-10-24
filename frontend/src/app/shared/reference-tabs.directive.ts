import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** Arrow/Home/End navigation for the existing, locally rendered tab panels. */
@Directive({ selector: '[appReferenceTabs]' })
export class ReferenceTabsDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  @HostListener('keydown', ['$event']) onKey(event: KeyboardEvent): void {
    const tabs = Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); tabs[next].click(); tabs[next].focus();
  }
}
