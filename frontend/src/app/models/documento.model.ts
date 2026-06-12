// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { DocumentoDTO, DocumentoMetadataDTO, operations } from '../api/types';

export type Documento = DocumentoDTO;
export type DocumentoMetadata = DocumentoMetadataDTO;
export type TipoDocumento = operations['upload']['parameters']['query']['tipoDocumento'];

export type DocumentoRelation =
  | { solicitudId: number }
  | { apelacionId: number }
  | { expedienteTtaipId: number }
  | { resolucionId: number }
  | { cedulaNotificacionId: number };

export interface DocumentoDescarga {
  blob: Blob;
  filename: string;
}

export const DOCUMENTO_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENTO_ACCEPT = '.pdf,.jpg,.jpeg,.png,.txt';
export const DOCUMENTO_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain'
]);

export function validarDocumento(file: File): string | null {
  if (file.size > DOCUMENTO_MAX_BYTES) {
    return 'El archivo supera el límite de 10 MB.';
  }

  if (!DOCUMENTO_CONTENT_TYPES.has(file.type)) {
    return 'Formato no permitido. Use PDF, JPG, PNG o TXT.';
  }

  return null;
}
