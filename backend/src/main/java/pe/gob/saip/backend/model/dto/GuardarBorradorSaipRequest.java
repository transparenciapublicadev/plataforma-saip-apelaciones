package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record GuardarBorradorSaipRequest(
        Long entidadId,
        @Size(max = 500) String asunto,
        @Size(max = 20000) String descripcion,
        @Size(max = 100) String tipoInformacion,
        @Size(max = 160) String oficinaDestinataria,
        boolean formatoCorreo,
        boolean copiaSimple,
        boolean copiaCertificada,
        boolean soporteMagnetico,
        @Size(max = 20) String canalNotificacion,
        boolean aceptaCanal,
        boolean consentimientoDatos,
        boolean declaraVeracidad,
        @Min(1) @Max(4) int paso
) {}
