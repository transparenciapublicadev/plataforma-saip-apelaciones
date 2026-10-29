import { CommonModule } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { UxMotionService } from './services/ux-motion.service';
import {
  LucideSun, LucideMoon, LucideLayoutDashboard, LucidePlus,
  LucideScale, LucideSettings, LucideLogOut, LucideChevronDown,
  LucideHome, LucideSearch, LucideHelpCircle, LucideX, LucideMenu, LucideUserPen
} from '@lucide/angular';

import { GuidedTourComponent } from './core/guided-tour/guided-tour.component';
import { GuidedTourService } from './core/guided-tour/guided-tour.service';
import { HostListener, effect } from '@angular/core';
import { NotificationBellComponent } from './shared/notification-bell.component';
import { LandingFooterComponent } from './pages/home/landing-footer.component';
import { ProfileDialogComponent } from './shared/profile-dialog.component';
import { ProfileDialogService } from './services/profile-dialog.service';
import { YaikuLogoComponent } from './shared/yaiku-logo.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    GuidedTourComponent, NotificationBellComponent, LandingFooterComponent, ProfileDialogComponent, YaikuLogoComponent,
    LucideSun, LucideMoon, LucideLayoutDashboard, LucidePlus,
    LucideScale, LucideSettings, LucideLogOut, LucideChevronDown,
    LucideHome, LucideSearch, LucideHelpCircle, LucideX, LucideMenu, LucideUserPen
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly motionService = inject(UxMotionService);
  private readonly guidedTourService = inject(GuidedTourService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private sessionRevision = this.authService.cambiosSesion();
  private splashFrame: number | null = null;

  readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');
  readonly profileDialog = inject(ProfileDialogService);

  readonly menuAbierto = signal(false);
  readonly mobileMenuAbierto = signal(false);
  readonly showSplash = signal(false);
  readonly avisoCierreSesion = this.authService.avisoCierreSesion;
  readonly entidadEtiqueta = computed(() => {
    const s = this.sesionActual();
    return s?.token && s.tipoUsuario === 'FUNCIONARIO' && Number.isSafeInteger(s.usuarioId) && s.usuarioId! > 0
      && s.funcionarioId === s.usuarioId && Number.isSafeInteger(s.entidadId) && s.entidadId! > 0
      && typeof s.entidadNombre === 'string' ? s.entidadNombre.trim() : '';
  });

  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (revision !== this.sessionRevision) {
        this.sessionRevision = revision;
        this.menuAbierto.set(false); this.mobileMenuAbierto.set(false);
      }
      if (this.guidedTourService.isOpen()) {
        this.menuAbierto.set(false);
        this.mobileMenuAbierto.set(false);
      }
    });

    if (typeof window !== 'undefined' && this.isLandingRoute() && !this.reducedMotion()) {
      try { this.showSplash.set(!sessionStorage.getItem('saip_splash_shown')); } catch { /* Storage unavailable: content remains accessible. */ }
    }
    // Branding is transitional, not an artificial loading gate. Dismiss after
    // the initial paint without waiting for an animation, network or storage.
    afterNextRender(() => {
      if (this.showSplash()) this.splashFrame = requestAnimationFrame(() => {
        this.splashFrame = requestAnimationFrame(() => this.dismissSplash());
      });
      else this.animateShell();
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.dismissSplash(false);
        this.menuAbierto.set(false);
        this.mobileMenuAbierto.set(false);
        if (typeof window !== 'undefined' && !(this.isLandingRoute() && this.router.parseUrl(this.router.url).fragment)) {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        if (!this.showSplash()) {
          this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
        }
      });

    this.destroyRef.onDestroy(() => {
      if (this.splashFrame !== null) cancelAnimationFrame(this.splashFrame);
      this.motionService.dispose();
    });
  }

  private sesionActual() {
    this.authService.cambiosSesion();
    try { return this.authService.obtenerSesion(); } catch { return null; }
  }
  private reducedMotion(): boolean { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
  private animateShell(): void { this.motionService.animateShell(); this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null); }
  private dismissSplash(animate = true): void {
    if (this.splashFrame !== null) cancelAnimationFrame(this.splashFrame); this.splashFrame = null;
    if (!this.showSplash()) return;
    this.showSplash.set(false);
    try { sessionStorage.setItem('saip_splash_shown', 'true'); } catch { /* Presentation only; never delay content. */ }
    if (animate) this.animateShell();
  }

  isLoggedIn(): boolean {
    return this.sesionActual()?.token != null;
  }

  nombreUsuario(): string {
    const sesion = this.sesionActual();
    return sesion?.nombre || 'Usuario';
  }

  userInitials(): string {
    return this.nombreUsuario()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  userFirstName(): string {
    return this.nombreUsuario().split(' ').filter(Boolean)[0] || this.nombreUsuario();
  }

  tipoUsuario(): string {
    return this.sesionActual()?.tipoUsuario || '';
  }

  toggleMenu(): void {
    this.menuAbierto.set(!this.menuAbierto());
    if (this.menuAbierto()) {
      this.mobileMenuAbierto.set(false);
      this.focusMenu('#desktop-user-menu [role="menuitem"]', this.menuAbierto);
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuAbierto.set(!this.mobileMenuAbierto());
    if (this.mobileMenuAbierto()) {
      this.menuAbierto.set(false);
      this.focusMenu('#mobile-navigation-panel a, #mobile-navigation-panel button', this.mobileMenuAbierto);
    }
  }

  private focusMenu(selector: string, open: () => boolean): void {
    afterNextRender(() => { if (open()) this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(); }, { injector: this.injector });
  }
  @HostListener('document:keydown', ['$event'])
  onHeaderKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.profileDialog.abierto() || (event.target as Element)?.closest?.('app-notification-bell')) return;
    if (event.key === 'Escape' && (this.menuAbierto() || this.mobileMenuAbierto())) {
      event.preventDefault(); const mobile = this.mobileMenuAbierto();
      this.menuAbierto.set(false); this.mobileMenuAbierto.set(false);
      this.host.nativeElement.querySelector<HTMLElement>(mobile ? '#mobile-menu-trigger' : '#desktop-user-trigger')?.focus();
      return;
    }
    const menu = this.host.nativeElement.querySelector('#desktop-user-menu');
    if (!this.menuAbierto() || !menu?.contains(event.target as Node) || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (!items.length) return;
    event.preventDefault(); const index = items.indexOf(document.activeElement as HTMLElement);
    items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  }
  @HostListener('document:click', ['$event'])
  @HostListener('document:focusin', ['$event'])
  closeHeaderMenusOutside(event: Event): void {
    if (this.profileDialog.abierto() || (event.target as Element)?.closest?.('app-profile-dialog')) return;
    const target = event.target as Node;
    const within = (selector: string) => Array.from(this.host.nativeElement.querySelectorAll(selector)).some(node => node.contains(target));
    if (this.menuAbierto() && !within('#desktop-user-menu, #desktop-user-trigger')) this.menuAbierto.set(false);
    if (this.mobileMenuAbierto() && !within('#mobile-navigation-panel, #mobile-menu-trigger')) this.mobileMenuAbierto.set(false);
  }

  logout(): void {
    void this.authService.cerrarSesion();
    this.menuAbierto.set(false);
    this.mobileMenuAbierto.set(false);
    this.router.navigate(['/']);
  }

  isAuthRoute(): boolean {
    const currentUrl = this.router.url.split(/[?#]/)[0];
    return currentUrl === '/login'
      || currentUrl === '/registro'
      || currentUrl === '/acceso-funcionario'
      || currentUrl === '/acceso-ttaip'
      || currentUrl === '/acceso-admin';
  }

  isLandingRoute(): boolean {
    const currentUrl = this.router.url.split('?')[0].split('#')[0];
    return currentUrl === '/';
  }

  isInfoRoute(): boolean {
    const currentUrl = this.router.url.split(/[?#]/)[0].replace(/\/$/, '');
    return currentUrl === '/documentacion' || currentUrl === '/acerca';
  }

  scrollToSection(sectionId: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const element = document.getElementById(sectionId);
    if (!element) return;

    const offset = (this.host.nativeElement.querySelector('[data-main-nav]')?.getBoundingClientRect().bottom || (this.isAuthRoute() ? 92 : 100)) + 8;
    const elementPosition = element.getBoundingClientRect().top;
    window.scrollTo({
      top: elementPosition + window.pageYOffset - offset,
      behavior: this.reducedMotion() ? 'instant' : 'smooth',
    });
    element.tabIndex = -1; element.focus({ preventScroll: true });
  }

  currentTheme(): 'light' | 'dark' {
    return this.themeService.theme();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
