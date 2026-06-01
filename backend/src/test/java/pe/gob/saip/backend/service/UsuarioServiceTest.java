package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.UsuarioRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    UsuarioRepository usuarioRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @InjectMocks
    UsuarioService usuarioService;

    private Usuario crearUsuario(Long id, String email, boolean activo) {
        Usuario u = new Usuario();
        u.setIdUsuario(id);
        u.setEmail(email);
        u.setPassword("$2a$12$encodedTestPassword");
        u.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        u.setActivo(activo);
        u.setFechaRegistro(LocalDateTime.now());
        return u;
    }

    @Test
    void obtenerTodosLosUsuarios_debeRetornarLista() {
        var usuarios = List.of(
                crearUsuario(1L, "user1@test.com", true),
                crearUsuario(2L, "user2@test.com", true)
        );
        when(usuarioRepository.findAll()).thenReturn(usuarios);

        List<Usuario> resultado = usuarioService.obtenerTodosLosUsuarios();

        assertThat(resultado).hasSize(2);
    }

    @Test
    void obtenerUsuarioPorId_existente_debeRetornarPresente() {
        var usuario = crearUsuario(1L, "user@test.com", true);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));

        Optional<Usuario> resultado = usuarioService.obtenerUsuarioPorId(1L);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getEmail()).isEqualTo("user@test.com");
    }

    @Test
    void obtenerUsuarioPorId_noExistente_debeRetornarVacio() {
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        Optional<Usuario> resultado = usuarioService.obtenerUsuarioPorId(999L);

        assertThat(resultado).isEmpty();
    }

    @Test
    void obtenerUsuarioPorEmail_debeRetornarUsuario() {
        var usuario = crearUsuario(1L, "user@test.com", true);
        when(usuarioRepository.findByEmail("user@test.com")).thenReturn(Optional.of(usuario));

        Optional<Usuario> resultado = usuarioService.obtenerUsuarioPorEmail("user@test.com");

        assertThat(resultado).isPresent();
    }

    @Test
    void existeEmail_existente_debeRetornarTrue() {
        when(usuarioRepository.findByEmail("user@test.com")).thenReturn(Optional.of(crearUsuario(1L, "user@test.com", true)));

        Boolean resultado = usuarioService.existeEmail("user@test.com");

        assertThat(resultado).isTrue();
    }

    @Test
    void existeEmail_noExistente_debeRetornarFalse() {
        when(usuarioRepository.findByEmail("noexiste@test.com")).thenReturn(Optional.empty());

        Boolean resultado = usuarioService.existeEmail("noexiste@test.com");

        assertThat(resultado).isFalse();
    }

    @Test
    void validarCredenciales_correctas_debeRetornarUsuario() {
        var usuario = crearUsuario(1L, "user@test.com", true);
        when(usuarioRepository.findByEmail("user@test.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("test123", usuario.getPassword())).thenReturn(true);

        Optional<Usuario> resultado = usuarioService.validarCredenciales("user@test.com", "test123");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getEmail()).isEqualTo("user@test.com");
    }

    @Test
    void validarCredenciales_passwordIncorrecto_debeRetornarVacio() {
        var usuario = crearUsuario(1L, "user@test.com", true);
        when(usuarioRepository.findByEmail("user@test.com")).thenReturn(Optional.of(usuario));

        Optional<Usuario> resultado = usuarioService.validarCredenciales("user@test.com", "wrongpass");

        assertThat(resultado).isEmpty();
    }

    @Test
    void validarCredenciales_usuarioInactivo_debeRetornarVacio() {
        var usuario = crearUsuario(1L, "user@test.com", false);
        when(usuarioRepository.findByEmail("user@test.com")).thenReturn(Optional.of(usuario));

        Optional<Usuario> resultado = usuarioService.validarCredenciales("user@test.com", "test123");

        assertThat(resultado).isEmpty();
    }

    @Test
    void validarCredenciales_passwordLegacyPlano_debeRetornarVacio() {
        var usuario = crearUsuario(1L, "user@test.com", true);
        usuario.setPassword("test123");
        when(usuarioRepository.findByEmail("user@test.com")).thenReturn(Optional.of(usuario));

        Optional<Usuario> resultado = usuarioService.validarCredenciales("user@test.com", "test123");

        assertThat(resultado).isEmpty();
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void validarCredenciales_emailNoExiste_debeRetornarVacio() {
        when(usuarioRepository.findByEmail("noexiste@test.com")).thenReturn(Optional.empty());

        Optional<Usuario> resultado = usuarioService.validarCredenciales("noexiste@test.com", "test123");

        assertThat(resultado).isEmpty();
    }

    @Test
    void guardarUsuario_debeInvocarSave() {
        var usuario = crearUsuario(null, "nuevo@test.com", true);

        usuarioService.guardarUsuario(usuario);

        verify(usuarioRepository).save(usuario);
    }

    @Test
    void eliminarUsuario_debeInvocarDeleteById() {
        usuarioService.eliminarUsuario(1L);

        verify(usuarioRepository).deleteById(1L);
    }
}
