import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Respuesta } from '../models/respuesta.model';
import type { CrearRespuestaRequest } from '../api/types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RespuestaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/respuestas`;

  findAll(): Observable<Respuesta[]> {
    return this.http.get<Respuesta[]>(this.apiUrl);
  }

  findById(id: number): Observable<Respuesta> {
    return this.http.get<Respuesta>(`${this.apiUrl}/${id}`);
  }

  findBySolicitudId(solicitudId: number): Observable<Respuesta> {
    return this.http.get<Respuesta>(`${this.apiUrl}/solicitud/${solicitudId}`);
  }

  aceptarSolicitud(data: CrearRespuestaRequest): Observable<Respuesta> {
    return this.http.post<Respuesta>(`${this.apiUrl}/aceptar`, data);
  }

  denegarSolicitud(data: CrearRespuestaRequest): Observable<Respuesta> {
    return this.http.post<Respuesta>(`${this.apiUrl}/denegar`, data);
  }

  getCausalesDenegacion(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/causales-denegacion`);
  }
}

