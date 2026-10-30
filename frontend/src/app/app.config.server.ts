import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { env } from 'node:process';
import { SERVER_API_ORIGIN, serverApiInterceptor } from './interceptors/server-api.interceptor';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    { provide: SERVER_API_ORIGIN, useFactory: () => env['API_INTERNAL_ORIGIN'] },
    provideHttpClient(withFetch(), withInterceptors([serverApiInterceptor])),
    provideServerRendering(withRoutes(serverRoutes))
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
