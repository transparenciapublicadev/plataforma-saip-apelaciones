// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type {
    SolicitudDTO, ApelacionInfoDTO, RespuestaDTO, DocumentoDTO, ObservacionSolicitudDTO,
    EstadoSolicitud as _EstadoSolicitud,
    Prioridad as _Prioridad,
    SemaforoEstado as _SemaforoEstado
} from '../api/types';

export type EstadoSolicitud = _EstadoSolicitud;
export type Prioridad = _Prioridad;
export type SemaforoEstado = _SemaforoEstado;
export type ApelacionInfo = Required<ApelacionInfoDTO>;
export type CanalNotificacion = 'CORREO_ELECTRONICO' | 'CASILLA_ELECTRONICA' | 'PLATAFORMA' | 'FISICA';
export type EstadoObservacionSolicitud = 'PENDIENTE_SUBSANACION' | 'SUBSANADA' | 'NO_SUBSANADA' | 'ARCHIVADA';
export type ObservacionSolicitud = Required<ObservacionSolicitudDTO>;
export type EstadoAmpliacionPlazo = 'REGISTRADA' | 'NOTIFICADA' | 'COMPLETADA' | 'CANCELADA' | 'VENCIDA';
export type EstadoEntregaParcial = 'PROGRAMADA' | 'ENTREGADA' | 'OBSERVADA' | 'CANCELADA' | 'VENCIDA';
export type AlcanceEncauzamientoSolicitud = 'TOTAL' | 'PARCIAL';
export type EstadoEncauzamientoSolicitud = 'REGISTRADO' | 'DERIVADO' | 'ATENDIDO' | 'CANCELADO' | 'VENCIDO';
export type EstadoLiquidacionCosto = 'EMITIDA' | 'NOTIFICADA' | 'PAGADA' | 'RECOGIDA' | 'ARCHIVADA' | 'CANCELADA' | 'VENCIDA';

export interface CronogramaEntregaParcial {
    id: number;
    ampliacionId: number;
    numeroEntrega: number;
    descripcion: string;
    fechaProgramada: string;
    estado: EstadoEntregaParcial;
    fechaEntregaReal?: string | null;
    observacion?: string | null;
}

export interface AmpliacionPlazoSolicitud {
    id: number;
    solicitudId: number;
    expediente: string;
    motivoAmpliacion: string;
    informeAmpliacion: string;
    fechaSolicitudAmpliacion: string;
    fechaNotificacionAmpliacion: string;
    fechaLimiteOriginal: string;
    fechaLimiteAmpliada: string;
    estadoAmpliacion: EstadoAmpliacionPlazo;
    responsable?: string | null;
    trazabilidad?: string | null;
    cronograma: CronogramaEntregaParcial[];
}

export interface EncauzamientoSolicitud {
    id: number;
    solicitudId: number;
    expediente: string;
    entidadOrigenId: number;
    entidadOrigenNombre: string;
    entidadOrigenAcronimo?: string | null;
    entidadDestinoId: number;
    entidadDestinoNombre: string;
    entidadDestinoAcronimo?: string | null;
    motivoEncauzamiento: string;
    alcance: AlcanceEncauzamientoSolicitud;
    fechaEncauzamiento: string;
    fechaLimiteEncauzamiento: string;
    estadoEncauzamiento: EstadoEncauzamientoSolicitud;
    responsable?: string | null;
    observacionSustento?: string | null;
    trazabilidad?: string | null;
}

export interface LiquidacionCostoSolicitud {
    id: number;
    solicitudId: number;
    expediente: string;
    codigoLiquidacion: string;
    monto: string;
    moneda: string;
    concepto: string;
    fechaEmision: string;
    fechaNotificacion: string;
    fechaLimiteRecojo: string;
    estadoLiquidacion: EstadoLiquidacionCosto;
    medioNotificacion: CanalNotificacion;
    responsable?: string | null;
    observacion?: string | null;
    trazabilidad?: string | null;
    fechaPago?: string | null;
    fechaRecojo?: string | null;
}

export type Solicitud = Required<Omit<SolicitudDTO, 'respuesta' | 'apelacion' | 'documentos' | 'observaciones' | 'ampliacionesPlazo' | 'encauzamientos' | 'liquidacionesCosto'>> & {
    respuesta?: Required<RespuestaDTO> | null;
    apelacion?: Required<ApelacionInfoDTO> | null;
    documentos: Required<DocumentoDTO>[];
    observaciones: ObservacionSolicitud[];
    ampliacionesPlazo: AmpliacionPlazoSolicitud[];
    encauzamientos: EncauzamientoSolicitud[];
    liquidacionesCosto: LiquidacionCostoSolicitud[];
};

// Tipo solo del lado cliente — no existe en el contrato OpenAPI
export interface SolicitudCreate {
    asunto: string;
    descripcion: string;
    ciudadanoId: number;
    entidadId: number;
    tipoInformacion?: string;
    formatoDigital?: boolean;
    formatoFisico?: boolean;
    copiaSimple?: boolean;
    copiaCertificada?: boolean;
    consentimientoDatosPersonales: boolean;
    canalNotificacion: CanalNotificacion;
}

export interface ObservarSolicitudPayload {
    motivoObservacion: string;
    responsable?: string;
}

export interface SubsanarSolicitudPayload {
    comentarioSubsanacion?: string;
    documentoSubsanacionNombre?: string;
    documentoSubsanacionRuta?: string;
    responsable?: string;
}

export interface RegistrarEntregaParcialPayload {
    numeroEntrega: number;
    descripcion: string;
    fechaProgramada: string;
    observacion?: string;
}

export interface RegistrarAmpliacionPlazoPayload {
    motivoAmpliacion: string;
    informeAmpliacion: string;
    fechaNotificacionAmpliacion: string;
    responsable?: string;
    cronograma: RegistrarEntregaParcialPayload[];
}

export interface RegistrarEncauzamientoPayload {
    entidadDestinoId: number;
    motivoEncauzamiento: string;
    alcance: AlcanceEncauzamientoSolicitud;
    responsable?: string;
    observacionSustento?: string;
}

export interface RegistrarLiquidacionCostoPayload {
    codigoLiquidacion?: string;
    monto: number;
    moneda?: string;
    concepto: string;
    fechaNotificacion: string;
    medioNotificacion: CanalNotificacion;
    responsable?: string;
    observacion?: string;
}

export interface ActualizarLiquidacionCostoPayload {
    estado: 'PAGADA' | 'RECOGIDA' | 'CANCELADA';
    fechaPago?: string;
    fechaRecojo?: string;
    responsable?: string;
    observacion?: string;
}

export interface ActualizarEntregaParcialPayload {
    estado: EstadoEntregaParcial;
    fechaEntregaReal?: string;
    observacion?: string;
}
