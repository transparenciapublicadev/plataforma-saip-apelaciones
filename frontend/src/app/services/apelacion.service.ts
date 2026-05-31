import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Apelacion, ApelacionCreate, ApelacionCreateExterna } from '../models/apelacion.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApelacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/apelaciones`;

  findAll(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(this.apiUrl);
  }

  findById(id: number): Observable<Apelacion> {
    return this.http.get<Apelacion>(`${this.apiUrl}/${id}`);
  }

  findByExpediente(expediente: string): Observable<Apelacion> {
    return this.http.get<Apelacion>(`${this.apiUrl}/expediente/${expediente}`);
  }

  findByEstado(estado: string): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/estado/${estado}`);
  }

  findByCiudadanoId(ciudadanoId: number): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/ciudadano/${ciudadanoId}`);
  }

  getEstadisticas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estadisticas`);
  }

  crear(apelacion: ApelacionCreate): Observable<Apelacion> {
    return this.http.post<Apelacion>(this.apiUrl, apelacion);
  }

  crearExterna(apelacion: ApelacionCreateExterna): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/externa`, apelacion);
  }

  actualizar(id: number, apelacion: Partial<Apelacion>): Observable<Apelacion> {
    return this.http.put<Apelacion>(`${this.apiUrl}/${id}`, apelacion);
  }

  cambiarEstado(id: number, estado: string): Observable<Apelacion> {
    return this.http.patch<Apelacion>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  subsanar(id: number, fundamentosAdicionales: string): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/${id}/subsanacion`, { fundamentosAdicionales });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

