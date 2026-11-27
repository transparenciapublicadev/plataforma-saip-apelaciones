package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;

import java.util.List;
import java.util.Optional;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<Usuario> obtenerTodosLosUsuarios() {
        return usuarioRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> obtenerUsuarioPorId(Long id) {
        return usuarioRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> obtenerUsuarioPorEmail(String email) {
        return usuarioRepository.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> findByEmail(String email) {
        return usuarioRepository.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public Boolean existeEmail(String email) {
        return usuarioRepository.findByEmail(email).isPresent();
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> validarCredenciales(String email, String password) {
        return usuarioRepository.findByEmail(email)
                .filter(u -> Boolean.TRUE.equals(u.getActivo()))
                .filter(u -> u.getPassword() != null && u.getPassword().startsWith("$2"))
                .filter(u -> passwordEncoder.matches(password, u.getPassword()));
    }

    @Transactional
    public void guardarUsuario(Usuario usuario) {
        usuarioRepository.save(usuario);
    }

    /** Updates admin profile data and an explicitly requested state in the same transaction. */
    @Transactional
    public Usuario guardarUsuario(Usuario usuario, Boolean activo) {
        Usuario guardado = usuarioRepository.saveAndFlush(usuario);
        return activo == null ? guardado : cambiarEstado(guardado.getIdUsuario(), activo);
    }

    /** A reactivation preserves the generation that invalidated previous JWTs. */
    @Transactional
    public Usuario cambiarEstado(Long id, Boolean activo) {
        if (activo == null) {
            throw new IllegalArgumentException("El campo activo es obligatorio");
        }
        if (usuarioRepository.actualizarEstadoAutenticacion(id, activo) == 0) {
            throw new RecursoNoEncontradoException("Usuario no encontrado con ID: " + id);
        }
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado con ID: " + id));
    }

    @Transactional
    public void eliminarUsuario(Long id) {
        usuarioRepository.deleteById(id);
    }
}
