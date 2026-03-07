import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  if (isBrowser && typeof localStorage !== 'undefined') {
    const usuario = localStorage.getItem('usuario');

    if (usuario) {
      const userData = JSON.parse(usuario);

      if (userData.token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${userData.token}`
          }
        });

        return next(authReq);
      }
    }
  }

  return next(req);
};

