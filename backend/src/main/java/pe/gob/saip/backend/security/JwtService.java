package pe.gob.saip.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import java.time.Instant;

@Service
public class JwtService {

    /** Only created from signed, validated claims; contains no bearer credential. */
    public record SesionVerificada(Long usuarioId, String jti, long versionAutenticacion, Instant expiraEn) {
    }

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    public String generateToken(Long usuarioId, String role, long versionAutenticacion) {
        if (versionAutenticacion < 0) {
            throw new IllegalArgumentException("Versión de autenticación inválida");
        }
        return Jwts.builder()
                .subject(IdentidadUsuario.subject(usuarioId))
                .id(UUID.randomUUID().toString())
                .claim("role", role)
                .claim("usuarioId", usuarioId)
                .claim("authVersion", Long.toString(versionAutenticacion))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public Long extractUsuarioId(String token) {
        return IdentidadUsuario.usuarioId(extractClaims(token).getSubject());
    }

    public String extractRole(String token) {
        return extractClaims(token).get("role", String.class);
    }

    public long extractVersionAutenticacion(String token) {
        return versionAutenticacion(extractClaims(token));
    }

    public SesionVerificada extraerSesion(String token) {
        Claims claims = extractClaims(token);
        return new SesionVerificada(IdentidadUsuario.usuarioId(claims.getSubject()), claims.getId(),
                versionAutenticacion(claims), claims.getExpiration().toInstant());
    }

    public boolean isTokenValid(String token) {
        try {
            extractClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims extractClaims(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        // All email-based legacy tokens require a new login, even if they carry usuarioId.
        // No key rotation or email/claim fallback participates in identity resolution.
        // Only the canonical textual subject resolves the actor; compatibility claims do not.
        IdentidadUsuario.usuarioId(claims.getSubject());
        // Stable tokens issued before versioning also require a new login. Never assume version 0.
        versionAutenticacion(claims);
        String jti = claims.getId();
        if (jti == null || !jti.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
                || claims.getExpiration() == null) {
            throw new IllegalArgumentException("Identificador de sesión inválido");
        }
        return claims;
    }

    private long versionAutenticacion(Claims claims) {
        Object version = claims.get("authVersion");
        if (!(version instanceof String value) || !value.matches("0|[1-9][0-9]*")) {
            throw new IllegalArgumentException("Versión de autenticación inválida");
        }
        return Long.parseLong(value);
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
