package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.SalaTtaip;

@Schema(description = "Sala del Tribunal de Transparencia asignada a un expediente")
public record SalaTtaipDTO(
        Long id,
        String nombre,
        String periodoInicio,
        String periodoFin,
        MiembroTTAIPDTO presidenteSala
) {
    public static SalaTtaipDTO from(SalaTtaip sala) {
        return new SalaTtaipDTO(
                sala.getId(),
                sala.getNombre(),
                sala.getPeriodoInicio() != null ? sala.getPeriodoInicio().toString() : null,
                sala.getPeriodoFin() != null ? sala.getPeriodoFin().toString() : null,
                sala.getPresidenteSala() != null ? MiembroTTAIPDTO.from(sala.getPresidenteSala()) : null
        );
    }
}
