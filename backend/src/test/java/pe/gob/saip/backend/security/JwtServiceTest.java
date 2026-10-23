package pe.gob.saip.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

class JwtServiceTest {

    @Test
    void simultaneousIssuancesHaveDistinctSignedRandomJtis() {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secret", "this-is-a-long-test-secret-key-for-jwt-validation-2026");
        ReflectionTestUtils.setField(service, "expirationMs", 3_600_000L);
        var ids = java.util.stream.IntStream.range(0, 100).parallel()
                .mapToObj(index -> service.extraerSesion(service.generateToken(1L, "CIUDADANO", 0L)).jti())
                .collect(java.util.stream.Collectors.toSet());
        assertEquals(100, ids.size());
        ids.forEach(id -> assertEquals(4, java.util.UUID.fromString(id).version()));
    }

    @Test
    void subjectPreservesTheFullPersistentLongIdWithoutFloatingPointConversion() {
        JwtService jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", "this-is-a-long-test-secret-key-for-jwt-validation-2026");
        ReflectionTestUtils.setField(jwtService, "expirationMs", 3_600_000L);
        String token = jwtService.generateToken(Long.MAX_VALUE, "CIUDADANO", Long.MAX_VALUE);
        assertEquals(Long.MAX_VALUE, jwtService.extractUsuarioId(token));
        assertEquals(Long.MAX_VALUE, jwtService.extractVersionAutenticacion(token));
        assertTrue(jwtService.isTokenValid(token));
    }

    @Test
    void generateToken_shouldRotateTokenOnRelogin() {
        JwtService jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", "this-is-a-long-test-secret-key-for-jwt-validation-2026");
        ReflectionTestUtils.setField(jwtService, "expirationMs", 86_400_000L);

        String firstToken = jwtService.generateToken(1L, "ADMINISTRADOR", 0L);
        String secondToken = jwtService.generateToken(1L, "ADMINISTRADOR", 0L);

        assertNotEquals(firstToken, secondToken, "Cada login debe generar un JWT distinto");
        assertEquals(1L, jwtService.extractUsuarioId(firstToken));
        assertTrue(jwtService.isTokenValid(firstToken));
        assertTrue(jwtService.isTokenValid(secondToken));
    }
}
