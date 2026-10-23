package pe.gob.saip.backend.service;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.repository.SesionJwtRevocadaRepository;
import pe.gob.saip.backend.security.IdentidadUsuario;
import pe.gob.saip.backend.security.JwtService.SesionVerificada;

/** Individual issuance revocation, independent of the account-wide authentication generation. */
@Service
public class SesionJwtService {
    private final SesionJwtRevocadaRepository revocaciones;

    public SesionJwtService(SesionJwtRevocadaRepository revocaciones) {
        this.revocaciones = revocaciones;
    }

    @Transactional(readOnly = true)
    public boolean estaRevocada(SesionVerificada sesion) {
        return revocaciones.existsByUsuarioIdAndJti(sesion.usuarioId(), sesion.jti());
    }

    @Transactional
    public void cerrarSesionActual(Authentication autenticacion) {
        if (autenticacion == null || !autenticacion.isAuthenticated()
                || !(autenticacion.getDetails() instanceof SesionVerificada sesion)
                || !IdentidadUsuario.usuarioId(autenticacion).equals(sesion.usuarioId())) {
            throw new BadCredentialsException("Token inválido");
        }
        revocaciones.revocar(sesion.usuarioId(), sesion.jti(), sesion.expiraEn());
    }
}
