package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.service.CalendarioService;

@RestController
@RequestMapping({"/api/v1/calendario", "/api/calendario"})
@Tag(name = "Calendario Oficial", description = "Gestión del calendario oficial, días inhábiles y cómputo de plazos")
public class CalendarioRestController {

    private final CalendarioService calendarioService;

    public CalendarioRestController(CalendarioService calendarioService) {
        this.calendarioService = calendarioService;
    }

    @Operation(summary = "Obtener configuración oficial del calendario y plazos")
    @GetMapping
    public ResponseEntity<CalendarioConfigDTO> obtenerCalendario() {
        return ResponseEntity.ok(calendarioService.obtenerConfiguracionCalendario());
    }

    @Operation(summary = "Obtener resumen y días inhábiles de un año específico")
    @GetMapping("/{anio}")
    public ResponseEntity<CalendarioAnioResumenDTO> obtenerResumenAnio(@PathVariable int anio) {
        return ResponseEntity.ok(calendarioService.obtenerResumenAnio(anio));
    }

    @Operation(summary = "Actualizar configuración integral del calendario y plazos (solo Admin)")
    @PutMapping
    public ResponseEntity<CalendarioConfigDTO> actualizarCalendario(
            @RequestBody CalendarioConfigDTO dto,
            Authentication authentication) {
        String usuario = authentication != null ? authentication.getName() : "admin";
        return ResponseEntity.ok(calendarioService.actualizarConfiguracionCalendario(dto, usuario));
    }

    @Operation(summary = "Registrar o modificar un día inhábil / feriado / suspensión (solo Admin)")
    @PostMapping("/feriados")
    public ResponseEntity<FeriadoDTO> registrarFeriado(
            @RequestBody FeriadoDTO dto,
            Authentication authentication) {
        String usuario = authentication != null ? authentication.getName() : "admin";
        return ResponseEntity.ok(calendarioService.crearOActualizarFeriado(dto, usuario));
    }

    @Operation(summary = "Eliminar o desactivar un día inhábil (solo Admin)")
    @DeleteMapping("/feriados/{id}")
    public ResponseEntity<Void> eliminarFeriado(
            @PathVariable String id,
            Authentication authentication) {
        String usuario = authentication != null ? authentication.getName() : "admin";
        calendarioService.eliminarFeriado(id, usuario);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Cómputo en vivo de plazos y días hábiles")
    @PostMapping("/computo")
    public ResponseEntity<ComputoPlazoResponse> computarPlazo(@RequestBody ComputoPlazoRequest request) {
        return ResponseEntity.ok(calendarioService.computarPlazo(request));
    }
}
