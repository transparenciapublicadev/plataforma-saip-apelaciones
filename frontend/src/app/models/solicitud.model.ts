// Derivado del contrato OpenAPI — re-generar: npm run generate:api
import type {
    SolicitudDTO, ApelacionInfoDTO, RespuestaDTO, DocumentoDTO, DocumentoMetadataDTO,
    ObservacionSolicitudDTO,
    EstadoSolicitud as _EstadoSolicitud,
    Prioridad as _Prioridad,
    SemaforoEstado as _SemaforoEstado
} from '../api/types';
import { aISO, habilesEntre, hoyLima, sumarDias, sumarHabiles } from './calendario.model';

export type EstadoSolicitud = _EstadoSolicitud;
export type Prioridad = _Prioridad;
export type SemaforoEstado = _SemaforoEstado;
export type ApelacionInfo = Required<Omit<ApelacionInfoDTO, 'plazoSubsanacion'>> & {
    plazoSubsanacion?: ApelacionInfoDTO['plazoSubsanacion'];
};
export type CanalNotificacion = 'CORREO_ELECTRONICO' | 'CASILLA_ELECTRONICA' | 'PLATAFORMA' | 'FISICA';
export type EstadoObservacionSolicitud = 'PENDIENTE_SUBSANACION' | 'SUBSANADA' | 'NO_SUBSANADA' | 'ARCHIVADA';
export type ObservacionSolicitud = Required<ObservacionSolicitudDTO>;
export type EstadoAmpliacionPlazo = 'REGISTRADA' | 'NOTIFICADA' | 'COMPLETADA' | 'CANCELADA' | 'VENCIDA';
export type EstadoEntregaParcial = 'PROGRAMADA' | 'ENTREGADA' | 'OBSERVADA' | 'CANCELADA' | 'VENCIDA';
export type DecisionEntregaProgramada = 'ENTREGA_TOTAL' | 'ENTREGA_PARCIAL' | 'DENEGACION_TOTAL';
export const DECISIONES_ENTREGA: Record<DecisionEntregaProgramada, string> = {
    ENTREGA_TOTAL: 'Entrega total del hito',
    ENTREGA_PARCIAL: 'Entrega parcial del hito',
    DENEGACION_TOTAL: 'Denegación del hito'
};
export type AlcanceEncauzamientoSolicitud = 'TOTAL' | 'PARCIAL';
export type EstadoEncauzamientoSolicitud = 'REGISTRADO' | 'DERIVADO' | 'ATENDIDO' | 'CANCELADO' | 'VENCIDO';
export type EstadoLiquidacionCosto = 'EMITIDA' | 'NOTIFICADA' | 'PAGADA' | 'RECOGIDA' | 'ARCHIVADA' | 'CANCELADA' | 'VENCIDA';

export interface CronogramaEntregaParcial {
    id: number;
    ampliacionId: number;
    numeroEntrega: number;
    descripcion: string;
    fechaProgramada: string;
    estado: EstadoEntregaParcial;
    fechaEntregaReal?: string | null;
    observacion?: string | null;
    incumplida?: boolean;
    documentos?: DocumentoMetadataDTO[];
    decision?: DecisionEntregaProgramada | null;
    fundamentoDecision?: string | null;
}

export interface PrevisionAmpliacion {
    hoy: string;
    fechaMaximaComunicacion: string;
    fechaLimiteAmpliada?: string | null;
    disponible: boolean;
    requiereCronograma: boolean;
}

export interface AmpliacionPlazoSolicitud {
    id: number;
    solicitudId: number;
    expediente: string;
    motivoAmpliacion: string;
    informeAmpliacion: string;
    fechaSolicitudAmpliacion: string;
    fechaNotificacionAmpliacion: string;
    fechaLimiteOriginal: string;
    fechaLimiteAmpliada: string;
    plazoOrdinarioVencido?: boolean;
    estadoAmpliacion: EstadoAmpliacionPlazo;
    responsable?: string | null;
    trazabilidad?: string | null;
    cronograma: CronogramaEntregaParcial[];
}

export function tieneCronogramaIncumplido(solicitud: Solicitud): boolean {
    return solicitud.ampliacionesPlazo?.some(ampliacion => ampliacion.solicitudId === solicitud.id
        && ampliacion.estadoAmpliacion !== 'CANCELADA'
        && ampliacion.cronograma?.some(hito => hito.ampliacionId === ampliacion.id && hito.incumplida === true)) ?? false;
}

