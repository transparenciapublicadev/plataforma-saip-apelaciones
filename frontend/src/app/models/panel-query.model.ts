import type { Solicitud, ApelacionInfo } from './solicitud.model';
import type { Apelacion } from './apelacion.model';

/** Read models for bounded dashboard queries. They are not writable aggregates. */
export type PanelSolicitud = Pick<Solicitud, 'id' | 'expediente' | 'estado' | 'ciudadanoId' | 'entidadId'>
  & Partial<Pick<Solicitud, 'asunto' | 'descripcion' | 'ciudadanoNombre' | 'ciudadanoDni' | 'entidadNombre'
    | 'fechaPresentacion' | 'fechaLimite' | 'diasRestantes' | 'prioridad' | 'tipoInformacion'
    | 'oficinaDestinataria' | 'areaResponsable' | 'encargadoArea'>> & {
  respuesta?: { id?: number; tipoRespuesta?: string; fechaRespuesta?: string } | null;
  observaciones?: { id?: number; solicitudId?: number; estado?: string; fechaLimiteSubsanacion?: string; fechaObservacion?: string; fechaSubsanacion?: string; diasRestantes?: number }[];
  etapa?: string;
  encauzamientoAlcance?: 'TOTAL' | 'PARCIAL' | null;
  apelacion?: PanelApelacion | null;
};
export type PanelApelacion = Pick<Apelacion, 'id' | 'expediente' | 'estado'>
  & Partial<Pick<Apelacion, 'ciudadanoId' | 'ciudadanoNombre' | 'entidadId' | 'entidadNombre' | 'entidadExternaNombre'
    | 'solicitudId' | 'solicitudExpediente' | 'solicitudAsunto' | 'resumenSolicitudOriginal' | 'fundamentos'
    | 'fechaApelacion' | 'plazoSubsanacion' | 'calificacionPrimera' | 'calificacionSegunda'>> & {
  resultado?: string;
  resuelta?: boolean;
  etapa?: string;
  actosNotificacionPendientes?: boolean;
  informacionComplementariaPendiente?: boolean;
  plazoPrimeraCalificacion?: { diasRestantes: number; vencido: boolean; diasSuspendidos?: number; fechaLimite?: string } | null;
  elevacion?: { fechaLimiteElevacion?: string };
  resolucion?: { id?: number; tipoResolucion?: string; decision?: string; fechaResolucion?: string } | null;
  resolucionPrimeraCalificacion?: { id?: number } | null;
  resolucionSegundaCalificacion?: { id?: number } | null;
  expedienteTtaip?: { id?: number; sala?: { id?: number; nombre?: string; codigo?: string } | null } | null;
};
export interface PanelSummary {
  total: number;
  porEstado: Record<string, number>;
  porEtapa: Record<string, number>;
  porResultado?: Record<string, number>;
  porEntidad?: Record<string, number>;
  porTipoInformacion?: Record<string, number>;
  porDiasRestantes?: Record<string, number>;
  registroRespuestas?: {
    enPlazo: number;
    fueraDePlazo: number;
    pendientes: number;
    noEvaluadas: number;
  } | null;
}
export interface PanelPage<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  ultima: boolean;
  resumen: PanelSummary;
  entidades: { id: number; nombre: string; total?: number }[];
  salas?: { id: number; nombre: string }[];
  alcance: string;
  fuentePlazo?: string;
  opcionesLimitadas?: boolean;
}
export interface PanelQuery {
  pagina: number;
  tamano: number;
  busqueda?: string;
  estado?: string;
  etapa?: string;
  orden?: 'recientes' | 'antiguas';
  sala?: number | 'SIN_SALA';
}

/** Reject incompatible pages rather than turn a malformed result into an empty list. */
export function validPanelPage<T>(value: unknown, page: number, size: number): value is PanelPage<T> {
  if (!value || typeof value !== 'object') return false;
  const v = value as PanelPage<T>;
  const count = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
  const counts = (x: unknown): boolean => !!x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every(count);
  return Array.isArray(v.contenido) && v.contenido.length <= size && v.pagina === page && v.tamano === size
    && count(v.totalElementos) && count(v.totalPaginas) && v.totalPaginas === Math.ceil(v.totalElementos / size)
    && v.contenido.length <= v.totalElementos && typeof v.ultima === 'boolean'
    && !!v.resumen && count(v.resumen.total) && v.resumen.total >= v.totalElementos
    && counts(v.resumen.porEstado) && counts(v.resumen.porEtapa)
    && Array.isArray(v.entidades) && typeof v.alcance === 'string' && !!v.alcance.trim();
}
