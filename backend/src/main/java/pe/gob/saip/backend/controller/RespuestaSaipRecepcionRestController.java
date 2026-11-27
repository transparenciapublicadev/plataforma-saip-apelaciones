package pe.gob.saip.backend.controller;

import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import pe.gob.saip.backend.model.dto.RegistrarRespuestaSaipRequest;
import pe.gob.saip.backend.model.dto.RespuestaSaipRecepcionDTO;
import pe.gob.saip.backend.service.RespuestaSaipRecepcionService;

/** Additive coordinated API; legacy JSON response and document APIs keep their contracts. */
@RestController
@RequestMapping("/api/respuestas/solicitud/{solicitudId}/recepciones")
@PreAuthorize("hasAnyRole('FUNCIONARIO','ADMINISTRADOR')")
@ApiResponses({
    @ApiResponse(responseCode="400", description="Datos o archivos inválidos", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="401", description="JWT ausente o inválido", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="403", description="Actor, entidad o recurso no autorizado", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="404", description="Solicitud u operación no encontrada; no descarta un envío aún en curso", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="409", description="Huella, clave, respuesta o transición incompatible", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="500", description="Fallo interno o de almacenamiento; consultar recepción antes de reintentar", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=ProblemDetail.class)))
})
public class RespuestaSaipRecepcionRestController {
    private final RespuestaSaipRecepcionService service;

    public RespuestaSaipRecepcionRestController(RespuestaSaipRecepcionService service) {
        this.service = service;
    }

    @Operation(operationId="registrarRespuestaSaipConDocumentos", summary="Registrar respuesta SAIP y todos sus archivos seleccionados",
            requestBody=@io.swagger.v3.oas.annotations.parameters.RequestBody(required=true,
                    content=@Content(mediaType=MediaType.MULTIPART_FORM_DATA_VALUE, schema=@Schema(implementation=RegistrarRespuestaSaipRequest.class))),
            description="Archivos opcionales. Persiste respuesta, estado, manifiesto y todos los archivos en una operación idempotente. "
                    + "Ante incertidumbre consulte la misma clave; un reintento debe conservar actor, solicitud, campos y bytes, incluido el orden de archivos. "
                    + "Reutiliza los comandos existentes y la compensación del almacenamiento; no hay atomicidad distribuida. No acredita entrega, notificación eficaz, firma ni emisión oficial.")
    @ApiResponse(responseCode="200", description="Recepción completa persistida o recuperación de un reintento idéntico",
            content=@Content(mediaType=MediaType.APPLICATION_JSON_VALUE, schema=@Schema(implementation=RespuestaSaipRecepcionDTO.class)))
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public RespuestaSaipRecepcionDTO registrar(@PathVariable Long solicitudId,
            @Valid @ModelAttribute RegistrarRespuestaSaipRequest request) {
        return service.registrar(solicitudId, request);
    }

    @Operation(operationId="obtenerRecepcionRespuestaSaip", summary="Recuperar recepción antes de repetir una respuesta incierta",
            description="Solo el actor original que conserve autorización sobre la solicitud. Una consulta sin recepción no descarta un envío aún en curso; "
                    + "si reintenta use la misma clave y contenido. Un error de consulta no prueba ausencia. Nunca vuelve a registrar respuesta o archivos.")
    @ApiResponse(responseCode="200", description="Recepción persistida y manifiesto de documentos disponibles",
            content=@Content(mediaType=MediaType.APPLICATION_JSON_VALUE, schema=@Schema(implementation=RespuestaSaipRecepcionDTO.class)))
    @GetMapping("/{claveOperacion}")
    public RespuestaSaipRecepcionDTO obtener(@PathVariable Long solicitudId, @PathVariable UUID claveOperacion) {
        return service.obtener(solicitudId, claveOperacion);
    }
}
