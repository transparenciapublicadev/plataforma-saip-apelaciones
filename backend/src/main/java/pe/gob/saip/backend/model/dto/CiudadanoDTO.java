package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.hibernate.LazyInitializationException;
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
    Long apelacionesRealizadas,
    String departamento,
    String provincia,
    String distrito
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
            contar(c.getSolicitudes()),
            0L, 0L, 0L,
            c.getDepartamento(),
            c.getProvincia(),
            c.getDistrito()
        );
    }

    /** A closed persistence session must not turn a profile read into a server error. */
    private static long contar(List<?> items) {
        if (items == null) return 0L;
        try {
            return items.size();
        } catch (LazyInitializationException ex) {
            return 0L;
        }
    }
}
