package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.util.List;

@Schema(description = "Resolución del TTAIP sobre una apelación")
public record ResolucionDTO(
    Long id,
    String numeroResolucion,
    @Schema(description = "Tipo de resolución", example = "RESOLUCION_FINAL", implementation = Resolucion.TipoResolucion.class, allowableValues = {"PRIMERA_CALIFICACION", "SEGUNDA_CALIFICACION", "RESOLUCION_FINAL"})
    String tipoResolucion,
    @Schema(description = "Decisión o resultado de la resolución", example = "FUNDADO", implementation = Resolucion.DecisionResolucion.class, allowableValues = {"ADMISIBLE", "INADMISIBLE", "IMPROCEDENTE", "ADMITIDO", "TENER_POR_NO_PRESENTADO", "FUNDADO", "FUNDADO_EN_PARTE", "INFUNDADO", "INFUNDADO_EN_PARTE", "CONCLUSION_SUSTRACCION_MATERIA", "CONCLUSION_DESISTIMIENTO", "ESTESE_A_LO_RESUELTO", "NULIDAD_DEL_ACTO"})
    String decision,
    String fundamentos,
    String fundamentoLegal,
    String observaciones,
    String fechaResolucion,
    @Schema(description = "Fecha en que se acreditaron los actos documentales de notificación de la resolución")
    String fechaValidacionActos,
    Long miembroTTAIPId,
    String miembroTTAIPNombre,
    Boolean iniciarProcesoDisciplinario,
    SalaTtaipDTO sala,
    @Schema(description = "Metadatos documentales seguros asociados directamente a la resolución")
    List<DocumentoMetadataDTO> documentos,
    List<CedulaNotificacionDTO> cedulas
) {
    public static ResolucionDTO from(Resolucion r) {
        return new ResolucionDTO(
            r.getId(),
            r.getNumeroResolucion(),
            r.getTipoResolucion() != null ? r.getTipoResolucion().name() : null,
            r.getDecision() != null ? r.getDecision().name() : null,
            r.getFundamentos(),
            r.getFundamentoLegal(),
            r.getObservaciones(),
            r.getFechaResolucion() != null ? r.getFechaResolucion().toString() : null,
            r.isActosDocumentales() && r.getFechaValidacionActos() != null ? r.getFechaValidacionActos().toString() : null,
            r.getMiembroTTAIP() != null ? r.getMiembroTTAIP().getId() : null,
            r.getMiembroTTAIP() != null ? r.getMiembroTTAIP().getNombreCompleto() : null,
            r.getIniciarProcesoDisciplinario(),
            r.getSalaTtaip() != null ? SalaTtaipDTO.from(r.getSalaTtaip()) : null,
            DocumentoMetadataDTO.fromActive(r.getDocumentos()),
            r.getCedulasNotificacion() != null
                    ? r.getCedulasNotificacion().stream().map(CedulaNotificacionDTO::from).toList()
                    : List.of()
        );
    }
}
