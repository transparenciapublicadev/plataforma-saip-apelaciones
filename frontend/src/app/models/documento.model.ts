// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type { DocumentoDTO, DocumentoMetadataDTO, operations } from '../api/types';

export type Documento = DocumentoDTO;
export type DocumentoMetadata = DocumentoMetadataDTO;
export type DocumentoListItem = Documento | DocumentoMetadata;
export type TipoDocumento = operations['upload']['parameters']['query']['tipoDocumento'];

export type DocumentoRelation =
  | { solicitudId: number }
  | { respuestaId: number }
  | { apelacionId: number }
  | { expedienteTtaipId: number }
  | { resolucionId: number }
  | { cedulaNotificacionId: number };

export type DocumentoRelationKey = keyof Required<Pick<
  DocumentoMetadata,
  | 'solicitudId'
  | 'respuestaId'
  | 'apelacionId'
  | 'expedienteTtaipId'
  | 'resolucionId'
  | 'cedulaNotificacionId'
>>;

export interface DocumentoDescarga {
  blob: Blob;
  filename: string;
}

export const DOCUMENTO_RELATION_KEYS: readonly DocumentoRelationKey[] = [
  'solicitudId',
  'respuestaId',
  'apelacionId',
  'expedienteTtaipId',
  'resolucionId',
  'cedulaNotificacionId'
];
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

export function getDocumentoRelationEntry(
  relation: DocumentoRelation
): readonly [DocumentoRelationKey, number] {
  const entries = DOCUMENTO_RELATION_KEYS
    .map((key) => [key, (relation as Partial<Record<DocumentoRelationKey, number>>)[key]] as const)
    .filter((entry): entry is readonly [DocumentoRelationKey, number] =>
      typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] > 0
    );

  if (entries.length !== 1) {
    throw new Error('Debe indicar exactamente una relación documental válida.');
  }

  return entries[0]!;
}
