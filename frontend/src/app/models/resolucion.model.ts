// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { ResolucionDTO } from '../api/types';

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
    | 'CONCLUSION_DESISTIMIENTO';

export type Resolucion = Required<ResolucionDTO>;
