package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.PresentacionAdmisionTtaip;
import pe.gob.saip.backend.service.ActosNotificacionTtaipService;
import pe.gob.saip.backend.service.DocumentosOficialesTtaipService;
import pe.gob.saip.backend.service.InformacionComplementariaTtaipService;
import pe.gob.saip.backend.service.PresentacionesAdmisionTtaipService;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ttaip/expedientes/{expedienteId}")
public class ActuacionesTtaipRestController {
    private final DocumentosOficialesTtaipService documentos;
    private final InformacionComplementariaTtaipService informacion;
    private final ActosNotificacionTtaipService notificaciones;
    private final PresentacionesAdmisionTtaipService presentaciones;

    public record EscritoAdmisionTtaip(@NotNull UUID operacion, @NotNull PresentacionAdmisionTtaip.Tipo tipo,
                                     Long descargoId, String texto, String numeroOficio,
                                     @Schema(type = "string", format = "binary") MultipartFile archivo,
                                     @ArraySchema(schema = @Schema(type = "string", format = "binary"))
                                     List<MultipartFile> anexos) {}
    public record RespuestaInformeOralTtaip(@NotNull UUID operacion, @NotNull Boolean aceptada,
                                           @NotNull @Schema(type = "string", format = "binary") MultipartFile archivo) {}

    @GetMapping("/presentaciones-admision")
    public PresentacionesAdmisionTtaipService.Consulta presentaciones(@PathVariable Long expedienteId) {
        return presentaciones.consultar(expedienteId);
    }

    @PostMapping(value = "/presentaciones-admision", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(
            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, schema = @Schema(implementation = EscritoAdmisionTtaip.class))))
    public PresentacionesAdmisionTtaipService.Presentacion presentar(@PathVariable Long expedienteId,
            @Parameter(hidden = true) @Valid @ModelAttribute EscritoAdmisionTtaip escrito) {
        return presentaciones.presentar(expedienteId, escrito.operacion(), escrito.tipo(), escrito.descargoId(),
                escrito.texto(), escrito.numeroOficio(), escrito.archivo(), escrito.anexos());
    }

    @PostMapping(value = "/presentaciones-admision/{id}/respuesta", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @Content(
            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE, schema = @Schema(implementation = RespuestaInformeOralTtaip.class))))
    public PresentacionesAdmisionTtaipService.Presentacion responderInformeOral(@PathVariable Long expedienteId,
            @PathVariable Long id, @Parameter(hidden = true) @Valid @ModelAttribute RespuestaInformeOralTtaip respuesta) {
        return presentaciones.responder(expedienteId, id, respuesta.operacion(), respuesta.aceptada(), respuesta.archivo());
    }

    @GetMapping("/documentos-oficiales/{etapa}")
    public List<DocumentosOficialesTtaipService.Preparado> documentos(@PathVariable Long expedienteId,
            @PathVariable Resolucion.TipoResolucion etapa) {
        return documentos.listar(expedienteId, etapa);
    }

    @PutMapping(value = "/documentos-oficiales/{etapa}/{clave}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentosOficialesTtaipService.Preparado preparar(@PathVariable Long expedienteId,
            @PathVariable Resolucion.TipoResolucion etapa, @PathVariable String clave,
            @RequestParam Resolucion.DecisionResolucion decision, @RequestParam(required = false) String sala,
            @RequestParam(required = false) String numero, @RequestParam(required = false) MultipartFile archivo) {
        return documentos.preparar(expedienteId, etapa, clave, decision, sala, numero, archivo);
    }

    @GetMapping("/informacion-complementaria")
    public InformacionComplementariaTtaipService.Consulta informacion(@PathVariable Long expedienteId) {
        return informacion.consultar(expedienteId);
    }

    @PostMapping(value = "/informacion-complementaria", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InformacionComplementariaTtaipService.Consulta solicitar(@PathVariable Long expedienteId,
            @RequestParam String texto, @RequestParam(required = false) List<MultipartFile> archivos) {
        return informacion.solicitar(expedienteId, texto, archivos);
    }

    @PostMapping(value = "/informacion-complementaria/{solicitudId}/respuesta", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InformacionComplementariaTtaipService.Consulta responder(@PathVariable Long expedienteId,
            @PathVariable Long solicitudId, @RequestParam String texto,
            @RequestParam(required = false) List<MultipartFile> archivos) {
        return informacion.responder(expedienteId, solicitudId, texto, archivos);
    }

    @GetMapping("/actos-notificacion")
    public List<ActosNotificacionTtaipService.Acto> actos(@PathVariable Long expedienteId) {
        return notificaciones.listar(expedienteId);
    }

    @PutMapping("/actos-notificacion/{notificacionId}/destino")
    public ActosNotificacionTtaipService.Acto destino(@PathVariable Long expedienteId,
            @PathVariable Long notificacionId, @Valid @RequestBody ActosNotificacionTtaipService.Destino destino) {
        return notificaciones.editarDestino(expedienteId, notificacionId, destino);
    }

    @PutMapping(value = "/actos-notificacion/{notificacionId}/archivos/{tipo}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ActosNotificacionTtaipService.Acto subir(@PathVariable Long expedienteId, @PathVariable Long notificacionId,
            @PathVariable ActosNotificacionTtaipService.TipoArchivo tipo, @RequestParam MultipartFile archivo) {
        return notificaciones.subir(expedienteId, notificacionId, tipo, archivo);
    }

    @PostMapping("/actos-notificacion/{notificacionId}/publicacion")
    public ActosNotificacionTtaipService.Acto publicar(@PathVariable Long expedienteId, @PathVariable Long notificacionId) {
        return notificaciones.publicar(expedienteId, notificacionId);
    }

    @PostMapping("/actos-notificacion/{notificacionId}/revision")
    public ActosNotificacionTtaipService.Acto revisar(@PathVariable Long expedienteId,
            @PathVariable Long notificacionId, @Valid @RequestBody ActosNotificacionTtaipService.Revision revision) {
        return notificaciones.revisar(expedienteId, notificacionId, revision);
    }
}
