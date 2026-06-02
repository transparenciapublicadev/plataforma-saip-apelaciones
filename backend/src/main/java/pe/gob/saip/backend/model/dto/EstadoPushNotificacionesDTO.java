package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Estado seguro del adapter push; nunca expone tokens ni credenciales Firebase")
public record EstadoPushNotificacionesDTO(
        String proveedor,
        String estado,
        boolean configurable,
        boolean credencialesExternasConfiguradas,
        boolean cifradoTokenConfigurado,
        String nota
) {
}
