import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReporteResponse<T> {
  fechaGeneracion: string;
  totalRegistros: number;
  filtros?: Record<string, any>;
  datos: T[];
}

export interface ReporteSolicitudItem {
  id: number;
  expediente: string;
  asunto: string;
  estado: string;
  fechaSolicitud: string;
  entidad: string;
  ciudadano: string;
  tieneRespuesta: boolean;
}

export interface ReporteApelacionItem {
  id: number;
  expediente: string;
  estado: string;
  fechaApelacion: string;
  solicitudExpediente: string;
  tipoOrigen: string;
  numeroSolicitudExterna: string;
  entidad: string;
  ciudadano: string;
  tieneResolucion: boolean;
}

export interface ReporteEntidadItem {
  id: number;
  nombre: string;
  acronimo: string;
  descripcion: string;
  activa: boolean;
  totalSolicitudes: number;
  solicitudesPendientes: number;
  solicitudesRespondidas: number;
}

export interface ReporteFuncionarioItem {
  id: number;
  nombreCompleto: string;
  cargo: string;
  email: string;
  activo: boolean;
  entidad: string;
  respuestasEmitidas: number;
}

export interface ReporteCiudadanoItem {
  id: number;
  nombreCompleto: string;
  dni: string;
  email: string;
  activo: boolean;
  fechaRegistro: string;
  totalSolicitudes: number;
  totalApelaciones: number;
}

export interface ResumenEjecutivoResponse {
  fechaGeneracion: string;
  solicitudes: {
    total: number;
    pendientes: number;
    respondidas: number;
    denegadas: number;
    vencidas: number;
  };
  apelaciones: {
    total: number;
    pendientes: number;
    enProceso: number;
    resueltas: number;
  };
  entidadesMasActivas: Array<{
    nombre: string;
    solicitudes: number;
  }>;
  usuarios: {
    ciudadanos: number;
    funcionarios: number;
    entidades: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  getReporteSolicitudes(filtros?: {
    estado?: string;
    entidadId?: number;
    desde?: string;
    hasta?: string;
  }): Observable<ReporteResponse<ReporteSolicitudItem>> {
    let params = new HttpParams();
    if (filtros?.estado && filtros.estado !== 'todos') params = params.set('estado', filtros.estado);
    if (filtros?.entidadId) params = params.set('entidadId', filtros.entidadId.toString());
    if (filtros?.desde) params = params.set('desde', filtros.desde);
    if (filtros?.hasta) params = params.set('hasta', filtros.hasta);

    return this.http.get<ReporteResponse<ReporteSolicitudItem>>(`${this.apiUrl}/solicitudes`, { params });
  }

  getReporteApelaciones(filtros?: {
    estado?: string;
    desde?: string;
    hasta?: string;
  }): Observable<ReporteResponse<ReporteApelacionItem>> {
    let params = new HttpParams();
    if (filtros?.estado && filtros.estado !== 'todos') params = params.set('estado', filtros.estado);
    if (filtros?.desde) params = params.set('desde', filtros.desde);
    if (filtros?.hasta) params = params.set('hasta', filtros.hasta);

    return this.http.get<ReporteResponse<ReporteApelacionItem>>(`${this.apiUrl}/apelaciones`, { params });
  }

  getReporteEntidades(): Observable<ReporteResponse<ReporteEntidadItem>> {
    return this.http.get<ReporteResponse<ReporteEntidadItem>>(`${this.apiUrl}/entidades`);
  }

  getReporteFuncionarios(entidadId?: number): Observable<ReporteResponse<ReporteFuncionarioItem>> {
    let params = new HttpParams();
    if (entidadId) params = params.set('entidadId', entidadId.toString());

    return this.http.get<ReporteResponse<ReporteFuncionarioItem>>(`${this.apiUrl}/funcionarios`, { params });
  }

  getReporteCiudadanos(): Observable<ReporteResponse<ReporteCiudadanoItem>> {
    return this.http.get<ReporteResponse<ReporteCiudadanoItem>>(`${this.apiUrl}/ciudadanos`);
  }

  getResumenEjecutivo(): Observable<ResumenEjecutivoResponse> {
    return this.http.get<ResumenEjecutivoResponse>(`${this.apiUrl}/resumen-ejecutivo`);
  }
}
