import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from './auth.service';
import { LoginResponse } from '../models/usuario.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/auth';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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
