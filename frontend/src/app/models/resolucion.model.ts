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
    | 'INFUNDADO'
    | 'DEVOLVER_ENTIDAD'
    | 'ORDENAR_ENTREGA';

export type Resolucion = Required<ResolucionDTO>;
