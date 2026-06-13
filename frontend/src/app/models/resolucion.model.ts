// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { ResolucionDTO } from '../api/types';
import type { DocumentoMetadata } from './documento.model';

// Enums tipados del lado cliente (el spec los expone como string)
// TODO: Agregar @Schema(allowableValues) al backend para generar enums
export type TipoResolucion =
    | 'PRIMERA_CALIFICACION'
    | 'SEGUNDA_CALIFICACION'
    | 'RESOLUCION_FINAL';

export type DecisionResolucion =
    | 'ADMISIBLE'
    | 'INADMISIBLE'
    | 'IMPROCEDENTE'
    | 'ADMITIDO'
    | 'FUNDADO'
    | 'FUNDADO_EN_PARTE'
    | 'INFUNDADO'
    | 'INFUNDADO_EN_PARTE'
    | 'TENER_POR_NO_PRESENTADO'
    | 'CONCLUSION_SUSTRACCION_MATERIA'
    | 'CONCLUSION_DESISTIMIENTO'
    | 'ESTESE_A_LO_RESUELTO'
    | 'NULIDAD_DEL_ACTO';

export interface MiembroTtaipResumen {
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

export interface SalaTtaipResumen {
    id: number;
    nombre: string;
    periodoInicio?: string | null;
    periodoFin?: string | null;
    presidenteSala?: MiembroTtaipResumen | null;
}

export interface CedulaNotificacion {
    id: number;
    numeroCedula: string;
    destinatario: 'CIUDADANO' | 'ENTIDAD_PUBLICA';
    destinatarioNombre?: string | null;
    destinatarioEmail?: string | null;
    fechaEmision?: string | null;
    canal?: string | null;
    estado?: string | null;
    documentoReferencia?: string | null;
    documentos?: DocumentoMetadata[];
}

export interface NotificacionTtaip {
    id: number;
    cedulaId?: number | null;
    numeroCedula?: string | null;
    destinatario: 'CIUDADANO' | 'ENTIDAD_PUBLICA';
    destinatarioNombre?: string | null;
    destinatarioEmail?: string | null;
    fechaNotificacion?: string | null;
    medio?: string | null;
    estado?: string | null;
    detalle?: string | null;
    medioNotificacion?: string | null;
    fechaEnvio?: string | null;
    codigoEnvio?: string | null;
    codigoConstancia?: string | null;
    constanciaEnvio?: string | null;
    acuseAutomatico?: string | null;
    fechaAcuse?: string | null;
    estadoAcuse?: string | null;
    resultadoNotificacion?: string | null;
    evidenciaUrl?: string | null;
    referenciaEvidencia?: string | null;
    validadaManualmente?: boolean | null;
    fechaValidacionManual?: string | null;
    responsableValidacion?: string | null;
    observacionValidacion?: string | null;
    responsableConstancia?: string | null;
    observacionConstancia?: string | null;
    trazabilidad?: string | null;
    documentosCedula?: DocumentoMetadata[];
}

export interface HistorialTtaip {
    id: number;
    tipoEvento?: string | null;
    descripcion?: string | null;
    estadoAnterior?: string | null;
    estadoNuevo?: string | null;
    actor?: string | null;
    referencia?: string | null;
    fechaEvento?: string | null;
}

export interface ReprocesoNotificacion {
    id: number;
    notificacionId?: number | null;
    cedulaOriginalId?: number | null;
    reprocesoPadreId?: number | null;
    destinatario?: 'CIUDADANO' | 'ENTIDAD_PUBLICA' | string | null;
    numeroCedulaOriginal?: string | null;
    fechaIngresoCargo?: string | null;
    observacionReproceso?: string | null;
    fechaSubsanacion?: string | null;
    cedulaSubsanacion?: string | null;
    fechaCedulaSubsanacion?: string | null;
    numeroIntento?: number | null;
    estado?: string | null;
    responsableNotificacion?: string | null;
    responsableSubsanacion?: string | null;
    fechaCreacion?: string | null;
    fechaActualizacion?: string | null;
}

export interface DescargoEntidadTtaip {
    id: number;
    expedienteTtaipId?: number | null;
    numeroExpediente?: string | null;
    apelacionId?: number | null;
    entidadId?: number | null;
    entidadNombre?: string | null;
    fechaRequerimiento?: string | null;
    fechaLimiteDescargo?: string | null;
    fechaPresentacion?: string | null;
    estadoDescargo?: string | null;
    resumenDescargo?: string | null;
    documentoDescargo?: string | null;
    responsableEntidad?: string | null;
    observacion?: string | null;
    trazabilidad?: string | null;
}

export interface SuspensionPlazoTtaip {
    id: number;
    expedienteTtaipId?: number | null;
    numeroExpediente?: string | null;
    descargoId?: number | null;
    motivoSuspension?: string | null;
    solicitante?: 'CIUDADANO' | 'ENTIDAD_PUBLICA' | 'TTAIP' | string | null;
    motivoDetalle?: string | null;
    fechaSolicitud?: string | null;
    fechaInicioSuspension?: string | null;
    fechaFinSuspension?: string | null;
    diasSuspendidos?: number | null;
    estadoSuspension?: string | null;
    responsable?: string | null;
    observacion?: string | null;
    trazabilidad?: string | null;
}

export interface CumplimientoResolucionTtaip {
    id?: number;
    expedienteTtaipId?: number | null;
    numeroExpediente?: string | null;
    apelacionId?: number | null;
    resolucionId?: number | null;
    numeroResolucion?: string | null;
    decisionResolucion?: string | null;
    entidadId?: number | null;
    entidadNombre?: string | null;
    fechaRequerimientoCumplimiento?: string | null;
    fechaLimiteCumplimiento?: string | null;
    fechaCumplimiento?: string | null;
    estadoCumplimiento?: string | null;
    tipoCumplimiento?: 'TOTAL' | 'PARCIAL' | 'NO_CUMPLE' | string | null;
    descripcionCumplimiento?: string | null;
    evidenciaCumplimiento?: string | null;
    referenciaDocumento?: string | null;
    responsableEntidad?: string | null;
    observacion?: string | null;
    trazabilidad?: string | null;
}

export interface RequerirDescargoEntidadPayload {
    fechaRequerimiento?: string | null;
    responsableTtaip?: string | null;
    observacion?: string | null;
}

export interface PresentarDescargoEntidadPayload {
    fechaPresentacion?: string | null;
    resumenDescargo: string;
    referenciaDocumento?: string | null;
    responsableEntidad: string;
    observacion?: string | null;
}

export interface RegistrarSuspensionTtaipPayload {
    fechaSolicitud?: string | null;
    solicitante: 'CIUDADANO' | 'ENTIDAD_PUBLICA' | 'TTAIP';
    motivo: string;
    responsable: string;
    observacion?: string | null;
}

export interface CancelarSuspensionTtaipPayload {
    fechaCancelacion?: string | null;
    responsable: string;
    observacion?: string | null;
}

export interface CrearSeguimientoCumplimientoPayload {
    fechaRequerimientoCumplimiento?: string | null;
    responsableTtaip?: string | null;
    observacion?: string | null;
}

export interface RegistrarCumplimientoResolucionPayload {
    fechaCumplimiento?: string | null;
    tipoCumplimiento: 'TOTAL' | 'PARCIAL' | 'NO_CUMPLE';
    descripcionCumplimiento: string;
    evidenciaCumplimiento?: string | null;
    referenciaDocumento?: string | null;
    responsableEntidad: string;
    observacion?: string | null;
}

export interface ObservarCumplimientoResolucionPayload {
    observacion: string;
    responsableTtaip?: string | null;
}

export interface CerrarCumplimientoResolucionPayload {
    responsableTtaip?: string | null;
    observacion?: string | null;
}

export interface RegistrarConstanciaEnvioNotificacionPayload {
    medioNotificacion: string;
    fechaEnvio?: string | null;
    codigoEnvio?: string | null;
    codigoConstancia?: string | null;
    constanciaEnvio: string;
    evidenciaUrl?: string | null;
    referenciaEvidencia?: string | null;
    responsable: string;
    observacion?: string | null;
}

export interface RegistrarAcuseAutomaticoNotificacionPayload {
    estadoAcuse: 'ENTREGADO' | 'FALLIDO' | 'NO_RECIBIDO' | 'OBSERVADO';
    acuseAutomatico: string;
    fechaAcuse?: string | null;
    resultadoNotificacion?: string | null;
    evidenciaUrl?: string | null;
    referenciaEvidencia?: string | null;
    responsable?: string | null;
    observacion?: string | null;
}

export interface ValidarNotificacionManualPayload {
    fechaValidacionManual?: string | null;
    responsableValidacion: string;
    observacionValidacion: string;
    evidenciaUrl?: string | null;
    referenciaEvidencia?: string | null;
}

export type Resolucion = Required<ResolucionDTO> & {
    numeroResolucion?: string | null;
    sala?: SalaTtaipResumen | null;
    documentos?: DocumentoMetadata[];
    cedulas?: CedulaNotificacion[];
};
