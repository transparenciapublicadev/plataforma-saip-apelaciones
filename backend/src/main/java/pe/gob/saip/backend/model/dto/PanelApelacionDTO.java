package pe.gob.saip.backend.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/** Only listing metadata; workflow commands still revalidate the complete aggregate. */
public record PanelApelacionDTO(Long id, String expediente, String fundamentos, String estado, String resultado,
    String fechaApelacion, Long solicitudId, String solicitudExpediente, String solicitudAsunto,
    Long ciudadanoId, String ciudadanoNombre, Long entidadId, String entidadNombre, String entidadExternaNombre,
    String resumenSolicitudOriginal, String tipoOrigen, String numeroSolicitudExterna,
    String calificacionPrimera, String calificacionSegunda, boolean resuelta, String etapa,
    PanelExpedienteDTO expedienteTtaip, PanelResolucionDTO resolucion,
    PanelResolucionDTO resolucionPrimeraCalificacion, PanelResolucionDTO resolucionSegundaCalificacion,
    PlazoSubsanacionTtaipDTO plazoSubsanacion,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Schema(description = "Plazo de primera calificación si consta el ingreso al Tribunal y todavía no se registró la calificación")
    PanelPlazoPrimeraCalificacionDTO plazoPrimeraCalificacion,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Schema(description = "Saldo de resolución desde el ingreso al Tribunal o la notificación eficaz de la admisión")
    PanelPlazoResolucionDTO plazoResolucion,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Schema(description = "Plazo base en días hábiles aunque esté pendiente el inicio del cómputo")
    Integer diasBaseResolucion,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    LocalDate recepcionSubsanacion,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    PanelPlazoCumplimientoDTO plazoCumplimiento,
    boolean respuestaCumplimientoDisponible, boolean cumplimientoRemitido,
    boolean actosNotificacionPendientes, boolean informacionComplementariaPendiente, boolean descargosPendientes) {
    public record PanelExpedienteDTO(Long id, PanelOpcionDTO sala) {}
    public record PanelResolucionDTO(Long id, String tipoResolucion, String decision, String fechaResolucion) {}
    public record PanelPlazoResolucionDTO(int diasRestantes, boolean vencido, int diasAdicionales, java.time.LocalDate fechaLimite) {}
    public record PanelPlazoCumplimientoDTO(int diasRestantes, boolean vencido, LocalDate fechaLimite) {}
    public record PanelPlazoPrimeraCalificacionDTO(int diasRestantes, boolean vencido, int diasSuspendidos, java.time.LocalDate fechaLimite) {}
}
