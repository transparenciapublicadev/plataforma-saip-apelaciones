// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { ApelacionDTO } from '../api/types';

// Enums tipados del lado cliente (el spec los expone como string)
// TODO: Agregar @Schema(allowableValues) al backend para generar enums
export type EstadoApelacion =
    | 'PENDIENTE'
    | 'EN_CALIFICACION'
    | 'EN_SUBSANACION'
    | 'SUBSANACION_PRESENTADA'
    | 'PRIMERA_RESOLUCION'
    | 'SEGUNDA_RESOLUCION'
    | 'RESUELTO_FUNDADO'
    | 'RESUELTO_INFUNDADO'
    | 'RESUELTO_INADMISIBLE'
    | 'RESUELTO_IMPROCEDENTE';

export type CalificacionApelacion =
    | 'ADMISIBLE'
    | 'INADMISIBLE'
    | 'IMPROCEDENTE'
    | 'FUNDADO'
    | 'INFUNDADO';

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
