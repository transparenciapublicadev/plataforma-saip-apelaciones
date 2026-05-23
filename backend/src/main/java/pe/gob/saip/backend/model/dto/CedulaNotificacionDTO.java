package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;

@Schema(description = "Cédula de notificación emitida para una resolución TTAIP")
public record CedulaNotificacionDTO(
        Long id,
        String numeroCedula,
        String destinatario,
        String destinatarioNombre,
        String destinatarioEmail,
        String fechaEmision,
        String canal,
        String estado,
        String documentoReferencia
) {
    public static CedulaNotificacionDTO from(CedulaNotificacion cedula) {
        return new CedulaNotificacionDTO(
                cedula.getId(),
                cedula.getNumeroCedula(),
                cedula.getDestinatario() != null ? cedula.getDestinatario().name() : null,
                cedula.getDestinatarioNombre(),
                cedula.getDestinatarioEmail(),
                cedula.getFechaEmision() != null ? cedula.getFechaEmision().toString() : null,
                cedula.getCanal(),
                cedula.getEstado(),
                cedula.getDocumentoReferencia()
        );
    }
}
