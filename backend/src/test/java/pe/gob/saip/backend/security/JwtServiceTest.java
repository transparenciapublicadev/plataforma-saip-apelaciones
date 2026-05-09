package pe.gob.saip.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    @Test
    void generateToken_shouldRotateTokenOnRelogin() {
        JwtService jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", "this-is-a-long-test-secret-key-for-jwt-validation-2026");
        ReflectionTestUtils.setField(jwtService, "expirationMs", 86_400_000L);

        String firstToken = jwtService.generateToken("admin@saip.gob.pe", "ADMIN", 1L);
        String secondToken = jwtService.generateToken("admin@saip.gob.pe", "ADMIN", 1L);

        assertNotEquals(firstToken, secondToken, "Cada login debe generar un JWT distinto");
        assertTrue(jwtService.isTokenValid(firstToken));
        assertTrue(jwtService.isTokenValid(secondToken));
    }
}
