package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.dto.SystemConfigDTO;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;
import pe.gob.saip.backend.repository.ConfiguracionSistemaRepository;

@Service
public class ConfiguracionSistemaService {

    private static final Long CONFIG_ID = 1L;
    private final ConfiguracionSistemaRepository repository;

    public ConfiguracionSistemaService(ConfiguracionSistemaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public ConfiguracionSistema obtenerConfiguracion() {
        return repository.findById(CONFIG_ID).orElseGet(this::inicializarConfiguracionPorDefecto);
    }

    @Transactional
    public ConfiguracionSistema actualizarConfiguracion(SystemConfigDTO dto) {
        ConfiguracionSistema config = repository.findById(CONFIG_ID).orElseGet(() -> {
            ConfiguracionSistema nueva = new ConfiguracionSistema();
            nueva.setId(CONFIG_ID);
            return nueva;
        });

        if (dto.plazos() != null) {
            config.setPlazoSaipRespuesta(dto.plazos().saipRespuesta());
            config.setPlazoSaipProrroga(dto.plazos().saipProrroga());
            config.setPlazoSubsanacion(dto.plazos().subsanacion());
            config.setPlazoRecojoInformacion(dto.plazos().recojoInformacion());
            config.setPlazoApelacionInterposicion(dto.plazos().apelacionInterposicion());
            config.setPlazoTtaipResolucion(dto.plazos().ttaipResolucion());
            config.setPlazoTtaipCalificacion(dto.plazos().ttaipCalificacion());
            config.setPlazoTtaipSubsanacion(dto.plazos().ttaipSubsanacion());
        }

        if (dto.notif() != null) {
            config.setNotifVencidas(dto.notif().vencidas());
            config.setNotifProximos(dto.notif().proximos());
            config.setNotifRegistros(dto.notif().registros());
            config.setNotifUmbralProximo(dto.notif().umbralProximo());
        }

        if (dto.tarifas() != null) {
            config.setCostoPorCopia(dto.tarifas().costoPorCopia());
        }

        return repository.save(config);
    }

    @Transactional
    public ConfiguracionSistema inicializarConfiguracionPorDefecto() {
        ConfiguracionSistema config = new ConfiguracionSistema();
        config.setId(CONFIG_ID);
        return repository.save(config);
    }
}
