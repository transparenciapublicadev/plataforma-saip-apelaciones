package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RevocarDispositivoPushActualRequest(
        @NotBlank(message = "El hash del dispositivo es obligatorio")
        @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "El hash del dispositivo debe ser SHA-256 hexadecimal")
        String deviceIdHash
) {
}
