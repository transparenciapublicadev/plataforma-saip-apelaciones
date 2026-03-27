import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Injectable({ providedIn: 'root' })
export class UxMotionService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private initialized = false;
  private routeMatchMedia: gsap.MatchMedia | null = null;

  private initialize(): boolean {
    if (!this.isBrowser) {
      return false;
    }

    if (typeof this.document.defaultView?.matchMedia !== 'function') {
      return false;
    }

    if (!this.initialized) {
      gsap.registerPlugin(ScrollTrigger);
      this.initialized = true;
    }

    return true;
  }

  animateShell(): void {
    if (!this.initialize()) {
      return;
    }

    const header = this.document.querySelector('header');
    const footer = this.document.querySelector('footer');
    if (!header || !footer) {
      return;
    }

    const canAnimate = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
    if (!canAnimate) {
      return;
    }

    gsap.fromTo(
      [header, footer],
      { autoAlpha: 0, y: -16 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        ease: 'power2.out',
        stagger: 0.08,
        clearProps: 'all',
      }
    );
  }

  animateRoute(mainElement: HTMLElement | null): void {
    if (!this.initialize() || !mainElement) {
      return;
    }

    const routeHost = mainElement.querySelector(':scope > :not(router-outlet)') as HTMLElement | null;
    if (!routeHost) {
      return;
    }

    this.routeMatchMedia?.revert();
    this.routeMatchMedia = null;

    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());

    const canUseMatchMedia = typeof this.document.defaultView?.matchMedia === 'function';
    if (!canUseMatchMedia) {
      this.runBasicIntro(routeHost);
      return;
    }

    this.routeMatchMedia = gsap.matchMedia();
    this.routeMatchMedia.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        motionEnabled: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const reduceMotion = Boolean(context.conditions?.['reduceMotion']);
        if (reduceMotion) {
          gsap.set(routeHost, { autoAlpha: 1, y: 0, clearProps: 'all' });
          return;
        }

        const prominentTargets = routeHost.querySelectorAll('h1, h2, .card-title, .form-section-title, [data-hero]');
        const bodyTargets = routeHost.querySelectorAll('section, article, .card, .metric-card, form, .table-container, .alert, [data-animate]');

        gsap.fromTo(
          routeHost,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            ease: 'power2.out',
            clearProps: 'all',
          }
        );

        if (prominentTargets.length > 0) {
          gsap.from(prominentTargets, {
            autoAlpha: 0,
            y: 22,
            duration: 0.52,
            ease: 'power3.out',
            stagger: 0.06,
            delay: 0.05,
            overwrite: 'auto',
          });
        }

        if (bodyTargets.length > 0) {
          gsap.from(bodyTargets, {
            autoAlpha: 0,
            y: 14,
            duration: 0.42,
            ease: 'power2.out',
            stagger: 0.03,
            delay: 0.14,
            overwrite: 'auto',
          });

          const revealTargets = gsap.utils.toArray<HTMLElement>(
            routeHost.querySelectorAll('.card, .metric-card, .table-container, form, .timeline-item, [data-reveal]')
          );

          revealTargets.forEach((target) => {
            gsap.from(target, {
              autoAlpha: 0,
              y: 20,
              duration: 0.5,
              ease: 'power1.out',
              scrollTrigger: {
                trigger: target,
                start: 'top 88%',
                once: true,
                toggleActions: 'play none none none',
              },
            });
          });
        }

        ScrollTrigger.refresh();
      }
    );
  }

  dispose(): void {
    this.routeMatchMedia?.revert();
    this.routeMatchMedia = null;
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }

  private runBasicIntro(routeHost: HTMLElement): void {
    gsap.fromTo(
      routeHost,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        ease: 'power2.out',
        clearProps: 'all',
      }
    );
  }
}
