import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Entidad } from '../models/entidad.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EntidadService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/entidades`;

  findAll(): Observable<Entidad[]> {
    return this.http.get<Entidad[]>(this.apiUrl);
  }

  findActivas(): Observable<Entidad[]> {
    return this.http.get<Entidad[]>(`${this.apiUrl}/activas`);
  }

  findById(id: number): Observable<Entidad> {
    return this.http.get<Entidad>(`${this.apiUrl}/${id}`);
  }

  findByIdConEstadisticas(id: number): Observable<Entidad> {
    return this.http.get<Entidad>(`${this.apiUrl}/${id}/estadisticas`);
  }

  buscarPorNombre(nombre: string): Observable<Entidad[]> {
    return this.http.get<Entidad[]>(`${this.apiUrl}/buscar`, {
      params: { nombre }
    });
  }

  crear(entidad: Partial<Entidad>): Observable<Entidad> {
    return this.http.post<Entidad>(this.apiUrl, entidad);
  }

  actualizar(id: number, entidad: Partial<Entidad>): Observable<Entidad> {
    return this.http.put<Entidad>(`${this.apiUrl}/${id}`, entidad);
  }

  cambiarEstado(id: number, estado: string): Observable<Entidad> {
    return this.http.patch<Entidad>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}

