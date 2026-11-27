package pe.gob.saip.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;
import org.springframework.core.io.support.ResourcePropertySource;
import org.springframework.core.env.StandardEnvironment;
import pe.gob.saip.backend.security.JwtService;

/** Isolated configuration tests, without external providers, database or production credentials. */
class StagingConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(context -> {
                context.getEnvironment().getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
                context.getEnvironment().getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
                context.getEnvironment().setActiveProfiles("staging");
                try {
                    // Staging overrides the local file. JWT remains in application.properties.
                    context.getEnvironment().getPropertySources().addLast(
                            new ResourcePropertySource("classpath:application-staging.properties"));
                    context.getEnvironment().getPropertySources().addLast(
                            new ResourcePropertySource("classpath:application.properties"));
                } catch (IOException exception) { throw new IllegalStateException(exception); }
            }).withUserConfiguration(JwtOnly.class);

    private static final String LOCAL_DEVELOPMENT_KEY =
            "saip-plataforma-jwt-secret-key-for-development-only-at-least-256-bits-long";

    @Test
    void stagingKeepsTheLocalDevelopmentKeyWhenNoSecretIsProvided() throws IOException {
        String staging = Files.readString(Path.of("src/main/resources/application-staging.properties"));
        String local = Files.readString(Path.of("src/main/resources/application.properties"));
        String production = Files.readString(Path.of("src/main/resources/application-prod.properties"));
        assertThat(staging).doesNotContain("jwt.secret=");
        assertThat(local).contains("jwt.secret=${JWT_SECRET:" + LOCAL_DEVELOPMENT_KEY + "}");
        assertThat(production).doesNotContain("jwt.secret=");
        runner.run(context -> {
            assertThat(context.getStartupFailure()).isNull();
            JwtService jwt = context.getBean(JwtService.class);
            assertThat(jwt.extractUsuarioId(jwt.generateToken(73L, "CIUDADANO", 4L))).isEqualTo(73L);
        });
    }

    @Test
    void stagingAcceptsAnExplicitKeyAndKeepsStableIdentityAndSessionClaims() {
        String secret = UUID.randomUUID().toString() + UUID.randomUUID();
        runner.withPropertyValues("JWT_SECRET=" + secret).run(context -> {
            assertThat(context.getStartupFailure()).isNull();
            JwtService jwt = context.getBean(JwtService.class);
            String token = jwt.generateToken(73L, "CIUDADANO", 4L);
            assertThat(jwt.extractUsuarioId(token)).isEqualTo(73L);
            assertThat(jwt.extractVersionAutenticacion(token)).isEqualTo(4L);
            assertThat(jwt.extraerSesion(token).jti()).isNotBlank();
        });
    }

    @Test
    void stagingResolvesTheLocalSeedAlreadyAppliedToTheDevelopmentDatabase() throws IOException {
        String production = Files.readString(Path.of("src/main/resources/application-prod.properties"));
        assertThat(production).contains("spring.flyway.locations=classpath:db/migration");
        assertThat(production).doesNotContain("classpath:db/seed");
        runner.withPropertyValues("JWT_SECRET=" + UUID.randomUUID() + UUID.randomUUID()).run(context -> {
            assertThat(context.getStartupFailure()).isNull();
            assertThat(context.getEnvironment().getProperty("spring.flyway.locations"))
                    .isEqualTo("classpath:db/migration,classpath:db/seed");
            assertThat(context.getEnvironment().getProperty("spring.jpa.open-in-view")).isEqualTo("false");
        });
    }

    @Configuration(proxyBeanMethods = false)
    static class JwtOnly {
        @Bean static PropertySourcesPlaceholderConfigurer placeholders() { return new PropertySourcesPlaceholderConfigurer(); }
        @Bean JwtService jwtService() { return new JwtService(); }
    }
}
