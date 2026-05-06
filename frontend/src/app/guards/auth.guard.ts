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

export const tipoUsuarioGuard = (tipoRequerido: string): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.estaLogueado()) {
      router.navigate([getLoginRouteByRole(tipoRequerido)]);
      return false;
    }

    const tipoUsuario = authService.getTipoUsuario();
    if (tipoUsuario?.toLowerCase() === tipoRequerido.toLowerCase()) {
      return true;
    }

    router.navigate(['/']);
    return false;
  };
};

