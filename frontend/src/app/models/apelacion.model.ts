// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { ApelacionDTO } from '../api/types';

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
    | 'TENER_POR_NO_PRESENTADO'
    | 'CONCLUSION_SUSTRACCION_MATERIA'
    | 'CONCLUSION_DESISTIMIENTO';

export type CalificacionApelacion =
    | 'ADMISIBLE'
    | 'INADMISIBLE'
    | 'IMPROCEDENTE'
    | 'ADMITIDO';

export type Apelacion = Required<ApelacionDTO> & {
    fundamentosSubsanacion?: string;
    documentosSubsanacion?: { id: number; nombreArchivo: string; rutaArchivo: string; tipoArchivo: string }[];
};

// Tipo solo del lado cliente — no existe en el contrato OpenAPI
export interface ApelacionCreate {
    solicitudId: number;
    ciudadanoId: number;
    fundamentos: string;
}
