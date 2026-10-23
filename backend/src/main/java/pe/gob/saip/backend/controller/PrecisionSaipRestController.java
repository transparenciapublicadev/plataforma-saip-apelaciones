package pe.gob.saip.backend.controller;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import pe.gob.saip.backend.model.dto.PrecisionSaipRecepcionDTO;
import pe.gob.saip.backend.model.dto.RegistrarPrecisionSaipRequest;
import pe.gob.saip.backend.service.PrecisionSaipService;

/** Additive precision API; the existing JSON subsanation endpoint is unchanged. */
@RestController
@RequestMapping("/api/solicitudes/{solicitudId}/observaciones/{observacionId}/precision")
@PreAuthorize("hasRole('CIUDADANO')")
@ApiResponses({
        @ApiResponse(responseCode = "400", description = "Parámetros o archivo inválidos",
                content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "JWT ausente, inválido o expirado",
                content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Requiere rol CIUDADANO y titularidad de la solicitud",
                content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "Solicitud, observación o recepción no encontrada en el recurso indicado",
                content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "500", description = "Fallo interno o archivo no disponible; comprobar recepción antes de reintentar",
                content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
})
public class PrecisionSaipRestController {
    private final PrecisionSaipService service;

    public PrecisionSaipRestController(PrecisionSaipService service) {
        this.service = service;
    }

    @Operation(operationId = "registrarPrecisionSaip", summary = "Recibir precisión SAIP y archivo de forma idempotente",
            description = "Requiere ciudadano titular. Reutilice claveOperacion y el mismo contenido ante un resultado incierto. "
                    + "Archivo obligatorio, hasta 10 MiB según configuración; PDF, PNG, JPEG o TXT permitidos.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Recepción persistida con archivo disponible, o reintento idéntico",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PrecisionSaipRecepcionDTO.class))),
            @ApiResponse(responseCode = "409", description = "Precisión ya recibida con distinta clave o contenido, o conflicto de persistencia",
                    content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "422", description = "La observación no admite subsanación según su estado o plazo vigente",
                    content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PrecisionSaipRecepcionDTO> registrar(
            @PathVariable Long solicitudId,
            @PathVariable Long observacionId,
            @Valid @ModelAttribute RegistrarPrecisionSaipRequest request) {
        return ResponseEntity.ok(service.registrar(solicitudId, observacionId, request));
    }

    @Operation(operationId = "obtenerRecepcionPrecisionSaip",
            summary = "Comprobar recepción de precisión antes de reintentar un envío incierto",
            description = "Requiere ciudadano titular. 404 indica que no existe recepción para esa operación; "
                    + "500 no debe interpretarse como ausencia de recepción.")
    @ApiResponse(responseCode = "200", description = "Recepción persistida con archivo disponible",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PrecisionSaipRecepcionDTO.class)))
    @GetMapping("/{claveOperacion}")
    public ResponseEntity<PrecisionSaipRecepcionDTO> obtenerRecepcion(
            @PathVariable Long solicitudId,
            @PathVariable Long observacionId,
            @PathVariable UUID claveOperacion) {
        return ResponseEntity.ok(service.obtenerRecepcion(solicitudId, observacionId, claveOperacion));
    }
}
