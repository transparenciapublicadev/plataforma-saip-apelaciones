/**
 * Tipos extraídos del OpenAPI spec auto-generado.
 * Fuente de verdad: openapi.json → schema.ts (generado por openapi-typescript)
 * Re-generar: npm run generate:api
 */
import type { components } from './schema';

// ── Entity DTOs ──────────────────────────────────────────────────────────
export type SolicitudDTO = components['schemas']['SolicitudDTO'];
export type ObservacionSolicitudDTO = components['schemas']['ObservacionSolicitudDTO'];
export type ApelacionDTO = components['schemas']['ApelacionDTO'];
export type ApelacionInfoDTO = components['schemas']['ApelacionInfoDTO'];
export type RespuestaDTO = components['schemas']['RespuestaDTO'];
export type ResolucionDTO = components['schemas']['ResolucionDTO'];
export type DocumentoDTO = components['schemas']['DocumentoDTO'];
export type DocumentoMetadataDTO = components['schemas']['DocumentoMetadataDTO'];
export type CiudadanoDTO = components['schemas']['CiudadanoDTO'];
export type EntidadDTO = components['schemas']['EntidadDTO'];
export type FuncionarioDTO = components['schemas']['FuncionarioDTO'];

// ── Request DTOs ─────────────────────────────────────────────────────────
export type LoginRequestDTO = components['schemas']['LoginRequestDTO'];
export type RegistroRequestDTO = components['schemas']['RegistroRequestDTO'];
export type CalificacionRequest = components['schemas']['CalificacionRequest'];
export type ResolucionRequest = components['schemas']['ResolucionRequest'];
export type CrearRespuestaRequest = components['schemas']['CrearRespuestaRequest'];
export type CrearApelacionExternaRequest = components['schemas']['CrearApelacionExternaRequest'];
export type ObservarSolicitudRequest = components['schemas']['ObservarSolicitudRequest'];
export type SubsanarSolicitudRequest = components['schemas']['SubsanarSolicitudRequest'];

// ── Enums extraídos del spec ─────────────────────────────────────────────
export type EstadoSolicitud = NonNullable<SolicitudDTO['estado']>;
export type Prioridad = NonNullable<SolicitudDTO['prioridad']>;
export type SemaforoEstado = NonNullable<SolicitudDTO['semaforo']>;
export type TipoRespuesta = NonNullable<RespuestaDTO['tipoRespuesta']>;
export type TipoRespuestaCrear = NonNullable<CrearRespuestaRequest['tipoRespuesta']>;

// ── API Paths & Operations (para uso avanzado) ──────────────────────────
export type { paths, operations } from './schema';
