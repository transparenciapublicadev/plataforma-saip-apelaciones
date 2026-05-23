import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PortalMetricas {
  saipPresentadas: number;
  respondidas: number;
  apelaciones: number;
  entidades: number;
  personasApelantes: number;
  tasaResolucion: number;
}

export interface PortalDistribucion {
  etiqueta: string;
  valor: number;
}

export interface PortalEjemplo {
  icono: string;
  texto: string;
}

export interface PortalFaq {
  pregunta: string;
  respuesta: string;
}

export interface PortalTendencia {
  mes: number;
  etiqueta: string;
  solicitudes: number;
  apelaciones: number;
}

export interface PortalMiembroTtaip {
  id: number;
  nombre: string;
  cargo?: string | null;
  sala?: string | null;
  especialidad?: string | null;
  email?: string | null;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  presidenteTribunal?: boolean | null;
}

export interface PortalPublico {
  metricas: PortalMetricas;
  ejemplosSolicitud: PortalEjemplo[];
  preguntasFrecuentes: PortalFaq[];
  apelacionesPorEntidad: PortalDistribucion[];
  tendenciaMensual: PortalTendencia[];
  miembrosTTAIP: PortalMiembroTtaip[];
}

@Injectable({
  providedIn: 'root',
})
export class PortalPublicoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/public/portal`;

  getPortal(): Observable<PortalPublico> {
    return this.http.get<PortalPublico>(this.apiUrl);
  }
}
