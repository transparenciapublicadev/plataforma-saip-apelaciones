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
export type Solicitud = Required<Omit<SolicitudDTO, 'respuesta' | 'apelacion' | 'documentos' | 'observaciones'>> & {
    respuesta?: Required<RespuestaDTO> | null;
    apelacion?: Required<ApelacionInfoDTO> | null;
    documentos: Required<DocumentoDTO>[];
    observaciones: ObservacionSolicitud[];
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
