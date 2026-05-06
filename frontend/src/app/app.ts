import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { UxMotionService } from './services/ux-motion.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly motionService = inject(UxMotionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');

  readonly menuAbierto = signal(false);
  readonly mobileMenuAbierto = signal(false);

  constructor() {
    this.motionService.animateShell();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.menuAbierto.set(false);
        this.mobileMenuAbierto.set(false);
        this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
      });

    this.destroyRef.onDestroy(() => {
      this.motionService.dispose();
    });

    setTimeout(() => {
      this.motionService.animateRoute(this.mainContent()?.nativeElement ?? null);
    });
  }

  isLoggedIn(): boolean {
    return this.authService.estaLogueado();
  }

  nombreUsuario(): string {
    const sesion = this.authService.obtenerSesion();
    return sesion?.nombre || 'Usuario';
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
    this.authService.cerrarSesion();
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

  currentTheme(): 'light' | 'dark' {
    return this.themeService.theme();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}

