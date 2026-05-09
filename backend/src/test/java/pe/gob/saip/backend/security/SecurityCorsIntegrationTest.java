package pe.gob.saip.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SecurityCorsIntegrationTest {

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Test
    void cors_shouldAllowFrontendOrigin() {
        CorsConfiguration cors = getCorsForOrigin("http://127.0.0.1:4200");

        assertThat(cors).isNotNull();
        assertThat(cors.checkOrigin("http://127.0.0.1:4200")).isEqualTo("http://127.0.0.1:4200");
        assertThat(cors.getAllowedMethods()).contains("GET", "OPTIONS");
    }

    @Test
    void cors_shouldAllowPostmanWebOrigin() {
        CorsConfiguration cors = getCorsForOrigin("https://web.postman.co");

        assertThat(cors).isNotNull();
        assertThat(cors.checkOrigin("https://web.postman.co")).isEqualTo("https://web.postman.co");
    }

    @Test
    void cors_shouldRejectUnknownOrigin() {
        CorsConfiguration cors = getCorsForOrigin("http://malicious.example");

        assertThat(cors).isNotNull();
        assertThat(cors.checkOrigin("http://malicious.example")).isNull();
    }

    private CorsConfiguration getCorsForOrigin(String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/solicitudes");
        request.addHeader(HttpHeaders.ORIGIN, origin);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET");
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type");
        return corsConfigurationSource.getCorsConfiguration(request);
    }
}
