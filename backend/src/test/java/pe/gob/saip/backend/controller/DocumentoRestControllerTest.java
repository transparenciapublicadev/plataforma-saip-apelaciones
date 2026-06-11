package pe.gob.saip.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import pe.gob.saip.backend.exception.GlobalExceptionHandler;
import pe.gob.saip.backend.model.dto.DocumentoDownloadDTO;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.service.DocumentoService;
import pe.gob.saip.backend.storage.StorageException;

@ExtendWith(MockitoExtension.class)
class DocumentoRestControllerTest {

    @Mock
    private DocumentoService documentoService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new DocumentoRestController(documentoService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void metadataDoesNotExposeStorageKeyOrInternalPath() throws Exception {
        when(documentoService.obtenerMetadata(8L)).thenReturn(metadata());

        mockMvc.perform(get("/api/documentos/8/metadata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(8))
                .andExpect(jsonPath("$.nombreOriginal").value("resolucion.pdf"))
                .andExpect(jsonPath("$.hashSha256").value("a".repeat(64)))
                .andExpect(jsonPath("$.storageKey").doesNotExist())
                .andExpect(jsonPath("$.rutaArchivo").doesNotExist())
                .andExpect(jsonPath("$.storageBucket").doesNotExist());
    }

    @Test
    void downloadUsesSafeAttachmentHeaders() throws Exception {
        byte[] content = "contenido".getBytes(StandardCharsets.UTF_8);
        when(documentoService.descargar(8L)).thenReturn(new DocumentoDownloadDTO(
                "resolucion.pdf",
                "application/pdf",
                content.length,
                new ByteArrayInputStream(content)));

        mockMvc.perform(get("/api/documentos/8/download"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.CONTENT_DISPOSITION,
                        containsString("attachment; filename=\"resolucion.pdf\"")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().bytes(content));
    }

    @Test
    void invalidUploadReturnsProblemDetails() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "falso.pdf",
                "application/pdf",
                "no es pdf".getBytes(StandardCharsets.UTF_8));
        when(documentoService.subir(eq(file), any())).thenThrow(new StorageException(
                StorageException.Reason.INVALID_INPUT,
                "El contenido del archivo no corresponde al tipo declarado"));

        mockMvc.perform(multipart("/api/documentos/upload")
                        .file(file)
                        .param("tipoDocumento", "DOCUMENTO_ADJUNTO")
                        .param("solicitudId", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.detail").value(
                        "El contenido del archivo no corresponde al tipo declarado"));
    }

    @Test
    void providerFailureReturnsGenericProblemDetailsWithoutLeakingInternalMessage() throws Exception {
        when(documentoService.descargar(8L)).thenThrow(new StorageException(
                StorageException.Reason.IO_ERROR,
                "Provider failure at private endpoint"));

        mockMvc.perform(get("/api/documentos/8/download"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Internal server error"))
                .andExpect(jsonPath("$.detail").value(
                        "No fue posible completar la operación documental."))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        containsString("private endpoint"))));
    }

    private DocumentoMetadataDTO metadata() {
        LocalDateTime now = LocalDateTime.of(2026, 6, 11, 10, 0);
        return new DocumentoMetadataDTO(
                8L,
                "RESOLUCION_TTAIP",
                "resolucion.pdf",
                "application/pdf",
                100L,
                "a".repeat(64),
                "LOCAL",
                "ACTIVO",
                31L,
                now,
                now,
                null,
                null,
                null,
                null,
                5L,
                null);
    }
}
