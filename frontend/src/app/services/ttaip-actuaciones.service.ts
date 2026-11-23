import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { DocumentoMetadata } from '../models/documento.model';

export type EtapaActuacion = 'PRIMERA_CALIFICACION' | 'SEGUNDA_CALIFICACION' | 'RESOLUCION_FINAL';

export type PasoCumplimiento = 'entrega' | 'validacion-entrega' | 'remision';
export type ClaseAdjuntoCumplimiento = 'RESPUESTA' | 'ANEXO_RESPUESTA' | 'CARGO' | 'ACUSE' | 'OFICIO' | 'ANEXO_OFICIO';
export interface FaseCumplimientoTtaip {
  id: number;
  numeroExpediente: string;
  numeroResolucion: string;
  entidad: string;
  estado: 'PENDIENTE' | 'CUMPLIDO' | 'VENCIDO';
  fechaNotificacionEntidad: string;
  fechaLimite: string;
  fechaEntrega: string | null;
  fechaEficaciaEntrega: string | null;
  fechaRemision: string | null;
  numeroOficio: string | null;
  fundamento: string | null;
  operacionEntrega: string | null;
  operacionValidacion: string | null;
  operacionRemision: string | null;
  puedeEntregar: boolean;
  puedeValidar: boolean;
  puedeRemitir: boolean;
  expedienteResuelto: boolean;
  documentos: { clase: ClaseAdjuntoCumplimiento; documento: DocumentoMetadata }[];
}

export type TipoPresentacionAdmision = 'DESCARGOS' | 'INFORME_ORAL' | 'DOCUMENTACION_ADICIONAL';

export interface PresentacionAdmision {
  id: number;
  operacion: string | null;
  tipo: TipoPresentacionAdmision;
  origen: 'CIUDADANO' | 'ENTIDAD_PUBLICA';
  texto: string | null;
  numeroOficio: string | null;
  fechaPresentacion: string | null;
  aceptada: boolean | null;
  fechaRespuesta: string | null;
  operacionRespuesta: string | null;
  documentos: DocumentoMetadata[];
  respuesta: DocumentoMetadata | null;
}

export interface ConsultaAdmision {
  puedePresentarSolicitudes: boolean;
  puedeResponderInformeOral: boolean;
  fechaLimiteResolucion: string | null;
  descargo: {
    id: number;
    estado: string;
    fechaLimite: string;
    fechaPresentacion: string | null;
    resumen: string | null;
    referencia: string | null;
    puedePresentar: boolean;
  } | null;
  presentaciones: PresentacionAdmision[];
}

export interface DocumentoPreparado {
  clave: string;
  decision: string;
  numero: string | null;
  sala: string | null;
  archivo: DocumentoMetadata | null;
}

export interface InformacionComplementaria {
  etapa: EtapaActuacion | null;
  entidad: string;
  puedeSolicitar: boolean;
  fechaLimiteCalificacion: string | null;
  diasSuspendidos: number;
  solicitudes: SolicitudComplementaria[];
}

export interface SolicitudComplementaria {
  id: number;
  etapa: EtapaActuacion;
  solicitud: string;
  fechaSolicitud: string;
  fechaLimite: string;
  estado: 'PENDIENTE' | 'RESPONDIDA' | 'VENCIDA' | 'CANCELADA';
  respuesta: string | null;
  fechaRespuesta: string | null;
  adjuntos: DocumentoMetadata[];
  adjuntosRespuesta: DocumentoMetadata[];
}

export type ArchivoNotificacion = 'FIRMADO' | 'CARGO' | 'ACUSE';
export type MedioNotificacion = 'CORREO_ELECTRONICO' | 'FISICA' | 'CASILLA_ELECTRONICA' | 'PLATAFORMA';
export type TipoActo = 'CEDULA' | 'CARTA';

export interface ActoNotificacion {
  id: number;
  resolucionId: number;
  numeroResolucion: string;
  etapa: EtapaActuacion;
  decision: string;
  destinatario: 'CIUDADANO' | 'ENTIDAD_PUBLICA';
  nombre: string;
  numero: string;
  tipo: TipoActo;
  medio: MedioNotificacion;
  direccion: string | null;
  estado: string;
  fechaEficacia: string | null;
  publicada: boolean;
  historica: boolean;
  requiereExpediente: boolean;
  firmado: DocumentoMetadata | null;
  cargo: DocumentoMetadata | null;
  acuse: DocumentoMetadata | null;
  anexos: DocumentoMetadata[];
}

