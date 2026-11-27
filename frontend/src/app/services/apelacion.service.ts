import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Apelacion,
  ApelacionCreate,
  ApelacionCreateAnteEntidad,
  ApelacionCreateExterna,
  AdmitirElevacionExcepcionalPayload,
  ComunicarOmisionElevacionPayload,
  ElevarApelacionPayload,
  ElevacionApelacionTtaip
} from '../models/apelacion.model';
import type { AltaApelacionRecepcionDTO, RegistrarAltaApelacionRequest } from '../api/types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApelacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/apelaciones`;

  registrarAlta(datos: RegistrarAltaApelacionRequest, archivos: readonly File[]): Observable<AltaApelacionRecepcionDTO> {
    const body = new FormData();
    body.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    for (const file of archivos) body.append('archivos', file, file.name);
    return this.http.post<AltaApelacionRecepcionDTO>(`${this.apiUrl}/recepciones`, body);
  }

  obtenerRecepcionAlta(clave: string): Observable<AltaApelacionRecepcionDTO> {
    return this.http.get<AltaApelacionRecepcionDTO>(`${this.apiUrl}/recepciones/${encodeURIComponent(clave)}`);
  }

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

  crearAnteEntidad(apelacion: ApelacionCreateAnteEntidad): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/ante-entidad`, apelacion);
  }

  findPendientesElevacionByEntidadId(entidadId: number): Observable<ElevacionApelacionTtaip[]> {
    return this.http.get<ElevacionApelacionTtaip[]>(`${this.apiUrl}/entidad/${entidadId}/pendientes-elevacion`);
  }

  getElevacion(id: number): Observable<ElevacionApelacionTtaip> {
    return this.http.get<ElevacionApelacionTtaip>(`${this.apiUrl}/${id}/elevacion`);
  }

  elevar(id: number, payload: ElevarApelacionPayload): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/${id}/elevacion/elevar`, payload);
  }

  comunicarOmision(id: number, payload: ComunicarOmisionElevacionPayload): Observable<ElevacionApelacionTtaip> {
    return this.http.post<ElevacionApelacionTtaip>(`${this.apiUrl}/${id}/elevacion/comunicacion-ciudadana`, payload);
  }

  admitirElevacionExcepcional(id: number, payload: AdmitirElevacionExcepcionalPayload): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/${id}/elevacion/admitir-excepcionalmente`, payload);
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

