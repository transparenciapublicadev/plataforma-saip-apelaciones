package pe.gob.saip.backend.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class ProductionConfigurationValidator {

    private static final String PROD_PROFILE = "prod";
    private static final String MODE_MOCK = "MOCK";
    private static final String MODE_SMTP = "SMTP";

    private final Environment environment;
    private final String notificationMode;
    private final String smtpHost;
    private final String mailFrom;
    private final boolean smtpAuth;
    private final String smtpUsername;
    private final String smtpPassword;

    public ProductionConfigurationValidator(
            Environment environment,
            @Value("${app.notifications.mode:MOCK}") String notificationMode,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${app.notifications.mail.from:}") String mailFrom,
            @Value("${spring.mail.properties.mail.smtp.auth:false}") boolean smtpAuth,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.password:}") String smtpPassword) {
        this.environment = environment;
        this.notificationMode = notificationMode;
        this.smtpHost = smtpHost;
        this.mailFrom = mailFrom;
        this.smtpAuth = smtpAuth;
        this.smtpUsername = smtpUsername;
        this.smtpPassword = smtpPassword;
    }

    @PostConstruct
    public void validate() {
        if (!isProductionProfile()) {
            return;
        }

        String normalizedMode = normalize(notificationMode);
        if (MODE_MOCK.equals(normalizedMode)) {
            throw new IllegalStateException(
                    "APP_NOTIFICATIONS_MODE=MOCK no está permitido con SPRING_PROFILES_ACTIVE=prod");
        }
        if (!MODE_SMTP.equals(normalizedMode)) {
            throw new IllegalStateException(
                    "APP_NOTIFICATIONS_MODE debe ser SMTP en producción hasta integrar un proveedor oficial adicional");
        }

        requireConfigured("SPRING_MAIL_HOST", smtpHost);
        requireConfigured("APP_NOTIFICATIONS_MAIL_FROM", mailFrom);
        if (smtpAuth) {
            requireConfigured("SPRING_MAIL_USERNAME", smtpUsername);
            requireConfigured("SPRING_MAIL_PASSWORD", smtpPassword);
        }
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(PROD_PROFILE::equalsIgnoreCase);
    }

    private static void requireConfigured(String variable, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(variable + " es obligatoria para SMTP en producción");
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
