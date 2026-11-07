package pe.gob.saip.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.service.AutorizacionRecursosService;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;

@SpringBootTest(properties = {
    "SUPABASE_S3_ENDPOINT=https://mock-s3-endpoint.com",
    "AWS_REGION=us-east-1",
    "SUPABASE_S3_BUCKET_NAME=mock-bucket",
    "SUPABASE_S3_ACCESS_KEY=mock-access-key",
    "SUPABASE_S3_SECRET_KEY=mock-secret-key",
    "spring.flyway.enabled=false"
})
@ActiveProfiles("staging")
@AutoConfigureMockMvc(addFilters = false)
class DocumentoOrchestrationStagingTest {

    @DynamicPropertySource
    static void isolatedJwt(DynamicPropertyRegistry registry) {
        String key = java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID();
        registry.add("JWT_SECRET", () -> key);
    }


    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private S3CompatibleStorageProvider s3StorageProvider;

    @MockitoBean
    private DocumentoRepository documentoRepository;

    @MockitoBean
    private SolicitudRepository solicitudRepository;

    @MockitoBean
    private AutorizacionRecursosService autorizacion;

    private S3Client mockS3Client;
    private Object originalS3Client;

    @BeforeEach
    void setUp() {
        mockS3Client = mock(S3Client.class);
        originalS3Client = ReflectionTestUtils.getField(s3StorageProvider, "s3Client");
        ReflectionTestUtils.setField(s3StorageProvider, "s3Client", mockS3Client);
    }

    @AfterEach
    void tearDown() {
        if (originalS3Client != null) {
            ReflectionTestUtils.setField(s3StorageProvider, "s3Client", originalS3Client);
        }
    }

    @Test
    void uploadCompensatesStorageByDeletingObjectWhenDatabasePersistenceThrowsException() throws Exception {
        // 1. Mock S3Client putObject to succeed
        when(mockS3Client.putObject(any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().eTag("etag-test").build());

        // 2. Mock SolicitudRepository findById to return a dummy Solicitud
        Solicitud dummySolicitud = new Solicitud();
        dummySolicitud.setIdSolicitud(100L);
        when(solicitudRepository.findById(100L)).thenReturn(java.util.Optional.of(dummySolicitud));

        // 3. Mock AutorizacionRecursosService obtenerUsuarioActual to return a dummy Usuario
        Usuario dummyUser = new Usuario();
        dummyUser.setIdUsuario(1L);
        when(autorizacion.obtenerUsuarioActual()).thenReturn(dummyUser);

        // 4. Mock DocumentoRepository save to throw DataIntegrityViolationException (conflict)
        when(documentoRepository.save(any(Documento.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("Simulated SQL constraint failure"));

        // Prepare valid PDF file
        byte[] pdfContent = "%PDF-1.4\ncontent\n%%EOF".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "documento.pdf",
                "application/pdf",
                pdfContent
        );

        // 5. Perform the upload request via MockMvc and verify RFC 9457 Conflict response is returned
        mockMvc.perform(multipart("/api/documentos/upload")
                        .file(mockFile)
                        .param("tipoDocumento", "DOCUMENTO_ADJUNTO")
                        .param("solicitudId", "100"))
                .andExpect(status().isConflict())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Conflict"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("La operación viola una restricción de datos o duplicidad."))
                .andExpect(jsonPath("$.diagnosticHint").value("Verifique IDs, unicidad y alineación del seed SQL."));

        // 6. Verify that S3Client.deleteObject(...) was invoked as a compensating action to avoid orphan S3 leaks
        org.mockito.ArgumentCaptor<DeleteObjectRequest> deleteCaptor =
                org.mockito.ArgumentCaptor.forClass(DeleteObjectRequest.class);
        org.mockito.Mockito.verify(mockS3Client).deleteObject(deleteCaptor.capture());
        
        // Assert S3 delete request properties
        DeleteObjectRequest deleteRequest = deleteCaptor.getValue();
        assertThat(deleteRequest.bucket()).isEqualTo("mock-bucket");
        assertThat(deleteRequest.key()).matches("\\d{4}/\\d{2}/[0-9a-f-]{36}\\.pdf");
    }
}
