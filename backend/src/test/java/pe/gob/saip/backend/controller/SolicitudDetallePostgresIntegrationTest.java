package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import pe.gob.saip.backend.model.entity.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Real HTTP/JWT/JPA with committed fixtures; no test transaction or OSIV. No external providers. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "server.address=127.0.0.1", "spring.jpa.open-in-view=false",
    "spring.flyway.enabled=true", "spring.flyway.clean-disabled=true",
    "spring.flyway.locations=classpath:db/migration", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "spring.jpa.properties.hibernate.generate_statistics=true",
    "logging.level.org.hibernate.stat=OFF", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@EnabledIfEnvironmentVariable(named="RUN_DETAIL_POSTGRES_TESTS", matches="true")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class SolicitudDetallePostgresIntegrationTest {
    private static final String KEY = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final Path LOCAL = temporaryStorage();
    @Autowired EntityManager em;
    @Autowired EntityManagerFactory emf;
    @Autowired PlatformTransactionManager manager;
    @Autowired PasswordEncoder encoder;
    @Autowired JsonMapper json;
    @Autowired Environment environment;
    @Autowired Flyway flyway;
    @LocalServerPort int port;
    private HttpClient client;
    private String password, ownerEmail, otherEmail, staffEmail, otherStaffEmail, expediente, marker;
    private long id, ownerId, staffId, respuestaId, apelacionId, observacionId;
    private final List<Long> solicitudDocs = new ArrayList<>();
    private final List<Long> respuestaDocs = new ArrayList<>();

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String url = System.getenv("DETAIL_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("An explicitly owned disposable loopback PostgreSQL database is required");
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> "yaiku_e11_test");
        registry.add("spring.datasource.password", () -> "");
        registry.add("jwt.secret", () -> KEY);
        registry.add("app.storage.local.base-path", LOCAL::toString);
    }

    @BeforeEach
    void committedFixture() {
        client = HttpClient.newHttpClient();
        String suffix = UUID.randomUUID().toString();
        password = UUID.randomUUID().toString();
        String hash = encoder.encode(password);
        ownerEmail = "owner-" + suffix + "@example.invalid";
        otherEmail = "other-" + suffix + "@example.invalid";
        staffEmail = "staff-" + suffix + "@example.invalid";
        otherStaffEmail = "other-staff-" + suffix + "@example.invalid";
        marker = "PRIVATE_SYNTHETIC_DETAIL_" + suffix;
        solicitudDocs.clear(); respuestaDocs.clear();
        tx(() -> {
            Ciudadano owner = citizen(ownerEmail, hash); ownerId = owner.getId();
            citizen(otherEmail, hash);
            Entidad institution = entity("Detalle sintético", "D-" + suffix.substring(0,8));
            Funcionario staff = staff(staffEmail, hash, institution); staffId = staff.getId();
            staff(otherStaffEmail, hash, entity("Entidad ajena", "A-" + suffix.substring(0,8)));
            Solicitud solicitud = new Solicitud();
            expediente = "SAIP-2099-%05d".formatted(ownerId);
            solicitud.setExpediente(expediente); solicitud.setAsunto(marker);
            solicitud.setDescripcion("DESCRIPTION_" + marker); solicitud.setCiudadano(owner);
            solicitud.setEntidad(institution); solicitud.setConsentimientoDatosPersonales(true);
            em.persist(solicitud); em.flush(); id = solicitud.getId();
        });
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
    }

    @AfterEach void closeClient() { client.close(); }

    @Test
    void originalMigrationsAndSchemaValidateWithoutAnOpenRequestOrTestSession() {
        assertThat(environment.getProperty("spring.jpa.open-in-view")).isEqualTo("false");
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).hasSize(11);
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
    }

    @Test
    void emptyDetailIsReadableByOwnerAndInstitutionWithExplicitEmptyCollections() throws Exception {
        for (String email : List.of(ownerEmail, staffEmail)) {
            JsonNode body = detail(login(email));
            assertThat(body.path("id").asLong()).isEqualTo(id);
            assertThat(body.path("asunto").asString()).isEqualTo(marker);
            assertThat(body.path("descripcion").asString()).isEqualTo("DESCRIPTION_" + marker);
            for (String field : List.of("documentos", "documentosMetadata", "observaciones",
                    "ampliacionesPlazo", "encauzamientos", "liquidacionesCosto"))
                assertThat(body.path(field).size()).as(field).isZero();
            assertThat(body.path("respuesta").isNull()).isTrue();
            assertThat(body.path("apelacion").isNull()).isTrue();
        }
    }

    @Test
    void mapsDocumentsResponseObservationsAndAppealFromTheirPersistedRelationships() throws Exception {
        richFixture();
        for (String email : List.of(ownerEmail, staffEmail)) {
            JsonNode body = detail(login(email));
            assertIds(body.path("documentos"), solicitudDocs);
            assertIds(body.path("documentosMetadata"), solicitudDocs);
            assertIds(body.path("respuesta").path("documentos"), respuestaDocs);
            assertIds(body.path("respuesta").path("documentosMetadata"), respuestaDocs);
            assertThat(body.path("respuesta").path("id").asLong()).isEqualTo(respuestaId);
            assertThat(body.path("respuesta").path("funcionarioId").asLong()).isEqualTo(staffId);
            for (JsonNode doc : body.path("documentosMetadata")) {
                assertThat(doc.path("solicitudId").asLong()).isEqualTo(id);
                assertThat(doc.path("respuestaId").isNull()).isTrue();
            }
            for (JsonNode doc : body.path("respuesta").path("documentosMetadata"))
                assertThat(doc.path("respuestaId").asLong()).isEqualTo(respuestaId);
            assertThat(body.path("observaciones").get(0).path("id").asLong()).isEqualTo(observacionId);
            assertThat(body.path("observaciones").get(0).path("solicitudId").asLong()).isEqualTo(id);
            assertThat(body.path("apelacion").path("id").asLong()).isEqualTo(apelacionId);
            assertThat(body.path("apelacion").path("plazoSubsanacion").path("estado").asString()).isEqualTo("PENDIENTE_INICIO");
            assertThat(body.path("ampliacionesPlazo").get(0).path("cronograma").size()).isEqualTo(1);
            assertThat(body.toString()).doesNotContain("private-storage-key", "UNRELATED_DOCUMENT");
        }
    }

    @Test
    void unauthorizedActorsAreRejectedBeforeFetchingDetailCollectionsAndMissingResourceStays404() throws Exception {
        richFixture();
        assertThat(get("/api/solicitudes/" + id, null).statusCode()).isEqualTo(401);
        for (String email : List.of(otherEmail, otherStaffEmail)) {
            String token = login(email); Statistics stats = statistics(); stats.clear();
            HttpResponse<String> response = get("/api/solicitudes/" + id, token);
            assertThat(response.statusCode()).isEqualTo(403);
            assertThat(response.body()).doesNotContain(marker, "private-storage-key");
            assertThat(stats.getCollectionFetchCount()).as("Reject before fetching DTO collections").isZero();
        }
        assertThat(get("/api/solicitudes/9223372036854775807", login(ownerEmail)).statusCode()).isEqualTo(404);
    }

    @Test
    void privateExpedienteAliasUsesTheSameAuthorizedDetailAndPublicLookupRemainsMinimized() throws Exception {
        String token = login(ownerEmail);
        HttpResponse<String> alias = get("/api/solicitudes/expediente/" + expediente, token);
        assertThat(alias.statusCode()).isEqualTo(200);
        assertThat(json.readTree(alias.body()).path("id").asLong()).isEqualTo(id);
        assertThat(get("/api/solicitudes/expediente/" + expediente, login(otherEmail)).statusCode()).isEqualTo(403);
        HttpResponse<String> publicResponse = get("/api/solicitudes/publica/expediente/" + expediente, null);
        assertThat(publicResponse.statusCode()).isEqualTo(200);
        JsonNode body = json.readTree(publicResponse.body());
        assertThat(publicResponse.body()).doesNotContain(marker);
        for (String field : List.of("asunto", "descripcion", "documentos", "documentosMetadata", "ciudadanoId", "id"))
            assertThat(body.has(field)).as(field).isFalse();
        assertThat(body.path("expediente").asString()).isEqualTo(expediente);
    }

    @Test
    void institutionalPanelCountsOpenDeadlinesAcrossPagesWithoutOtherEntities() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().pending()).isEmpty();
        tx(() -> {
            Solicitud original = em.find(Solicitud.class, id);
            original.setTipoInformacion("Tema activo");
            Solicitud second = panelRequest(original, original.getEntidad(), "segunda", "Tema activo");
            assertThat(second.getFechaLimite()).isEqualTo(original.getFechaLimite());
            Solicitud overdue = panelRequest(original, original.getEntidad(), "vencida", "Tema anterior");
            overdue.setFechaLimite(LocalDate.now().minusDays(1));
            Solicitud answered = panelRequest(original, original.getEntidad(), "respondida", "Tema cerrado");
            answered.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);
            panelRequest(original, entity("Entidad del panel ajena", "PA-" + ownerId), "ajena", "Tema ajeno");
        });

        HttpResponse<String> response = get("/api/panel/solicitudes?tamano=1&busqueda=segunda", login(staffEmail));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        JsonNode page = json.readTree(response.body());
        assertThat(page.path("totalElementos").asInt()).isEqualTo(1);
        JsonNode days = page.path("resumen").path("porDiasRestantes");
        String visibleDays = page.path("contenido").get(0).path("diasRestantes").asString();
        assertThat(days.size()).isEqualTo(1);
        assertThat(days.path(visibleDays).asInt()).isEqualTo(2);
        JsonNode topics = page.path("resumen").path("porTipoInformacion");
        assertThat(topics.path("Tema activo").asInt()).isEqualTo(2);
        assertThat(topics.has("Tema cerrado")).isFalse();
        assertThat(topics.has("Tema ajeno")).isFalse();

        HttpResponse<String> ownerPage = get("/api/panel/solicitudes", login(ownerEmail));
        assertThat(ownerPage.statusCode()).isEqualTo(200);
        assertThat(json.readTree(ownerPage.body()).path("resumen").path("porDiasRestantes").isObject()).isFalse();
        assertThat(get("/api/panel/solicitudes", null).statusCode()).isEqualTo(401);
    }

    private Solicitud panelRequest(Solicitud original, Entidad entidad, String suffix, String topic) {
        Solicitud request = new Solicitud();
        request.setExpediente(expediente + "-" + suffix);
        request.setAsunto(suffix);
        request.setDescripcion("Solicitud sintética del panel");
        request.setCiudadano(original.getCiudadano());
        request.setEntidad(entidad);
        request.setTipoInformacion(topic);
        request.setConsentimientoDatosPersonales(true);
        em.persist(request);
        return request;
    }

    @Test
    void addingDocumentsDoesNotAddOneSelectPerDocumentOrDuplicateRows() throws Exception {
        richFixture();
        String token = login(ownerEmail); Statistics stats = statistics(); stats.clear();
        detail(token); long initial = stats.getPrepareStatementCount();
        tx(() -> { Solicitud s = em.find(Solicitud.class, id);
            for (int i=0; i<20; i++) document(s, null, "extra-" + i, solicitudDocs);
        });
        stats.clear(); JsonNode expanded = detail(token);
        assertIds(expanded.path("documentosMetadata"), solicitudDocs);
        assertThat(stats.getPrepareStatementCount()).as("Statement count stays constant as document cardinality grows").isEqualTo(initial);
    }

    private void richFixture() {
        tx(() -> {
            Solicitud s = em.find(Solicitud.class, id);
            for (int i=0; i<3; i++) document(s, null, "request-"+i, solicitudDocs);
            Documento deleted = document(s, null, "deleted", new ArrayList<>()); deleted.setEstado(Documento.EstadoDocumento.ELIMINADO);
            Respuesta response = new Respuesta(); response.setSolicitud(s); response.setFuncionario(em.find(Funcionario.class, staffId));
            response.setTipoRespuesta(Respuesta.TipoRespuesta.ENTREGA_PARCIAL); response.setContenido("Contenido sintético registrado");
            em.persist(response); em.flush(); respuestaId = response.getId();
            for (int i=0; i<2; i++) document(null, response, "response-"+i, respuestaDocs);
            ObservacionSolicitud obs = new ObservacionSolicitud(); obs.setSolicitud(s); obs.setMotivoObservacion("Observación sintética atendida");
            obs.setFechaObservacion(LocalDateTime.now().minusDays(2)); obs.setFechaLimiteSubsanacion(LocalDate.now());
            obs.setEstado(ObservacionSolicitud.EstadoObservacion.SUBSANADA); em.persist(obs); em.flush(); observacionId = obs.getId();
            Apelacion appeal = new Apelacion(); appeal.setSolicitud(s); appeal.setCiudadano(em.find(Ciudadano.class, ownerId));
            appeal.setExpediente("TTAIP-DETAIL-" + ownerId); appeal.setFundamentos("Fundamento sintético");
            appeal.setEstado(Apelacion.EstadoApelacion.EN_SUBSANACION); em.persist(appeal); em.flush(); apelacionId = appeal.getId();
            Resolucion requirement = new Resolucion(); requirement.setApelacion(appeal);
            requirement.setTipoResolucion(Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
            requirement.setDecision(Resolucion.DecisionResolucion.INADMISIBLE); requirement.setFundamentos("Requerimiento sintético"); em.persist(requirement);
            AmpliacionPlazoSolicitud amp = new AmpliacionPlazoSolicitud(); amp.setSolicitud(s); amp.setMotivoAmpliacion("Motivo sintético");
            amp.setInformeAmpliacion("Informe sintético"); amp.setFechaNotificacionAmpliacion(LocalDate.now());
            amp.setFechaLimiteOriginal(s.getFechaLimite()); amp.setFechaLimiteAmpliada(s.getFechaLimite().plusDays(1)); em.persist(amp);
            CronogramaEntregaParcialSolicitud item = new CronogramaEntregaParcialSolicitud(); item.setAmpliacion(amp);
            item.setNumeroEntrega(1); item.setDescripcion("Entrega programada sintética"); item.setFechaProgramada(s.getFechaLimite()); em.persist(item);
            Solicitud unrelated = new Solicitud(); unrelated.setExpediente("SAIP-2098-%05d".formatted(ownerId));
            unrelated.setCiudadano(s.getCiudadano()); unrelated.setEntidad(s.getEntidad()); unrelated.setAsunto("Otro expediente"); unrelated.setDescripcion("Contexto separado");
            em.persist(unrelated); document(unrelated, null, "UNRELATED_DOCUMENT", new ArrayList<>());
        });
    }

    private Documento document(Solicitud request, Respuesta response, String name, List<Long> ids) {
        Documento d = new Documento(); d.setNombreOriginal(name + ".txt"); d.setStorageKey("private-storage-key/"+UUID.randomUUID());
        d.setContentType("text/plain"); d.setSizeBytes(7L); d.setSolicitud(request); d.setRespuesta(response);
        em.persist(d); em.flush(); ids.add(d.getId()); return d;
    }
    private Ciudadano citizen(String email, String hash) {
        Ciudadano c = new Ciudadano(); c.setEmail(email); c.setPassword(hash); c.setNombreCompleto("Persona Sintética");
        c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO); em.persist(c); em.flush(); return c;
    }
    private Entidad entity(String name, String acronym) {
        Entidad e = new Entidad(); e.setNombre(name); e.setAcronimo(acronym); em.persist(e); return e;
    }
    private Funcionario staff(String email, String hash, Entidad e) {
        Funcionario f = new Funcionario(); f.setEmail(email); f.setPassword(hash); f.setNombreCompleto("Operador Sintético");
        f.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO); f.setEntidad(e); em.persist(f); em.flush(); return f;
    }
    private void tx(Runnable action) { new TransactionTemplate(manager).executeWithoutResult(tx -> action.run()); }
    private Statistics statistics() { return emf.unwrap(SessionFactory.class).getStatistics(); }
    private void assertIds(JsonNode array, List<Long> expected) {
        List<Long> actual = new ArrayList<>(); for (JsonNode item : array) actual.add(item.path("id").asLong());
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected).doesNotHaveDuplicates();
    }
    private JsonNode detail(String token) throws Exception {
        HttpResponse<String> response = get("/api/solicitudes/"+id, token);
        assertThat(response.statusCode()).as("Authorized detail with OSIV disabled").isEqualTo(200);
        return json.readTree(response.body());
    }
    private String login(String email) throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/auth/login"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("identificador",email,"password",password))))
            .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        String token = json.readTree(response.body()).path("token").asString();
        if (token.isBlank()) throw new AssertionError("Real login must issue a token"); return token;
    }
    private HttpResponse<String> get(String path, String token) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path)).timeout(Duration.ofSeconds(30)).GET();
        if (token!=null) builder.header("Authorization", "Bearer "+token);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    private URI uri(String path) { return URI.create("http://127.0.0.1:"+port+path); }
    private static Path temporaryStorage() {
        try { return Files.createTempDirectory("yaiku-detail-storage-"); }
        catch (java.io.IOException e) { throw new IllegalStateException(e); }
    }
}
