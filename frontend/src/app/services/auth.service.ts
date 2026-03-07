import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { LoginRequest, LoginResponse, RegistroRequest, RegistroResponse } from '../models/usuario.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials);
  }

  registro(datos: RegistroRequest): Observable<RegistroResponse> {
    return this.http.post<RegistroResponse>(`${this.apiUrl}/registro`, datos);
  }

  verificarEmail(email: string): Observable<{ existe: boolean }> {
    return this.http.get<{ existe: boolean }>(`${this.apiUrl}/verificar-email`, {
      params: { email }
    });
  }

  verificarDni(dni: string): Observable<{ existe: boolean }> {
    return this.http.get<{ existe: boolean }>(`${this.apiUrl}/verificar-dni`, {
      params: { dni }
    });
  }

  getUsuarioActual(usuarioId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/me/${usuarioId}`);
  }

  guardarSesion(data: LoginResponse): void {
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      localStorage.setItem('usuario', JSON.stringify(data));
    }
  }

  obtenerSesion(): LoginResponse | null {
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('usuario');
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  cerrarSesion(): void {
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      localStorage.removeItem('usuario');
    }
  }

  estaLogueado(): boolean {
    if (!this.isBrowser || typeof localStorage === 'undefined') {
      return false;
    }
    const sesion = this.obtenerSesion();
    return sesion?.token != null;
  }

  getTipoUsuario(): string | null {
    if (!this.isBrowser || typeof localStorage === 'undefined') {
      return null;
    }
    const sesion = this.obtenerSesion();
    return sesion ? sesion.tipoUsuario || null : null;
  }

  getToken(): string | null {
    if (!this.isBrowser || typeof localStorage === 'undefined') {
      return null;
    }
    const sesion = this.obtenerSesion();
    return sesion?.token || null;
  }
}

