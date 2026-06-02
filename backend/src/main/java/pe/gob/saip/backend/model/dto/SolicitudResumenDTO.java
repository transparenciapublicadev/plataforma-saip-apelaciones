package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Solicitud;

@Schema(description = "Resumen liviano de una solicitud SAIP para listados paginados")
public record SolicitudResumenDTO(
        Long id,
        String expediente,
        String asunto,
        String estado,
        String prioridad,
        String semaforo,
        String fechaPresentacion,
        String fechaLimite,
        Integer diasRestantes,
        Long ciudadanoId,
        String ciudadanoNombre,
        Long entidadId,
        String entidadNombre,
        String entidadAcronimo,
        String canalNotificacion
) {
    public static SolicitudResumenDTO from(Solicitud solicitud) {
        return new SolicitudResumenDTO(
                solicitud.getId(),
                solicitud.getExpediente(),
                solicitud.getAsunto(),
                solicitud.getEstado() != null ? solicitud.getEstado().name() : null,
                solicitud.getPrioridad() != null ? solicitud.getPrioridad().name() : null,
                solicitud.getSemaforo(),
                solicitud.getFechaPresentacion() != null ? solicitud.getFechaPresentacion().toString() : null,
                solicitud.getFechaLimite() != null ? solicitud.getFechaLimite().toString() : null,
                solicitud.getDiasRestantes(),
                solicitud.getCiudadano() != null ? solicitud.getCiudadano().getId() : null,
                solicitud.getCiudadano() != null ? solicitud.getCiudadano().getNombreCompleto() : null,
                solicitud.getEntidad() != null ? solicitud.getEntidad().getId() : null,
                solicitud.getEntidad() != null ? solicitud.getEntidad().getNombre() : null,
                solicitud.getEntidad() != null ? solicitud.getEntidad().getAcronimo() : null,
                solicitud.getCanalNotificacion() != null ? solicitud.getCanalNotificacion().name() : null
        );
    }
}
