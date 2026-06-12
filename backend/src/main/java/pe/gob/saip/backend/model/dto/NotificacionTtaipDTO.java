package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;

import java.util.List;

@Schema(description = "Notificación TTAIP asociada a una cédula y a un destinatario")
public record NotificacionTtaipDTO(
        Long id,
        Long cedulaId,
        String numeroCedula,
        String destinatario,
        String destinatarioNombre,
        String destinatarioEmail,
        String fechaNotificacion,
        String medio,
        String estado,
        String detalle,
        String medioNotificacion,
        String fechaEnvio,
        String codigoEnvio,
        String codigoConstancia,
        String constanciaEnvio,
        String acuseAutomatico,
        String fechaAcuse,
        String estadoAcuse,
        String resultadoNotificacion,
        String evidenciaUrl,
        String referenciaEvidencia,
        Boolean validadaManualmente,
        String fechaValidacionManual,
        String responsableValidacion,
        String observacionValidacion,
        String responsableConstancia,
        String observacionConstancia,
        String trazabilidad,
        @Schema(description = "Metadatos documentales seguros de la cédula asociada")
        List<DocumentoMetadataDTO> documentosCedula
) {
    public static NotificacionTtaipDTO from(NotificacionTtaip notificacion) {
        return new NotificacionTtaipDTO(
                notificacion.getId(),
                notificacion.getCedula() != null ? notificacion.getCedula().getIdCedula() : null,
                notificacion.getCedula() != null ? notificacion.getCedula().getNumeroCedula() : null,
                notificacion.getDestinatario() != null ? notificacion.getDestinatario().name() : null,
                notificacion.getDestinatarioNombre(),
                notificacion.getDestinatarioEmail(),
                notificacion.getFechaNotificacion() != null ? notificacion.getFechaNotificacion().toString() : null,
                notificacion.getMedio(),
                notificacion.getEstado(),
                notificacion.getDetalle(),
                notificacion.getMedioNotificacion(),
                notificacion.getFechaEnvio() != null ? notificacion.getFechaEnvio().toString() : null,
                notificacion.getCodigoEnvio(),
                notificacion.getCodigoConstancia(),
                notificacion.getConstanciaEnvio(),
                notificacion.getAcuseAutomatico(),
                notificacion.getFechaAcuse() != null ? notificacion.getFechaAcuse().toString() : null,
                notificacion.getEstadoAcuse(),
                notificacion.getResultadoNotificacion(),
                notificacion.getEvidenciaUrl(),
                notificacion.getReferenciaEvidencia(),
                notificacion.getValidadaManualmente(),
                notificacion.getFechaValidacionManual() != null ? notificacion.getFechaValidacionManual().toString() : null,
                notificacion.getResponsableValidacion(),
                notificacion.getObservacionValidacion(),
                notificacion.getResponsableConstancia(),
                notificacion.getObservacionConstancia(),
                notificacion.getTrazabilidad(),
                notificacion.getCedula() != null
                        ? DocumentoMetadataDTO.fromActive(notificacion.getCedula().getDocumentos())
                        : List.of()
        );
    }
}
