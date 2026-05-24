package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.EncauzamientoSolicitud;

@Schema(description = "Encauzamiento formal de una solicitud SAIP hacia una entidad competente")
public record EncauzamientoSolicitudDTO(
        Long id,
        Long solicitudId,
        String expediente,
        Long entidadOrigenId,
        String entidadOrigenNombre,
        String entidadOrigenAcronimo,
        Long entidadDestinoId,
        String entidadDestinoNombre,
        String entidadDestinoAcronimo,
        String motivoEncauzamiento,
        String alcance,
        String fechaEncauzamiento,
        String fechaLimiteEncauzamiento,
        String estadoEncauzamiento,
        String responsable,
        String observacionSustento,
        String trazabilidad
) {
    public static EncauzamientoSolicitudDTO from(EncauzamientoSolicitud encauzamiento) {
        return new EncauzamientoSolicitudDTO(
                encauzamiento.getId(),
                encauzamiento.getSolicitud() != null ? encauzamiento.getSolicitud().getId() : null,
                encauzamiento.getSolicitud() != null ? encauzamiento.getSolicitud().getExpediente() : null,
                encauzamiento.getEntidadOrigen() != null ? encauzamiento.getEntidadOrigen().getId() : null,
                encauzamiento.getEntidadOrigen() != null ? encauzamiento.getEntidadOrigen().getNombre() : null,
                encauzamiento.getEntidadOrigen() != null ? encauzamiento.getEntidadOrigen().getAcronimo() : null,
                encauzamiento.getEntidadDestino() != null ? encauzamiento.getEntidadDestino().getId() : null,
                encauzamiento.getEntidadDestino() != null ? encauzamiento.getEntidadDestino().getNombre() : null,
                encauzamiento.getEntidadDestino() != null ? encauzamiento.getEntidadDestino().getAcronimo() : null,
                encauzamiento.getMotivoEncauzamiento(),
                encauzamiento.getAlcance() != null ? encauzamiento.getAlcance().name() : null,
                encauzamiento.getFechaEncauzamiento() != null ? encauzamiento.getFechaEncauzamiento().toString() : null,
                encauzamiento.getFechaLimiteEncauzamiento() != null ? encauzamiento.getFechaLimiteEncauzamiento().toString() : null,
                encauzamiento.getEstadoEncauzamiento() != null ? encauzamiento.getEstadoEncauzamiento().name() : null,
                encauzamiento.getResponsable(),
                encauzamiento.getObservacionSustento(),
                encauzamiento.getTrazabilidad()
        );
    }
}
