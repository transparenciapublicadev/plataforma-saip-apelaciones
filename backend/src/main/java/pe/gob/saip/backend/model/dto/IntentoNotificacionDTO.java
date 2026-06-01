package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.IntentoNotificacion;

@Schema(description = "Intento persistido de envío mediante el motor común de notificaciones")
public record IntentoNotificacionDTO(
        Long id,
        Long notificacionTtaipId,
        Long solicitudId,
        String origen,
        String canal,
        String proveedor,
        String estado,
        String destinatarioNombre,
        String destinatarioContacto,
        String asunto,
        String codigoCorrelacion,
        String codigoEnvio,
        String codigoConstancia,
        String constanciaEnvio,
        String acuseAutomatico,
        String estadoAcuse,
        String mensajeTecnicoSanitizado,
        String responsable,
        String fechaIntento,
        String fechaRespuesta,
        String trazabilidad
) {
    public static IntentoNotificacionDTO from(IntentoNotificacion intento) {
        return new IntentoNotificacionDTO(
                intento.getId(),
                intento.getNotificacionTtaip() != null ? intento.getNotificacionTtaip().getId() : null,
                intento.getSolicitud() != null ? intento.getSolicitud().getId() : null,
                intento.getOrigen() != null ? intento.getOrigen().name() : null,
                intento.getCanal() != null ? intento.getCanal().name() : null,
                intento.getProveedor(),
                intento.getEstado() != null ? intento.getEstado().name() : null,
                intento.getDestinatarioNombre(),
                intento.getDestinatarioContacto(),
                intento.getAsunto(),
                intento.getCodigoCorrelacion(),
                intento.getCodigoEnvio(),
                intento.getCodigoConstancia(),
                intento.getConstanciaEnvio(),
                intento.getAcuseAutomatico(),
                intento.getEstadoAcuse(),
                intento.getMensajeTecnicoSanitizado(),
                intento.getResponsable(),
                intento.getFechaIntento() != null ? intento.getFechaIntento().toString() : null,
                intento.getFechaRespuesta() != null ? intento.getFechaRespuesta().toString() : null,
                intento.getTrazabilidad()
        );
    }
}
