package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import pe.gob.saip.backend.model.dto.SystemConfigDTO;
import pe.gob.saip.backend.model.dto.TarifasConfigDTO;
import pe.gob.saip.backend.model.entity.Administrador;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.ConfiguracionSistemaRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.security.JwtService;
import pe.gob.saip.backend.service.ConfiguracionSistemaService;
import tools.jackson.databind.json.JsonMapper;

/**
 * Full Spring/Tomcat context with original Flyway migrations and schema validation
 * on an explicitly named disposable PostgreSQL database. JPA, HTTP and LOCAL are
 * real; notifications are isolated in MOCK mode and push is disabled.
 */
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
@EnabledIfEnvironmentVariable(named = "RUN_CONFIG_POSTGRES_TESTS", matches = "true")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ConfiguracionSistemaPostgresIntegrationTest {
    private static final Path STORAGE = createStorage();

    @Autowired private ConfiguracionSistemaRepository configurations;
    @Autowired private ConfiguracionSistemaService service;
    @Autowired private UsuarioRepository users;
    @Autowired private JwtService jwt;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Flyway flyway;
    @Autowired private Environment environment;
    @Autowired private PlatformTransactionManager transactionManager;
    @LocalServerPort private int port;

    private HttpClient client;
    private TransactionTemplate transactions;
    private String token;

    @DynamicPropertySource
    static void isolatedPostgres(DynamicPropertyRegistry registry) {
        String url = System.getenv("E11_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}")) {
            throw new IllegalArgumentException("An explicitly named isolated database on loopback is required");
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> "yaiku_e11_test");
        registry.add("spring.datasource.password", () -> "");
        registry.add("app.storage.local.base-path", STORAGE::toString);
    }

    @BeforeEach
    void prepareSyntheticConfigurationAndAdministrator() {
        transactions = new TransactionTemplate(transactionManager);
        configurations.saveAndFlush(new ConfiguracionSistema());
        Administrador admin = new Administrador();
        admin.setEmail("config-" + UUID.randomUUID() + "@example.test");
        admin.setPassword("not-used-by-jwt-test");
        admin.setTipoUsuario(Usuario.TipoUsuario.ADMINISTRADOR);
        admin.setNombreCompleto("Administrador sintético de configuración");
        admin = users.saveAndFlush(admin);
        token = jwt.generateToken(admin.getIdUsuario(), admin.getTipoUsuario().name(), admin.getVersionAutenticacion());
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @AfterEach
    void closeHttpClient() {
        client.close();
    }

    @Test
    void fullContextStartsWithValidateAndOriginalFlywayNumericDefinition() throws Exception {
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.flyway.enabled")).isEqualTo("true");
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().applied()).hasSize(11);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class)).isEqualTo(11);
        var column = jdbc.queryForMap("""
                SELECT data_type, numeric_precision, numeric_scale
                FROM information_schema.columns WHERE table_schema='public'
                AND table_name='configuracion_sistema' AND column_name='costo_por_copia'
                """);
        assertThat(column.get("data_type")).isEqualTo("numeric");
        assertThat(((Number) column.get("numeric_precision")).intValue()).isEqualTo(10);
        assertThat(((Number) column.get("numeric_scale")).intValue()).isEqualTo(2);
        Path artifacts = Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"));
        Files.writeString(artifacts.resolve("config-flyway-history.txt"),
                jdbc.queryForList("SELECT version, script, checksum, success FROM flyway_schema_history ORDER BY installed_rank").toString());
        HttpResponse<String> specification = client.send(HttpRequest.newBuilder(uri("/v3/api-docs"))
                .timeout(Duration.ofSeconds(30)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(specification.statusCode()).isEqualTo(200);
        Files.writeString(artifacts.resolve("config-openapi-after.json"), specification.body());
    }

    @Test
    void decimalPersistsExactlyAndIsReadInSeparateCommittedTransactions() {
        for (String value : new String[]{"0.10", "0.29", "12345678.91", "99999999.99"}) {
            BigDecimal amount = new BigDecimal(value);
            transactions.executeWithoutResult(status -> {
                ConfiguracionSistema config = configurations.findById(1L).orElseThrow();
                config.setCostoPorCopia(amount);
                configurations.saveAndFlush(config);
            });
            BigDecimal reloaded = transactions.execute(status -> configurations.findById(1L).orElseThrow().getCostoPorCopia());
            assertThat(reloaded).isEqualTo(amount);
            assertThat(reloaded.scale()).isEqualTo(2);
            assertThat(jdbc.queryForObject("SELECT costo_por_copia FROM configuracion_sistema WHERE id=1", BigDecimal.class))
                    .isEqualTo(amount);
        }
    }

    @Test
    void initializationStillPersistsTheExactOriginalDefault() {
        transactions.executeWithoutResult(status -> {
            configurations.deleteById(1L);
            configurations.flush();
            service.inicializarConfiguracionPorDefecto();
        });
        assertThat(service.obtenerConfiguracion().getCostoPorCopia()).isEqualTo(new BigDecimal("0.10"));
    }

    @Test
    void realHttpJsonKeepsNumericAmountAndOtherConfigurationValuesAfterPutAndReload() throws Exception {
        SystemConfigDTO original = SystemConfigDTO.from(service.obtenerConfiguracion());
        SystemConfigDTO update = new SystemConfigDTO(original.plazos(), original.notif(), new TarifasConfigDTO(new BigDecimal("0.29")));
        var saved = request("PUT", json.writeValueAsString(update));
        assertThat(saved.statusCode()).isEqualTo(200);
        assertThat(saved.body()).contains("\"costoPorCopia\":0.29");
        assertThat(json.readTree(saved.body()).path("tarifas").path("costoPorCopia").isNumber()).isTrue();
        var loaded = request("GET", null);
        assertThat(loaded.statusCode()).isEqualTo(200);
        SystemConfigDTO result = json.readValue(loaded.body(), SystemConfigDTO.class);
        assertThat(result.tarifas().costoPorCopia()).isEqualTo(new BigDecimal("0.29"));
        assertThat(result.plazos()).isEqualTo(original.plazos());
        assertThat(result.notif()).isEqualTo(original.notif());
        assertThat(service.obtenerConfiguracion().getCostoPorCopia()).isEqualTo(new BigDecimal("0.29"));
    }

    @Test
    void realHttpRetainsRequiredAndNonnegativeValidationWithoutChangingStoredAmount() throws Exception {
        SystemConfigDTO original = SystemConfigDTO.from(service.obtenerConfiguracion());
        for (BigDecimal invalid : new BigDecimal[]{null, new BigDecimal("-0.01")}) {
            var response = request("PUT", json.writeValueAsString(
                    new SystemConfigDTO(original.plazos(), original.notif(), new TarifasConfigDTO(invalid))));
            assertThat(response.statusCode()).isEqualTo(400);
            assertThat(service.obtenerConfiguracion().getCostoPorCopia()).isEqualTo(new BigDecimal("0.10"));
        }
    }

    private HttpResponse<String> request(String method, String body) throws Exception {
        var request = HttpRequest.newBuilder(uri("/api/configuracion")).timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + token).header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }

    private static Path createStorage() {
        try {
            return Files.createTempDirectory("yaiku-config-decimal-");
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot create isolated LOCAL storage", exception);
        }
    }

    @AfterAll
    static void removeStorage() throws IOException {
        try (var paths = Files.walk(STORAGE)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }
}
