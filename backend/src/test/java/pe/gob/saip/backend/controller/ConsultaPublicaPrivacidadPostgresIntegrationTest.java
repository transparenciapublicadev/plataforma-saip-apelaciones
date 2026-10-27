package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.CiudadanoRepository;
import pe.gob.saip.backend.repository.EntidadRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Real HTTP, login/JWT, JPA and PostgreSQL; only external notifications use MOCK. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1",
        "spring.flyway.enabled=true", "spring.flyway.clean-disabled=true",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
        "springdoc.default-produces-media-type=application/json",
        "springdoc.default-consumes-media-type=application/json",
        "app.storage.provider=local", "app.notifications.mode=MOCK",
        "app.notifications.push.enabled=false"
})
@EnabledIfEnvironmentVariable(named = "RUN_PUBLICA_PRIVACY_POSTGRES_TESTS", matches = "true")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ConsultaPublicaPrivacidadPostgresIntegrationTest {
    private static final Path LOCAL = crearTemporal();
    private static final String TEST_KEY = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final List<String> PUBLIC_FIELDS = List.of("expediente", "ciudadano", "entidad",
            "fechaPresentacion", "fechaLimite", "diasTranscurridos", "diasRestantes", "estado",
            "respuestaFecha", "respuestaTipo", "apelacionExpediente", "apelacionEstado", "apelacionFecha",
            "resolucionFecha", "resolucionResultado");

    @Autowired private CiudadanoRepository ciudadanos;
    @Autowired private EntidadRepository entidades;
    @Autowired private FuncionarioRepository funcionarios;
    @Autowired private SolicitudRepository solicitudes;
    @Autowired private PasswordEncoder encoder;
    @Autowired private PlatformTransactionManager manager;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Flyway flyway;
    @Autowired private Environment environment;
    @LocalServerPort private int port;

    private HttpClient client;
    private long solicitudId;
    private String expediente;
    private String password;
    private String emailTitular;
    private String emailAjeno;
    private String emailFuncionario;
    private String emailOtraEntidad;
    private String marker;

    @DynamicPropertySource
    static void isolatedPostgres(DynamicPropertyRegistry registry) {
        String url = System.getenv("E11_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}")) {
            throw new IllegalArgumentException("An explicitly named disposable PostgreSQL database on loopback is required");
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> "yaiku_e11_test");
        registry.add("spring.datasource.password", () -> "");
        registry.add("app.storage.local.base-path", LOCAL::toString);
        registry.add("jwt.secret", () -> TEST_KEY);
    }

    @BeforeEach
    void persistSyntheticFixtureInACommittedTransaction() {
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        String suffix = UUID.randomUUID().toString();
        password = UUID.randomUUID().toString();
        marker = "MARCADOR_PERSONAL_SINTETICO_" + suffix;
        emailTitular = "titular-" + suffix + "@example.invalid";
        emailAjeno = "ajeno-" + suffix + "@example.invalid";
        emailFuncionario = "operador-" + suffix + "@example.invalid";
        emailOtraEntidad = "otra-entidad-" + suffix + "@example.invalid";
        String hash = encoder.encode(password);
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            Ciudadano titular = ciudadano(emailTitular, hash);
            ciudadano(emailAjeno, hash);
            // A committed database identity gives each run a distinct synthetic resource.
            expediente = "SAIP-2099-%05d".formatted(titular.getIdUsuario());
            Entidad entidad = entidad("Entidad sintética de privacidad", "PRIV-" + suffix.substring(0, 8));
            Entidad otra = entidad("Otra entidad sintética de privacidad", "AJEN-" + suffix.substring(0, 8));
            funcionario(emailFuncionario, hash, entidad);
            funcionario(emailOtraEntidad, hash, otra);
            Solicitud solicitud = new Solicitud();
            solicitud.setExpediente(expediente);
            solicitud.setAsunto(marker);
            solicitud.setDescripcion("DESCRIPCION_PRIVADA_" + marker);
            solicitud.setCiudadano(titular);
            solicitud.setEntidad(entidad);
            solicitud.setEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);
            solicitud.setConsentimientoDatosPersonales(true);
            solicitud.setCanalNotificacion(Solicitud.CanalNotificacion.PLATAFORMA);
            solicitud.setFormatoDigital(true);
            solicitudId = solicitudes.saveAndFlush(solicitud).getId();
        });
    }

    @AfterEach
    void closeClient() { client.close(); }

    @Test
    void fullContextValidatesOriginalFlywayHistoryAndExportsLiveContract() throws Exception {
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("app.notifications.mode")).isEqualTo("MOCK");
        assertThat(environment.getProperty("app.notifications.push.enabled")).isEqualTo("false");
        assertThat(environment.getProperty("app.storage.provider")).isEqualTo("local");
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().applied()).isNotEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE NOT success", Integer.class)).isZero();
        evidence("flyway-history.json", json.writeValueAsString(jdbc.queryForList(
                "SELECT version, script, checksum, success FROM flyway_schema_history ORDER BY installed_rank")));
        HttpResponse<String> specification = get("/v3/api-docs", null);
        assertThat(specification.statusCode()).isEqualTo(200);
        evidence("openapi-live.json", specification.body());
        JsonNode operation = json.readTree(specification.body()).path("paths")
                .path("/api/solicitudes/publica/expediente/{expediente}").path("get");
        assertThat(operation.has("security")).isTrue();
        assertThat(operation.path("security").isArray()).isTrue();
        assertThat(operation.path("security").size()).isZero();
        assertThat(json.readTree(specification.body()).path("components").path("schemas")
                .path("ConsultaPublicaSolicitudDTO").path("properties").has("asunto")).isFalse();
    }

    @Test
    void anonymousHttpBodyOmitsFreeTextAndPrivateDetailsButRetainsPublicTracking() throws Exception {
        HttpResponse<String> response = get(publicPath(expediente), null);
        assertThat(response.statusCode()).isEqualTo(200);
        evidence("anonymous-public-body.json", response.body());
        assertPublicBody(response.body());
    }

    @Test
    void authenticatedPublicProjectionIsTheSameForOwnerAndUnrelatedAccount() throws Exception {
        HttpResponse<String> anonymous = get(publicPath(expediente), null);
        HttpResponse<String> owner = get(publicPath(expediente), login(emailTitular));
        HttpResponse<String> unrelated = get(publicPath(expediente), login(emailAjeno));
        assertThat(anonymous.statusCode()).isEqualTo(200);
        assertThat(owner.statusCode()).isEqualTo(200);
        assertThat(unrelated.statusCode()).isEqualTo(200);
        evidence("authenticated-public-body.json", owner.body());
        assertThat(json.readTree(owner.body())).isEqualTo(json.readTree(anonymous.body()));
        assertThat(json.readTree(unrelated.body())).isEqualTo(json.readTree(anonymous.body()));
        assertPublicBody(owner.body());
    }

    @Test
    void privateReadKeepsCompleteSubjectAndDescriptionOnlyForAuthorizedActors() throws Exception {
        String path = "/api/solicitudes/" + solicitudId;
        for (String email : List.of(emailTitular, emailFuncionario)) {
            HttpResponse<String> response = get(path, login(email));
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode body = json.readTree(response.body());
            assertThat(body.path("asunto").asString()).isEqualTo(marker);
            assertThat(body.path("descripcion").asString()).isEqualTo("DESCRIPCION_PRIVADA_" + marker);
        }
        HttpResponse<String> anonymous = get(path, null);
        assertThat(anonymous.statusCode()).isEqualTo(401);
        assertThat(anonymous.body()).doesNotContain(marker);
        for (String email : List.of(emailAjeno, emailOtraEntidad)) {
            HttpResponse<String> rejected = get(path, login(email));
            assertThat(rejected.statusCode()).isEqualTo(403);
            assertThat(rejected.body()).doesNotContain(marker);
        }
        assertThat(jdbc.queryForObject("SELECT asunto FROM solicitudes WHERE id_solicitud=?", String.class, solicitudId)).isEqualTo(marker);
    }

    @ParameterizedTest
    @ValueSource(strings = {"SAIP-2098-00000", "SAIP-2099-incorrecto", "00145-2099-JUS-TTAIP"})
    void incorrectOrMissingPublicCodesDoNotReturnTheSyntheticResource(String code) throws Exception {
        HttpResponse<String> response = get(publicPath(code), null);
        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.body()).doesNotContain(marker);
        assertThat(json.readTree(response.body()).has("asunto")).isFalse();
    }

    private void assertPublicBody(String text) throws Exception {
        JsonNode body = json.readTree(text);
        assertThat(body.has("asunto")).as("A public status lookup must not expose the free-text subject").isFalse();
        assertThat(text).doesNotContain(marker);
        for (String field : List.of("descripcion", "documentos", "documentosMetadata", "fundamentos", "dni", "email", "ciudadanoId", "id")) {
            assertThat(body.has(field)).as("Private field: %s", field).isFalse();
        }
        assertThat(body.size()).isEqualTo(PUBLIC_FIELDS.size());
        for (String field : PUBLIC_FIELDS) assertThat(body.has(field)).as("Public field: %s", field).isTrue();
        assertThat(body.path("expediente").asString()).isEqualTo(expediente);
        assertThat(body.path("estado").asString()).isEqualTo("EN_PROCESO");
        assertThat(body.path("entidad").asString()).isEqualTo("Entidad sintética de privacidad");
        assertThat(body.path("ciudadano").asString()).isEqualTo("P*** S***");
        assertThat(body.path("fechaPresentacion").asString()).isNotBlank();
        assertThat(body.path("diasTranscurridos").isIntegralNumber()).isTrue();
    }

    private String login(String email) throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/auth/login"))
                .timeout(Duration.ofSeconds(30)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("identificador", email, "password", password))))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("Real login status").isEqualTo(200);
        String token = json.readTree(response.body()).path("token").asString();
        if (token.isBlank()) throw new AssertionError("A successful login must issue a token");
        return token;
    }

    private HttpResponse<String> get(String path, String token) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).timeout(Duration.ofSeconds(30)).GET();
        if (token != null) request.header("Authorization", "Bearer " + token);
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) { return URI.create("http://127.0.0.1:" + port + path); }
    private String publicPath(String code) { return "/api/solicitudes/publica/expediente/" + code; }
    private void evidence(String name, String text) throws IOException {
        String directory = System.getenv("PUBLICA_PRIVACY_ARTIFACTS");
        if (directory != null) Files.writeString(Path.of(directory).resolve(name), text);
    }
    private static Path crearTemporal() {
        try { return Files.createTempDirectory("yaiku-public-privacy-local-"); }
        catch (IOException e) { throw new IllegalStateException(e); }
    }
    private Ciudadano ciudadano(String email, String hash) {
        Ciudadano c = new Ciudadano(); c.setEmail(email); c.setNombreCompleto("Persona Sintética");
        c.setPassword(hash); c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO); return ciudadanos.saveAndFlush(c);
    }
    private Entidad entidad(String nombre, String acronimo) {
        Entidad e = new Entidad(); e.setNombre(nombre); e.setAcronimo(acronimo); return entidades.saveAndFlush(e);
    }
    private void funcionario(String email, String hash, Entidad entidad) {
        Funcionario f = new Funcionario(); f.setEmail(email); f.setNombreCompleto("Operador Sintético");
        f.setPassword(hash); f.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO); f.setEntidad(entidad); funcionarios.saveAndFlush(f);
    }
}
