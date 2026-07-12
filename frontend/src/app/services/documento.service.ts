import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DocumentoDescarga,
  DocumentoMetadata,
  DocumentoRelation,
  getDocumentoRelationEntry,
  TipoDocumento
} from '../models/documento.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/documentos`;

  upload(
    file: File | FormData,
    tipoDocumento?: TipoDocumento,
    relation?: DocumentoRelation
  ): Observable<DocumentoMetadata> {
    if (file instanceof FormData) {
      return this.http.post<DocumentoMetadata>(`${this.apiUrl}/upload`, file);
    }

    const [relationKey, relationId] = getDocumentoRelationEntry(relation!);
    const formData = new FormData();
    formData.append('file', file, file.name);

    const params = new HttpParams()
      .set('tipoDocumento', tipoDocumento!)
      .set(relationKey, relationId);

    return this.http.post<DocumentoMetadata>(`${this.apiUrl}/upload`, formData, { params });
  }

  listByRelation(relation: DocumentoRelation): Observable<DocumentoMetadata[]> {
    const [relationKey, relationId] = getDocumentoRelationEntry(relation);
    const params = new HttpParams().set(relationKey, relationId);
    return this.http.get<DocumentoMetadata[]>(this.apiUrl, { params });
  }

  getMetadata(id: number): Observable<DocumentoMetadata> {
    return this.http.get<DocumentoMetadata>(`${this.apiUrl}/${id}/metadata`);
  }

  download(id: number, fallbackFilename = 'documento'): Observable<DocumentoDescarga> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      observe: 'response',
      responseType: 'blob'
    }).pipe(
      map((response) => ({
        blob: response.body ?? new Blob(),
        filename: this.extractFilename(response, fallbackFilename)
      }))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  clonar(
    documentoId: number,
    tipoDocumento: TipoDocumento,
    relation: DocumentoRelation
  ): Observable<DocumentoMetadata> {
    const [relationKey, relationId] = getDocumentoRelationEntry(relation);
    const params = new HttpParams()
      .set('tipoDocumento', tipoDocumento)
      .set(relationKey, relationId);
    return this.http.post<DocumentoMetadata>(`${this.apiUrl}/${documentoId}/clonar`, null, { params });
  }

  private extractFilename(response: HttpResponse<Blob>, fallbackFilename: string): string {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) {
      return fallbackFilename;
    }

    const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch?.[1]) {
      try {
        return decodeURIComponent(encodedMatch[1].trim());
      } catch {
        return fallbackFilename;
      }
    }

    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    return plainMatch?.[1]?.trim() || fallbackFilename;
  }
}
