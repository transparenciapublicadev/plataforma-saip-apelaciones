package pe.gob.saip.backend.security;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.UsuarioRepository;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public CustomUserDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String subject) throws UsernameNotFoundException {
        final Long usuarioId;
        try {
            usuarioId = IdentidadUsuario.usuarioId(subject);
        } catch (IllegalArgumentException invalidIdentity) {
            throw new UsernameNotFoundException("Usuario no encontrado");
        }
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));

        UserDetails cuenta = User.builder()
                .username(IdentidadUsuario.subject(usuario.getIdUsuario()))
                .password(usuario.getPassword())
                .roles(usuario.getTipoUsuario().name())
                .disabled(!Boolean.TRUE.equals(usuario.getActivo()))
                .build();
        return new UsuarioAutenticado(cuenta, usuario.getVersionAutenticacion());
    }
}
