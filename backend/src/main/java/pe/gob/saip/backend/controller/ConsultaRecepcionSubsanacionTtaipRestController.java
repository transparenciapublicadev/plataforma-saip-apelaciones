package pe.gob.saip.backend.controller;

import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.*;
import pe.gob.saip.backend.model.dto.ConsultaRecepcionSubsanacionTtaipDTO;
import pe.gob.saip.backend.service.ConsultaRecepcionSubsanacionTtaipService;

/** Institutional receipt lookup; the citizen's operation recovery endpoint remains separate. */
@RestController
@RequestMapping("/api/ttaip/expedientes/{expedienteId}/requerimientos/{requerimientoId}/subsanacion/recepcion")
public class ConsultaRecepcionSubsanacionTtaipRestController {
    private final ConsultaRecepcionSubsanacionTtaipService service;
    public ConsultaRecepcionSubsanacionTtaipRestController(ConsultaRecepcionSubsanacionTtaipService service) { this.service=service; }

    @Operation(operationId="consultarRecepcionSubsanacionTtaipInstitucional",
        summary="Consultar recepción del requerimiento desde el expediente institucional",
        description="Solo TTAIP o administrador según la autorización institucional vigente. AUSENTE indica un requerimiento válido sin recepción. Un error de relaciones o almacenamiento nunca significa ausencia. No modifica actuaciones ni acredita notificación, firma o emisión.")
    @ApiResponses({
        @ApiResponse(responseCode="200", description="Recepción persistida o ausencia confirmada", content=@Content(mediaType="application/json",schema=@Schema(implementation=ConsultaRecepcionSubsanacionTtaipDTO.class))),
        @ApiResponse(responseCode="400", description="Identificadores inválidos", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
        @ApiResponse(responseCode="401", description="Sesión no válida", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
        @ApiResponse(responseCode="403", description="Requiere TTAIP o administrador", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
        @ApiResponse(responseCode="404", description="Expediente o requerimiento inexistente o ajeno al agregado", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
        @ApiResponse(responseCode="409", description="Actuación o relaciones incompatibles", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
        @ApiResponse(responseCode="500", description="Error de consulta o almacenamiento; no acredita ausencia", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    })
    @GetMapping
    public ConsultaRecepcionSubsanacionTtaipDTO consultar(@PathVariable Long expedienteId, @PathVariable Long requerimientoId) {
        return service.consultar(expedienteId,requerimientoId);
    }
}
