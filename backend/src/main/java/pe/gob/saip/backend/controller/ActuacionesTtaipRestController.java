package pe.gob.saip.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.service.ActosNotificacionTtaipService;
import pe.gob.saip.backend.service.DocumentosOficialesTtaipService;
import pe.gob.saip.backend.service.InformacionComplementariaTtaipService;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ttaip/expedientes/{expedienteId}")
public class ActuacionesTtaipRestController {
    private final DocumentosOficialesTtaipService documentos;
    private final InformacionComplementariaTtaipService informacion;
    private final ActosNotificacionTtaipService notificaciones;

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
