import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { LoginRequest, LoginResponse, RegistroRequest, RegistroResponse } from '../models/usuario.model';
import { environment } from '../../environments/environment';

export type ResultadoCierreSesion = 'confirmado' | 'local' | 'sin-sesion';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private cierreEnCurso = 0;
  private readonly avisoCierre = signal<string | null>(null);
  readonly avisoCierreSesion = this.avisoCierre.asReadonly();
  private readonly cerrando = signal(false);
  readonly cerrandoSesion = this.cerrando.asReadonly();
  private readonly cambioSesion = signal(0);
  readonly cambiosSesion = this.cambioSesion.asReadonly();

  constructor() {
    if (this.isBrowser && typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => {
        if (event.key === 'usuario' || event.key === null) this.notificarCambioSesion();
      };
      window.addEventListener('storage', onStorage);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
    }
  }

  private notificarCambioSesion(): void {
    this.cambioSesion.update(value => value + 1);
  }

  terminarCierreVisual(): void {
    this.cerrando.set(false);
  }

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
      this.avisoCierre.set(null);
      this.cerrando.set(false);
      this.notificarCambioSesion();
    }
  }

  obtenerSesion(): LoginResponse | null {
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('usuario');
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  async cerrarSesion(): Promise<ResultadoCierreSesion> {
    const token = this.getToken();
    const cierre = ++this.cierreEnCurso;
    if (!this.isBrowser || typeof localStorage === 'undefined') {
      return 'sin-sesion';
    }
    // Clear immediately so guards stop admitting this session, even when offline.
    this.cerrando.set(true);
    this.avisoCierre.set(null);
    localStorage.removeItem('usuario');
    this.notificarCambioSesion();
    if (!token) return 'sin-sesion';

    let resultado: ResultadoCierreSesion;
    try {
      await firstValueFrom(this.http.post<void>(`${this.apiUrl}/logout`, null, {
        // Capture this issuance; the interceptor must not substitute a later login.
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      }).pipe(timeout(10_000)));
      resultado = 'confirmado';
    } catch {
      resultado = 'local';
    }
    // The browser session is already closed. A failed server confirmation must not
    // raise a warning over the page the person is leaving.
    if (cierre === this.cierreEnCurso && this.getToken()) this.cerrando.set(false);
    return resultado;
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