export const ETAPAS: Record<EtapaActuacion, string> = {
  PRIMERA_CALIFICACION: 'Primera calificación',
  SEGUNDA_CALIFICACION: 'Segunda calificación',
  RESOLUCION_FINAL: 'Resolución final',
};

export function errorActuacion(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status > 0 && error.status < 500) {
    return error.error?.message || error.error?.mensaje || fallback;
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class TtaipActuacionesService {
  private readonly http = inject(HttpClient);

  private url(id: number, recurso: string) {
    return `${environment.apiUrl}/ttaip/expedientes/${id}/${recurso}`;
  }

  documentos(id: number, etapa: EtapaActuacion) {
    return this.http.get<DocumentoPreparado[]>(this.url(id, `documentos-oficiales/${etapa}`));
  }

  preparar(id: number, etapa: EtapaActuacion, clave: string, decision: string, sala?: string,
           numero?: string, archivo?: File) {
    const body = new FormData();
    body.set('decision', decision);
    if (sala) body.set('sala', sala);
    if (numero) body.set('numero', numero);
    if (archivo) body.set('archivo', archivo);
    return this.http.put<DocumentoPreparado>(this.url(id, `documentos-oficiales/${etapa}/${clave}`), body);
  }

  informacion(id: number) {
    return this.http.get<InformacionComplementaria>(this.url(id, 'informacion-complementaria'));
  }

  presentacionesAdmision(id: number) {
    return this.http.get<ConsultaAdmision>(this.url(id, 'presentaciones-admision'));
  }

  enviarPresentacionAdmision(id: number, body: FormData, respuestaId?: number) {
    const ruta = respuestaId == null ? 'presentaciones-admision' : `presentaciones-admision/${respuestaId}/respuesta`;
    return this.http.post<PresentacionAdmision>(this.url(id, ruta), body);
  }

  enviarInformacion(id: number, texto: string, archivos: File[], solicitud?: number) {
    const body = new FormData();
    body.set('texto', texto);
    archivos.forEach(archivo => body.append('archivos', archivo));
    const suffix = solicitud == null ? '' : `/${solicitud}/respuesta`;
    return this.http.post<InformacionComplementaria>(this.url(id, 'informacion-complementaria' + suffix), body);
  }

  actos(id: number) {
    return this.http.get<ActoNotificacion[]>(this.url(id, 'actos-notificacion'));
  }

  destino(id: number, acto: number, medio: MedioNotificacion, direccion: string, tipo: TipoActo) {
    return this.http.put<ActoNotificacion>(this.url(id, `actos-notificacion/${acto}/destino`), { medio, direccion, tipo });
  }

  archivo(id: number, acto: number, tipo: ArchivoNotificacion, archivo: File) {
    const body = new FormData();
    body.set('archivo', archivo);
    return this.http.put<ActoNotificacion>(this.url(id, `actos-notificacion/${acto}/archivos/${tipo}`), body);
  }

  publicar(id: number, acto: number) {
    return this.http.post<ActoNotificacion>(this.url(id, 'actos-notificacion/' + acto + '/publicacion'), null);
  }

  revisar(id: number, acto: number, valida: boolean, observacion: string, fechaEficacia: string | null) {
    return this.http.post<ActoNotificacion>(this.url(id, `actos-notificacion/${acto}/revision`),
      { valida, observacion, fechaEficacia });
  }
  cumplimientoDocumental(expedienteId: number) {
    return this.http.get<{ cumplimiento: FaseCumplimientoTtaip | null }>(this.url(expedienteId, 'cumplimiento-documental'));
  }

  registrarCumplimientoDocumental(expedienteId: number, paso: PasoCumplimiento, body: FormData) {
    return this.http.post<FaseCumplimientoTtaip>(this.url(expedienteId, `cumplimiento-documental/${paso}`), body);
  }
}
