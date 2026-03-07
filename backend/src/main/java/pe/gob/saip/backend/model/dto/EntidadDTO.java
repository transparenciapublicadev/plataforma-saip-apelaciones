package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Entidad;

@Schema(description = "Entidad pública del Estado peruano")
public record EntidadDTO(
    Long id,
    @Schema(description = "Nombre oficial de la entidad")
    String nombre,
    @Schema(description = "Acrónimo único", example = "MINJUS")
    String acronimo,
    String descripcion,
    String direccion,
    String telefono,
    String email,
    String estado,
    Boolean activa,
    String fechaRegistro,
    Long solicitudesAsignadas,
    Long pendientes,
    Long respondidas,
    Long vencidas,
    Integer tasaCumplimiento
) {
    public static EntidadDTO from(Entidad e) {
        return new EntidadDTO(
            e.getId(),
            e.getNombre(),
            e.getAcronimo(),
            e.getDescripcion(),
            e.getDireccion(),
            e.getTelefono(),
            e.getEmail(),
            e.getEstado(),
            e.getActiva(),
            e.getFechaRegistro() != null ? e.getFechaRegistro().toString() : null,
            e.getSolicitudesAsignadas(),
            e.getPendientes(),
            e.getRespondidas(),
            e.getVencidas(),
            e.getTasaCumplimiento()
        );
    }
}
