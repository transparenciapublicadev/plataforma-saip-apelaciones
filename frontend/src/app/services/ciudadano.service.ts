import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Ciudadano } from '../models/ciudadano.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CiudadanoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ciudadanos`;

  findAll(): Observable<Ciudadano[]> {
    return this.http.get<Ciudadano[]>(this.apiUrl);
  }

  findById(id: number): Observable<Ciudadano> {
    return this.http.get<Ciudadano>(`${this.apiUrl}/${id}`);
  }

  findByDni(dni: string): Observable<Ciudadano> {
    return this.http.get<Ciudadano>(`${this.apiUrl}/dni/${dni}`);
  }

  findByIdConEstadisticas(id: number): Observable<Ciudadano> {
    return this.http.get<Ciudadano>(`${this.apiUrl}/${id}/estadisticas`);
  }

  crear(ciudadano: Partial<Ciudadano>): Observable<Ciudadano> {
    return this.http.post<Ciudadano>(this.apiUrl, ciudadano);
  }

  actualizar(id: number, ciudadano: Partial<Ciudadano>): Observable<Ciudadano> {
    return this.http.put<Ciudadano>(`${this.apiUrl}/${id}`, ciudadano);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Ciudadano> {
    return this.http.patch<Ciudadano>(`${this.apiUrl}/${id}/estado`, { activo });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

