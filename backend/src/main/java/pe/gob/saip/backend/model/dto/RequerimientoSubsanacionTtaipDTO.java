package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;
import io.swagger.v3.oas.annotations.media.Schema;

/** Current presentation conditions and evidenced clock; historical creation is never a clock fallback. */
public record RequerimientoSubsanacionTtaipDTO(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long apelacionId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long requerimientoId,
    String numeroResolucion, String observaciones,
    @Schema(types={"string","null"}, format="date", description="Fecha eficaz acreditada, nula si el plazo no ha iniciado")
    LocalDate fechaBasePlazo,
    @Schema(types={"string","null"}, format="date") LocalDate fechaLimite,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int diasSubsanacion,
    @Schema(types={"integer","null"}, format="int32") Integer diasHabilesRestantes,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean admitePresentacion,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "false: no se infieren anexos obligatorios a partir de observaciones en texto libre")
    boolean exigenciasDocumentalesEstructuradas,
    PlazoSubsanacionTtaipDTO plazo) {}
