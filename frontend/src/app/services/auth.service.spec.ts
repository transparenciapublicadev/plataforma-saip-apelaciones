import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from './auth.service';
import { LoginResponse } from '../models/usuario.model';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { authGuard } from '../guards/auth.guard';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/auth';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // --- HTTP Methods ---

  it('should send POST to /login', () => {
    const credentials = { identificador: 'test@mail.com', password: '123456' };
    const mockResponse: LoginResponse = { success: true, token: 'jwt-token', tipoUsuario: 'CIUDADANO' };

    service.login(credentials as any).subscribe(res => {
      expect(res.success).toBe(true);
      expect(res.token).toBe('jwt-token');
    });

    const req = httpMock.expectOne(`${apiUrl}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    req.flush(mockResponse);
  });

  it('should send POST to /registro', () => {
    const datos = { email: 'nuevo@mail.com', password: '123456', dni: '12345678' };

    service.registro(datos as any).subscribe();

    const req = httpMock.expectOne(`${apiUrl}/registro`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });

  it('should send GET to /verificar-email with param', () => {
    service.verificarEmail('test@mail.com').subscribe(res => {
      expect(res.existe).toBe(false);
    });

    const req = httpMock.expectOne(r => r.url === `${apiUrl}/verificar-email`);
    expect(req.request.params.get('email')).toBe('test@mail.com');
    req.flush({ existe: false });
  });

  it('should send GET to /verificar-dni with param', () => {
    service.verificarDni('12345678').subscribe(res => {
      expect(res.existe).toBe(true);
    });

    const req = httpMock.expectOne(r => r.url === `${apiUrl}/verificar-dni`);
    expect(req.request.params.get('dni')).toBe('12345678');
    req.flush({ existe: true });
  });

  it('should send GET to /me/:id', () => {
    service.getUsuarioActual(5).subscribe();

    const req = httpMock.expectOne(`${apiUrl}/me/5`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  // --- Session Management ---

  it('should save session to localStorage', () => {
    const data: LoginResponse = { success: true, token: 'abc', tipoUsuario: 'CIUDADANO' };
    service.guardarSesion(data);

    const stored = localStorage.getItem('usuario');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).token).toBe('abc');
  });

  it('should retrieve session from localStorage', () => {
    const data: LoginResponse = { success: true, token: 'xyz', tipoUsuario: 'FUNCIONARIO' };
    localStorage.setItem('usuario', JSON.stringify(data));

    const sesion = service.obtenerSesion();
    expect(sesion).not.toBeNull();
    expect(sesion!.token).toBe('xyz');
    expect(sesion!.tipoUsuario).toBe('FUNCIONARIO');
  });

  it('should return null when no session stored', () => {
    expect(service.obtenerSesion()).toBeNull();
  });

  it('should clear session on cerrarSesion', () => {
    localStorage.setItem('usuario', JSON.stringify({ token: 'x' }));
    service.cerrarSesion();
    expect(localStorage.getItem('usuario')).toBeNull();
    const req = httpMock.expectOne(`${apiUrl}/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer x');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('clears and protects the route while logout is pending and after a network failure', async () => {
    service.guardarSesion({ success: true, token: 'closing-session', tipoUsuario: 'CIUDADANO' });
    const result = service.cerrarSesion();
    const guard = () => TestBed.runInInjectionContext(() => authGuard(
      {} as ActivatedRouteSnapshot, { url: '/ciudadano/dashboard' } as RouterStateSnapshot));
    expect(guard()).toBe(false);
    const req = httpMock.expectOne(`${apiUrl}/logout`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer closing-session');
    expect(req.request.body).toBeNull();
    req.error(new ProgressEvent('error'));
    expect(await result).toBe('local');
    expect(service.getToken()).toBeNull();
    expect(guard()).toBe(false);
    expect(service.avisoCierreSesion()).toContain('No se pudo confirmar');
  });

  it('a confirmed logout leaves no banner', async () => {
    service.guardarSesion({ success: true, token: 'closing-session' });
    const result = service.cerrarSesion();
    expect(service.avisoCierreSesion()).toBeNull();
    httpMock.expectOne(`${apiUrl}/logout`).flush(null, { status: 204, statusText: 'No Content' });
    expect(await result).toBe('confirmado');
    expect(service.avisoCierreSesion()).toBeNull();
    expect(service.estaLogueado()).toBe(false);
  });

  it.each(['success', 'error'])('a late %s cannot clear or change the new login', async response => {
    service.guardarSesion({ success: true, token: 'old-session' });
    const closing = service.cerrarSesion();
    const oldRequest = httpMock.expectOne(`${apiUrl}/logout`);
    service.login({ identificador: 'test@mail.com', password: '123456' }).subscribe(data => service.guardarSesion(data));
    httpMock.expectOne(`${apiUrl}/login`).flush({ success: true, token: 'new-session', tipoUsuario: 'CIUDADANO' });
    expect(oldRequest.request.headers.get('Authorization')).toBe('Bearer old-session');
    if (response === 'success') oldRequest.flush(null, { status: 204, statusText: 'No Content' });
    else oldRequest.error(new ProgressEvent('error'));
    await closing;
    expect(service.getToken()).toBe('new-session');
    expect(service.estaLogueado()).toBe(true);
    expect(service.avisoCierreSesion()).toBeNull();
  });

  it('does not send another logout after the local session was already cleared', async () => {
    service.guardarSesion({ success: true, token: 'closing-session' });
    const first = service.cerrarSesion();
    expect(await service.cerrarSesion()).toBe('sin-sesion');
    httpMock.expectOne(`${apiUrl}/logout`).flush(null, { status: 204, statusText: 'No Content' });
    await first;
    httpMock.expectNone(`${apiUrl}/logout`);
  });

  it('a server rejection leaves only a local logout, without claiming success', async () => {
    service.guardarSesion({ success: true, token: 'already-invalid' });
    const closing = service.cerrarSesion();
    httpMock.expectOne(`${apiUrl}/logout`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await closing).toBe('local');
    expect(service.getToken()).toBeNull();
    expect(service.avisoCierreSesion()).toContain('No se pudo confirmar');
  });

  it('bounds a logout request that never responds and keeps the local logout', async () => {
    vi.useFakeTimers();
    try {
      service.guardarSesion({ success: true, token: 'unresponsive' });
      const closing = service.cerrarSesion();
      const req = httpMock.expectOne(`${apiUrl}/logout`);
      await vi.advanceTimersByTimeAsync(10_001);
      expect(await closing).toBe('local');
      expect(req.cancelled).toBe(true);
      expect(service.getToken()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // --- Auth State ---

  it('should return true for estaLogueado when token exists', () => {
    localStorage.setItem('usuario', JSON.stringify({ token: 'valid-token' }));
    expect(service.estaLogueado()).toBe(true);
  });

  it('should return false for estaLogueado when no token', () => {
    localStorage.setItem('usuario', JSON.stringify({ success: true }));
    expect(service.estaLogueado()).toBe(false);
  });

  it('should return false for estaLogueado when no session', () => {
    expect(service.estaLogueado()).toBe(false);
  });

  it('should return tipoUsuario from session', () => {
    localStorage.setItem('usuario', JSON.stringify({ token: 't', tipoUsuario: 'TTAIP' }));
    expect(service.getTipoUsuario()).toBe('TTAIP');
  });

  it('should return null tipoUsuario when no session', () => {
    expect(service.getTipoUsuario()).toBeNull();
  });

  it('should return token from session', () => {
    localStorage.setItem('usuario', JSON.stringify({ token: 'my-jwt' }));
    expect(service.getToken()).toBe('my-jwt');
  });

  it('should return null token when no session', () => {
    expect(service.getToken()).toBeNull();
  });
});
