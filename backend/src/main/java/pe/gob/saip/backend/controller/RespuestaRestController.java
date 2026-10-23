package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.CrearRespuestaRequest;
import pe.gob.saip.backend.model.dto.RespuestaDTO;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.service.AutorizacionRecursosService;
import pe.gob.saip.backend.service.RespuestaService;
import pe.gob.saip.backend.service.SolicitudService;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/respuestas")
@Validated
@Tag(name = "Respuestas", description = "Respuestas de funcionarios a solicitudes SAIP")
public class RespuestaRestController {

    private final RespuestaService respuestaService;
    private final SolicitudService solicitudService;
    private final AutorizacionRecursosService autorizacionRecursosService;

    public RespuestaRestController(RespuestaService respuestaService,
                                    SolicitudService solicitudService,
                                    AutorizacionRecursosService autorizacionRecursosService) {
        this.respuestaService = respuestaService;
        this.solicitudService = solicitudService;
        this.autorizacionRecursosService = autorizacionRecursosService;
    }

    @Operation(summary = "Listar todas las respuestas")
    @GetMapping
    public ResponseEntity<List<RespuestaDTO>> listar() {
        List<RespuestaDTO> respuestas = autorizacionRecursosService
                .filtrarRespuestasAccesibles(respuestaService.obtenerTodasLasRespuestas())
                .stream()
                .map(RespuestaDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(respuestas);
    }

    @Operation(summary = "Obtener respuesta por ID")
    @GetMapping("/{id}")
    public ResponseEntity<RespuestaDTO> obtenerPorId(@Parameter(description = "ID de la respuesta") @PathVariable Long id) {
        Respuesta respuesta = respuestaService.obtenerRespuestaPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Respuesta no encontrada con ID: " + id));
        autorizacionRecursosService.verificarRespuestaAccesible(id);
        return ResponseEntity.ok(RespuestaDTO.from(respuesta));
    }

    @Operation(summary = "Obtener respuesta por solicitud")
    @GetMapping("/solicitud/{solicitudId}")
    public ResponseEntity<RespuestaDTO> obtenerPorSolicitud(@Parameter(description = "ID de la solicitud") @PathVariable Long solicitudId) {
        autorizacionRecursosService.verificarSolicitudAccesible(solicitudId);
        Solicitud solicitud = solicitudService.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + solicitudId));

        if (solicitud.getRespuesta() == null) {
            throw new RecursoNoEncontradoException("La solicitud no tiene respuesta");
        }

        return ResponseEntity.ok(RespuestaDTO.from(solicitud.getRespuesta()));
    }

    @Operation(summary = "Crear respuesta a solicitud SAIP", description = "Registra entrega total, parcial o denegatoria desde RECEPCIONADA, EN_REVISION o VENCIDA, sin respuesta ni observación pendiente. Una respuesta tardía conserva el límite registrado. Registrar no acredita entrega, firma ni notificación eficaz.")
    @ApiResponses({
        @ApiResponse(responseCode="201", description="Actuación o datos persistidos", content=@Content(schema=@Schema(implementation=RespuestaDTO.class))),
        @ApiResponse(responseCode="400", description="Tipo de respuesta desconocido o incompatible con el comando", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class))),
        @ApiResponse(responseCode="409", description="Respuesta existente o transición incompatible con las actuaciones del expediente", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PostMapping
    public ResponseEntity<RespuestaDTO> crear(@Valid @RequestBody CrearRespuestaRequest request) {
        verificarAutorizacionRespuesta(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(respuestaService.crearRespuesta(request));
    }

    @Operation(summary = "Aceptar solicitud", description = "Registra exclusivamente ENTREGA_TOTAL. Para ENTREGA_PARCIAL use POST /api/respuestas. Requiere solicitud RECEPCIONADA, EN_REVISION o VENCIDA sin respuesta ni observación pendiente.")
    @ApiResponses({
        @ApiResponse(responseCode="201", description="Actuación o datos persistidos", content=@Content(schema=@Schema(implementation=RespuestaDTO.class))),
        @ApiResponse(responseCode="400", description="Tipo de respuesta desconocido o incompatible con el comando", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class))),
        @ApiResponse(responseCode="409", description="Respuesta existente o transición incompatible con las actuaciones del expediente", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PostMapping("/aceptar")
    public ResponseEntity<RespuestaDTO> aceptarSolicitud(@Valid @RequestBody CrearRespuestaRequest request) {
        verificarAutorizacionRespuesta(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(respuestaService.aceptarSolicitud(request));
    }

    @Operation(summary = "Denegar solicitud", description = "Registra DENEGACION_TOTAL con los datos aportados. Requiere solicitud RECEPCIONADA, EN_REVISION o VENCIDA sin respuesta ni observación pendiente. No acredita notificación eficaz.")
    @ApiResponses({
        @ApiResponse(responseCode="201", description="Actuación o datos persistidos", content=@Content(schema=@Schema(implementation=RespuestaDTO.class))),
        @ApiResponse(responseCode="400", description="Tipo de respuesta desconocido o incompatible con el comando", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class))),
        @ApiResponse(responseCode="409", description="Respuesta existente o transición incompatible con las actuaciones del expediente", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PostMapping("/denegar")
    public ResponseEntity<RespuestaDTO> denegarSolicitud(@Valid @RequestBody CrearRespuestaRequest request) {
        verificarAutorizacionRespuesta(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(respuestaService.denegarSolicitud(request));
    }

    @Operation(summary = "Obtener causales de denegación", description = "Lista las 9 causales bajo Art. 15 Ley 27806")
    @GetMapping("/causales-denegacion")
    public ResponseEntity<List<String>> obtenerCausalesDenegacion() {
        List<String> causales = List.of(
                "Información Confidencial - Art. 15 Ley 27806",
                "Información Secreta - Art. 15-A Ley 27806",
                "Información Reservada - Art. 15-B Ley 27806",
                "Información que afecta la intimidad personal",
                "Información vinculada a investigaciones en trámite",
                "Secreto bancario, tributario, comercial o tecnológico",
                "Información elaborada como consejo o recomendación",
                "Información que ponga en riesgo la vida o seguridad de personas",
                "La solicitud requiere una elaboración de la información"
        );
        return ResponseEntity.ok(causales);
    }

    private void verificarAutorizacionRespuesta(CrearRespuestaRequest request) {
        autorizacionRecursosService.verificarSolicitudInstitucional(request.solicitudId());
        autorizacionRecursosService.verificarFuncionarioPuedeActuar(request.funcionarioId());
    }
}
