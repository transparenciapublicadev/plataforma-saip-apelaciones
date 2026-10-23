package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.util.DiasHabilesUtil;

/** Operational clock status, distinct from the legal state of the appeal. */
public record PlazoSubsanacionTtaipDTO(
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long requerimientoId,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED,
        allowableValues={"PENDIENTE_INICIO","EN_CURSO","VENCIDO"}) String estado,
    @Schema(types={"integer","null"}, format="int64") Long notificacionId,
    @Schema(types={"string","null"}, format="date-time") LocalDateTime fechaEficacia,
    @Schema(types={"string","null"}, format="date") LocalDate fechaLimite,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) int diasHabiles,
    @Schema(types={"integer","null"}, format="int32") Integer diasHabilesRestantes,
    @Schema(types={"string","null"}) String fuente
) {
    public static Resolucion requerimientoActual(Apelacion ap) {
        return ap.getResoluciones() == null ? null : ap.getResoluciones().stream()
            .filter(r -> r.getTipoResolucion() == Resolucion.TipoResolucion.PRIMERA_CALIFICACION)
            .max(Comparator.comparing(Resolucion::getFechaResolucion,
                Comparator.nullsFirst(Comparator.naturalOrder())).thenComparing(Resolucion::getId))
            .orElse(null);
    }
    public static PlazoSubsanacionTtaipDTO from(Apelacion ap) {
        Resolucion r = requerimientoActual(ap);
        return r == null || r.getDecision() != Resolucion.DecisionResolucion.INADMISIBLE ? null : from(r);
    }
    public static PlazoSubsanacionTtaipDTO from(Resolucion r) {
        InicioPlazoSubsanacionTtaip inicio = r.getInicioPlazoSubsanacion();
        int dias = r.getApelacion().getDiasSubsanacion() == null ? 2 : r.getApelacion().getDiasSubsanacion();
        if (inicio == null) return new PlazoSubsanacionTtaipDTO(r.getId(), "PENDIENTE_INICIO", null, null, null, dias, null, null);
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(inicio.getFechaEficacia().toLocalDate(), inicio.getDiasHabiles());
        return new PlazoSubsanacionTtaipDTO(r.getId(), LocalDate.now().isAfter(limite) ? "VENCIDO" : "EN_CURSO",
            inicio.getNotificacion().getId(), inicio.getFechaEficacia(), limite, inicio.getDiasHabiles(),
            DiasHabilesUtil.diasHabilesRestantes(limite), inicio.getFuente());
    }
}
