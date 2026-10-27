import { DOCUMENTO_RELATION_KEYS, DocumentoRelation } from '../../models/documento.model';
import { Solicitud } from '../../models/solicitud.model';
import { positiveId } from './funcionario-dashboard.model';

/** Legacy nested DTOs omit relations; explicit metadata must agree with its parent. */
export function documentoDelRecurso(documento: any, relation: DocumentoRelation): boolean {
  if (!documento || !positiveId(documento.id)) return false;
  const [key, id] = Object.entries(relation)[0];
  const explicit = DOCUMENTO_RELATION_KEYS.filter(field => documento[field] != null);
  return !explicit.length || (explicit.length === 1 && documento[key] === id);
}

export function documentosDelRecurso(documentos: unknown, relation: DocumentoRelation): any[] {
  return Array.isArray(documentos) ? documentos.filter(doc => documentoDelRecurso(doc, relation)) : [];
}

/** An embedded record can omit its FK; a contradictory FK/expediente is never accepted. */
export function actuacionesDeSolicitud<T extends { id: number; solicitudId?: number; expediente?: string }>(
  actuaciones: T[] | null | undefined, solicitud: Solicitud | null,
): T[] {
  return solicitud && Array.isArray(actuaciones) ? actuaciones.filter(item => item && positiveId(item.id)
    && (item.solicitudId == null || item.solicitudId === solicitud.id)
    && (item.expediente == null || item.expediente === solicitud.expediente)) : [];
}

export function registroAnidadoCompatible(registro: any, solicitud: Solicitud): boolean {
  return registro && positiveId(registro.id) && (registro.solicitudId == null || registro.solicitudId === solicitud.id);
}

export function modalidadesRegistradas(solicitud: Solicitud | null): string[] {
  if (!solicitud) return [];
  const opciones: [boolean, string][] = [[solicitud.formatoDigital, 'Digital'], [solicitud.formatoFisico, 'Físico'],
    [solicitud.copiaSimple, 'Copia simple'], [solicitud.copiaCertificada, 'Copia certificada']];
  return opciones.filter(([elegida]) => elegida === true).map(([, label]) => label);
}

export function detalleConRelacionesVerificadas(data: Solicitud): { solicitud: Solicitud; incompleta: boolean } {
  let incompleta = !positiveId(data.entidadId) || !data.asunto || !data.estado || !data.fechaPresentacion || !Number.isFinite(Date.parse(data.fechaPresentacion))
    || (['RESPONDIDA', 'DENEGADA'].includes(data.estado) && !data.respuesta);
  const solicitud = { ...data };
  for (const field of ['observaciones', 'ampliacionesPlazo', 'encauzamientos', 'liquidacionesCosto'] as const) {
    const original = data[field];
    const validas = actuacionesDeSolicitud(original as any, data);
    if (!Array.isArray(original) || original.length !== validas.length) incompleta = true;
    (solicitud as any)[field] = validas;
  }
  for (const field of ['respuesta', 'apelacion'] as const) {
    if (data[field] && !registroAnidadoCompatible(data[field], data)) {
      (solicitud as any)[field] = null; incompleta = true;
    }
  }
  const filterDocs = (source: any, relation: DocumentoRelation) => {
    const originales = source.documentosMetadata ?? source.documentos;
    const seguros = documentosDelRecurso(originales, relation);
    if (!Array.isArray(originales) || originales.length !== seguros.length) incompleta = true;
    // An explicit empty metadata array is authoritative; never fall back to old DTOs.
    return { ...source, documentosMetadata: seguros };
  };
  Object.assign(solicitud, filterDocs(solicitud, { solicitudId: data.id }));
  if (solicitud.respuesta) solicitud.respuesta = filterDocs(solicitud.respuesta, { respuestaId: solicitud.respuesta.id });
  return { solicitud, incompleta };
}
