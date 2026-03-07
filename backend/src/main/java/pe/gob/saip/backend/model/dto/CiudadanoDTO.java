package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Ciudadano;

@Schema(description = "Ciudadano solicitante de información pública")
public record CiudadanoDTO(
    Long id,
    @Schema(description = "DNI de 8 dígitos", example = "12345678")
    String dni,
    String nombreCompleto,
    String email,
    String telefono,
    String direccion,
    String fechaRegistro,
    Boolean activo,
    Long totalSolicitudes,
    Long solicitudesEnProceso,
    Long solicitudesRespondidas,
    Long apelacionesRealizadas
) {
    public static CiudadanoDTO from(Ciudadano c) {
        return new CiudadanoDTO(
            c.getId(),
            c.getDni(),
            c.getNombreCompleto(),
            c.getEmail(),
            c.getTelefono(),
            c.getDireccion(),
            c.getFechaRegistro() != null ? c.getFechaRegistro().toString() : null,
            c.getActivo(),
            c.getSolicitudes() != null ? (long) c.getSolicitudes().size() : 0L,
            0L, 0L, 0L
        );
    }
}
