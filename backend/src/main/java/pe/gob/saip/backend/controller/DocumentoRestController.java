package pe.gob.saip.backend.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import pe.gob.saip.backend.model.dto.DocumentoDownloadDTO;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.DocumentoRelacionRequest;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.service.DocumentoService;

@RestController
@RequestMapping("/api/documentos")
@Tag(name = "Documentos", description = "Carga y acceso seguro a documentos por metadatos")
public class DocumentoRestController {

    private final DocumentoService documentoService;

    public DocumentoRestController(DocumentoService documentoService) {
        this.documentoService = documentoService;
    }

    @PostMapping(path = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Cargar documento asociado a un recurso SAIP/TTAIP")
    public ResponseEntity<DocumentoMetadataDTO> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam Documento.TipoDocumento tipoDocumento,
            @RequestParam(required = false) Long solicitudId,
            @RequestParam(required = false) Long respuestaId,
            @RequestParam(required = false) Long apelacionId,
            @RequestParam(required = false) Long expedienteTtaipId,
            @RequestParam(required = false) Long resolucionId,
            @RequestParam(required = false) Long cedulaNotificacionId) {
        DocumentoUploadRequest request = new DocumentoUploadRequest(
                tipoDocumento,
                solicitudId,
                respuestaId,
                apelacionId,
                expedienteTtaipId,
                resolucionId,
                cedulaNotificacionId);
        return ResponseEntity.status(201).body(documentoService.subir(file, request));
    }

    @GetMapping
    @Operation(summary = "Listar metadatos documentales seguros por relación de negocio")
    public List<DocumentoMetadataDTO> listar(
            @RequestParam(required = false) Long solicitudId,
            @RequestParam(required = false) Long respuestaId,
            @RequestParam(required = false) Long apelacionId,
            @RequestParam(required = false) Long expedienteTtaipId,
            @RequestParam(required = false) Long resolucionId,
            @RequestParam(required = false) Long cedulaNotificacionId) {
        return documentoService.listarPorRelacion(new DocumentoRelacionRequest(
                solicitudId,
                respuestaId,
                apelacionId,
                expedienteTtaipId,
                resolucionId,
                cedulaNotificacionId));
    }

    @GetMapping("/{documentoId}/metadata")
    @Operation(summary = "Consultar metadatos seguros de un documento")
    public DocumentoMetadataDTO metadata(@PathVariable Long documentoId) {
        return documentoService.obtenerMetadata(documentoId);
    }

    @GetMapping("/{documentoId}/download")
    @Operation(summary = "Descargar un documento validando ownership")
    public ResponseEntity<InputStreamResource> download(@PathVariable Long documentoId) {
        DocumentoDownloadDTO download = documentoService.descargar(documentoId);
        MediaType mediaType = MediaType.parseMediaType(download.contentType());
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.nombreOriginal(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(download.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new InputStreamResource(download.content()));
    }

    @DeleteMapping("/{documentoId}")
    @Operation(summary = "Eliminar físicamente un documento y conservar su metadato como eliminado")
    public ResponseEntity<Void> delete(@PathVariable Long documentoId) {
        documentoService.eliminar(documentoId);
        return ResponseEntity.noContent().build();
    }
}
