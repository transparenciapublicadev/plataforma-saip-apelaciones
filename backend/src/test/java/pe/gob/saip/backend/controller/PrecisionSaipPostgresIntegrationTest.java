package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.security.JwtService;

/**
 * Opt-in replay of the E1.1 suite on an explicitly named disposable PostgreSQL
 * database. Flyway applies the original migrations and local seed; Hibernate
 * validates the complete schema without performing DDL. E1.1 schema constraints
 * are also checked explicitly, and its mappings exercised through JPA.
 * LOCAL storage is real. Notification adapters remain in MOCK mode.
 * The inherited repository spy injects one failure; this suite also causes a real
 * PostgreSQL failure after upload. No database or storage adapter is mocked.
 */
@EnabledIfEnvironmentVariable(named = "RUN_E11_POSTGRES_TESTS", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1",
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "spring.flyway.clean-disabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
        "springdoc.default-produces-media-type=application/json",
        "springdoc.default-consumes-media-type=application/json",
        "app.storage.provider=local",
        "app.notifications.mode=MOCK",
        "app.notifications.push.enabled=false"
})
class PrecisionSaipPostgresIntegrationTest extends PrecisionSaipIntegrationTest {
    private final Set<Integer> backendPids = ConcurrentHashMap.newKeySet();
    private final Set<Long> transactionIds = ConcurrentHashMap.newKeySet();
    private final CountDownLatch databaseTransactionsReady = new CountDownLatch(2);

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private Flyway flyway;
    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwt;
    @Autowired private StorageProperties storage;
    @LocalServerPort private int port;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        String url = System.getenv("E11_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}")) {
            throw new IllegalArgumentException("Use only the explicitly named isolated E1.1 database on loopback");
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> "yaiku_e11_test");
        registry.add("spring.datasource.password", () -> "");
    }

    @BeforeAll
    static void clearSyntheticSeed(@Autowired JdbcTemplate jdbc) {
        // Flyway has already migrated this guarded disposable DB.
        // Remove the original local seed so the inherited fixtures own their data.
        jdbc.execute("TRUNCATE TABLE usuarios, entidades RESTART IDENTITY CASCADE");
    }

    @Test
    void flywayAppliedOriginalMigrationsAndExportsCompleteContractOverHttp() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(Arrays.stream(flyway.info().applied()).map(migration -> migration.getVersion().toString()))
                .containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class))
                .isEqualTo(16);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE checksum IS NULL", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT version()", String.class)).startsWith("PostgreSQL");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_constraint WHERE conrelid = 'recepciones_precision_saip'::regclass AND contype IN ('p','u','f')", Integer.class))
                .isEqualTo(7);
        Path output = Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"));
        Files.createDirectories(output);
        Files.writeString(output.resolve("flyway-history.txt"),
                jdbc.queryForList("SELECT installed_rank, version, script, checksum, success FROM flyway_schema_history ORDER BY installed_rank").toString());
        try (HttpClient client = HttpClient.newHttpClient()) {
            var response = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v3/api-docs")).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            assertThat(response.statusCode()).isEqualTo(200);
            Files.writeString(output.resolve("openapi-postgres-complete.json"), response.body());
        }
    }

    @Override
    @Test
    void concurrentRetryProducesOneCommittedReceptionAndOneFile() throws Exception {
        super.concurrentRetryProducesOneCommittedReceptionAndOneFile();
        assertThat(backendPids).hasSize(2);
        assertThat(transactionIds).hasSize(2);
        Files.writeString(Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"), "concurrent-transactions.txt"),
                "Independent PostgreSQL backend PIDs=" + backendPids + "; transaction IDs=" + transactionIds);
    }

    @Override
    protected MvcResult sendConcurrent(String key, String comment, byte[] bytes, String token) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return transaction.execute(status -> {
            backendPids.add(jdbc.queryForObject("SELECT pg_backend_pid()", Integer.class));
            transactionIds.add(jdbc.queryForObject("SELECT txid_current()", Long.class));
            databaseTransactionsReady.countDown();
            try {
                assertThat(databaseTransactionsReady.await(10, TimeUnit.SECONDS)).isTrue();
                return super.sendConcurrent(key, comment, bytes, token);
            } catch (Exception exception) {
                throw new IllegalStateException("Concurrent HTTP precision failed", exception);
            }
        });
    }

    @Test
    void postgresFailureAfterUploadRollsBackAndCompensatesBeforeIdenticalRetry() throws Exception {
        var fixture = jdbc.queryForMap("""
                SELECT o.id_solicitud, o.id_observacion, u.id_usuario, u.email, u.version_autenticacion
                FROM observaciones_solicitud o JOIN solicitudes s USING (id_solicitud)
                JOIN usuarios u ON u.id_usuario = s.id_ciudadano
                """);
        String url = "/api/solicitudes/" + fixture.get("id_solicitud") + "/observaciones/"
                + fixture.get("id_observacion") + "/precision";
        String key = UUID.randomUUID().toString();
        String token = "Bearer " + jwt.generateToken(((Number) fixture.get("id_usuario")).longValue(), "CIUDADANO",
                ((Number) fixture.get("version_autenticacion")).longValue());
        byte[] bytes = "%PDF-1.4\nPostgreSQL rollback\n%%EOF".getBytes(StandardCharsets.UTF_8);
        jdbc.execute("""
                CREATE FUNCTION e11_reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'E11 synthetic receipt failure' USING ERRCODE = '23514'; END $$
                """);
        jdbc.execute("CREATE TRIGGER e11_reject_receipt BEFORE INSERT ON recepciones_precision_saip FOR EACH ROW EXECUTE FUNCTION e11_reject_receipt()");
        try {
            mvc.perform(multipart(url).file(new MockMultipartFile("archivo", "precision.pdf", "application/pdf", bytes))
                            .param("comentario", "Prueba de rollback real").param("claveOperacion", key)
                            .header(HttpHeaders.AUTHORIZATION, token))
                    .andExpect(status().isConflict());
            assertThat(jdbc.queryForObject("SELECT count(*) FROM recepciones_precision_saip", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM documentos", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT estado FROM observaciones_solicitud", String.class)).isEqualTo("PENDIENTE_SUBSANACION");
            assertThat(jdbc.queryForObject("SELECT estado FROM solicitudes", String.class)).isEqualTo("PENDIENTE_INFORMACION");
            try (var files = Files.walk(Path.of(storage.getLocal().getBasePath()))) {
                assertThat(files.filter(Files::isRegularFile).count()).isZero();
            }
        } finally {
            jdbc.execute("DROP TRIGGER e11_reject_receipt ON recepciones_precision_saip");
            jdbc.execute("DROP FUNCTION e11_reject_receipt()");
        }
        mvc.perform(multipart(url).file(new MockMultipartFile("archivo", "precision.pdf", "application/pdf", bytes))
                        .param("comentario", "Prueba de rollback real").param("claveOperacion", key)
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM recepciones_precision_saip", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM documentos", Integer.class)).isEqualTo(1);
    }
}
