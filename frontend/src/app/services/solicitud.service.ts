import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarEntregaParcialPayload,
  ActualizarLiquidacionCostoPayload,
  AmpliacionPlazoSolicitud,
  CronogramaEntregaParcial,
  EncauzamientoSolicitud,
  LiquidacionCostoSolicitud,
  ObservacionSolicitud,
  ObservarSolicitudPayload,
  RegistrarAmpliacionPlazoPayload,
  RegistrarEncauzamientoPayload,
  RegistrarLiquidacionCostoPayload,
  Solicitud,
  SolicitudCreate,
  SubsanarSolicitudPayload
} from '../models/solicitud.model';
import { environment } from '../../environments/environment';
import type { AltaSaipRecepcionDTO } from '../api/types';
import type { TipoDocumento } from '../models/documento.model';

export interface ConsultaPublicaSolicitud {
  expediente: string;
  ciudadano: string;
  entidad: string;
  fechaPresentacion: string;
  fechaLimite: string;
  diasTranscurridos: number;
  diasRestantes: number;
  estado: 'EN_PROCESO' | 'RESPONDIDA' | 'APELADA' | 'DENEGADA' | 'VENCIDA' | 'ARCHIVADA';
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

  registrarAlta(clave: string, datos: SolicitudCreate, declaraVeracidad: boolean,
    archivos: readonly { file: File; tipo: TipoDocumento }[]): Observable<AltaSaipRecepcionDTO> {
    const body = new FormData();
    body.append('claveOperacion', clave);
    for (const campo of ['entidadId', 'asunto', 'descripcion', 'tipoInformacion', 'formatoDigital', 'formatoFisico',
      'copiaSimple', 'copiaCertificada', 'consentimientoDatosPersonales', 'canalNotificacion'] as const) {
      if (datos[campo] != null) body.append(campo, String(datos[campo]));
    }
    body.append('declaraVeracidad', String(declaraVeracidad));
    for (const archivo of archivos) { body.append('tiposDocumento', archivo.tipo); body.append('archivos', archivo.file, archivo.file.name); }
    return this.http.post<AltaSaipRecepcionDTO>(`${this.apiUrl}/recepciones`, body);
  }

  obtenerRecepcionAlta(clave: string): Observable<AltaSaipRecepcionDTO> {
    return this.http.get<AltaSaipRecepcionDTO>(`${this.apiUrl}/recepciones/${encodeURIComponent(clave)}`);
  }

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

  asignarArea(id: number, payload: { area: string; encargado?: string }): Observable<Solicitud> {
    return this.http.patch<Solicitud>(`${this.apiUrl}/${id}/area-responsable`, payload);
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

  registrarAmpliacion(id: number, payload: RegistrarAmpliacionPlazoPayload): Observable<AmpliacionPlazoSolicitud> {
    return this.http.post<AmpliacionPlazoSolicitud>(`${this.apiUrl}/${id}/ampliaciones`, payload);
  }

  listarAmpliaciones(id: number): Observable<AmpliacionPlazoSolicitud[]> {
    return this.http.get<AmpliacionPlazoSolicitud[]>(`${this.apiUrl}/${id}/ampliaciones`);
  }

  listarCronogramaAmpliacion(id: number): Observable<CronogramaEntregaParcial[]> {
    return this.http.get<CronogramaEntregaParcial[]>(`${this.apiUrl}/${id}/ampliaciones/cronograma`);
  }

  registrarEncauzamiento(id: number, payload: RegistrarEncauzamientoPayload): Observable<EncauzamientoSolicitud> {
    return this.http.post<EncauzamientoSolicitud>(`${this.apiUrl}/${id}/encauzamientos`, payload);
  }

  listarEncauzamientos(id: number): Observable<EncauzamientoSolicitud[]> {
    return this.http.get<EncauzamientoSolicitud[]>(`${this.apiUrl}/${id}/encauzamientos`);
  }

  obtenerEncauzamientoActivo(id: number): Observable<EncauzamientoSolicitud> {
    return this.http.get<EncauzamientoSolicitud>(`${this.apiUrl}/${id}/encauzamientos/activo`);
  }

  emitirLiquidacion(id: number, payload: RegistrarLiquidacionCostoPayload): Observable<LiquidacionCostoSolicitud> {
    return this.http.post<LiquidacionCostoSolicitud>(`${this.apiUrl}/${id}/liquidaciones`, payload);
  }

  listarLiquidaciones(id: number): Observable<LiquidacionCostoSolicitud[]> {
    return this.http.get<LiquidacionCostoSolicitud[]>(`${this.apiUrl}/${id}/liquidaciones`);
  }

  obtenerLiquidacionActiva(id: number): Observable<LiquidacionCostoSolicitud> {
    return this.http.get<LiquidacionCostoSolicitud>(`${this.apiUrl}/${id}/liquidaciones/activa`);
  }

  actualizarLiquidacion(
    id: number,
    liquidacionId: number,
    payload: ActualizarLiquidacionCostoPayload
  ): Observable<LiquidacionCostoSolicitud> {
    return this.http.patch<LiquidacionCostoSolicitud>(
      `${this.apiUrl}/${id}/liquidaciones/${liquidacionId}`,
      payload
    );
  }

  procesarLiquidacionesVencidas(): Observable<LiquidacionCostoSolicitud[]> {
    return this.http.post<LiquidacionCostoSolicitud[]>(`${this.apiUrl}/liquidaciones/vencidas/procesar`, {});
  }

  actualizarEntregaParcial(
    id: number,
    ampliacionId: number,
    entregaId: number,
    payload: ActualizarEntregaParcialPayload
  ): Observable<CronogramaEntregaParcial> {
    return this.http.patch<CronogramaEntregaParcial>(
      `${this.apiUrl}/${id}/ampliaciones/${ampliacionId}/cronograma/${entregaId}`,
      payload
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  obtenerSeguimientoPlazo(id: number): Observable<PlazoSeguimientoDTO> {
    return this.http.get<PlazoSeguimientoDTO>(`${this.apiUrl}/${id}/plazo-seguimiento`);
  }
}

export interface PlazoSeguimientoDTO {
  fechaRegistro: string;
  fechaVencimiento: string;
  diasRestantes: number;
  enSilencioAdministrativo: boolean;
}

