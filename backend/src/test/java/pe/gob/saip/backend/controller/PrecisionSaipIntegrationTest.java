package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;
import pe.gob.saip.backend.model.entity.PrecisionSaipRecepcion;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.CiudadanoRepository;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.EntidadRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.ObservacionSolicitudRepository;
import pe.gob.saip.backend.repository.PrecisionSaipRecepcionRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.security.JwtService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Exercises real HTTP filters, H2 transactions, document authorization and local
 * filesystem storage. Only the receipt repository is spied to inject one failure
 * after the physical upload; the normal persistence operations remain real.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:precision_saip_integration;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.flyway.enabled=false",
        "app.storage.provider=local",
        "app.notifications.mode=MOCK",
        "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PrecisionSaipIntegrationTest {

    private static final Path TEST_DIRECTORY = createTestDirectory();
    private static final Path STORAGE_DIRECTORY = TEST_DIRECTORY.resolve("documents");
    private static final byte[] PDF_BYTES = "%PDF-1.4\nPrecision SAIP con bytes verificables\n%%EOF"
            .getBytes(StandardCharsets.UTF_8);
    private static final String COMMENT = "Preciso el periodo consultado y adjunto el sustento.";

    @Autowired private MockMvc mockMvc;
    @Autowired private JsonMapper json;
    @Autowired private JwtService jwtService;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private CiudadanoRepository ciudadanos;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private FuncionarioRepository funcionarios;
    @Autowired private EntidadRepository entidades;
    @Autowired private SolicitudRepository solicitudes;
    @Autowired private ObservacionSolicitudRepository observaciones;
    @Autowired private DocumentoRepository documentos;
    @MockitoSpyBean private PrecisionSaipRecepcionRepository recepciones;

    private TransactionTemplate transactions;
    private Ciudadano owner;
    private Ciudadano otherCitizen;
    private Funcionario funcionario;
    private Solicitud solicitud;
    private ObservacionSolicitud observacion;
    private String ownerToken;
    private String operationKey;

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("app.storage.local.base-path", STORAGE_DIRECTORY::toString);
    }

    @BeforeEach
    void createPendingObservation() throws IOException {
        reset(recepciones);
        transactions = new TransactionTemplate(transactionManager);
        transactions.executeWithoutResult(status -> {
            recepciones.deleteAll();
            documentos.deleteAll();
            observaciones.deleteAll();
            solicitudes.deleteAll();
            funcionarios.deleteAll();
            ciudadanos.deleteAll();
            usuarios.deleteAll();
            entidades.deleteAll();

            String suffix = UUID.randomUUID().toString().substring(0, 8);
            owner = saveCitizen("owner-" + suffix + "@example.test", "Ciudadano propietario");
            otherCitizen = saveCitizen("other-" + suffix + "@example.test", "Otro ciudadano");
            Entidad entidad = new Entidad();
            entidad.setNombre("Entidad de prueba de precisiones");
            entidad.setAcronimo("E11-" + suffix);
            entidad = entidades.saveAndFlush(entidad);

            funcionario = new Funcionario();
            funcionario.setEmail("funcionario-" + suffix + "@example.test");
            funcionario.setPassword("not-used-by-token-test");
            funcionario.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO);
            funcionario.setNombreCompleto("Funcionario de la misma entidad");
            funcionario.setEntidad(entidad);
            funcionario = funcionarios.saveAndFlush(funcionario);

            solicitud = new Solicitud();
            solicitud.setExpediente("SAIP-2026-" + suffix);
            solicitud.setAsunto("Información pública para prueba de recepción");
            solicitud.setDescripcion("Solicitud real persistida en H2 para una precisión.");
            solicitud.setCiudadano(owner);
            solicitud.setEntidad(entidad);
            solicitud.setEstado(Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
            solicitud.setConsentimientoDatosPersonales(true);
            solicitud = solicitudes.saveAndFlush(solicitud);

            observacion = new ObservacionSolicitud();
            observacion.setSolicitud(solicitud);
            observacion.setMotivoObservacion("Precise el periodo consultado y adjunte el sustento.");
            observacion.setFechaObservacion(LocalDateTime.now());
            observacion.setFechaLimiteSubsanacion(LocalDate.now().plusDays(2));
            observacion.setResponsableObservacion("Funcionario de prueba");
            observacion.setTrazabilidad("Observación original conservada.");
            observacion = observaciones.saveAndFlush(observacion);
        });
        deleteFilesInsideStorage();
        Files.createDirectories(STORAGE_DIRECTORY);
        ownerToken = token(owner);
        operationKey = UUID.randomUUID().toString();
    }

    @Test
    void recordsPrecisionAndRecoversCommittedObservationMetadataAndIdenticalBytes() throws Exception {
        LocalDate originalDeadline = solicitud.getFechaLimite();
        MvcResult received = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.solicitudId").value(solicitud.getId()))
                .andExpect(jsonPath("$.observacionId").value(observacion.getId()))
                .andExpect(jsonPath("$.claveOperacion").value(operationKey))
                .andExpect(jsonPath("$.estado").value("SUBSANADA"))
                .andExpect(jsonPath("$.comentario").value(COMMENT))
                .andExpect(jsonPath("$.fechaRecepcion").isNotEmpty())
                .andExpect(jsonPath("$.documento.id").isNumber())
                .andExpect(jsonPath("$.documento.solicitudId").value(solicitud.getId()))
                .andExpect(jsonPath("$.documento.tipoDocumento").value("SUBSANACION"))
                .andExpect(jsonPath("$.documento.nombreOriginal").value("precision.pdf"))
                .andExpect(jsonPath("$.documento.sizeBytes").value(PDF_BYTES.length))
                .andExpect(jsonPath("$.documento.hashSha256").value(sha256(PDF_BYTES)))
                .andExpect(jsonPath("$.documento.storageKey").doesNotExist())
                .andReturn();
        long documentId = json.readTree(received.getResponse().getContentAsString())
                .path("documento").path("id").asLong();

        // Each request runs after the POST transaction has committed.
        mockMvc.perform(get(receiptUrl(operationKey)).header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documento.id").value(documentId))
                .andExpect(jsonPath("$.comentario").value(COMMENT));
        mockMvc.perform(get("/api/solicitudes/{id}/observaciones", solicitud.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].estado").value("SUBSANADA"))
                .andExpect(jsonPath("$[0].comentarioSubsanacion").value(COMMENT))
                .andExpect(jsonPath("$[0].fechaSubsanacion").isNotEmpty());
        mockMvc.perform(get("/api/solicitudes/{id}", solicitud.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_REVISION"))
                .andExpect(jsonPath("$.documentosMetadata[0].id").value(documentId));
        mockMvc.perform(get("/api/documentos/{id}/metadata", documentId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hashSha256").value(sha256(PDF_BYTES)));
        mockMvc.perform(get("/api/documentos/{id}/download", documentId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(PDF_BYTES));
        assertThat(solicitudes.findById(solicitud.getId()).orElseThrow().getFechaLimite())
                .isEqualTo(originalDeadline);
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void replayAfterLostResponseReturnsSameReceptionWithoutDuplicatingDocumentOrTrace() throws Exception {
        MvcResult first = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk()).andReturn();
        String originalTrace = observaciones.findById(observacion.getId()).orElseThrow().getTrazabilidad();
        MvcResult replay = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk()).andReturn();
        assertThat(json.readTree(replay.getResponse().getContentAsString()))
                .isEqualTo(json.readTree(first.getResponse().getContentAsString()));
        assertThat(observaciones.findById(observacion.getId()).orElseThrow().getTrazabilidad())
                .isEqualTo(originalTrace);
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void anIdenticalReplayAfterDeadlineStillRecoversTheOriginalTimelyReception() throws Exception {
        MvcResult original = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk()).andReturn();
        transactions.executeWithoutResult(status -> {
            ObservacionSolicitud received = observaciones.findById(observacion.getId()).orElseThrow();
            received.setFechaLimiteSubsanacion(LocalDate.now().minusDays(1));
            observaciones.saveAndFlush(received);
        });
        MvcResult replay = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk()).andReturn();
        assertThat(json.readTree(replay.getResponse().getContentAsString()))
                .isEqualTo(json.readTree(original.getResponse().getContentAsString()));
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void concurrentRetryProducesOneCommittedReceptionAndOneFile() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var requests = java.util.stream.IntStream.range(0, 2).mapToObj(index -> executor.submit(() -> {
                ready.countDown();
                assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                return sendConcurrent(operationKey, COMMENT, PDF_BYTES, ownerToken);
            })).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            MvcResult first = requests.get(0).get(30, TimeUnit.SECONDS);
            MvcResult second = requests.get(1).get(30, TimeUnit.SECONDS);
            assertThat(first.getResponse().getStatus()).isEqualTo(200);
            assertThat(second.getResponse().getStatus()).isEqualTo(200);
            assertThat(json.readTree(first.getResponse().getContentAsString()).path("documento").path("id").asLong())
                    .isEqualTo(json.readTree(second.getResponse().getContentAsString()).path("documento").path("id").asLong());
        }
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void rejectsChangedPayloadOrNewOperationAfterReception() throws Exception {
        send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isOk());
        send(operationKey, "Otro comentario", PDF_BYTES, ownerToken).andExpect(status().isConflict());
        send(operationKey, COMMENT, "%PDF-1.4\nOtro archivo\n%%EOF".getBytes(StandardCharsets.UTF_8), ownerToken)
                .andExpect(status().isConflict());
        mockMvc.perform(multipart(baseUrl())
                        .file(new MockMultipartFile("archivo", "another-name.pdf", "application/pdf", PDF_BYTES))
                        .param("comentario", COMMENT).param("claveOperacion", operationKey)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isConflict());
        send(UUID.randomUUID().toString(), COMMENT, PDF_BYTES, ownerToken).andExpect(status().isConflict());
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void anonymousCannotSubmitOrRecoverReception() throws Exception {
        send(operationKey, COMMENT, PDF_BYTES, null).andExpect(status().isUnauthorized());
        mockMvc.perform(get(receiptUrl(operationKey))).andExpect(status().isUnauthorized());
        assertNotReceived();
    }

    @Test
    void anotherCitizenAndSameEntityFuncionarioCannotSubmitOrRecoverReceipt() throws Exception {
        for (String forbiddenToken : new String[] {token(otherCitizen), token(funcionario)}) {
            send(operationKey, COMMENT, PDF_BYTES, forbiddenToken).andExpect(status().isForbidden());
            mockMvc.perform(get(receiptUrl(operationKey))
                            .header(HttpHeaders.AUTHORIZATION, bearer(forbiddenToken)))
                    .andExpect(status().isForbidden());
        }
        assertNotReceived();
    }

    @Test
    void documentRemainsProtectedAfterSuccessfulReception() throws Exception {
        MvcResult result = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk()).andReturn();
        long documentId = json.readTree(result.getResponse().getContentAsString()).path("documento").path("id").asLong();
        mockMvc.perform(get("/api/documentos/{id}/download", documentId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(otherCitizen))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/documentos/{id}/metadata", documentId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(otherCitizen))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(receiptUrl(operationKey))
                        .header(HttpHeaders.AUTHORIZATION, bearer(token(otherCitizen))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/documentos/{id}/download", documentId)).andExpect(status().isUnauthorized());
    }

    @Test
    void observationFromAnotherSolicitudCannotBeAssociated() throws Exception {
        Long otherObservationId = transactions.execute(status -> {
            Solicitud another = new Solicitud();
            another.setExpediente("SAIP-2026-" + UUID.randomUUID().toString().substring(0, 8));
            another.setAsunto("Otra solicitud del mismo ciudadano");
            another.setDescripcion("Esta observación no pertenece al recurso del path.");
            another.setCiudadano(owner);
            another.setEntidad(solicitud.getEntidad());
            another.setEstado(Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
            another = solicitudes.saveAndFlush(another);
            ObservacionSolicitud wrongParent = new ObservacionSolicitud();
            wrongParent.setSolicitud(another);
            wrongParent.setMotivoObservacion("Observación de otra solicitud");
            wrongParent.setFechaLimiteSubsanacion(LocalDate.now().plusDays(2));
            return observaciones.saveAndFlush(wrongParent).getId();
        });
        mockMvc.perform(requestFor(solicitud.getId(), otherObservationId, operationKey, COMMENT, PDF_BYTES)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(baseUrl(solicitud.getId(), otherObservationId) + "/" + operationKey)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        assertNotReceived();
    }

    @Test
    void missingResourceAndUnreceivedOperationReturn404WithoutChangingTheObservation() throws Exception {
        mockMvc.perform(requestFor(Long.MAX_VALUE, observacion.getId(), operationKey, COMMENT, PDF_BYTES)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(requestFor(solicitud.getId(), Long.MAX_VALUE, operationKey, COMMENT, PDF_BYTES)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(receiptUrl(operationKey)).header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        assertNotReceived();
    }

    @Test
    void invalidCommentOperationOrFileDoesNotRegisterPrecision() throws Exception {
        send(operationKey, "  ", PDF_BYTES, ownerToken).andExpect(status().isBadRequest());
        send("not-a-uuid", COMMENT, PDF_BYTES, ownerToken).andExpect(status().isBadRequest());
        send(operationKey, COMMENT, new byte[0], ownerToken).andExpect(status().isBadRequest());
        mockMvc.perform(multipart(baseUrl())
                        .file(new MockMultipartFile("archivo", "payload.exe", "application/octet-stream", new byte[]{1, 2, 3}))
                        .param("comentario", COMMENT).param("claveOperacion", operationKey)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(multipart(baseUrl())
                        .param("comentario", COMMENT).param("claveOperacion", operationKey)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isBadRequest());
        assertNotReceived();
    }

    @Test
    void expiredObservationDoesNotReceiveFileOrChangeItsDeadline() throws Exception {
        LocalDate expired = LocalDate.now().minusDays(1);
        transactions.executeWithoutResult(status -> {
            ObservacionSolicitud pending = observaciones.findById(observacion.getId()).orElseThrow();
            pending.setFechaLimiteSubsanacion(expired);
            observaciones.saveAndFlush(pending);
        });
        send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isUnprocessableEntity());
        assertNotReceived();
        assertThat(observaciones.findById(observacion.getId()).orElseThrow().getFechaLimiteSubsanacion())
                .isEqualTo(expired);
    }

    @Test
    void storageFailureLeavesNoReceptionAndSameAttemptCanBeRetried() throws Exception {
        deleteFilesInsideStorage();
        Files.delete(STORAGE_DIRECTORY);
        Files.writeString(STORAGE_DIRECTORY, "Simulated unavailable storage directory");
        try {
            send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isInternalServerError());
            assertThat(recepciones.count()).isZero();
            assertThat(documentos.count()).isZero();
            assertPendingObservation();
        } finally {
            Files.delete(STORAGE_DIRECTORY);
            Files.createDirectories(STORAGE_DIRECTORY);
        }
        mockMvc.perform(get(receiptUrl(operationKey)).header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isOk());
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void databaseFailureAfterPhysicalUploadRollsBackAndDeletesStoredObjectBeforeRetry() throws Exception {
        doThrow(new IllegalStateException("Simulated receipt persistence failure after upload"))
                .when(recepciones).saveAndFlush(any(PrecisionSaipRecepcion.class));
        send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isInternalServerError());
        assertNotReceived();
        mockMvc.perform(get(receiptUrl(operationKey)).header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isNotFound());
        reset(recepciones);
        send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isOk());
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(storedFileCount()).isEqualTo(1);
    }

    @Test
    void aMissingAcceptedFileDoesNotReturnAConfirmationOrCreateADuplicateOnReplay() throws Exception {
        MvcResult accepted = send(operationKey, COMMENT, PDF_BYTES, ownerToken)
                .andExpect(status().isOk()).andReturn();
        long documentId = json.readTree(accepted.getResponse().getContentAsString())
                .path("documento").path("id").asLong();
        Documento storedDocument = documentos.findById(documentId).orElseThrow();
        Path object = STORAGE_DIRECTORY.resolve(storedDocument.getStorageKey()).normalize();
        assertThat(object.startsWith(STORAGE_DIRECTORY)).isTrue();
        Files.delete(object);

        // A missing object is not a "not received" result: the durable receipt still exists.
        mockMvc.perform(get(receiptUrl(operationKey)).header(HttpHeaders.AUTHORIZATION, bearer(ownerToken)))
                .andExpect(status().isInternalServerError());
        send(operationKey, COMMENT, PDF_BYTES, ownerToken).andExpect(status().isInternalServerError());
        assertThat(recepciones.count()).isEqualTo(1);
        assertThat(documentos.count()).isEqualTo(1);
        assertThat(storedFileCount()).isZero();
        assertThat(observaciones.findById(observacion.getId()).orElseThrow().getEstado())
                .isEqualTo(ObservacionSolicitud.EstadoObservacion.SUBSANADA);
    }

    @Test
    void legacyJsonSubsanacionRemainsCompatibleForExistingConsumers() throws Exception {
        mockMvc.perform(post("/api/solicitudes/{solicitudId}/observaciones/{observacionId}/subsanar",
                        solicitud.getId(), observacion.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comentarioSubsanacion\":\"Comentario del consumidor legado\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("SUBSANADA"));
        assertThat(recepciones.count()).isZero();
    }

    @Test
    void openApiPublishesMultipartBytesAndReceiptWithoutRemovingLegacyJsonContract() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk()).andReturn();
        JsonNode specification = json.readTree(result.getResponse().getContentAsString());
        JsonNode paths = specification.path("paths");
        String precisionPath = "/api/solicitudes/{solicitudId}/observaciones/{observacionId}/precision";
        JsonNode multipartContent = paths.path(precisionPath).path("post")
                .path("requestBody").path("content").path(MediaType.MULTIPART_FORM_DATA_VALUE);
        assertThat(multipartContent.isMissingNode()).isFalse();
        JsonNode schema = resolveSchema(specification, multipartContent.path("schema"));
        assertThat(schema.path("properties").has("comentario")).isTrue();
        assertThat(schema.path("properties").has("claveOperacion")).isTrue();
        JsonNode archivo = schema.path("properties").path("archivo");
        assertThat(archivo.path("type").asText()).isEqualTo("string");
        assertThat(archivo.path("format").asText()).isEqualTo("binary");
        assertThat(paths.path(precisionPath + "/{claveOperacion}").has("get")).isTrue();
        assertThat(paths.path("/api/solicitudes/{id}/observaciones/{observacionId}/subsanar")
                .path("post").path("requestBody").path("content").has(MediaType.APPLICATION_JSON_VALUE)).isTrue();
        JsonNode metadata = specification.path("components").path("schemas").path("DocumentoMetadataDTO");
        assertThat(metadata.path("properties").has("storageKey")).isFalse();
        assertThat(metadata.path("properties").has("storageBucket")).isFalse();
        assertThat(metadata.path("properties").has("storageProvider")).isFalse();
        JsonNode receipt = specification.path("components").path("schemas").path("PrecisionSaipRecepcionDTO");
        assertThat(receipt.path("properties").has("documento")).isTrue();
        assertThat(paths.path(precisionPath).path("post").path("requestBody").path("required").asBoolean()).isTrue();
        assertThat(receipt.path("required").valueStream().map(JsonNode::asText).toList())
                .containsExactlyInAnyOrder("solicitudId", "observacionId", "claveOperacion", "fechaRecepcion",
                        "comentario", "estado", "documento");
        assertThat(receipt.path("properties").path("claveOperacion").path("format").asText()).isEqualTo("uuid");
        assertThat(receipt.path("properties").path("estado").path("enum").valueStream().map(JsonNode::asText).toList())
                .containsExactly("SUBSANADA");
        assertThat(schema.path("properties").path("comentario").path("minLength").asInt()).isEqualTo(1);
        for (String code : new String[]{"200", "400", "401", "403", "404", "409", "422", "500"}) {
            assertThat(paths.path(precisionPath).path("post").path("responses").has(code)).as("POST response %s", code).isTrue();
        }
        for (String code : new String[]{"200", "400", "401", "403", "404", "500"}) {
            assertThat(paths.path(precisionPath + "/{claveOperacion}").path("get").path("responses").has(code))
                    .as("GET response %s", code).isTrue();
        }
        assertThat(specification.path("security").get(0).has("bearerAuth")).isTrue();
    }

    private JsonNode resolveSchema(JsonNode specification, JsonNode schema) {
        if (schema.has("$ref")) {
            String reference = schema.path("$ref").asText();
            return specification.at(reference.substring(1));
        }
        return schema;
    }

    private Ciudadano saveCitizen(String email, String name) {
        Ciudadano citizen = new Ciudadano();
        citizen.setEmail(email);
        citizen.setPassword("not-used-by-token-test");
        citizen.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        citizen.setNombreCompleto(name);
        return ciudadanos.saveAndFlush(citizen);
    }

    private String token(Usuario user) {
        return jwtService.generateToken(user.getIdUsuario(), user.getTipoUsuario().name(), user.getVersionAutenticacion());
    }

    private String bearer(String value) {
        return "Bearer " + value;
    }

    private String baseUrl() {
        return baseUrl(solicitud.getId(), observacion.getId());
    }

    private String baseUrl(Long solicitudId, Long observacionId) {
        return "/api/solicitudes/" + solicitudId + "/observaciones/" + observacionId + "/precision";
    }

    private String receiptUrl(String key) {
        return baseUrl() + "/" + key;
    }

    private MockMultipartHttpServletRequestBuilder requestFor(Long solicitudId, Long observacionId,
            String key, String comment, byte[] bytes) {
        return multipart(baseUrl(solicitudId, observacionId))
                .file(new MockMultipartFile("archivo", "precision.pdf", "application/pdf", bytes))
                .param("comentario", comment)
                .param("claveOperacion", key);
    }

    private org.springframework.test.web.servlet.ResultActions send(String key, String comment,
            byte[] bytes, String jwt) throws Exception {
        MockMultipartHttpServletRequestBuilder request = requestFor(solicitud.getId(), observacion.getId(), key, comment, bytes);
        if (jwt != null) {
            request.header(HttpHeaders.AUTHORIZATION, bearer(jwt));
        }
        return mockMvc.perform(request);
    }

    /** Allows the PostgreSQL suite to prove independent database transactions. */
    protected MvcResult sendConcurrent(String key, String comment, byte[] bytes, String jwt) throws Exception {
        return send(key, comment, bytes, jwt).andReturn();
    }

    private void assertNotReceived() throws IOException {
        assertThat(recepciones.count()).isZero();
        assertThat(documentos.count()).isZero();
        assertThat(storedFileCount()).isZero();
        assertPendingObservation();
    }

    private void assertPendingObservation() {
        ObservacionSolicitud current = observaciones.findById(observacion.getId()).orElseThrow();
        assertThat(current.getEstado()).isEqualTo(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION);
        assertThat(current.getFechaSubsanacion()).isNull();
        assertThat(current.getComentarioSubsanacion()).isNull();
        assertThat(solicitudes.findById(solicitud.getId()).orElseThrow().getEstado())
                .isEqualTo(Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
    }

    private long storedFileCount() throws IOException {
        try (var files = Files.walk(STORAGE_DIRECTORY)) {
            return files.filter(Files::isRegularFile).count();
        }
    }

    private void deleteFilesInsideStorage() throws IOException {
        if (!Files.isDirectory(STORAGE_DIRECTORY)) {
            return;
        }
        try (var paths = Files.walk(STORAGE_DIRECTORY)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                if (!path.equals(STORAGE_DIRECTORY)) {
                    Files.delete(path);
                }
            }
        }
    }

    private String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static Path createTestDirectory() {
        try {
            return Files.createTempDirectory("yaiku-e11-integration-");
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot initialize isolated test storage", exception);
        }
    }

    @AfterAll
    static void removeTestStorage() throws IOException {
        try (var paths = Files.walk(TEST_DIRECTORY)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }
}
