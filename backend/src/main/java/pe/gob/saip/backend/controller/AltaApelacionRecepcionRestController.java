package pe.gob.saip.backend.controller;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.service.AltaApelacionRecepcionService;

@RestController @RequestMapping("/api/apelaciones/recepciones")
@ApiResponses({
    @ApiResponse(responseCode="400",description="Datos, modalidad o archivos inválidos",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="401",description="Sesión no válida",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="403",description="Actor o recurso ajeno",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="404",description="Recurso o recepción no encontrado; no descarta un envío en curso",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="409",description="Contenido, versión, asociación o estado incompatible",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class))),
    @ApiResponse(responseCode="500",description="Resultado no confirmado; consulte antes de reintentar",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
})
public class AltaApelacionRecepcionRestController {
    private final AltaApelacionRecepcionService service;
    public AltaApelacionRecepcionRestController(AltaApelacionRecepcionService service){this.service=service;}
    @Operation(operationId="registrarAltaApelacion",summary="Recibir apelación y manifiesto documental coordinados",
        requestBody=@io.swagger.v3.oas.annotations.parameters.RequestBody(required=true,content=@Content(mediaType="multipart/form-data",encoding=@Encoding(name="datos",contentType="application/json"))),
        description="Parte datos JSON con identidad exclusivamente del ciudadano autenticado. DIRECTA_TTAIP y EXTERNA abren expediente; ANTE_ENTIDAD conserva pendiente de elevación. Cada entrada sin origenId consume el siguiente archivo; un antecedente exige su SHA-256 y relación autorizada a la SAIP/respuesta. Archivos nuevos según requisitos de modalidad. Misma clave y huella recuperan la recepción sin repetir efectos. No acredita admisión, entrega, notificación eficaz, firma ni emisión.")
    @ApiResponse(responseCode="200",description="Recepción persistida o repetición compatible")
    @ApiResponse(responseCode="422",description="Rechazo de una precondición de negocio de la modalidad existente",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public AltaApelacionRecepcionDTO registrar(@Valid @RequestPart("datos") RegistrarAltaApelacionRequest datos,
            @RequestPart(value="archivos",required=false) List<MultipartFile> archivos,MultipartHttpServletRequest http) throws Exception {
        // A JSON part without filename is also a servlet parameter in an actual multipart request.
        if(!Set.of("datos").containsAll(http.getParameterMap().keySet())
                || !Set.of("datos","archivos").containsAll(http.getMultiFileMap().keySet())
                || http.getMultiFileMap().getOrDefault("datos",List.of()).size()>1
                || http.getParameterValues("datos")!=null && http.getParameterValues("datos").length>1
                || http.getParts().stream().filter(p->"datos".equals(p.getName())).count()>1)
            throw new IllegalArgumentException("Solo se admiten datos JSON y archivos de esta operación");
        return service.registrar(datos,archivos==null?List.of():archivos);
    }
    @Operation(operationId="obtenerRecepcionAltaApelacion",summary="Recuperar recepción sin recrear apelación o documentos",
        description="Solo el ciudadano original. Un 404 no descarta un envío en curso. Conserve clave y contenido para un reintento explícito. La apelación anidada refleja el recurso actual; recepción, modalidad, IDs y hash aceptado son persistentes.")
    @ApiResponse(responseCode="200",description="Recepción y manifiesto disponibles")
    @GetMapping("/{claveOperacion}")
    public AltaApelacionRecepcionDTO obtener(@PathVariable UUID claveOperacion){return service.obtener(claveOperacion);}
}
