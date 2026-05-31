package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

@Schema(description = "Resumen de apelación asociada a una solicitud")
public record ApelacionInfoDTO(
    Long id,
    String expediente,
    String estado,
    String resultado,
    String fechaApelacion,
    String fechaSubsanacion,
    Integer diasSubsanacion,
    ElevacionApelacionTtaipDTO elevacion
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
            a.getElevacion() != null ? ElevacionApelacionTtaipDTO.from(a.getElevacion()) : null
        );
    }
}
