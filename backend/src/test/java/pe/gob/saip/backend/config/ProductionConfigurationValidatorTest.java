package pe.gob.saip.backend.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionConfigurationValidatorTest {

    @Test
    void validateAllowsMockOutsideProduction() {
        ProductionConfigurationValidator validator = validator(
                new MockEnvironment().withProperty("spring.profiles.active", "dev"),
                "MOCK",
                "",
                "",
                false,
                "",
                "");

        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    @Test
    void validateRejectsMockInProduction() {
        ProductionConfigurationValidator validator = validator(
                prodEnvironment(),
                "MOCK",
                "smtp.example.test",
                "no-reply@example.test",
                true,
                "mailer",
                "secret");

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_NOTIFICATIONS_MODE=MOCK");
    }

    @Test
    void validateRejectsIncompleteSmtpInProduction() {
        ProductionConfigurationValidator validator = validator(
                prodEnvironment(),
                "SMTP",
                "",
                "no-reply@example.test",
                false,
                "",
                "");

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_MAIL_HOST");
    }

    @Test
    void validateAllowsCompleteSmtpInProduction() {
        ProductionConfigurationValidator validator = validator(
                prodEnvironment(),
                "SMTP",
                "smtp.example.test",
                "no-reply@example.test",
                true,
                "mailer",
                "secret");

        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    private MockEnvironment prodEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        return environment;
    }

    private ProductionConfigurationValidator validator(
            MockEnvironment environment,
            String mode,
            String smtpHost,
            String mailFrom,
            boolean smtpAuth,
            String smtpUsername,
            String smtpPassword) {
        return new ProductionConfigurationValidator(
                environment,
                mode,
                smtpHost,
                mailFrom,
                smtpAuth,
                smtpUsername,
                smtpPassword);
    }
}
