package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.ElevacionApelacionTtaip;

@Schema(description = "Elevación formal de una apelación presentada ante una entidad pública")
public record ElevacionApelacionTtaipDTO(
        Long id,
        Long apelacionId,
        String expedienteReservado,
        Long entidadOrigenId,
        String entidadOrigenNombre,
        String fechaPresentacionAnteEntidad,
        String fechaLimiteElevacion,
        String fechaElevacionTtaip,
        String fechaComunicacionCiudadano,
        String estadoElevacion,
        String referenciaCargoPresentacion,
        String referenciaExpedienteElevado,
        String referenciaPruebaOmision,
        String responsableEntidad,
        String responsableTtaip,
        String observacion,
        String trazabilidad
) {
    public static ElevacionApelacionTtaipDTO from(ElevacionApelacionTtaip elevacion) {
        return new ElevacionApelacionTtaipDTO(
                elevacion.getId(),
                elevacion.getApelacion() != null ? elevacion.getApelacion().getId() : null,
                elevacion.getApelacion() != null ? elevacion.getApelacion().getExpediente() : null,
                elevacion.getEntidadOrigen() != null ? elevacion.getEntidadOrigen().getId() : null,
                elevacion.getEntidadOrigen() != null ? elevacion.getEntidadOrigen().getNombre() : null,
                elevacion.getFechaPresentacionAnteEntidad() != null ? elevacion.getFechaPresentacionAnteEntidad().toString() : null,
                elevacion.getFechaLimiteElevacion() != null ? elevacion.getFechaLimiteElevacion().toString() : null,
                elevacion.getFechaElevacionTtaip() != null ? elevacion.getFechaElevacionTtaip().toString() : null,
                elevacion.getFechaComunicacionCiudadano() != null ? elevacion.getFechaComunicacionCiudadano().toString() : null,
                elevacion.getEstadoElevacion() != null ? elevacion.getEstadoElevacion().name() : null,
                elevacion.getReferenciaCargoPresentacion(),
                elevacion.getReferenciaExpedienteElevado(),
                elevacion.getReferenciaPruebaOmision(),
                elevacion.getResponsableEntidad(),
                elevacion.getResponsableTtaip(),
                elevacion.getObservacion(),
                elevacion.getTrazabilidad()
        );
    }
}
