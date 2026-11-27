package pe.gob.saip.backend.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/** Canonical identity backed by the immutable usuario primary key, never an email. */
public final class IdentidadUsuario {
    private static final String PREFIX = "saip:user:v1:";

    private IdentidadUsuario() {
    }

    public static String subject(Long usuarioId) {
        if (usuarioId == null || usuarioId <= 0) {
            throw new IllegalArgumentException("Identidad de usuario inválida");
        }
        return PREFIX + usuarioId;
    }

    /** Rejects legacy email subjects, noncanonical IDs and numeric overflow. */
    public static Long usuarioId(String subject) {
        if (subject == null || !subject.matches("saip:user:v1:[1-9][0-9]*")) {
            throw new IllegalArgumentException("Identidad de usuario inválida");
        }
        return Long.valueOf(subject.substring(PREFIX.length()));
    }

    /** Accepts only the authenticated principal, never request-supplied identity. */
    public static Long usuarioId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Se requiere una identidad autenticada válida");
        }
        try {
            return usuarioId(authentication.getName());
        } catch (IllegalArgumentException invalidIdentity) {
            throw new AccessDeniedException("Se requiere una identidad autenticada válida");
        }
    }
}
