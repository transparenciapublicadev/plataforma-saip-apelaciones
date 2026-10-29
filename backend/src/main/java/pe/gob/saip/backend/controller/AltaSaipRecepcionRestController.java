package pe.gob.saip.backend.controller;

import java.util.Set;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.service.AltaSaipRecepcionService;

/** Additive coordinated citizen creation; legacy JSON creation remains an independent operation. */
@RestController @RequestMapping("/api/solicitudes/recepciones")
@ApiResponses({
    @ApiResponse(responseCode="400",description="Campos, archivos o atributos no permitidos",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="401",description="Sesión no válida",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="403",description="Requiere ciudadano y actor original de la operación",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="404",description="Entidad o recepción no encontrada; no descarta una operación todavía en curso",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="409",description="Contenido incompatible, entidad inactiva o conflicto de persistencia",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="500",description="Resultado no confirmado o fallo de almacenamiento: consulte antes de repetir",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
})
public class AltaSaipRecepcionRestController {
    private final AltaSaipRecepcionService service;
    public AltaSaipRecepcionRestController(AltaSaipRecepcionService service){this.service=service;}
    @Operation(operationId="registrarAltaSaip",summary="Recibir nueva SAIP con todos sus archivos opcionales",
        description="Identidad derivada del ciudadano autenticado. Misma clave y huella versionada recuperan la misma recepción sin duplicar solicitud ni archivos. Se requiere consentimiento, declaración de veracidad y al menos una modalidad digital/física. Cada archivo exige su tipo en el mismo orden. Rigen los límites multipart y de almacenamiento. No acredita entrega, notificación eficaz, firma o emisión.",
        requestBody=@io.swagger.v3.oas.annotations.parameters.RequestBody(required=true))
    @ApiResponse(responseCode="200",description="Recepción persistida o repetición compatible",content=@Content(mediaType="application/json",schema=@Schema(implementation=AltaSaipRecepcionDTO.class)))
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public AltaSaipRecepcionDTO registrar(@Valid @ModelAttribute RegistrarAltaSaipRequest request,HttpServletRequest http){
        if(!Set.of("claveOperacion","entidadId","asunto","descripcion","tipoInformacion","formatoDigital","formatoFisico",
                "copiaSimple","copiaCertificada","consentimientoDatosPersonales","declaraVeracidad","canalNotificacion","tiposDocumento")
                .containsAll(http.getParameterMap().keySet()) || http instanceof MultipartHttpServletRequest multi
                && !Set.of("archivos").containsAll(multi.getMultiFileMap().keySet()))
            throw new IllegalArgumentException("El alta solo admite sus campos de presentación y los bytes de archivos seleccionados");
        return service.registrar(request);
    }
    @Operation(operationId="obtenerRecepcionAltaSaip",summary="Recuperar recepción de alta sin recrear la solicitud",
        description="Solo el ciudadano original. 404 no descarta un envío en curso: un reintento explícito debe conservar clave y contenido. Un fallo no acredita ausencia. La solicitud anidada refleja el recurso autorizado actual; recepción y manifiesto conservan sus IDs.")
    @ApiResponse(responseCode="200",description="Recepción y manifiesto disponibles",content=@Content(mediaType="application/json",schema=@Schema(implementation=AltaSaipRecepcionDTO.class)))
    @GetMapping("/{claveOperacion}")
    public AltaSaipRecepcionDTO obtener(@PathVariable UUID claveOperacion){return service.obtener(claveOperacion);}
}
