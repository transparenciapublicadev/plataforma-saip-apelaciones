import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioAdmin {
  id: number;
  email: string;
  tipoUsuario: 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR';
  fechaRegistro: string;
  activo: boolean;
  nombre: string;
  entidadId?: number;
}

export interface CrearUsuarioAdmin {
  email: string;
  password: string;
  tipoUsuario: UsuarioAdmin['tipoUsuario'];
  nombre?: string;
  entidadId?: number;
}

export interface ActualizarUsuarioAdmin {
  email?: string;
  nombre?: string;
  tipoUsuario?: UsuarioAdmin['tipoUsuario'];
  activo?: boolean;
  entidadId?: number;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  findAll(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(this.apiUrl);
  }

  crear(usuario: CrearUsuarioAdmin): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(this.apiUrl, usuario);
  }

  actualizar(id: number, usuario: ActualizarUsuarioAdmin): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${this.apiUrl}/${id}`, usuario);
  }

  cambiarEstado(id: number, activo: boolean): Observable<UsuarioAdmin> {
    return this.http.patch<UsuarioAdmin>(`${this.apiUrl}/${id}/estado`, { activo });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
