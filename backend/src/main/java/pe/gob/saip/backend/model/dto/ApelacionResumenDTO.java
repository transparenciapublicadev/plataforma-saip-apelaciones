package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

@Schema(description = "Resumen liviano de una apelación TTAIP para listados paginados")
public record ApelacionResumenDTO(
        Long id,
        String expediente,
        String estado,
        String resultado,
        String fechaApelacion,
        Long solicitudId,
        String solicitudExpediente,
        Long ciudadanoId,
        String ciudadanoNombre,
        Long entidadId,
        String entidadNombre,
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
