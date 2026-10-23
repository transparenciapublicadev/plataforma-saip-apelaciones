package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

import java.util.List;

@Schema(description = "Apelación ante el Tribunal de Transparencia (TTAIP)")
public record ApelacionDTO(
    Long id,
    @Schema(description = "Número de expediente TTAIP", example = "01560-2025-JUS/TTAIP")
    String expediente,
    String fundamentos,
    @Schema(description = "Estado de la apelación", example = "EN_CALIFICACION_1", implementation = Apelacion.EstadoApelacion.class, allowableValues = {"PENDIENTE_ELEVACION", "EN_CALIFICACION_1", "EN_SUBSANACION", "EN_CALIFICACION_2", "NOTIFICACION_SEGUNDA_CALIFICACION", "EN_RESOLUCION", "RESUELTO", "TENER_POR_NO_PRESENTADO", "CONCLUSION_SUSTRACCION_MATERIA", "CONCLUSION_DESISTIMIENTO", "RESUELTO_FUNDADO", "RESUELTO_FUNDADO_EN_PARTE", "RESUELTO_INFUNDADO", "RESUELTO_INFUNDADO_EN_PARTE", "RESUELTO_IMPROCEDENTE", "RESUELTO_ESTESE_A_LO_RESUELTO", "RESUELTO_NULIDAD_ACTO"})
    String estado,
    String resultado,
    String fechaApelacion,
    @Schema(description="Fecha histórica del requerimiento; no acredita notificación eficaz ni debe usarse para calcular plazos", deprecated=true)
    String fechaSubsanacion,
    Integer diasSubsanacion,
    @Schema(description = "Calificación de primera instancia", example = "ADMITIDO", implementation = Apelacion.Calificacion.class, allowableValues = {"ADMISIBLE", "INADMISIBLE", "IMPROCEDENTE", "ADMITIDO"})
    String calificacionPrimera,
    @Schema(description = "Calificación de segunda instancia", example = "ADMITIDO", implementation = Apelacion.Calificacion.class, allowableValues = {"ADMISIBLE", "INADMISIBLE", "IMPROCEDENTE", "ADMITIDO"})
    String calificacionSegunda,
    Long solicitudId,
    String solicitudExpediente,
    String solicitudAsunto,
    Long ciudadanoId,
    String ciudadanoNombre,
    Long entidadId,
    String entidadNombre,
    @Schema(description = "Tipo de origen de la apelación", example = "SAIP_INTERNA", implementation = Apelacion.TipoOrigenApelacion.class, allowableValues = {"SAIP_INTERNA", "EXTERNA"})
    String tipoOrigen,
    String entidadExternaNombre,
    String entidadExternaRuc,
    String entidadExternaEmail,
    String numeroSolicitudExterna,
    String fechaPresentacionSolicitudExterna,
    String fechaRespuestaEntidad,
    @Schema(description = "Tipo de denegatoria de la SAIP", example = "EXPRESA", implementation = Apelacion.TipoDenegatoria.class, allowableValues = {"EXPRESA", "TACITA"})
    String tipoDenegatoria,
    String resumenSolicitudOriginal,
    String resumenRespuestaEntidad,
    String referenciaDocumentoSolicitud,
    String referenciaCargoRecepcion,
    String referenciaRespuestaEntidad,
    String evidenciaSilencioAdministrativo,
    String observacion,
    @Schema(description = "Elevación formal cuando la apelación fue presentada inicialmente ante la entidad pública")
    ElevacionApelacionTtaipDTO elevacion,
    @Schema(description = "Resolución final (RESOLUCION_FINAL)")
    ResolucionDTO resolucion,
    @Schema(description = "Resolución de primera calificación (PRIMERA_CALIFICACION)")
    ResolucionDTO resolucionPrimeraCalificacion,
    @Schema(description = "Resolución de segunda calificación (SEGUNDA_CALIFICACION)")
    ResolucionDTO resolucionSegundaCalificacion,
    @Schema(description = "Expediente TTAIP como agregado principal de la segunda instancia")
    ExpedienteTtaipDTO expedienteTtaip,
    @Schema(description = "Todas las resoluciones emitidas dentro del expediente")
    List<ResolucionDTO> resoluciones,
    List<DocumentoDTO> documentos,
    @Schema(description = "Metadatos documentales seguros asociados directamente a la apelación")
    List<DocumentoMetadataDTO> documentosMetadata,
    Boolean resuelta,
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    PlazoSubsanacionTtaipDTO plazoSubsanacion
) {
    public static ApelacionDTO from(Apelacion a) {
        return new ApelacionDTO(
            a.getId(),
            a.getExpediente(),
            a.getFundamentos(),
            a.getEstado() != null ? a.getEstado().name() : null,
            a.getResultado(),
            a.getFechaApelacion() != null ? a.getFechaApelacion().toString() : null,
            a.getFechaSubsanacion() != null ? a.getFechaSubsanacion().toString() : null,
            a.getDiasSubsanacion(),
            a.getCalificacionPrimera() != null ? a.getCalificacionPrimera().name() : null,
            a.getCalificacionSegunda() != null ? a.getCalificacionSegunda().name() : null,
            a.getSolicitud() != null ? a.getSolicitud().getId() : null,
            a.getSolicitud() != null ? a.getSolicitud().getExpediente() : null,
            a.getSolicitud() != null ? a.getSolicitud().getAsunto() : null,
            a.getCiudadano() != null ? a.getCiudadano().getId() : null,
            a.getCiudadano() != null ? a.getCiudadano().getNombreCompleto() : null,
            a.getEntidadApeladaEfectiva() != null ? a.getEntidadApeladaEfectiva().getId() : null,
            a.getEntidadNombreEfectivo(),
            a.getTipoOrigenEfectivo().name(),
            a.getEntidadExternaNombre(),
            a.getEntidadExternaRuc(),
            a.getEntidadExternaEmail(),
            a.getNumeroSolicitudExterna(),
            a.getFechaPresentacionSolicitudExterna() != null ? a.getFechaPresentacionSolicitudExterna().toString() : null,
            a.getFechaRespuestaEntidad() != null ? a.getFechaRespuestaEntidad().toString() : null,
            a.getTipoDenegatoria() != null ? a.getTipoDenegatoria().name() : null,
            a.getResumenSolicitudOriginal(),
            a.getResumenRespuestaEntidad(),
            a.getReferenciaDocumentoSolicitud(),
            a.getReferenciaCargoRecepcion(),
            a.getReferenciaRespuestaEntidad(),
            a.getEvidenciaSilencioAdministrativo(),
            a.getObservacion(),
            a.getElevacion() != null ? ElevacionApelacionTtaipDTO.from(a.getElevacion()) : null,
            a.getResolucion() != null ? ResolucionDTO.from(a.getResolucion()) : null,
            a.getResolucionPrimeraCalificacion() != null ? ResolucionDTO.from(a.getResolucionPrimeraCalificacion()) : null,
            a.getResolucionSegundaCalificacion() != null ? ResolucionDTO.from(a.getResolucionSegundaCalificacion()) : null,
            a.getExpedienteTtaip() != null ? ExpedienteTtaipDTO.from(a.getExpedienteTtaip()) : null,
            a.getResoluciones() != null ? a.getResoluciones().stream().map(ResolucionDTO::from).toList() : List.of(),
            DocumentoDTO.fromActive(a.getDocumentos()),
            DocumentoMetadataDTO.fromActive(a.getDocumentos()),
            a.isResuelta(),
            PlazoSubsanacionTtaipDTO.from(a)
        );
    }
}
