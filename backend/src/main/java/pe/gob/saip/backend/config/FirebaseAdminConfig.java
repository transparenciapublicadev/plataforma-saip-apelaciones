package pe.gob.saip.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseAdminConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAdminConfig.class);

    @Value("${app.notifications.push.firebase.credentials-json:}")
    private String credentialsJson;

    @Value("${app.notifications.push.enabled:false}")
    private boolean pushEnabled;

    @Bean
    public FirebaseApp firebaseApp() {
        if (!pushEnabled) {
            log.info("Push notifications are disabled. FirebaseApp will not be initialized.");
            return null;
        }

        if (credentialsJson == null || credentialsJson.isBlank() || "{}".equals(credentialsJson.trim())) {
            log.warn("FIREBASE_CREDENTIALS_JSON is missing, empty, or empty JSON. Push engine will operate in mock mode (mock/simulated). FirebaseApp will not be initialized.");
            return null;
        }

        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                log.info("FirebaseApp is already initialized.");
                return FirebaseApp.getInstance();
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(
                            new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8))))
                    .build();

            log.info("Initializing FirebaseApp safely in memory.");
            return FirebaseApp.initializeApp(options);
        } catch (Exception e) {
            log.error("Failed to initialize FirebaseApp dynamically in memory: {}", e.getMessage(), e);
            // Return null instead of throwing to avoid breaking context startup in local dev
            return null;
        }
    }
}
