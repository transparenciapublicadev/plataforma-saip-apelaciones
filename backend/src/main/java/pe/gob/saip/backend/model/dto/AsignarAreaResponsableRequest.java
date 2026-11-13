package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Internal assignment of the office that holds the requested information. */
public record AsignarAreaResponsableRequest(
    @NotBlank @Size(max = 160) String area,
    @Size(max = 160) String encargado
) {}
