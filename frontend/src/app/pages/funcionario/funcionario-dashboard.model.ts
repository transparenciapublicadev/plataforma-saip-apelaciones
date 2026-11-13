import { PanelSolicitud as Solicitud } from '../../models/panel-query.model';

export type BucketKey = 'todas' | 'san' | 'hoy' | 'semana' | 'plazo' | 'respondidas';
export interface QueueItem {
  solicitud: Solicitud;
  bucket: Exclude<BucketKey, 'todas'>;
  diasRestantes: number | null;
  iniciales: string;
  prioridad: string | null;
  tema: string | null;
}
export const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');

// A relation mismatch invalidates the whole institutional response, rather than filtering a global list.
export function readInstitutionList(value: unknown, entidad: number): Solicitud[] | null {
  if (!Array.isArray(value)) return null;
  const ids = new Set<number>(), codes = new Set<string>();
  for (const row of value) {
    if (!row || !positiveId(row.id) || row.entidadId !== entidad || typeof row.expediente !== 'string'
      || !/^SAIP-\d{4}-\d{5,}$/.test(row.expediente) || typeof row.estado !== 'string' || !row.estado.trim()
      || ids.has(row.id) || codes.has(row.expediente)) return null;
    for (const field of ['asunto', 'ciudadanoNombre', 'tipoInformacion', 'fechaPresentacion', 'oficinaDestinataria', 'areaResponsable', 'encargadoArea']) {
      if (row[field] != null && typeof row[field] !== 'string') return null;
    }
    ids.add(row.id); codes.add(row.expediente);
  }
  return value;
}

export function queueItem(solicitud: Solicitud): QueueItem {
  const days = Number.isSafeInteger(solicitud.diasRestantes) ? solicitud.diasRestantes! : null;
  let bucket: QueueItem['bucket'] = 'plazo';
  if (solicitud.estado === 'RESPONDIDA' || solicitud.estado === 'DENEGADA' || solicitud.respuesta != null) {
    bucket = 'respondidas';
  } else if (solicitud.estado === 'PENDIENTE_INFORMACION') {
    bucket = 'plazo';
  } else if (solicitud.estado === 'VENCIDA' || (days !== null && days < 0)) {
    bucket = 'san';
  } else if (days !== null && days <= 1) {
    bucket = 'hoy';
  } else if (days !== null && days <= 5) {
    bucket = 'semana';
  } else {
    bucket = 'plazo';
  }
  const nombre = typeof solicitud.ciudadanoNombre === 'string' ? solicitud.ciudadanoNombre.trim() : '';
  const prioridad = typeof solicitud.prioridad === 'string' && ['ALTA', 'MEDIA', 'BAJA', 'NORMAL', 'URGENTE'].includes(solicitud.prioridad) ? solicitud.prioridad : null;
  return { solicitud, bucket, diasRestantes: days,
    iniciales: nombre ? nombre.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : '—',
    prioridad, tema: typeof solicitud.tipoInformacion === 'string' && solicitud.tipoInformacion.trim() ? solicitud.tipoInformacion.trim() : null };
}

// Navigation is enabled for active un-responded requests that are not in precision
export function canNavigateToResponse(solicitud: Solicitud): boolean {
  if (!solicitud) return false;
  if (['CONCLUIDA', 'PENDIENTE_INFORMACION', 'RESPONDIDA', 'DENEGADA'].includes(solicitud.estado)) return false;
  if (solicitud.respuesta !== null) return false;
  if (!Array.isArray(solicitud.observaciones)) return false;
  if (solicitud.observaciones.some(item => !item || typeof item !== 'object' || item.estado === 'PENDIENTE_SUBSANACION')) return false;
  return ['RECEPCIONADA', 'EN_REVISION', 'VENCIDA'].includes(solicitud.estado);
}
