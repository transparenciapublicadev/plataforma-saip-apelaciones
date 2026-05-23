package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;

@Schema(description = "Miembro del Tribunal de Transparencia asignado a una sala o expediente")
public record MiembroTTAIPDTO(
        Long id,
        String nombre,
        String cargo,
        String sala,
        String especialidad,
        String email,
        String periodoInicio,
        String periodoFin,
        Boolean presidenteTribunal
) {
    public static MiembroTTAIPDTO from(MiembroTTAIP miembro) {
        return new MiembroTTAIPDTO(
                miembro.getId(),
                miembro.getNombreCompleto(),
                miembro.getCargo(),
                miembro.getSala(),
                miembro.getEspecialidad(),
                miembro.getEmail(),
                miembro.getPeriodoInicio() != null ? miembro.getPeriodoInicio().toString() : null,
                miembro.getPeriodoFin() != null ? miembro.getPeriodoFin().toString() : null,
                Boolean.TRUE.equals(miembro.getPresidenteTribunal())
        );
    }
}
