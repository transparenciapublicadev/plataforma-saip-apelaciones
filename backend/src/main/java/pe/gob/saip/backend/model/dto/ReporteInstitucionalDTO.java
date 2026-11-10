package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bounded institutional report; counts describe records, never delivery or legal timeliness. */
public final class ReporteInstitucionalDTO {
    private ReporteInstitucionalDTO() { }
    public record Conteo(String etiqueta, long cantidad) { }
    public record Resumen(String modo, String ambito, Long entidadId, String entidad,
            LocalDate desde, LocalDate hasta, LocalDateTime consultado,
            long total, long conActuacion, List<Conteo> estados, List<Conteo> porMes,
            List<Conteo> resultados, String alcance) { }
    public record Fila(Long id, String expediente, LocalDateTime fecha, String asunto,
            String entidad, String estado, String resultado, boolean actuacionRegistrada) { }
    public record Pagina(List<Fila> content, long totalElements, int totalPages, int number, int size) { }
    public record Guardar(@NotNull UUID operacionId, Long version, @NotNull Map<String, String> cualitativo) { }
    public record Borrador(UUID id, String modo, LocalDate desde, LocalDate hasta, long version,
            UUID operacionId, Map<String, String> cualitativo, Resumen resumen,
            LocalDateTime actualizado, String estado) { }
    public record Historial(List<Borrador> content, long totalElements, int totalPages, int number, int size) { }
}
