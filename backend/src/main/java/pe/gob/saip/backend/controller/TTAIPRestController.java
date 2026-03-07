package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.CalificacionRequest;
import pe.gob.saip.backend.model.dto.ResolucionRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.service.TTAIPService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ttaip")
@Validated
@Tag(name = "TTAIP", description = "Calificación y resolución de apelaciones por el Tribunal de Transparencia")
public class TTAIPRestController {

    private final TTAIPService ttaipService;

    public TTAIPRestController(TTAIPService ttaipService) {
        this.ttaipService = ttaipService;
    }

    @Operation(summary = "Estadísticas del tribunal")
    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticas() {
        return ResponseEntity.ok(ttaipService.obtenerEstadisticas());
    }

    @Operation(summary = "Listar apelaciones pendientes de elevación")
    @GetMapping("/pendientes")
    public ResponseEntity<List<ApelacionDTO>> listarPendientes() {
        return ResponseEntity.ok(ttaipService.listarPendientes());
    }

    @Operation(summary = "Listar apelaciones en primera calificación")
    @GetMapping("/en-calificacion")
    public ResponseEntity<List<ApelacionDTO>> listarEnCalificacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION));
    }

    @Operation(summary = "Listar apelaciones en subsanación")
    @GetMapping("/subsanacion")
    public ResponseEntity<List<ApelacionDTO>> listarSubsanacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_SUBSANACION));
    }

    @Operation(summary = "Listar apelaciones en segunda calificación", description = "Apelaciones con subsanación presentada, pendientes de segunda calificación")
    @GetMapping("/segunda-calificacion")
    public ResponseEntity<List<ApelacionDTO>> listarSegundaCalificacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.SUBSANACION_PRESENTADA));
    }

    @Operation(summary = "Listar apelaciones resueltas")
    @GetMapping("/resueltas")
    public ResponseEntity<List<ApelacionDTO>> listarResueltas() {
        return ResponseEntity.ok(ttaipService.listarResueltas());
    }

    @Operation(summary = "Admitir apelación", description = "Primera calificación: admite la apelación y solicita descargos a la entidad")
    @PostMapping("/calificacion/{apelacionId}/admitir")
    public ResponseEntity<ApelacionDTO> admitirApelacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.admitirApelacion(apelacionId, request));
    }

    @Operation(summary = "Requerir subsanación", description = "Primera calificación: solicita al ciudadano subsanar la apelación en 2 días hábiles")
    @PostMapping("/calificacion/{apelacionId}/subsanar")
    public ResponseEntity<ApelacionDTO> requerirSubsanacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.requerirSubsanacion(apelacionId, request));
    }

    @Operation(summary = "Inadmitir o rechazar apelación")
    @PostMapping({"/calificacion/{apelacionId}/inadmitir", "/calificacion/{apelacionId}/rechazar"})
    public ResponseEntity<ApelacionDTO> inadmitirApelacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.inadmitirApelacion(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación fundada", description = "Resolución final a favor del ciudadano")
    @PostMapping({"/resolucion/{apelacionId}/fundado", "/resolucion/{apelacionId}/fundada"})
    public ResponseEntity<ApelacionDTO> declararFundado(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararFundado(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación infundada", description = "Resolución final: confirma la denegación de la entidad")
    @PostMapping({"/resolucion/{apelacionId}/infundado", "/resolucion/{apelacionId}/infundada"})
    public ResponseEntity<ApelacionDTO> declararInfundado(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararInfundado(apelacionId, request));
    }
}

