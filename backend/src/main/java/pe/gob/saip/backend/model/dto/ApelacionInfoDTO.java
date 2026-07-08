package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

@Schema(description = "Resumen de apelación asociada a una solicitud")
public record ApelacionInfoDTO(
    Long id,
    String expediente,
    @Schema(description = "Estado de la apelación", example = "EN_CALIFICACION_1", implementation = Apelacion.EstadoApelacion.class, allowableValues = {"PENDIENTE_ELEVACION", "EN_CALIFICACION_1", "EN_SUBSANACION", "EN_CALIFICACION_2", "NOTIFICACION_SEGUNDA_CALIFICACION", "EN_RESOLUCION", "RESUELTO", "TENER_POR_NO_PRESENTADO", "CONCLUSION_SUSTRACCION_MATERIA", "CONCLUSION_DESISTIMIENTO", "RESUELTO_FUNDADO", "RESUELTO_FUNDADO_EN_PARTE", "RESUELTO_INFUNDADO", "RESUELTO_INFUNDADO_EN_PARTE", "RESUELTO_IMPROCEDENTE", "RESUELTO_ESTESE_A_LO_RESUELTO", "RESUELTO_NULIDAD_ACTO"})
    String estado,
    String resultado,
    String fechaApelacion,
    String fechaSubsanacion,
    Integer diasSubsanacion,
    ElevacionApelacionTtaipDTO elevacion,
    Boolean resuelta
) {
    public static ApelacionInfoDTO from(Apelacion a) {
        return new ApelacionInfoDTO(
            a.getId(),
            a.getExpediente(),
            a.getEstado() != null ? a.getEstado().name() : null,
            a.getResultado(),
            a.getFechaApelacion() != null ? a.getFechaApelacion().toString() : null,
            a.getFechaSubsanacion() != null ? a.getFechaSubsanacion().toString() : null,
            a.getDiasSubsanacion(),
            a.getElevacion() != null ? ElevacionApelacionTtaipDTO.from(a.getElevacion()) : null,
            a.isResuelta()
        );
    }
}
