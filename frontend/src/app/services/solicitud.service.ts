import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ObservacionSolicitud,
  ObservarSolicitudPayload,
  Solicitud,
  SolicitudCreate,
  SubsanarSolicitudPayload
} from '../models/solicitud.model';
import { environment } from '../../environments/environment';

export interface ConsultaPublicaSolicitud {
  expediente: string;
  ciudadano: string;
  entidad: string;
  fechaPresentacion: string;
  fechaLimite: string;
  diasTranscurridos: number;
  diasRestantes: number;
  estado: 'EN_PROCESO' | 'RESPONDIDA' | 'APELADA' | 'DENEGADA' | 'VENCIDA' | 'ARCHIVADA';
  asunto: string;
  respuestaFecha: string | null;
  respuestaTipo: string | null;
  apelacionExpediente: string | null;
  apelacionEstado: string | null;
  apelacionFecha: string | null;
  resolucionFecha: string | null;
  resolucionResultado: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SolicitudService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/solicitudes`;

  findAll(): Observable<Solicitud[]> {
    return this.http.get<Solicitud[]>(this.apiUrl);
  }

  findById(id: number): Observable<Solicitud> {
    return this.http.get<Solicitud>(`${this.apiUrl}/${id}`);
  }

  findByExpediente(expediente: string): Observable<Solicitud> {
    return this.http.get<Solicitud>(`${this.apiUrl}/expediente/${expediente}`);
  }

  consultarPublicamente(expediente: string): Observable<ConsultaPublicaSolicitud> {
    return this.http.get<ConsultaPublicaSolicitud>(`${this.apiUrl}/publica/expediente/${encodeURIComponent(expediente)}`);
  }

  findByCiudadanoId(ciudadanoId: number): Observable<Solicitud[]> {
    return this.http.get<Solicitud[]>(`${this.apiUrl}/ciudadano/${ciudadanoId}`);
  }

  findByEntidadId(entidadId: number): Observable<Solicitud[]> {
    return this.http.get<Solicitud[]>(`${this.apiUrl}/entidad/${entidadId}`);
  }

  findByEstado(estado: string): Observable<Solicitud[]> {
    return this.http.get<Solicitud[]>(`${this.apiUrl}/estado/${estado}`);
  }

  getEstadisticas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estadisticas`);
  }

  getEstadisticasCiudadano(ciudadanoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/ciudadano/${ciudadanoId}/estadisticas`);
  }

  getEstadisticasEntidad(entidadId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/entidad/${entidadId}/estadisticas`);
  }

  crear(solicitud: SolicitudCreate): Observable<Solicitud> {
    return this.http.post<Solicitud>(this.apiUrl, solicitud);
  }

  actualizar(id: number, solicitud: Partial<Solicitud>): Observable<Solicitud> {
    return this.http.put<Solicitud>(`${this.apiUrl}/${id}`, solicitud);
  }

  cambiarEstado(id: number, estado: string): Observable<Solicitud> {
    return this.http.patch<Solicitud>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  observar(id: number, payload: ObservarSolicitudPayload): Observable<ObservacionSolicitud> {
    return this.http.post<ObservacionSolicitud>(`${this.apiUrl}/${id}/observaciones`, payload);
  }

  listarObservaciones(id: number): Observable<ObservacionSolicitud[]> {
    return this.http.get<ObservacionSolicitud[]>(`${this.apiUrl}/${id}/observaciones`);
  }

  subsanar(id: number, observacionId: number, payload: SubsanarSolicitudPayload): Observable<ObservacionSolicitud> {
    return this.http.post<ObservacionSolicitud>(`${this.apiUrl}/${id}/observaciones/${observacionId}/subsanar`, payload);
  }

  procesarObservacionesVencidas(): Observable<ObservacionSolicitud[]> {
    return this.http.post<ObservacionSolicitud[]>(`${this.apiUrl}/observaciones/vencidas/procesar`, {});
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

