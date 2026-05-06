import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

type GsapMatchMedia = ReturnType<(typeof import('gsap'))['gsap']['matchMedia']>;

@Injectable({ providedIn: 'root' })
export class UxMotionService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private initialized = false;
  private initializing: Promise<boolean> | null = null;
  private gsapRef: (typeof import('gsap'))['gsap'] | null = null;
  private scrollTriggerRef: (typeof import('gsap/ScrollTrigger'))['ScrollTrigger'] | null = null;
  private routeMatchMedia: GsapMatchMedia | null = null;
  private animationToken = 0;

  private async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (!this.isBrowser) return false;
    if (typeof this.document.defaultView?.matchMedia !== 'function') return false;
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      this.gsapRef = gsap;
      this.scrollTriggerRef = ScrollTrigger;
      this.initialized = true;
      return true;
    })().catch(() => false);

    return this.initializing;
  }

  animateShell(): void {
    void this.runShellAnimation();
  }

  animateRoute(mainElement: HTMLElement | null): void {
    void this.runRouteAnimation(mainElement);
  }

  dispose(): void {
    this.routeMatchMedia?.revert();
    this.routeMatchMedia = null;
    this.scrollTriggerRef?.getAll().forEach((trigger) => trigger.kill());
  }

  /* ─── Shell: header slide-down + institutional bar ─── */
  private async runShellAnimation(): Promise<void> {
    if (!(await this.initialize())) return;
    const gsap = this.gsapRef;
    if (!gsap) return;

    const canAnimate = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
    if (!canAnimate) return;

    const instBar = this.document.querySelector('[data-inst-bar]');
    const header = this.document.querySelector('header');
    const footer = this.document.querySelector('footer');

    const targets = [instBar, header, footer].filter(Boolean);
    if (targets.length === 0) return;

    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: -16 },
      { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out', stagger: 0.08, clearProps: 'all' }
    );
  }

  /* ─── Route: entrance + scroll-reveals + counters ─── */
  private async runRouteAnimation(mainElement: HTMLElement | null): Promise<void> {
    if (!mainElement) return;
    if (!(await this.initialize())) return;

    const gsap = this.gsapRef;
    const ScrollTrigger = this.scrollTriggerRef;
    if (!gsap || !ScrollTrigger) return;

    const currentToken = ++this.animationToken;
    const routeHost = mainElement.querySelector(':scope > :not(router-outlet)') as HTMLElement | null;
    if (!routeHost) return;
    if (currentToken !== this.animationToken) return;

    this.routeMatchMedia?.revert();
    this.routeMatchMedia = null;
    ScrollTrigger.getAll().forEach((t) => t.kill());

    const canUseMatchMedia = typeof this.document.defaultView?.matchMedia === 'function';
    if (!canUseMatchMedia) {
      this.runBasicIntro(gsap, routeHost);
      return;
    }

    this.routeMatchMedia = gsap.matchMedia();
    this.routeMatchMedia.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        motionEnabled: '(prefers-reduced-motion: no-preference)',
      },
      (context: { conditions?: Record<string, boolean> }) => {
        if (Boolean(context.conditions?.['reduceMotion'])) {
          gsap.set(routeHost, { autoAlpha: 1, y: 0, clearProps: 'all' });
          return;
        }

        /* 1) Route entrance fade */
        gsap.fromTo(
          routeHost,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'all' }
        );

        /* 2) Hero section parallax-like fade */
        const heroTargets = routeHost.querySelectorAll('h1, h2, [data-hero], .text-gradient-hero');
        if (heroTargets.length > 0) {
          gsap.from(heroTargets, {
            autoAlpha: 0, y: 28, duration: 0.6, ease: 'power3.out',
            stagger: 0.08, delay: 0.05, overwrite: 'auto',
          });
        }

        /* 3) Metric cards: stagger with scale */
        const metricCards = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.metric-card, .glass')
        );
        if (metricCards.length > 0) {
          gsap.from(metricCards, {
            autoAlpha: 0, y: 20, scale: 0.95,
            duration: 0.45, ease: 'back.out(1.4)',
            stagger: 0.06, delay: 0.12, overwrite: 'auto',
          });
        }

        /* 4) Cards, sections, forms: basic stagger */
        const bodyTargets = routeHost.querySelectorAll(
          'section, article, .card, .card-elevated, form, .table-container, .alert, [data-animate]'
        );
        if (bodyTargets.length > 0) {
          gsap.from(bodyTargets, {
            autoAlpha: 0, y: 14, duration: 0.42,
            ease: 'power2.out', stagger: 0.03, delay: 0.14, overwrite: 'auto',
          });
        }

        /* 5) Scroll-triggered reveals for below-fold content */
        const revealTargets = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.card, .card-elevated, .metric-card, .table-container, form, .timeline-item, [data-reveal]')
        );
        revealTargets.forEach((target) => {
          gsap.fromTo(target, {
            autoAlpha: 0, y: 24
          }, {
            autoAlpha: 1, y: 0, duration: 0.55,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: target,
              start: 'top 88%',
              once: true,
              toggleActions: 'play none none none',
            },
          });
        });

        /* 6) Number counter animation for metric values */
        const metricValues = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.metric-value')
        );
        metricValues.forEach((el) => {
          const text = el.textContent?.trim() ?? '';
          const numericMatch = text.match(/^[\d,]+(\.\d+)?/);
          if (!numericMatch) return;

          const rawNum = numericMatch[0].replace(/,/g, '');
          const endVal = parseFloat(rawNum);
          if (isNaN(endVal) || endVal === 0) return;

          const suffix = text.slice(numericMatch[0].length);
          const hasDecimal = rawNum.includes('.');
          const obj = { val: 0 };

          gsap.to(obj, {
            val: endVal,
            duration: 1.2,
            ease: 'power2.out',
            delay: 0.3,
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              once: true,
            },
            onUpdate: () => {
              const formatted = hasDecimal
                ? obj.val.toFixed(1)
                : Math.round(obj.val).toLocaleString('es-PE');
              el.textContent = formatted + suffix;
            },
          });
        });

        /* 7) Section tags: slide in from left */
        const sectionTags = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.section-tag')
        );
        sectionTags.forEach((tag) => {
          gsap.from(tag, {
            autoAlpha: 0, x: -20, duration: 0.4,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: tag,
              start: 'top 90%',
              once: true,
            },
          });
        });

        /* 8) Dividers: width grow */
        const dividers = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.divider-rojo, .divider-oro')
        );
        dividers.forEach((div) => {
          gsap.from(div, {
            scaleX: 0, transformOrigin: 'center',
            duration: 0.6, ease: 'power2.out',
            scrollTrigger: { trigger: div, start: 'top 92%', once: true },
          });
        });

        ScrollTrigger.refresh();
      }
    );
  }

  private runBasicIntro(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    gsap.fromTo(
      routeHost,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'all' }
    );
  }
}
