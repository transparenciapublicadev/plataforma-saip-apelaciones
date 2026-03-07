package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Funcionario;

@Schema(description = "Funcionario de entidad pública")
public record FuncionarioDTO(
    Long id,
    String nombreCompleto,
    String cargo,
    String email,
    String telefono,
    String fechaRegistro,
    Boolean activo,
    Long entidadId,
    String entidadNombre,
    String entidadAcronimo,
    Long solicitudesAtendidas
) {
    public static FuncionarioDTO from(Funcionario f) {
        return new FuncionarioDTO(
            f.getId(),
            f.getNombreCompleto(),
            f.getCargo(),
            f.getEmail(),
            f.getTelefono(),
            f.getFechaRegistro() != null ? f.getFechaRegistro().toString() : null,
            f.getActivo(),
            f.getEntidad() != null ? f.getEntidad().getId() : null,
            f.getEntidad() != null ? f.getEntidad().getNombre() : null,
            f.getEntidad() != null ? f.getEntidad().getAcronimo() : null,
            0L
        );
    }
}
