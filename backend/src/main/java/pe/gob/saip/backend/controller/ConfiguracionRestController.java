package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.dto.SystemConfigDTO;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;
import pe.gob.saip.backend.service.ConfiguracionSistemaService;

@RestController
@RequestMapping("/api/configuracion")
@Tag(name = "Configuración", description = "Parámetros y reglas operativas del sistema")
public class ConfiguracionRestController {

    private final ConfiguracionSistemaService service;

    public ConfiguracionRestController(ConfiguracionSistemaService service) {
        this.service = service;
    }

    @Operation(summary = "Obtener configuración del sistema", description = "Plazos, reglas de notificación y tarifas")
    @GetMapping
    public ResponseEntity<SystemConfigDTO> obtenerConfiguracion() {
        ConfiguracionSistema config = service.obtenerConfiguracion();
        return ResponseEntity.ok(SystemConfigDTO.from(config));
    }

    @Operation(summary = "Actualizar configuración del sistema")
    @PutMapping
    public ResponseEntity<SystemConfigDTO> actualizarConfiguracion(@Valid @RequestBody SystemConfigDTO request) {
        ConfiguracionSistema actualizada = service.actualizarConfiguracion(request);
        return ResponseEntity.ok(SystemConfigDTO.from(actualizada));
    }
}
