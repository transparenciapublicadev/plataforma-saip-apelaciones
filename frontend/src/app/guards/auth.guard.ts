import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

function getLoginRouteByRole(tipoRequerido: string): string {
  const normalized = tipoRequerido.toUpperCase();
  if (normalized === 'FUNCIONARIO') return '/acceso-funcionario';
  if (normalized === 'TTAIP') return '/acceso-ttaip';
  if (normalized === 'ADMINISTRADOR' || normalized === 'ADMIN') return '/acceso-admin';
  return '/login';
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaLogueado()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const tipoUsuarioGuard = (...tiposRequeridos: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const acceso = tiposRequeridos[0] ?? 'CIUDADANO';

    if (!authService.estaLogueado()) {
      router.navigate([getLoginRouteByRole(acceso)]);
      return false;
    }

    const tipoUsuario = authService.getTipoUsuario()?.toLowerCase();
    const permitidos = new Set(tiposRequeridos.map(tipo => tipo.toLowerCase()));
    if (tipoUsuario && permitidos.has(tipoUsuario)) {
      return true;
    }

    router.navigate(['/']);
    return false;
  };
};

