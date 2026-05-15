import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Directive, EmbeddedViewRef, OnDestroy, OnInit, PLATFORM_ID, TemplateRef, ViewContainerRef, inject } from '@angular/core';

let activeBodyScrollLocks = 0;
let previousBodyOverflow = '';

@Directive({
  selector: '[appBodyPortal]',
  standalone: true
})
export class BodyPortalDirective implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private movedNodes: Node[] = [];
  private locksBodyScroll = false;
  private viewRef: EmbeddedViewRef<unknown> | null = null;

  ngOnInit(): void {
    this.viewRef = this.viewContainerRef.createEmbeddedView(this.templateRef);
    this.viewRef.detectChanges();

    if (!isPlatformBrowser(this.platformId) || !this.document.body) {
      return;
    }

    if (activeBodyScrollLocks === 0) {
      previousBodyOverflow = this.document.body.style.overflow;
    }

    activeBodyScrollLocks += 1;
    this.locksBodyScroll = true;
    this.document.body.style.overflow = 'hidden';

    for (const node of this.viewRef.rootNodes) {
      if (this.isDomNode(node)) {
        this.document.body.appendChild(node);
        this.movedNodes.push(node);
      }
    }
  }

  ngOnDestroy(): void {
    for (const node of this.movedNodes) {
      node.parentNode?.removeChild(node);
    }

    this.movedNodes = [];

    if (this.locksBodyScroll && isPlatformBrowser(this.platformId) && this.document.body) {
      activeBodyScrollLocks = Math.max(0, activeBodyScrollLocks - 1);

      if (activeBodyScrollLocks === 0) {
        this.document.body.style.overflow = previousBodyOverflow;
      }
    }

    if (this.viewRef && !this.viewRef.destroyed) {
      this.viewRef.destroy();
    }
  }

  private isDomNode(value: unknown): value is Node {
    return typeof value === 'object' && value !== null && 'nodeType' in value;
  }
}
