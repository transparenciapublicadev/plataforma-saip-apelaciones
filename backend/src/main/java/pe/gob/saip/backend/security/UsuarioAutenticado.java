package pe.gob.saip.backend.security;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

/** A current database account and its server-owned authentication generation. */
public final class UsuarioAutenticado extends User {
    private final long versionAutenticacion;

    public UsuarioAutenticado(UserDetails cuenta, long versionAutenticacion) {
        super(cuenta.getUsername(), cuenta.getPassword(), cuenta.isEnabled(),
                cuenta.isAccountNonExpired(), cuenta.isCredentialsNonExpired(),
                cuenta.isAccountNonLocked(), cuenta.getAuthorities());
        this.versionAutenticacion = versionAutenticacion;
    }

    public long getVersionAutenticacion() {
        return versionAutenticacion;
    }
}
