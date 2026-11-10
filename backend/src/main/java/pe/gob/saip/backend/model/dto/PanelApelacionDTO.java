package pe.gob.saip.backend.model.dto;
/** Only listing metadata; workflow commands still revalidate the complete aggregate. */
public record PanelApelacionDTO(Long id, String expediente, String fundamentos, String estado, String resultado,
    String fechaApelacion, Long solicitudId, String solicitudExpediente, String solicitudAsunto,
    Long ciudadanoId, String ciudadanoNombre, Long entidadId, String entidadNombre, String entidadExternaNombre,
    String resumenSolicitudOriginal, String tipoOrigen, String numeroSolicitudExterna,
    String calificacionPrimera, String calificacionSegunda, boolean resuelta, String etapa,
    PanelExpedienteDTO expedienteTtaip, PanelResolucionDTO resolucion,
    PanelResolucionDTO resolucionPrimeraCalificacion, PanelResolucionDTO resolucionSegundaCalificacion,
    PlazoSubsanacionTtaipDTO plazoSubsanacion) {
    public record PanelExpedienteDTO(Long id, PanelOpcionDTO sala) {}
    public record PanelResolucionDTO(Long id, String tipoResolucion, String decision, String fechaResolucion) {}
}
