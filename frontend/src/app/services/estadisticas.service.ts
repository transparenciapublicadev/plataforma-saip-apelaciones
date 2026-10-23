import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EstadisticasGenerales {
  totalSolicitudes: number;
  solicitudesPendientes: number;
  solicitudesRespondidas: number;
  solicitudesDenegadas: number;
  solicitudesVencidas: number;
  totalApelaciones: number;
  apelacionesPendientes: number;
  apelacionesResueltas: number;
  totalEntidades: number;
  totalCiudadanos: number;
  totalFuncionarios: number;
  totalUsuarios?: number;
  tiempoPromedioRespuestaDias?: number;
}

export interface RankingEntidadItem {
  entidadId: number;
  entidadNombre: string;
  acronimo: string;
  totalSolicitudes: number;
  respondidas: number;
  pendientes: number;
}

export interface ActividadRecienteItem {
  dot: string;
  label: string;
  detail: string;
  fecha?: string;
  ts: number;
}

export interface ApelacionesEstadisticas {
  total: number;
  pendientes: number;
  pendientesElevacion: number;
  enCalificacion: number;
  enSubsanacion: number;
  resueltosFundado: number;
  resueltosInfundado: number;
  resueltosFundadoEnParte: number;
  resueltosInfundadoEnParte: number;
  resueltosImprocedente: number;
  resueltosEsteseALoResuelto: number;
  resueltosNulidadActo: number;
  tenerPorNoPresentado: number;
  conclusionSustraccion: number;
  conclusionDesistimiento: number;
}

export interface TtaipEstadisticas {
  pendientesAdmision: number;
  pendientesElevacion: number;
  enProceso: number;
  enSubsanacion: number;
  resueltas: number;
}

@Injectable({
  providedIn: 'root',
})
export class EstadisticasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/estadisticas`;
  private readonly apelacionesUrl = `${environment.apiUrl}/apelaciones`;
  private readonly ttaipUrl = `${environment.apiUrl}/ttaip`;

  getGeneral(): Observable<EstadisticasGenerales> {
    return this.http.get<EstadisticasGenerales>(`${this.apiUrl}/general`);
  }

  getRankingEntidades(limite: number = 10): Observable<RankingEntidadItem[]> {
    const params = new HttpParams().set('limite', limite.toString());
    return this.http.get<RankingEntidadItem[]>(`${this.apiUrl}/ranking/entidades`, { params });
  }

  getDistribucionEstados(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.apiUrl}/distribucion/estados`);
  }

  getActividadReciente(limite: number = 10): Observable<ActividadRecienteItem[]> {
    const params = new HttpParams().set('limite', limite.toString());
    return this.http.get<ActividadRecienteItem[]>(`${this.apiUrl}/actividad-reciente`, { params });
  }

  getApelacionesEstadisticas(): Observable<ApelacionesEstadisticas> {
    return this.http.get<ApelacionesEstadisticas>(`${this.apelacionesUrl}/estadisticas`);
  }

  getTtaipEstadisticas(): Observable<TtaipEstadisticas> {
    return this.http.get<TtaipEstadisticas>(`${this.ttaipUrl}/estadisticas`);
  }
}