export function ampliacionParaApelar(solicitud: Solicitud): AmpliacionPlazoSolicitud | undefined {
    return solicitud.ampliacionesPlazo?.find(a => a.solicitudId === solicitud.id && a.estadoAmpliacion !== 'CANCELADA');
}

/** La ampliación sigue en curso y la entidad aún no cerró la SAIP con una respuesta. */
export function tienePlazoAmpliadoVigente(solicitud: Solicitud): boolean {
    const estado = (solicitud.estado || '').toUpperCase();
    if (estado !== 'RECEPCIONADA' && estado !== 'EN_REVISION' && estado !== 'EN_PROCESO') return false;
    if (solicitud.respuesta) return false;
    return ampliacionParaApelar(solicitud) != null;
}

export function tieneHitoDesfavorable(solicitud: Solicitud): boolean {
    const ampliacion = ampliacionParaApelar(solicitud);
    return ampliacion?.cronograma?.some(hito => hito.ampliacionId === ampliacion.id && hito.estado === 'ENTREGADA'
        && (hito.decision === 'ENTREGA_PARCIAL' || hito.decision === 'DENEGACION_TOTAL')) ?? false;
}

/** Días hábiles que quedan para apelar, contados desde el día siguiente al ancla e incluyendo hoy. */
export function diasHabilesParaApelar(ancla?: string | null, hoy = hoyLima()): number | null {
    const inicio = aISO(ancla);
    if (!inicio) return null;
    const limite = sumarHabiles(inicio, 15);
    if (hoy > limite) return -1;
    const desde = hoy <= inicio ? inicio : sumarDias(hoy, -1);
    return habilesEntre(desde, limite);
}

/**
 * Null hasta el día hábil siguiente al vencimiento ordinario.
 * Cero o más durante los 15 días hábiles. -1 cuando ese plazo ya terminó.
 */
export function diasApelacionCronograma(ampliacion?: AmpliacionPlazoSolicitud | null, hoy = hoyLima()): number | null {
    if (!ampliacion || ampliacion.estadoAmpliacion === 'CANCELADA') return null;
    const ancla = aISO(ampliacion.fechaLimiteOriginal);
    if (!ancla || hoy <= ancla) return null;
    return diasHabilesParaApelar(ancla, hoy);
}

export function entregaApelable(ampliacion?: AmpliacionPlazoSolicitud | null, hoy = hoyLima()): CronogramaEntregaParcial | null {
    if (!ampliacion || ampliacion.estadoAmpliacion === 'CANCELADA') return null;
    let elegida: CronogramaEntregaParcial | null = null;
    let anclaElegida = '';
    for (const hito of ampliacion.cronograma ?? []) {
        if (hito.estado !== 'ENTREGADA' || (hito.ampliacionId != null && hito.ampliacionId !== ampliacion.id)) continue;
        const ancla = aISO(hito.fechaEntregaReal) ?? aISO(hito.fechaProgramada);
        if (!ancla) return hito;
        const dias = diasHabilesParaApelar(ancla, hoy);
        if (dias !== null && dias >= 0 && ancla >= anclaElegida) {
            elegida = hito;
            anclaElegida = ancla;
        }
    }
    return elegida;
}

/** El cronograma se apela 15 días hábiles desde el día 11. Cada entrega recibida abre otro plazo igual. */
export function ampliacionPermiteApelar(ampliacion?: AmpliacionPlazoSolicitud | null, hoy = hoyLima()): boolean {
    if (!ampliacion || ampliacion.estadoAmpliacion === 'CANCELADA') return false;
    const dias = diasApelacionCronograma(ampliacion, hoy);
    if (dias !== null && dias >= 0) return true;
    if (entregaApelable(ampliacion, hoy)) return true;
    return (ampliacion.cronograma ?? []).some(hito => hito.incumplida === true
        && (hito.ampliacionId == null || hito.ampliacionId === ampliacion.id));
}

