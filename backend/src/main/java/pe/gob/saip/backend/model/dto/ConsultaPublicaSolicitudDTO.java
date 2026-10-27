package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.stream.Collectors;

@Schema(description = "Vista pública y enmascarada del estado de una solicitud SAIP")
public record ConsultaPublicaSolicitudDTO(
        String expediente,
        String ciudadano,
        String entidad,
        String fechaPresentacion,
        String fechaLimite,
        Integer diasTranscurridos,
        Integer diasRestantes,
        String estado,
        String respuestaFecha,
        String respuestaTipo,
        String apelacionExpediente,
        String apelacionEstado,
        String apelacionFecha,
        String resolucionFecha,
        String resolucionResultado
) {
    public static ConsultaPublicaSolicitudDTO from(Solicitud solicitud) {
        Respuesta respuesta = solicitud.getRespuesta();
        Apelacion apelacion = solicitud.getApelacion();
        Resolucion resolucion = apelacion != null ? apelacion.getResolucion() : null;

        return new ConsultaPublicaSolicitudDTO(
                solicitud.getExpediente(),
                maskName(solicitud.getCiudadano() != null ? solicitud.getCiudadano().getNombreCompleto() : null),
                solicitud.getEntidad() != null ? solicitud.getEntidad().getNombre() : null,
                solicitud.getFechaPresentacion() != null ? solicitud.getFechaPresentacion().toString() : null,
                solicitud.getFechaLimite() != null ? solicitud.getFechaLimite().toString() : null,
                solicitud.getFechaPresentacion() != null
                        ? Math.toIntExact(Math.max(0, ChronoUnit.DAYS.between(solicitud.getFechaPresentacion(), LocalDateTime.now())))
                        : 0,
                solicitud.getDiasRestantes(),
                estadoPublico(solicitud),
                respuesta != null && respuesta.getFechaRespuesta() != null ? respuesta.getFechaRespuesta().toString() : null,
                respuesta != null && respuesta.getTipoRespuesta() != null ? respuesta.getTipoRespuesta().name() : null,
                apelacion != null ? apelacion.getExpediente() : null,
                apelacion != null && apelacion.getEstado() != null ? apelacion.getEstado().name() : null,
                apelacion != null && apelacion.getFechaApelacion() != null ? apelacion.getFechaApelacion().toString() : null,
                resolucion != null && resolucion.getFechaResolucion() != null ? resolucion.getFechaResolucion().toString() : null,
                resolucion != null && resolucion.getDecision() != null ? resolucion.getDecision().name() : null
        );
    }

    private static String estadoPublico(Solicitud solicitud) {
        if (solicitud.getApelacion() != null) {
            return "APELADA";
        }

        if (solicitud.getEstado() == null) {
            return "EN_PROCESO";
        }

        return switch (solicitud.getEstado()) {
            case RECEPCIONADA, EN_REVISION, PENDIENTE_INFORMACION -> "EN_PROCESO";
            case RESPONDIDA -> "RESPONDIDA";
            case DENEGADA -> "DENEGADA";
            case VENCIDA -> "VENCIDA";
            case CONCLUIDA -> "ARCHIVADA";
        };
    }

    private static String maskName(String value) {
        if (value == null || value.isBlank()) {
            return "Solicitante protegido";
        }

        return Arrays.stream(value.trim().split("\\s+"))
                .filter(part -> !part.isBlank())
                .map(part -> part.substring(0, 1).toUpperCase() + "***")
                .collect(Collectors.joining(" "));
    }
}
