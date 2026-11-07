package pe.gob.saip.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
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
                    context.getEnvironment().getPropertySources().addLast(
                            new ResourcePropertySource("classpath:application-staging.properties"));
                } catch (IOException exception) { throw new IllegalStateException(exception); }
            }).withUserConfiguration(JwtOnly.class);

    @Test
    void stagingCannotStartJwtWithoutAnExplicitSecret() {
        runner.run(context -> assertThat(context.getStartupFailure() != null)
                .as("Staging must fail closed instead of choosing a shared development key").isTrue());
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
    void stagingOnlySelectsOriginalMigrationsAndNeverDevelopmentSeed() {
        runner.withPropertyValues("JWT_SECRET=" + UUID.randomUUID() + UUID.randomUUID()).run(context -> {
            assertThat(context.getStartupFailure()).isNull();
            assertThat(context.getEnvironment().getProperty("spring.flyway.locations"))
                    .isEqualTo("classpath:db/migration");
            assertThat(context.getEnvironment().getProperty("spring.jpa.open-in-view")).isEqualTo("false");
        });
    }

    @Configuration(proxyBeanMethods = false)
    static class JwtOnly {
        @Bean static PropertySourcesPlaceholderConfigurer placeholders() { return new PropertySourcesPlaceholderConfigurer(); }
        @Bean JwtService jwtService() { return new JwtService(); }
    }
}
