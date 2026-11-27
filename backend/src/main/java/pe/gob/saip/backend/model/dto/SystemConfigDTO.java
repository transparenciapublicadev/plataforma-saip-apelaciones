package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;

@Schema(description = "Configuración integral del sistema SAIP")
public record SystemConfigDTO(
        @NotNull @Valid PlazosConfigDTO plazos,
        @NotNull @Valid NotifConfigDTO notif,
        @NotNull @Valid TarifasConfigDTO tarifas
) {
    public static SystemConfigDTO from(ConfiguracionSistema config) {
        return new SystemConfigDTO(
                new PlazosConfigDTO(
                        config.getPlazoSaipRespuesta(),
                        config.getPlazoSaipProrroga(),
                        config.getPlazoSubsanacion(),
                        config.getPlazoRecojoInformacion(),
                        config.getPlazoApelacionInterposicion(),
                        config.getPlazoTtaipResolucion(),
                        config.getPlazoTtaipCalificacion(),
                        config.getPlazoTtaipSubsanacion()
                ),
                new NotifConfigDTO(
                        config.getNotifVencidas(),
                        config.getNotifProximos(),
                        config.getNotifRegistros(),
                        config.getNotifUmbralProximo()
                ),
                new TarifasConfigDTO(
                        config.getCostoPorCopia()
                )
        );
    }
}
