import { DocumentoMetadata } from '../../../models/documento.model';

export interface FilaDocumental {
  doc: DocumentoMetadata;
  etiqueta: string;
  procedencia: string;
  color: string;
  colorProcedencia: string;
  fecha: string;
}

export interface EtapaDocumental {
  key: string;
  label: string;
  orden: number;
  total: number;
  filas: FilaDocumental[];
}

const ETAPAS = [
  { key: 'saip', label: 'Solicitud SAIP' },
  { key: 'entidad', label: 'Respuesta y descargos de la entidad' },
  { key: 'apelacion', label: 'Recurso de apelación' },
  { key: 'subsanacion', label: 'Subsanación' },
  { key: 'resolucion', label: 'Resoluciones del Tribunal' },
  { key: 'notificacion', label: 'Notificaciones y cargos' },
] as const;

const ETIQUETA: Record<string, string> = {
  SOLICITUD_ORIGINAL: 'Solicitud', RESPUESTA_ENTIDAD: 'Respuesta', RECURSO_APELACION: 'Recurso de apelación',
  SUBSANACION: 'Subsanación', RESOLUCION_TTAIP: 'Resolución', CEDULA_NOTIFICACION: 'Cédula',
  INFORME: 'Informe', EXPEDIENTE_ADMINISTRATIVO: 'Expediente', DOCUMENTO_ADJUNTO: 'Anexo', OTRO: 'Documento',
};

const COLOR: Record<string, string> = {
  saip: 'var(--brand-700)', entidad: 'var(--info)', apelacion: 'var(--gold-dark)',
  subsanacion: 'var(--warning)', resolucion: 'var(--brand-700)', notificacion: 'var(--info)',
};

export function nombreDocumento(doc: DocumentoMetadata): string {
  return (doc.nombreOriginal || 'Nombre no informado').replace(/^\s*(principal|anexo\s*\d*)\s*[—-]\s*/i, '').trim() || 'Nombre no informado';
}

export function fechaLegible(valor: string | null | undefined): string {
  const coincidencia = (valor || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!coincidencia) return '—';
  const fecha = `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}`;
  return coincidencia[4] ? `${fecha}, ${coincidencia[4]}:${coincidencia[5]}` : fecha;
}

function etapaDe(doc: DocumentoMetadata): string {
  const tipo = doc.tipoDocumento || '';
  if (tipo === 'SUBSANACION') return 'subsanacion';
  if (tipo === 'SOLICITUD_ORIGINAL') return 'saip';
  if (tipo === 'RESPUESTA_ENTIDAD') return 'entidad';
  if (tipo === 'RESOLUCION_TTAIP' || tipo === 'INFORME') return 'resolucion';
  if (tipo === 'CEDULA_NOTIFICACION' || doc.cedulaNotificacionId) return 'notificacion';
  if (tipo === 'RECURSO_APELACION') return 'apelacion';
  if (doc.resolucionId) return 'resolucion';
  if (doc.respuestaId && !doc.apelacionId) return 'entidad';
  if (doc.solicitudId && !doc.apelacionId) return 'saip';
  return 'apelacion';
}

function filaDe(doc: DocumentoMetadata, entidad: string): FilaDocumental {
  const etapa = etapaDe(doc);
  const tribunal = etapa === 'resolucion' || etapa === 'notificacion';
  return {
    doc,
    etiqueta: ETIQUETA[doc.tipoDocumento || ''] || (doc.resolucionId ? 'Resolución' : doc.cedulaNotificacionId ? 'Cédula' : 'Documento'),
    procedencia: etapa === 'entidad' ? entidad : tribunal ? 'Tribunal' : 'Administrado',
    color: COLOR[etapa] || 'var(--brand-700)',
    colorProcedencia: tribunal ? 'var(--brand-700)' : etapa === 'entidad' ? 'var(--info)' : 'var(--gold-dark)',
    fecha: fechaLegible(doc.fechaCreacion),
  };
}

export function agruparExpediente(documentos: DocumentoMetadata[], entidad: string, busqueda: string): EtapaDocumental[] {
  const norm = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
  const consulta = norm(busqueda);
  const procedencia = entidad.trim() || 'Entidad';
  return ETAPAS.map((etapa, index) => {
    const propias = documentos.filter(doc => etapaDe(doc) === etapa.key)
      .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
    const filas = propias.filter(doc => {
      const fila = filaDe(doc, procedencia);
      return !consulta || norm([nombreDocumento(doc), fila.etiqueta, fila.procedencia, fila.fecha, doc.contentType, etapa.label].filter(Boolean).join(' ')).includes(consulta);
    }).map(doc => filaDe(doc, procedencia));
    return { key: etapa.key, label: etapa.label, orden: index + 1, total: propias.length, filas };
  }).filter(etapa => etapa.total > 0);
}
