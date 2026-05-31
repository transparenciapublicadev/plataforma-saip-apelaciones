// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { ApelacionDTO, CrearApelacionExternaRequest } from '../api/types';
import type {
    CedulaNotificacion,
    CumplimientoResolucionTtaip,
    DescargoEntidadTtaip,
    HistorialTtaip,
    MiembroTtaipResumen,
    NotificacionTtaip,
    ReprocesoNotificacion,
    Resolucion,
    SalaTtaipResumen,
    SuspensionPlazoTtaip
} from './resolucion.model';

// Enums tipados del lado cliente (el spec los expone como string)
// TODO: Agregar @Schema(allowableValues) al backend para generar enums
export type EstadoApelacion =
    | 'PENDIENTE_ELEVACION'
    | 'EN_CALIFICACION_1'
    | 'EN_SUBSANACION'
    | 'EN_CALIFICACION_2'
    | 'NOTIFICACION_SEGUNDA_CALIFICACION'
    | 'EN_RESOLUCION'
    | 'RESUELTO'
    | 'RESUELTO_FUNDADO'
    | 'RESUELTO_FUNDADO_EN_PARTE'
    | 'RESUELTO_INFUNDADO'
    | 'RESUELTO_INFUNDADO_EN_PARTE'
    | 'RESUELTO_IMPROCEDENTE'
    | 'RESUELTO_ESTESE_A_LO_RESUELTO'
    | 'RESUELTO_NULIDAD_ACTO'
    | 'TENER_POR_NO_PRESENTADO'
    | 'CONCLUSION_SUSTRACCION_MATERIA'
    | 'CONCLUSION_DESISTIMIENTO';

export type CalificacionApelacion =
    | 'ADMISIBLE'
    | 'INADMISIBLE'
    | 'IMPROCEDENTE'
    | 'ADMITIDO';

export type TipoOrigenApelacion = 'SAIP_INTERNA' | 'EXTERNA';
export type TipoDenegatoriaApelacion = 'EXPRESA' | 'TACITA';
export type CanalPresentacionApelacion = 'DIRECTA_TTAIP' | 'ANTE_ENTIDAD';
export type EstadoElevacionApelacion =
    | 'PENDIENTE'
    | 'ELEVADA'
    | 'VENCIDA_NO_ELEVADA'
    | 'COMUNICADA_POR_CIUDADANO'
    | 'ADMITIDA_EXCEPCIONALMENTE';

export interface ElevacionApelacionTtaip {
    id: number;
    apelacionId: number;
    expedienteReservado: string;
    entidadOrigenId: number;
    entidadOrigenNombre: string;
    fechaPresentacionAnteEntidad: string;
    fechaLimiteElevacion: string;
    fechaElevacionTtaip?: string | null;
    fechaComunicacionCiudadano?: string | null;
    estadoElevacion: EstadoElevacionApelacion;
    referenciaCargoPresentacion: string;
    referenciaExpedienteElevado?: string | null;
    referenciaPruebaOmision?: string | null;
    responsableEntidad?: string | null;
    responsableTtaip?: string | null;
    observacion?: string | null;
    trazabilidad?: string | null;
}

export type Apelacion = Required<ApelacionDTO> & {
    tipoOrigen?: TipoOrigenApelacion | string | null;
    entidadExternaNombre?: string | null;
    entidadExternaRuc?: string | null;
    entidadExternaEmail?: string | null;
    numeroSolicitudExterna?: string | null;
    fechaPresentacionSolicitudExterna?: string | null;
    fechaRespuestaEntidad?: string | null;
    tipoDenegatoria?: TipoDenegatoriaApelacion | string | null;
    resumenSolicitudOriginal?: string | null;
    resumenRespuestaEntidad?: string | null;
    referenciaDocumentoSolicitud?: string | null;
    referenciaCargoRecepcion?: string | null;
    referenciaRespuestaEntidad?: string | null;
    evidenciaSilencioAdministrativo?: string | null;
    observacion?: string | null;
    elevacion?: ElevacionApelacionTtaip | null;
    expedienteTtaip?: {
        id: number;
        numeroExpediente: string;
        estado?: EstadoApelacion | string | null;
        fechaApertura?: string | null;
        fechaActualizacion?: string | null;
        fechaPrimeraCalificacion?: string | null;
        fechaSegundaCalificacion?: string | null;
        fechaResolucionFinal?: string | null;
        fechaLimiteResolucion?: string | null;
        trazabilidadMinima?: string | null;
        sala?: SalaTtaipResumen | null;
        miembros?: MiembroTtaipResumen[];
        resoluciones?: Resolucion[];
        cedulas?: CedulaNotificacion[];
        notificaciones?: NotificacionTtaip[];
        historial?: HistorialTtaip[];
        reprocesos?: ReprocesoNotificacion[];
        descargosEntidad?: DescargoEntidadTtaip[];
        suspensionesPlazo?: SuspensionPlazoTtaip[];
        cumplimientosResolucion?: CumplimientoResolucionTtaip[];
    } | null;
    resoluciones?: Resolucion[];
    fundamentosSubsanacion?: string;
    documentosSubsanacion?: { id: number; nombreArchivo: string; rutaArchivo: string; tipoArchivo: string }[];
};

// Tipo solo del lado cliente — no existe en el contrato OpenAPI
export interface ApelacionCreate {
    solicitudId: number;
    ciudadanoId: number;
    fundamentos: string;
}

export type ApelacionCreateExterna = CrearApelacionExternaRequest;

export interface ApelacionCreateAnteEntidad extends ApelacionCreate {
    fechaPresentacionAnteEntidad: string;
    referenciaCargoPresentacion: string;
    observacion?: string;
}

export interface ElevarApelacionPayload {
    responsableEntidad: string;
    referenciaExpedienteElevado: string;
    observacion?: string;
}

export interface ComunicarOmisionElevacionPayload {
    referenciaPruebaOmision: string;
    observacion?: string;
}

export interface AdmitirElevacionExcepcionalPayload {
    responsableTtaip: string;
    observacion?: string;
}
