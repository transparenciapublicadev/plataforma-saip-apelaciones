package pe.gob.saip.backend.controller;

import java.util.UUID;
import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.service.SubsanacionTtaipService;

/** Additive multipart and reconciliation endpoints; legacy JSON remains available. */
@RestController
@RequestMapping("/api/apelaciones/{apelacionId}/subsanacion")
@ApiResponses({
    @ApiResponse(responseCode="400", description="Solicitud o adjuntos inválidos", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="401", description="Sesión no válida", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="403", description="Requiere ciudadano titular o administrador", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="404", description="Recurso, requerimiento o recepción no encontrada", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="409", description="Conflicto de estado, contenido o persistencia", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="422", description="Plazo o condiciones de presentación no cumplidos", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="500", description="Fallo de almacenamiento o servidor: consultar recepción antes de repetir", content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
})
public class SubsanacionTtaipRestController {
    private final SubsanacionTtaipService service;
    public SubsanacionTtaipRestController(SubsanacionTtaipService service) { this.service = service; }

    @Operation(operationId="obtenerRequerimientoSubsanacionTtaip", summary="Consultar requerimiento y condiciones vigentes de subsanación")
    @ApiResponse(responseCode="200", description="Requerimiento y condiciones actuales", content=@Content(mediaType="application/json",schema=@Schema(implementation=RequerimientoSubsanacionTtaipDTO.class)))
    @GetMapping("/requerimiento")
    public RequerimientoSubsanacionTtaipDTO requerimiento(@PathVariable Long apelacionId) {
        return service.requerimientoActual(apelacionId);
    }

    @Operation(operationId="registrarSubsanacionTtaip", summary="Recibir subsanación y todos sus adjuntos",
        description="Operación idempotente por requerimiento concreto de primera calificación. Reutilizar clave y contenido ante resultado incierto. Los adjuntos seleccionados deben enviarse como bytes; no acepta IDs de documentos existentes. Límite total de adjuntos según almacenamiento (10 MiB por defecto). El modelo vigente no expresa exigencias documentales estructuradas.",
        requestBody=@io.swagger.v3.oas.annotations.parameters.RequestBody(required=true))
    @ApiResponse(responseCode="200", description="Recepción persistida y archivos disponibles, o reintento idéntico", content=@Content(mediaType="application/json",schema=@Schema(implementation=SubsanacionTtaipRecepcionDTO.class)))
    @PostMapping(path="/{requerimientoId}/recepcion", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public SubsanacionTtaipRecepcionDTO registrar(@PathVariable Long apelacionId, @PathVariable Long requerimientoId,
            @Valid @ModelAttribute RegistrarSubsanacionTtaipRequest request, HttpServletRequest http) {
        if (!Set.of("claveOperacion", "fundamentosAdicionales").containsAll(http.getParameterMap().keySet())
                || http instanceof MultipartHttpServletRequest multipart
                    && !Set.of("archivos").containsAll(multipart.getMultiFileMap().keySet())) {
            throw new IllegalArgumentException("La recepción solo admite la clave, los fundamentos y los bytes de sus adjuntos");
        }
        return service.registrar(apelacionId, requerimientoId, request);
    }

    @Operation(operationId="obtenerRecepcionSubsanacionTtaip", summary="Comprobar recepción antes de repetir una operación incierta",
        description="Solo 404 confirma ausencia para esta clave y requerimiento; un fallo de servidor o almacenamiento no equivale a ausencia.")
    @ApiResponse(responseCode="200", description="Recepción persistida y archivos disponibles", content=@Content(mediaType="application/json",schema=@Schema(implementation=SubsanacionTtaipRecepcionDTO.class)))
    @GetMapping("/{requerimientoId}/recepcion/{claveOperacion}")
    public SubsanacionTtaipRecepcionDTO consultar(@PathVariable Long apelacionId, @PathVariable Long requerimientoId,
            @PathVariable UUID claveOperacion) {
        return service.consultar(apelacionId, requerimientoId, claveOperacion);
    }
}
