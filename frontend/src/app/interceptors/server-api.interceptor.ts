import { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';

export const SERVER_API_ORIGIN = new InjectionToken<string | undefined>('SSR API origin', {
  providedIn: 'root', factory: () => undefined,
});

/** Resolve only the application's relative API URLs on the SSR server. */
export const serverApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!/^\/api(?:\/|\?|$)/.test(request.url)) {
    return next(request);
  }

  const configured = inject(SERVER_API_ORIGIN);
  if (!configured) {
    throw new Error('API_INTERNAL_ORIGIN is required for server-side API requests');
  }
  const origin = new URL(configured);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
  ) {
    throw new Error('API_INTERNAL_ORIGIN must be an HTTP origin without credentials or a path');
  }
  return next(request.clone({ url: origin.origin + request.url }));
};