export interface EncauzamientoSolicitud {
    id: number;
    solicitudId: number;
    expediente: string;
    entidadOrigenId: number;
    entidadOrigenNombre: string;
    entidadOrigenAcronimo?: string | null;
    entidadDestinoId: number;
    entidadDestinoNombre: string;
    entidadDestinoAcronimo?: string | null;
    motivoEncauzamiento: string;
    alcance: AlcanceEncauzamientoSolicitud;
    fechaEncauzamiento: string;
    fechaLimiteEncauzamiento: string;
    estadoEncauzamiento: EstadoEncauzamientoSolicitud;
    responsable?: string | null;
    observacionSustento?: string | null;
    trazabilidad?: string | null;
    solicitudDerivadaId?: number | null;
    expedienteDerivado?: string | null;
}

export interface LiquidacionCostoSolicitud {
    id: number;
    solicitudId: number;
    expediente: string;
    codigoLiquidacion: string;
    monto: string;
    moneda: string;
    concepto: string;
    fechaEmision: string;
    fechaNotificacion: string;
    fechaLimiteRecojo: string;
    estadoLiquidacion: EstadoLiquidacionCosto;
    medioNotificacion: CanalNotificacion;
    responsable?: string | null;
    observacion?: string | null;
    trazabilidad?: string | null;
    fechaPago?: string | null;
    fechaRecojo?: string | null;
}

export type Solicitud = Required<Omit<SolicitudDTO, 'respuesta' | 'apelacion' | 'documentos' | 'documentosMetadata' | 'observaciones' | 'ampliacionesPlazo' | 'encauzamientos' | 'liquidacionesCosto'>> & {
    respuesta?: Required<RespuestaDTO> | null;
    apelacion?: ApelacionInfo | null;
    documentos: Required<DocumentoDTO>[];
    documentosMetadata: Required<DocumentoMetadataDTO>[];
    observaciones: ObservacionSolicitud[];
    ampliacionesPlazo: AmpliacionPlazoSolicitud[];
    encauzamientos: EncauzamientoSolicitud[];
    liquidacionesCosto: LiquidacionCostoSolicitud[];
    oficinaDestinataria?: string | null;
    areaResponsable?: string | null;
    encargadoArea?: string | null;
    fechaAsignacionArea?: string | null;
};

// Tipo solo del lado cliente — no existe en el contrato OpenAPI
export interface SolicitudCreate {
    asunto: string;
    descripcion: string;
    ciudadanoId: number;
    entidadId: number;
    tipoInformacion?: string;
    formatoDigital?: boolean;
    formatoFisico?: boolean;
    copiaSimple?: boolean;
    copiaCertificada?: boolean;
    consentimientoDatosPersonales: boolean;
    canalNotificacion: CanalNotificacion;
}

export interface ObservarSolicitudPayload {
    motivoObservacion: string;
    responsable?: string;
}

export interface SubsanarSolicitudPayload {
    comentarioSubsanacion?: string;
    documentoSubsanacionNombre?: string;
    documentoSubsanacionRuta?: string;
    responsable?: string;
}

export interface RegistrarEntregaParcialPayload {
    numeroEntrega: number;
    descripcion: string;
    fechaProgramada: string;
    observacion?: string;
}

export interface RegistrarAmpliacionPlazoPayload {
    motivoAmpliacion: string;
    informeAmpliacion: string;
    fechaNotificacionAmpliacion: string;
    responsable?: string;
    cronograma: RegistrarEntregaParcialPayload[];
    diasHabilesAdicionales?: number;
}

export interface RegistrarEncauzamientoPayload {
    entidadDestinoId: number;
    motivoEncauzamiento: string;
    alcance: AlcanceEncauzamientoSolicitud;
    responsable?: string;
    observacionSustento?: string;
}

export interface RegistrarLiquidacionCostoPayload {
    codigoLiquidacion?: string;
    monto: number;
    moneda?: string;
    concepto: string;
    fechaNotificacion: string;
    medioNotificacion: CanalNotificacion;
    responsable?: string;
    observacion?: string;
}

export interface ActualizarLiquidacionCostoPayload {
    estado: 'PAGADA' | 'RECOGIDA' | 'CANCELADA';
    fechaPago?: string;
    fechaRecojo?: string;
    responsable?: string;
    observacion?: string;
}

export interface ActualizarEntregaParcialPayload {
    estado: EstadoEntregaParcial;
    fechaEntregaReal?: string;
    observacion?: string;
}
