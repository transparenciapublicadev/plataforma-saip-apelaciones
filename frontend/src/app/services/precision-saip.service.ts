import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import type { components } from '../api/schema';
import { DocumentoMetadata } from '../models/documento.model';

type PrecisionSaipRecepcionDTO = components['schemas']['PrecisionSaipRecepcionDTO'];

export type PrecisionSaipRecepcion = Required<Omit<PrecisionSaipRecepcionDTO, 'estado' | 'documento'>> & {
  estado: 'SUBSANADA';
  documento: DocumentoMetadata;
};

@Injectable({ providedIn: 'root' })
export class PrecisionSaipService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/solicitudes`;

  enviar(
    solicitudId: number,
    observacionId: number,
    claveOperacion: string,
    comentario: string,
    archivo: File
  ): Observable<PrecisionSaipRecepcion> {
    const body = new FormData();
    body.append('archivo', archivo, archivo.name);
    body.append('comentario', comentario);
    body.append('claveOperacion', claveOperacion);
    return this.http.post<PrecisionSaipRecepcion>(this.url(solicitudId, observacionId), body)
      .pipe(timeout(30_000));
  }

  consultar(solicitudId: number, observacionId: number, claveOperacion: string): Observable<PrecisionSaipRecepcion> {
    return this.http.get<PrecisionSaipRecepcion>(`${this.url(solicitudId, observacionId)}/${claveOperacion}`)
      .pipe(timeout(30_000));
  }

  private url(solicitudId: number, observacionId: number): string {
    return `${this.apiUrl}/${solicitudId}/observaciones/${observacionId}/precision`;
  }
}
