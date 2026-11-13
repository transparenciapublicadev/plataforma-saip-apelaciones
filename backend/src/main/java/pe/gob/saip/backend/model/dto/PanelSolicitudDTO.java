package pe.gob.saip.backend.model.dto;
import java.util.List;
/** A listing projection, deliberately not a private case-file DTO. Document collections are not queried. */
public record PanelSolicitudDTO(Long id, String expediente, String asunto, String descripcion, String estado,
    String prioridad, String tipoInformacion, String fechaPresentacion, String fechaLimite, Integer diasRestantes,
    Long ciudadanoId, String ciudadanoNombre, Long entidadId, String entidadNombre, String entidadAcronimo,
    String etapa, PanelRespuestaDTO respuesta, List<PanelObservacionDTO> observaciones, PanelApelacionDTO apelacion,
    String oficinaDestinataria, String areaResponsable, String encargadoArea) {
    public record PanelRespuestaDTO(Long id, String tipoRespuesta, String fechaRespuesta) {}
    public record PanelObservacionDTO(Long id, Long solicitudId, String estado, String fechaObservacion,
        String fechaLimiteSubsanacion, String fechaSubsanacion, Integer diasRestantes) {}
}
