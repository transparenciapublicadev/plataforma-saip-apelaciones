import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, tipoUsuarioGuard } from './auth.guard';

describe('Auth Guards', () => {
  let router: Router;
  const mockRoute: any = {};
  const mockState: any = { url: '/test' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: {} as any },
          { path: '**', component: {} as any },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  afterEach(() => localStorage.clear());

  describe('authGuard', () => {
    it('should return true when user is logged in', () => {
      localStorage.setItem('usuario', JSON.stringify({ token: 'valid-token' }));
      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
      expect(result).toBe(true);
    });

    it('should navigate to /login and return false when not logged in', () => {
      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
      expect(result).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('tipoUsuarioGuard', () => {
    it('should return true when user type matches', () => {
      localStorage.setItem('usuario', JSON.stringify({ token: 't', tipoUsuario: 'CIUDADANO' }));
      const guard = tipoUsuarioGuard('CIUDADANO');
      const result = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(result).toBe(true);
    });

    it('should match case-insensitively', () => {
      localStorage.setItem('usuario', JSON.stringify({ token: 't', tipoUsuario: 'FUNCIONARIO' }));
      const guard = tipoUsuarioGuard('funcionario');
      const result = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(result).toBe(true);
    });

    it('should navigate to / when type does not match', () => {
      localStorage.setItem('usuario', JSON.stringify({ token: 't', tipoUsuario: 'CIUDADANO' }));
      const guard = tipoUsuarioGuard('ADMIN');
      const result = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(result).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should navigate to /login when not logged in', () => {
      const guard = tipoUsuarioGuard('CIUDADANO');
      const result = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(result).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
