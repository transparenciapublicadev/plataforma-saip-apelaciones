import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Apelacion } from '../models/apelacion.model';
import type { CalificacionRequest, ResolucionRequest } from '../api/types';
import type {
  CancelarSuspensionTtaipPayload,
  CerrarCumplimientoResolucionPayload,
  CrearSeguimientoCumplimientoPayload,
  CumplimientoResolucionTtaip,
  DescargoEntidadTtaip,
  NotificacionTtaip,
  ObservarCumplimientoResolucionPayload,
  PresentarDescargoEntidadPayload,
  RegistrarCumplimientoResolucionPayload,
  RegistrarAcuseAutomaticoNotificacionPayload,
  RegistrarConstanciaEnvioNotificacionPayload,
  RegistrarSuspensionTtaipPayload,
  RequerirDescargoEntidadPayload,
  SuspensionPlazoTtaip,
  ValidarNotificacionManualPayload
} from '../models/resolucion.model';
import { environment } from '../../environments/environment';

export interface TtaipEstadisticas {
  pendientesAdmision: number;
  enProceso: number;
  enSubsanacion: number;
  resueltas: number;
}

@Injectable({
  providedIn: 'root',
})
export class TtaipService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ttaip`;

  getEstadisticas(): Observable<TtaipEstadisticas> {
    return this.http.get<TtaipEstadisticas>(`${this.apiUrl}/estadisticas`);
  }

  getPendientes(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/pendientes`);
  }

  getEnAnalisis(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/en-calificacion`);
  }

  getSubsanacion(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/subsanacion`);
  }

  getSegundaCalificacion(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/segunda-calificacion`);
  }

  getEnResolucion(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/en-resolucion`);
  }

  getResueltas(): Observable<Apelacion[]> {
    return this.http.get<Apelacion[]>(`${this.apiUrl}/resueltas`);
  }

  admitirApelacion(apelacionId: number, data: CalificacionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/calificacion/${apelacionId}/admitir`, data);
  }

  requerirSubsanacion(apelacionId: number, data: CalificacionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/calificacion/${apelacionId}/subsanar`, data);
  }

  inadmitirApelacion(apelacionId: number, data: CalificacionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/calificacion/${apelacionId}/inadmitir`, data);
  }

  declararFundado(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/fundado`, data);
  }

  declararInfundado(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/infundado`, data);
  }

  declararFundadoEnParte(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/fundado-en-parte`, data);
  }

  declararInfundadoEnParte(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/infundado-en-parte`, data);
  }

  declararImprocedente(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/improcedente`, data);
  }

  declararSustraccionMateria(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/sustraccion-materia`, data);
  }

  declararDesistimiento(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/desistimiento`, data);
  }

  declararEsteseALoResuelto(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/estese-a-lo-resuelto`, data);
  }

  declararNulidadDelActo(apelacionId: number, data: ResolucionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/resolucion/${apelacionId}/nulidad-acto`, data);
  }

  declararNoPresentado(apelacionId: number, data: CalificacionRequest): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/calificacion/${apelacionId}/no-presentado`, data);
  }

  notificarSegundaCalificacion(apelacionId: number): Observable<Apelacion> {
    return this.http.post<Apelacion>(`${this.apiUrl}/${apelacionId}/notificar-segunda-calificacion`, {});
  }

  requerirDescargos(expedienteId: number, data: RequerirDescargoEntidadPayload): Observable<DescargoEntidadTtaip> {
    return this.http.post<DescargoEntidadTtaip>(`${this.apiUrl}/expedientes/${expedienteId}/descargos/requerir`, data);
  }

  listarDescargos(expedienteId: number): Observable<DescargoEntidadTtaip[]> {
    return this.http.get<DescargoEntidadTtaip[]>(`${this.apiUrl}/expedientes/${expedienteId}/descargos`);
  }

  obtenerDescargoActivo(expedienteId: number): Observable<DescargoEntidadTtaip> {
    return this.http.get<DescargoEntidadTtaip>(`${this.apiUrl}/expedientes/${expedienteId}/descargos/activo`);
  }

  presentarDescargo(
    expedienteId: number,
    descargoId: number,
    data: PresentarDescargoEntidadPayload
  ): Observable<DescargoEntidadTtaip> {
    return this.http.post<DescargoEntidadTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/descargos/${descargoId}/presentar`,
      data
    );
  }

  procesarDescargosVencidos(): Observable<DescargoEntidadTtaip[]> {
    return this.http.post<DescargoEntidadTtaip[]>(`${this.apiUrl}/descargos/vencidos/procesar`, {});
  }

  listarSuspensiones(expedienteId: number): Observable<SuspensionPlazoTtaip[]> {
    return this.http.get<SuspensionPlazoTtaip[]>(`${this.apiUrl}/expedientes/${expedienteId}/suspensiones`);
  }

  registrarInformeOral(expedienteId: number, data: RegistrarSuspensionTtaipPayload): Observable<SuspensionPlazoTtaip> {
    return this.http.post<SuspensionPlazoTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/suspensiones/informe-oral`,
      data
    );
  }

  registrarInformacionComplementaria(
    expedienteId: number,
    data: RegistrarSuspensionTtaipPayload
  ): Observable<SuspensionPlazoTtaip> {
    return this.http.post<SuspensionPlazoTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/suspensiones/informacion-complementaria`,
      data
    );
  }

  cancelarSuspension(
    expedienteId: number,
    suspensionId: number,
    data: CancelarSuspensionTtaipPayload
  ): Observable<SuspensionPlazoTtaip> {
    return this.http.patch<SuspensionPlazoTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/suspensiones/${suspensionId}/cancelar`,
      data
    );
  }

  crearSeguimientoCumplimiento(
    expedienteId: number,
    resolucionId: number,
    data: CrearSeguimientoCumplimientoPayload
  ): Observable<CumplimientoResolucionTtaip> {
    return this.http.post<CumplimientoResolucionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/resoluciones/${resolucionId}/cumplimientos`,
      data
    );
  }

  listarCumplimientos(expedienteId: number): Observable<CumplimientoResolucionTtaip[]> {
    return this.http.get<CumplimientoResolucionTtaip[]>(
      `${this.apiUrl}/expedientes/${expedienteId}/cumplimientos`
    );
  }

  obtenerCumplimientoActivo(expedienteId: number): Observable<CumplimientoResolucionTtaip> {
    return this.http.get<CumplimientoResolucionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/cumplimientos/activo`
    );
  }

  registrarCumplimiento(
    expedienteId: number,
    cumplimientoId: number,
    data: RegistrarCumplimientoResolucionPayload
  ): Observable<CumplimientoResolucionTtaip> {
    return this.http.post<CumplimientoResolucionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/cumplimientos/${cumplimientoId}/registrar`,
      data
    );
  }

  observarCumplimiento(
    expedienteId: number,
    cumplimientoId: number,
    data: ObservarCumplimientoResolucionPayload
  ): Observable<CumplimientoResolucionTtaip> {
    return this.http.patch<CumplimientoResolucionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/cumplimientos/${cumplimientoId}/observar`,
      data
    );
  }

  cerrarCumplimiento(
    expedienteId: number,
    cumplimientoId: number,
    data: CerrarCumplimientoResolucionPayload
  ): Observable<CumplimientoResolucionTtaip> {
    return this.http.patch<CumplimientoResolucionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/cumplimientos/${cumplimientoId}/cerrar`,
      data
    );
  }

  procesarCumplimientosVencidos(): Observable<CumplimientoResolucionTtaip[]> {
    return this.http.post<CumplimientoResolucionTtaip[]>(`${this.apiUrl}/cumplimientos/vencidos/procesar`, {});
  }

  listarNotificaciones(expedienteId: number): Observable<NotificacionTtaip[]> {
    return this.http.get<NotificacionTtaip[]>(`${this.apiUrl}/expedientes/${expedienteId}/notificaciones`);
  }

  obtenerNotificacion(expedienteId: number, notificacionId: number): Observable<NotificacionTtaip> {
    return this.http.get<NotificacionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/notificaciones/${notificacionId}`
    );
  }

  registrarConstanciaEnvio(
    expedienteId: number,
    notificacionId: number,
    data: RegistrarConstanciaEnvioNotificacionPayload
  ): Observable<NotificacionTtaip> {
    return this.http.post<NotificacionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/notificaciones/${notificacionId}/constancia-envio`,
      data
    );
  }

  registrarAcuseAutomatico(
    expedienteId: number,
    notificacionId: number,
    data: RegistrarAcuseAutomaticoNotificacionPayload
  ): Observable<NotificacionTtaip> {
    return this.http.post<NotificacionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/notificaciones/${notificacionId}/acuse-automatico`,
      data
    );
  }

  validarNotificacionManualmente(
    expedienteId: number,
    notificacionId: number,
    data: ValidarNotificacionManualPayload
  ): Observable<NotificacionTtaip> {
    return this.http.post<NotificacionTtaip>(
      `${this.apiUrl}/expedientes/${expedienteId}/notificaciones/${notificacionId}/validacion-manual`,
      data
    );
  }
}

