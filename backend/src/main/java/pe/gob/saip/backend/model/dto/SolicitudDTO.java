package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Solicitud;

import java.util.List;
import java.util.Comparator;

@Schema(description = "Solicitud de Acceso a la Información Pública (SAIP)")
public record SolicitudDTO(
    Long id,
    @Schema(description = "Número de solicitud", example = "SAIP-2025-00512")
    String expediente,
    @Schema(description = "Asunto de la solicitud")
    String asunto,
    String descripcion,
    @Schema(description = "Estado actual", example = "RECEPCIONADA", allowableValues = {"RECEPCIONADA", "EN_REVISION", "PENDIENTE_INFORMACION", "RESPONDIDA", "DENEGADA", "CONCLUIDA", "VENCIDA"})
    String estado,
    @Schema(description = "Nivel de prioridad", example = "MEDIA", allowableValues = {"BAJA", "NORMAL", "MEDIA", "ALTA", "URGENTE"})
    String prioridad,
    @Schema(description = "Semáforo de plazo", example = "VERDE", allowableValues = {"VERDE", "AMBAR", "ROJO", "NEGRO"})
    String semaforo,
    String fechaPresentacion,
    @Schema(description = "Fecha límite (10 días hábiles)")
    String fechaLimite,
    @Schema(description = "Días hábiles restantes")
    Integer diasRestantes,
    Long ciudadanoId,
    String ciudadanoNombre,
    String ciudadanoDni,
    String ciudadanoEmail,
    String ciudadanoTelefono,
    Long entidadId,
    String entidadNombre,
    String entidadAcronimo,
    Boolean formatoDigital,
    Boolean formatoFisico,
    Boolean copiaSimple,
    Boolean copiaCertificada,
    String tipoInformacion,
    @Schema(description = "Aceptación expresa del tratamiento de datos personales para el procedimiento SAIP", example = "true")
    Boolean consentimientoDatosPersonales,
    @Schema(description = "Canal formal elegido para notificaciones", example = "CASILLA_ELECTRONICA", allowableValues = {"CORREO_ELECTRONICO", "CASILLA_ELECTRONICA", "PLATAFORMA", "FISICA"})
    String canalNotificacion,
    RespuestaDTO respuesta,
    ApelacionInfoDTO apelacion,
    List<DocumentoDTO> documentos,
    @Schema(description = "Metadatos documentales seguros asociados directamente a la SAIP")
    List<DocumentoMetadataDTO> documentosMetadata,
    List<ObservacionSolicitudDTO> observaciones,
    List<AmpliacionPlazoSolicitudDTO> ampliacionesPlazo,
    List<EncauzamientoSolicitudDTO> encauzamientos,
    List<LiquidacionCostoSolicitudDTO> liquidacionesCosto
) {
    public static SolicitudDTO from(Solicitud s) {
        return new SolicitudDTO(
            s.getId(),
            s.getExpediente(),
            s.getAsunto(),
            s.getDescripcion(),
            s.getEstado() != null ? s.getEstado().name() : null,
            s.getPrioridad() != null ? s.getPrioridad().name() : null,
            s.getSemaforo(),
            s.getFechaPresentacion() != null ? s.getFechaPresentacion().toString() : null,
            s.getFechaLimite() != null ? s.getFechaLimite().toString() : null,
            s.getDiasRestantes(),
            s.getCiudadano() != null ? s.getCiudadano().getId() : null,
            s.getCiudadano() != null ? s.getCiudadano().getNombreCompleto() : null,
            s.getCiudadano() != null ? s.getCiudadano().getDni() : null,
            s.getCiudadano() != null ? s.getCiudadano().getEmail() : null,
            s.getCiudadano() != null ? s.getCiudadano().getTelefono() : null,
            s.getEntidad() != null ? s.getEntidad().getId() : null,
            s.getEntidad() != null ? s.getEntidad().getNombre() : null,
            s.getEntidad() != null ? s.getEntidad().getAcronimo() : null,
            s.getFormatoDigital(),
            s.getFormatoFisico(),
            s.getCopiaSimple(),
            s.getCopiaCertificada(),
            s.getTipoInformacion(),
            s.getConsentimientoDatosPersonales(),
            s.getCanalNotificacion() != null ? s.getCanalNotificacion().name() : null,
            s.getRespuesta() != null ? RespuestaDTO.from(s.getRespuesta()) : null,
            s.getApelacion() != null ? ApelacionInfoDTO.from(s.getApelacion()) : null,
            DocumentoDTO.fromActive(s.getDocumentos()),
            DocumentoMetadataDTO.fromActive(s.getDocumentos()),
            s.getObservaciones() != null
                    ? s.getObservaciones().stream()
                            .sorted(Comparator.comparing(
                                    obs -> obs.getFechaObservacion() != null ? obs.getFechaObservacion() : java.time.LocalDateTime.MIN,
                                    Comparator.reverseOrder()))
                            .map(ObservacionSolicitudDTO::from)
                            .toList()
                    : List.of(),
            s.getAmpliacionesPlazo() != null
                    ? s.getAmpliacionesPlazo().stream()
                            .sorted(Comparator.comparing(
                                    amp -> amp.getFechaSolicitudAmpliacion() != null ? amp.getFechaSolicitudAmpliacion() : java.time.LocalDateTime.MIN,
                                    Comparator.reverseOrder()))
                            .map(AmpliacionPlazoSolicitudDTO::from)
                            .toList()
                    : List.of(),
            s.getEncauzamientos() != null
                    ? s.getEncauzamientos().stream()
                            .sorted(Comparator.comparing(
                                    enc -> enc.getFechaEncauzamiento() != null ? enc.getFechaEncauzamiento() : java.time.LocalDateTime.MIN,
                                    Comparator.reverseOrder()))
                            .map(EncauzamientoSolicitudDTO::from)
                            .toList()
                    : List.of(),
            s.getLiquidacionesCosto() != null
                    ? s.getLiquidacionesCosto().stream()
                            .sorted(Comparator.comparing(
                                    liq -> liq.getFechaEmision() != null ? liq.getFechaEmision() : java.time.LocalDateTime.MIN,
                                    Comparator.reverseOrder()))
                            .map(LiquidacionCostoSolicitudDTO::from)
                            .toList()
                    : List.of()
        );
    }
}
