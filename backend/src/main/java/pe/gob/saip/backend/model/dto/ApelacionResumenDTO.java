package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

@Schema(description = "Resumen liviano de una apelación TTAIP para listados paginados")
public record ApelacionResumenDTO(
        Long id,
        String expediente,
        @Schema(description = "Estado de la apelación", example = "EN_CALIFICACION_1", implementation = Apelacion.EstadoApelacion.class, allowableValues = {"PENDIENTE_ELEVACION", "EN_CALIFICACION_1", "EN_SUBSANACION", "EN_CALIFICACION_2", "NOTIFICACION_SEGUNDA_CALIFICACION", "EN_RESOLUCION", "NOTIFICACION_RESOLUCION_FINAL", "EN_CUMPLIMIENTO", "RESUELTO", "TENER_POR_NO_PRESENTADO", "CONCLUSION_SUSTRACCION_MATERIA", "CONCLUSION_DESISTIMIENTO", "RESUELTO_FUNDADO", "RESUELTO_FUNDADO_EN_PARTE", "RESUELTO_INFUNDADO", "RESUELTO_INFUNDADO_EN_PARTE", "RESUELTO_IMPROCEDENTE", "RESUELTO_ESTESE_A_LO_RESUELTO", "RESUELTO_NULIDAD_ACTO"})
        String estado,
        String resultado,
        String fechaApelacion,
        Long solicitudId,
        String solicitudExpediente,
        Long ciudadanoId,
        String ciudadanoNombre,
        Long entidadId,
        String entidadNombre,
        @Schema(description = "Tipo de origen de la apelación", example = "SAIP_INTERNA", implementation = Apelacion.TipoOrigenApelacion.class, allowableValues = {"SAIP_INTERNA", "EXTERNA"})
        String tipoOrigen,
        String numeroSolicitudExterna
) {
    public static ApelacionResumenDTO from(Apelacion apelacion) {
        return new ApelacionResumenDTO(
                apelacion.getId(),
                apelacion.getExpediente(),
                apelacion.getEstado() != null ? apelacion.getEstado().name() : null,
                apelacion.getResultado(),
                apelacion.getFechaApelacion() != null ? apelacion.getFechaApelacion().toString() : null,
                apelacion.getSolicitud() != null ? apelacion.getSolicitud().getId() : null,
                apelacion.getSolicitud() != null ? apelacion.getSolicitud().getExpediente() : null,
                apelacion.getCiudadano() != null ? apelacion.getCiudadano().getId() : null,
                apelacion.getCiudadano() != null ? apelacion.getCiudadano().getNombreCompleto() : null,
                apelacion.getEntidadApeladaEfectiva() != null ? apelacion.getEntidadApeladaEfectiva().getId() : null,
                apelacion.getEntidadNombreEfectivo(),
                apelacion.getTipoOrigenEfectivo().name(),
                apelacion.getNumeroSolicitudExterna()
        );
    }
}
