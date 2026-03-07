import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

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
      router.navigate(['/login']);
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

