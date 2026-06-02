package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;

public record RegistrarDispositivoPushRequest(
        @NotBlank(message = "El token FCM es obligatorio")
        @Size(min = 20, max = 4096, message = "El token FCM debe tener entre 20 y 4096 caracteres")
        String token,
        @NotNull(message = "El flavor mobile es obligatorio")
        DispositivoNotificacionPush.AppFlavor appFlavor,
        @NotNull(message = "La plataforma es obligatoria")
        DispositivoNotificacionPush.Plataforma plataforma,
        @NotBlank(message = "El hash del dispositivo es obligatorio")
        @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "El hash del dispositivo debe ser SHA-256 hexadecimal")
        String deviceIdHash,
        @Size(max = 40, message = "La versión de app no puede exceder 40 caracteres")
        String appVersion,
        @Size(max = 20, message = "El tipo de build no puede exceder 20 caracteres")
        String buildType
) {
}
