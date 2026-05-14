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
    const mainNav = this.document.querySelector('[data-main-nav]');
    const header = this.document.querySelector('header');
    const footer = this.document.querySelector('footer');

    const topTargets = [instBar, mainNav ?? header].filter(Boolean);

    if (topTargets.length > 0) {
      gsap.fromTo(
        topTargets,
        { autoAlpha: 0, y: -12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.04,
          clearProps: 'opacity,visibility,transform',
        }
      );
    }

    if (mainNav) {
      const navItems = mainNav.querySelectorAll('a, button');
      if (navItems.length > 0) {
        gsap.set(navItems, { autoAlpha: 1, y: 0, clearProps: 'opacity,visibility,transform' });
      }
    }

    if (footer) {
      gsap.fromTo(
        footer,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.45, delay: 0.12, ease: 'power2.out', clearProps: 'all' }
      );
    }
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
        const isLandingPage = Boolean(routeHost.querySelector('[data-landing-page]'));

        gsap.fromTo(
          routeHost,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'all' }
        );

        this.runLandingIntro(gsap, routeHost);
        this.runMotionGroups(gsap, routeHost);
        this.runReferencePageMotion(gsap, routeHost);

        /* 2) Hero section fade matching design-reference motion/react */
        const heroTargets = routeHost.querySelectorAll('[data-hero], .text-gradient-hero');
        if (heroTargets.length > 0) {
          gsap.from(heroTargets, {
            autoAlpha: 0, y: 20, duration: 0.7, ease: 'power2.out',
            stagger: 0.08, delay: 0.04, overwrite: 'auto',
          });
        }

        /* 3) Metric cards: stagger with scale */
        const metricCards = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.metric-card, .stat-card:not([data-landing-stat])')
        );
        if (!isLandingPage && metricCards.length > 0) {
          gsap.from(metricCards, {
            autoAlpha: 0, y: 12,
            duration: 0.35, ease: 'power2.out',
            stagger: 0.05, delay: 0.12, overwrite: 'auto',
          });
        }

        /* 4) Cards, sections, forms: basic stagger */
        const bodyTargets = routeHost.querySelectorAll(
          '.form-shell:not([data-motion-item]), .process-tile, .data-table-wrapper, .table-container, .card:not([data-motion-item]), .card-elevated:not([data-motion-item]), .modal-panel, .alert, [data-animate]'
        );
        if (!isLandingPage && bodyTargets.length > 0) {
          gsap.from(bodyTargets, {
            autoAlpha: 0, y: 10, duration: 0.35,
            ease: 'power2.out', stagger: 0.025, delay: 0.1, overwrite: 'auto',
          });
        }

        /* 5) Scroll-triggered reveals for below-fold content */
        const revealTargets = gsap.utils.toArray<HTMLElement>(
          routeHost.querySelectorAll('.card:not([data-motion-item]), .card-elevated:not([data-motion-item]), .metric-card, .stat-card:not([data-landing-stat]), .form-shell:not([data-motion-item]), .process-tile, .table-container, .data-table-wrapper, form, .timeline-item, [data-reveal]:not([data-motion-item])')
        );
        revealTargets.forEach((target) => {
          gsap.fromTo(target, {
            autoAlpha: 0, y: 16
          }, {
            autoAlpha: 1, y: 0, duration: 0.45,
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
          routeHost.querySelectorAll('.metric-value, .stat-card:not([data-landing-stat]) .stat-card-value')
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
            duration: 0.9,
            ease: 'power2.out',
            delay: 0.2,
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
          routeHost.querySelectorAll('.divider-rojo, .divider-oro, .brand-divider')
        );
        dividers.forEach((div) => {
          gsap.from(div, {
            scaleX: 0, transformOrigin: 'center',
            duration: 0.5, ease: 'power2.out',
            scrollTrigger: { trigger: div, start: 'top 92%', once: true },
          });
        });

        this.runChartMotion(gsap, routeHost);
        this.runReferenceRowMotion(gsap, routeHost);

        ScrollTrigger.refresh();
      }
    );
  }

  private runBasicIntro(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    gsap.fromTo(
      routeHost,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'all' }
    );
  }

  private runLandingIntro(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    if (!routeHost.querySelector('[data-landing-page]')) return;

    const copy = routeHost.querySelector('[data-landing-copy]');
    const stats = routeHost.querySelector('[data-landing-stats]');
    const statCards = gsap.utils.toArray<HTMLElement>(
      routeHost.querySelectorAll('[data-landing-stat]')
    );
    const trust = routeHost.querySelector('[data-landing-trust]');

    if (copy) {
      gsap.from(copy, {
        autoAlpha: 0,
        y: 20,
        duration: 0.7,
        ease: 'power2.out',
        delay: 0.03,
        overwrite: 'auto',
      });
    }

    if (stats) {
      gsap.from(stats, {
        autoAlpha: 0,
        y: 20,
        duration: 0.7,
        ease: 'power2.out',
        delay: 0.2,
        overwrite: 'auto',
      });
    }

    if (statCards.length > 0) {
      gsap.from(statCards, {
        autoAlpha: 0,
        y: 16,
        duration: 0.42,
        ease: 'power2.out',
        delay: 0.3,
        stagger: 0.08,
        overwrite: 'auto',
      });
    }

    if (trust) {
      gsap.from(trust, {
        autoAlpha: 0,
        y: 8,
        duration: 0.4,
        ease: 'power2.out',
        delay: 0.36,
        overwrite: 'auto',
      });
    }
  }

  private runMotionGroups(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    const groups = gsap.utils.toArray<HTMLElement>(
      routeHost.querySelectorAll('[data-motion-stagger]')
    );

    groups.forEach((group) => {
      const targets = gsap.utils.toArray<HTMLElement>(group.querySelectorAll('[data-motion-item]'));
      if (targets.length === 0) return;

      const x = this.readNumberAttribute(group, 'data-motion-x', 0);
      const y = this.readNumberAttribute(group, 'data-motion-y', 16);
      const duration = this.readNumberAttribute(group, 'data-motion-duration', 0.45);
      const stagger = this.readNumberAttribute(group, 'data-motion-delay-step', 0.06);

      gsap.from(targets, {
        autoAlpha: 0,
        x,
        y,
        duration,
        ease: 'power2.out',
        stagger,
        overwrite: 'auto',
        scrollTrigger: {
          trigger: group,
          start: 'top 88%',
          once: true,
          toggleActions: 'play none none none',
        },
      });
    });
  }

  private runReferencePageMotion(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    if (routeHost.querySelector('[data-landing-page]')) return;

    const hero = routeHost.querySelector<HTMLElement>(
      '.relative.bg-paper.border-b.border-border.overflow-hidden'
    );
    const heroContent = hero?.querySelector<HTMLElement>(
      '.max-w-7xl, .max-w-5xl, .max-w-4xl, .max-w-3xl, .max-w-2xl'
    );

    if (heroContent) {
      gsap.from(heroContent, {
        autoAlpha: 0,
        y: 10,
        duration: 0.35,
        ease: 'power2.out',
        delay: 0.02,
        overwrite: 'auto',
      });
    }

    const primaryShell = routeHost.querySelector<HTMLElement>('.form-shell');
    if (primaryShell && !primaryShell.hasAttribute('data-reveal')) {
      gsap.from(primaryShell, {
        autoAlpha: 0,
        y: 8,
        duration: 0.32,
        ease: 'power2.out',
        delay: 0.08,
        overwrite: 'auto',
      });
    }
  }

  private runReferenceRowMotion(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    const rowTargets = gsap.utils.toArray<HTMLElement>(
      routeHost.querySelectorAll('tbody tr, [data-table-row], .timeline-item')
    );
    if (rowTargets.length === 0) return;

    gsap.from(rowTargets, {
      autoAlpha: 0,
      x: -6,
      duration: 0.28,
      ease: 'power2.out',
      stagger: 0.03,
      overwrite: 'auto',
      scrollTrigger: {
        trigger: rowTargets[0].closest('.form-shell, .table-container, .data-table-wrapper, section') ?? rowTargets[0],
        start: 'top 90%',
        once: true,
      },
    });
  }

  private runChartMotion(gsap: (typeof import('gsap'))['gsap'], routeHost: HTMLElement): void {
    const bars = gsap.utils.toArray<SVGRectElement>(
      routeHost.querySelectorAll('[data-chart-bar]')
    );
    if (bars.length > 0) {
      gsap.from(bars, {
        scaleY: 0,
        transformOrigin: '50% 100%',
        duration: 0.55,
        ease: 'power2.out',
        stagger: 0.04,
        scrollTrigger: {
          trigger: bars[0].closest('svg') ?? bars[0],
          start: 'top 88%',
          once: true,
        },
      });
    }

    const lines = gsap.utils.toArray<SVGPolylineElement>(
      routeHost.querySelectorAll('[data-chart-line]')
    );
    lines.forEach((line) => {
      const length = (line as SVGGeometryElement).getTotalLength?.() ?? 0;
      if (length <= 0) return;

      gsap.fromTo(
        line,
        { strokeDasharray: length, strokeDashoffset: length },
        {
          strokeDashoffset: 0,
          duration: 0.75,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: line.closest('svg') ?? line,
            start: 'top 88%',
            once: true,
          },
        }
      );
    });

    const points = gsap.utils.toArray<SVGCircleElement>(
      routeHost.querySelectorAll('[data-chart-point]')
    );
    if (points.length > 0) {
      gsap.from(points, {
        scale: 0,
        transformOrigin: '50% 50%',
        duration: 0.25,
        ease: 'back.out(1.7)',
        stagger: 0.025,
        scrollTrigger: {
          trigger: points[0].closest('svg') ?? points[0],
          start: 'top 88%',
          once: true,
        },
      });
    }
  }

  private readNumberAttribute(element: HTMLElement, attributeName: string, fallback: number): number {
    const value = Number(element.getAttribute(attributeName));
    return Number.isFinite(value) ? value : fallback;
  }
}
