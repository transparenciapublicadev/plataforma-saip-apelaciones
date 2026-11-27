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

@Schema(description = "Vista pública y enmascarada del estado de una solicitud SAIP o una apelación TTAIP")
public record ConsultaPublicaSolicitudDTO(
        @Schema(description = "Número SAIP. Nulo si la apelación se presentó sin una solicitud en la plataforma", types = {"string", "null"})
        String expediente,
        String ciudadano,
        @Schema(types = {"string", "null"}) String entidad,
        @Schema(types = {"string", "null"}) String fechaPresentacion,
        @Schema(types = {"string", "null"}) String fechaLimite,
        @Schema(types = {"integer", "null"}, format = "int32") Integer diasTranscurridos,
        @Schema(types = {"integer", "null"}, format = "int32") Integer diasRestantes,
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

    public static ConsultaPublicaSolicitudDTO from(Apelacion apelacion) {
        if (apelacion.getSolicitud() != null) {
            return from(apelacion.getSolicitud());
        }
        Resolucion resolucion = apelacion.getResolucion();
        // El nombre de una entidad declarada en una apelación externa es texto libre.
        var entidad = apelacion.getEntidadApelada();
        return new ConsultaPublicaSolicitudDTO(
                null,
                maskName(apelacion.getCiudadano() != null ? apelacion.getCiudadano().getNombreCompleto() : null),
                entidad != null ? entidad.getNombre() : null,
                null, null, null, null, "APELADA", null, null,
                apelacion.getExpediente(),
                apelacion.getEstado() != null ? apelacion.getEstado().name() : null,
                apelacion.getFechaApelacion() != null ? apelacion.getFechaApelacion().toString() : null,
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
