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
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1));
    }

    @Operation(summary = "Listar apelaciones en subsanación")
    @GetMapping("/subsanacion")
    public ResponseEntity<List<ApelacionDTO>> listarSubsanacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_SUBSANACION));
    }

    @Operation(summary = "Listar apelaciones en segunda calificación")
    @GetMapping("/segunda-calificacion")
    public ResponseEntity<List<ApelacionDTO>> listarSegundaCalificacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_2));
    }

    @Operation(summary = "Listar apelaciones en resolución", description = "Apelaciones admitidas pendientes de resolución final")
    @GetMapping("/en-resolucion")
    public ResponseEntity<List<ApelacionDTO>> listarEnResolucion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_RESOLUCION));
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

    @Operation(summary = "Declarar apelación fundada en parte", description = "Resolución final: amparo parcial del recurso")
    @PostMapping("/resolucion/{apelacionId}/fundado-en-parte")
    public ResponseEntity<ApelacionDTO> declararFundadoEnParte(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararFundadoEnParte(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación infundada en parte", description = "Resolución final: desestimación parcial del recurso")
    @PostMapping("/resolucion/{apelacionId}/infundado-en-parte")
    public ResponseEntity<ApelacionDTO> declararInfundadoEnParte(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararInfundadoEnParte(apelacionId, request));
    }

    @Operation(summary = "Declarar improcedente en resolución final", description = "Resolución final: no cumple requisitos formales o de fondo")
    @PostMapping("/resolucion/{apelacionId}/improcedente")
    public ResponseEntity<ApelacionDTO> declararImprocedenteFinal(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararImprocedenteFinal(apelacionId, request));
    }

    @Operation(summary = "Conclusión por sustracción de la materia", description = "La entidad entrega la información durante el trámite de apelación")
    @PostMapping("/resolucion/{apelacionId}/sustraccion-materia")
    public ResponseEntity<ApelacionDTO> declararConclusionSustraccion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararConclusionSustraccion(apelacionId, request));
    }

    @Operation(summary = "Conclusión por desistimiento", description = "El ciudadano desiste voluntariamente del recurso")
    @PostMapping("/resolucion/{apelacionId}/desistimiento")
    public ResponseEntity<ApelacionDTO> declararConclusionDesistimiento(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararConclusionDesistimiento(apelacionId, request));
    }

    @Operation(summary = "Declarar tener por no presentado", description = "El ciudadano no subsanó en plazo de 2 días hábiles tras inadmisible")
    @PostMapping("/calificacion/{apelacionId}/no-presentado")
    public ResponseEntity<ApelacionDTO> declararTenerPorNoPresentado(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.declararTenerPorNoPresentado(apelacionId, request));
    }

    @Operation(summary = "Notificar segunda calificación al ciudadano", description = "Registra la notificación de la resolución de segunda calificación. Inicia el plazo de resolución final.")
    @PostMapping("/{apelacionId}/notificar-segunda-calificacion")
    public ResponseEntity<ApelacionDTO> notificarSegundaCalificacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId) {
        return ResponseEntity.ok(ttaipService.notificarSegundaCalificacion(apelacionId));
    }
}

