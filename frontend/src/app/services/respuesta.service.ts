import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { Respuesta } from '../models/respuesta.model';
import type { CrearRespuestaRequest } from '../api/types';
import { environment } from '../../environments/environment';
import type { components } from '../api/schema';
import { DocumentoMetadata } from '../models/documento.model';

export type RespuestaSaipRecepcion = Required<Omit<components['schemas']['RespuestaSaipRecepcionDTO'], 'respuesta' | 'documentos'>> & {
  respuesta: Respuesta;
  documentos: DocumentoMetadata[];
};

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

  crear(data: CrearRespuestaRequest): Observable<Respuesta> {
    return this.http.post<Respuesta>(this.apiUrl, data);
  }

  registrarConDocumentos(solicitudId: number, claveOperacion: string,
    datos: CrearRespuestaRequest, archivos: readonly File[]): Observable<RespuestaSaipRecepcion> {
    const body = new FormData();
    body.append('claveOperacion', claveOperacion);
    for (const campo of ['tipoRespuesta', 'contenido', 'causalDenegatoria', 'fundamentoLegal',
      'formatoEntrega', 'plazoEntrega', 'funcionarioId'] as const) {
      const valor = datos[campo];
      if (valor !== undefined && valor !== null) body.append(campo, String(valor));
    }
    for (const file of archivos) body.append('archivos', file, file.name);
    return this.http.post<RespuestaSaipRecepcion>(`${this.apiUrl}/solicitud/${solicitudId}/recepciones`, body)
      .pipe(timeout(30_000));
  }

  consultarRecepcion(solicitudId: number, claveOperacion: string): Observable<RespuestaSaipRecepcion> {
    return this.http.get<RespuestaSaipRecepcion>(`${this.apiUrl}/solicitud/${solicitudId}/recepciones/${claveOperacion}`)
      .pipe(timeout(30_000));
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

