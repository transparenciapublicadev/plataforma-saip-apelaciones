package pe.gob.saip.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import jakarta.persistence.EntityManagerFactory;
import pe.gob.saip.backend.model.entity.Usuario;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import pe.gob.saip.backend.SaipBackendApplication;

/** Replays the real authentication and committed-account tests on isolated PostgreSQL. */
@SpringBootTest(properties = {
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
@EnabledIfEnvironmentVariable(named = "RUN_R4_POSTGRES_TESTS", matches = "true")
class JwtAccountStatusPostgresIntegrationTest extends JwtAccountStatusIntegrationTest {
    @Autowired private Flyway flyway;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Environment environment;
    @Autowired private MockMvc mvc;
    @Autowired private EntityManagerFactory entityManagers;

    @DynamicPropertySource
    static void isolatedPostgres(DynamicPropertyRegistry registry) {
        String url = System.getenv("E11_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}")) {
            throw new IllegalArgumentException("An explicitly named disposable PostgreSQL database on loopback is required");
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> "yaiku_e11_test");
        registry.add("spring.datasource.password", () -> "");
    }

    @Test
    void validatesOriginalSchemaAndKeepsTheApiContractUnchanged() throws Exception {
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().applied()).hasSize(9);
        assertThat(jdbc.queryForObject("SELECT version()", String.class)).startsWith("PostgreSQL");
        var specification = mvc.perform(MockMvcRequestBuilders.get("/v3/api-docs")).andReturn();
        assertThat(specification.getResponse().getStatus()).isEqualTo(200);
        Files.writeString(Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"), "r4-openapi.json"),
                specification.getResponse().getContentAsString());
    }

    @Test
    void logoutSurvivesClosingAndRecreatingTheFullApplicationOnTheSameDatabase() throws Exception {
        String closing = login(owner);
        String continuing = login(owner);
        try (HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()) {
            try (var first = restartableApplication()) {
                var result = client.send(HttpRequest.newBuilder(appUri(first, "/api/auth/logout"))
                        .header("Authorization", "Bearer " + closing).POST(HttpRequest.BodyPublishers.noBody())
                        .timeout(Duration.ofSeconds(15)).build(), HttpResponse.BodyHandlers.discarding());
                assertThat(result.statusCode()).isEqualTo(204);
            }
            try (var recreated = restartableApplication()) {
                for (var entry : java.util.Map.of(closing, 401, continuing, 200).entrySet()) {
                    var result = client.send(HttpRequest.newBuilder(appUri(recreated, "/api/solicitudes/" + ownRequest.getId()))
                            .header("Authorization", "Bearer " + entry.getKey()).timeout(Duration.ofSeconds(15)).GET().build(),
                            HttpResponse.BodyHandlers.discarding());
                    assertThat(result.statusCode()).isEqualTo(entry.getValue());
                }
                var contract = client.send(HttpRequest.newBuilder(appUri(recreated, "/v3/api-docs")).GET()
                        .timeout(Duration.ofSeconds(30)).build(), HttpResponse.BodyHandlers.ofString());
                assertThat(contract.statusCode()).isEqualTo(200);
                Files.writeString(Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"), "logout-openapi-complete.json"), contract.body());
            }
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sesiones_jwt_revocadas WHERE id_usuario=? AND jti=?",
                Integer.class, owner.getId(), jwt.extraerSesion(closing).jti())).isEqualTo(1);
        assertThat(users.findById(owner.getId()).orElseThrow().getVersionAutenticacion()).isZero();
    }

    @Test
    void concurrentLoginsAndLogoutRequestsPreserveTheOtherIssuance() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var startLogins = new CountDownLatch(1);
            var a = executor.submit(() -> { await(startLogins); return login(owner); });
            var b = executor.submit(() -> { await(startLogins); return login(owner); });
            startLogins.countDown();
            String closing = a.get(30, TimeUnit.SECONDS);
            String continuing = b.get(30, TimeUnit.SECONDS);
            assertThat(jwt.extraerSesion(closing).jti()).isNotEqualTo(jwt.extraerSesion(continuing).jti());
            var startLogout = new CountDownLatch(1);
            java.util.concurrent.Callable<Integer> logout = () -> {
                await(startLogout);
                return mvc.perform(MockMvcRequestBuilders.post("/api/auth/logout")
                        .header("Authorization", "Bearer " + closing)).andReturn().getResponse().getStatus();
            };
            var first = executor.submit(logout);
            var second = executor.submit(logout);
            startLogout.countDown();
            assertThat(first.get(30, TimeUnit.SECONDS)).isIn(204, 401);
            assertThat(second.get(30, TimeUnit.SECONDS)).isIn(204, 401);
            access(ownRequest, closing, 401);
            access(ownRequest, continuing, 200);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM sesiones_jwt_revocadas WHERE id_usuario=? AND jti=?",
                    Integer.class, owner.getId(), jwt.extraerSesion(closing).jti())).isEqualTo(1);
        }
    }

    private ConfigurableApplicationContext restartableApplication() {
        return new SpringApplicationBuilder(SaipBackendApplication.class).run(
                "--server.address=127.0.0.1", "--server.port=0", "--spring.main.banner-mode=off",
                "--spring.datasource.url=" + System.getenv("E11_POSTGRES_URL"),
                "--spring.datasource.username=yaiku_e11_test", "--spring.datasource.password=",
                "--spring.datasource.driver-class-name=org.postgresql.Driver",
                "--spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
                "--spring.flyway.enabled=true", "--spring.flyway.clean-disabled=true",
                "--spring.flyway.locations=classpath:db/migration,classpath:db/seed",
                "--spring.jpa.hibernate.ddl-auto=validate", "--spring.sql.init.mode=never",
                "--jwt.secret=" + environment.getRequiredProperty("jwt.secret"),
                "--app.storage.provider=local", "--app.storage.local.base-path="
                        + Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"), "restart-storage"),
                "--app.notifications.mode=MOCK", "--app.notifications.push.enabled=false",
                "--springdoc.default-produces-media-type=application/json", "--springdoc.default-consumes-media-type=application/json");
    }

    private URI appUri(ConfigurableApplicationContext application, String path) {
        return URI.create("http://127.0.0.1:" + application.getEnvironment().getRequiredProperty("local.server.port") + path);
    }

    @Test
    void rollbackRestoresBothStateAndGeneration() throws Exception {
        String token = login(owner);
        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            userService.cambiarEstado(owner.getId(), false);
            assertThat(users.findById(owner.getId()).orElseThrow().getVersionAutenticacion()).isEqualTo(1L);
            throw new IllegalStateException("Synthetic rollback after deactivation");
        })).isInstanceOf(IllegalStateException.class);
        Usuario current = users.findById(owner.getId()).orElseThrow();
        assertThat(current.getActivo()).isTrue();
        assertThat(current.getVersionAutenticacion()).isZero();
        access(ownRequest, token, 200);
    }

    @Test
    void concurrentStaleProfileMergeCannotReactivateAccountOrRestoreItsGeneration() throws Exception {
        String token = login(owner);
        var loaded = new CountDownLatch(1);
        var write = new CountDownLatch(1);
        String changedEmail = "concurrent-" + UUID.randomUUID() + "@example.test";
        try (var executor = Executors.newSingleThreadExecutor()) {
            var profile = executor.submit(() -> {
                try (var entityManager = entityManagers.createEntityManager()) {
                    entityManager.getTransaction().begin();
                    try {
                        Usuario stale = entityManager.find(Usuario.class, owner.getId());
                        assertThat(stale.getVersionAutenticacion()).isZero();
                        entityManager.detach(stale);
                        loaded.countDown();
                        await(write);
                        stale.setEmail(changedEmail);
                        stale.setActivo(true);
                        ReflectionTestUtils.setField(stale, "versionAutenticacion", 0L);
                        entityManager.merge(stale);
                        entityManager.getTransaction().commit();
                    } finally {
                        if (entityManager.getTransaction().isActive()) {
                            entityManager.getTransaction().rollback();
                        }
                    }
                }
                return true;
            });
            try {
                await(loaded);
                setActive(owner, false);
            } finally {
                write.countDown();
            }
            assertThat(profile.get(15, TimeUnit.SECONDS)).isTrue();
        }
        Usuario current = users.findById(owner.getId()).orElseThrow();
        assertThat(current.getEmail()).isEqualTo(changedEmail);
        assertThat(current.getActivo()).isFalse();
        assertThat(current.getVersionAutenticacion()).isEqualTo(1L);
        access(ownRequest, token, 401);
        setActive(current, true);
        access(ownRequest, token, 401);
        access(ownRequest, login(users.findById(owner.getId()).orElseThrow()), 200);
    }

    @Test
    void concurrentDeactivationsUseIndependentConnectionsAndDoNotLoseInvalidation() throws Exception {
        String token = login(owner);
        var updated = new CountDownLatch(1);
        var commit = new CountDownLatch(1);
        var secondStarted = new CountDownLatch(1);
        var firstPid = new java.util.concurrent.atomic.AtomicInteger();
        var secondPid = new java.util.concurrent.atomic.AtomicInteger();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> new TransactionTemplate(transactionManager).execute(status -> {
                firstPid.set(jdbc.queryForObject("SELECT pg_backend_pid()", Integer.class));
                userService.cambiarEstado(owner.getId(), false);
                updated.countDown();
                await(commit);
                return true;
            }));
            try {
                await(updated);
                var second = executor.submit(() -> new TransactionTemplate(transactionManager).execute(status -> {
                    secondPid.set(jdbc.queryForObject("SELECT pg_backend_pid()", Integer.class));
                    secondStarted.countDown();
                    userService.cambiarEstado(owner.getId(), false);
                    return true;
                }));
                try {
                    await(secondStarted);
                    long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
                    boolean waiting = false;
                    while (System.nanoTime() < deadline) {
                        waiting = Boolean.TRUE.equals(jdbc.queryForObject(
                                "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = ? AND wait_event_type = 'Lock')",
                                Boolean.class, secondPid.get()));
                        if (waiting) break;
                        Thread.sleep(25);
                    }
                    assertThat(waiting).as("second transaction really waits on PostgreSQL row lock").isTrue();
                } finally {
                    commit.countDown();
                }
                assertThat(first.get(15, TimeUnit.SECONDS)).isTrue();
                assertThat(second.get(15, TimeUnit.SECONDS)).isTrue();
            } finally {
                commit.countDown();
            }
        }
        assertThat(firstPid.get()).isNotEqualTo(secondPid.get());
        Usuario current = users.findById(owner.getId()).orElseThrow();
        assertThat(current.getActivo()).isFalse();
        assertThat(current.getVersionAutenticacion()).isEqualTo(1L);
        setActive(current, true);
        access(ownRequest, token, 401);
        access(ownRequest, login(current), 200);
        Files.writeString(Path.of(System.getenv("E11_POSTGRES_ARTIFACTS"), "r4-concurrent-generations.txt"),
                "Independent PostgreSQL connections: " + firstPid.get() + ", " + secondPid.get()
                        + "; second waited on database lock; generation=1; previous JWT rejected after reactivation.");
    }

    private static void await(CountDownLatch latch) {
        try {
            assertThat(latch.await(10, TimeUnit.SECONDS)).as("bounded transaction coordination").isTrue();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interrupted);
        }
    }
}
