import { DocumentoMetadata, DocumentoRelation, DOCUMENTO_RELATION_KEYS } from '../models/documento.model';

/** An authorized read supplies the relation; a filename never identifies its resource. */
export function documentosDelRecurso(value: unknown, relation: DocumentoRelation): DocumentoMetadata[] | null {
  if (!Array.isArray(value)) return null;
  const [key, id] = Object.entries(relation)[0], ids = new Set<number>();
  for (const doc of value) {
    if (!doc || !Number.isSafeInteger(doc.id) || doc.id <= 0 || ids.has(doc.id) || doc[key] !== id
      || DOCUMENTO_RELATION_KEYS.filter(k => doc[k] != null).length !== 1 || (doc.estado != null && doc.estado !== 'ACTIVO')) return null;
    ids.add(doc.id);
  }
  return value;
}
