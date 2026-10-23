import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { UxMotionService } from './services/ux-motion.service';
import {
  LucideSun, LucideMoon, LucideLayoutDashboard, LucidePlus,
  LucideScale, LucideSettings, LucideLogOut, LucideChevronDown,
  LucideMail, LucidePhone, LucideMapPin, LucideArrowUpRight,
  LucideHome, LucideSearch, LucideHelpCircle, LucideX, LucideMenu
} from '@lucide/angular';

import { GuidedTourComponent } from './core/guided-tour/guided-tour.component';
import { GuidedTourService } from './core/guided-tour/guided-tour.service';
import { HostListener, effect } from '@angular/core';
import { NotificationBellComponent } from './shared/notification-bell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    GuidedTourComponent, NotificationBellComponent,
    LucideSun, LucideMoon, LucideLayoutDashboard, LucidePlus,
    LucideScale, LucideSettings, LucideLogOut, LucideChevronDown,
    LucideMail, LucidePhone, LucideMapPin, LucideArrowUpRight,
    LucideHome, LucideSearch, LucideHelpCircle, LucideX, LucideMenu
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

  readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');

  readonly menuAbierto = signal(false);
  readonly mobileMenuAbierto = signal(false);
  readonly showSplash = signal(false);
  readonly splashLeaving = signal(false);
  readonly avisoCierreSesion = this.authService.avisoCierreSesion;

  constructor() {
    effect(() => {
      if (this.guidedTourService.isOpen()) {
        this.menuAbierto.set(false);
        this.mobileMenuAbierto.set(false);
      }
    });

    if (typeof window !== 'undefined' && this.isLandingRoute() && !sessionStorage.getItem('saip_splash_shown')) {
      this.showSplash.set(true);
      setTimeout(() => {
        this.splashLeaving.set(true);
      }, 1900);

      setTimeout(() => {
        this.showSplash.set(false);
        try {
          sessionStorage.setItem('saip_splash_shown', 'true');
        } catch {}
        setTimeout(() => {
          this.motionService.animateShell();
          this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
        });
      }, 2400);
    } else {
      setTimeout(() => {
        this.motionService.animateShell();
        this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
      });
    }

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.menuAbierto.set(false);
        this.mobileMenuAbierto.set(false);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        if (!this.showSplash()) {
          this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
        }
      });

    this.destroyRef.onDestroy(() => {
      this.motionService.dispose();
    });

    setTimeout(() => {
      if (!this.showSplash()) {
        this.motionService.animateShell();
        this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
      }
    });
  }

  isLoggedIn(): boolean {
    return this.authService.estaLogueado();
  }

  nombreUsuario(): string {
    const sesion = this.authService.obtenerSesion();
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
    return this.authService.getTipoUsuario() || '';
  }

  toggleMenu(): void {
    this.menuAbierto.set(!this.menuAbierto());
  }

  toggleMobileMenu(): void {
    this.mobileMenuAbierto.set(!this.mobileMenuAbierto());
  }

  logout(): void {
    void this.authService.cerrarSesion();
    this.menuAbierto.set(false);
    this.mobileMenuAbierto.set(false);
    this.router.navigate(['/']);
  }

  isAuthRoute(): boolean {
    const currentUrl = this.router.url.split('?')[0];
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

  scrollToSection(sectionId: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const element = document.getElementById(sectionId);
    if (!element) return;

    const offset = 80;
    const elementPosition = element.getBoundingClientRect().top;
    window.scrollTo({
      top: elementPosition + window.pageYOffset - offset,
      behavior: 'smooth',
    });
  }

  currentTheme(): 'light' | 'dark' {
    return this.themeService.theme();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
