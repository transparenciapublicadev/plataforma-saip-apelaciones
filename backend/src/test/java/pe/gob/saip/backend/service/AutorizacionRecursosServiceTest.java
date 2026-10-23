package pe.gob.saip.backend.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.EncauzamientoSolicitud;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.ElevacionApelacionTtaipRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.EncauzamientoSolicitudRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CiudadanoRepository;
import pe.gob.saip.backend.repository.RespuestaRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;

@ExtendWith(MockitoExtension.class)
class AutorizacionRecursosServiceTest {

    @Mock
    private FuncionarioRepository funcionarioRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private CiudadanoRepository ciudadanoRepository;

    @Mock
    private SolicitudRepository solicitudRepository;

    @Mock
    private RespuestaRepository respuestaRepository;

    @Mock
    private ApelacionRepository apelacionRepository;

    @Mock
    private ExpedienteTtaipRepository expedienteRepository;

    @Mock
    private ElevacionApelacionTtaipRepository elevacionRepository;

    @Mock
    private EncauzamientoSolicitudRepository encauzamientoRepository;

    private AutorizacionRecursosService service;

    @BeforeEach
    void setUp() {
        service = new AutorizacionRecursosService(
                usuarioRepository,
                ciudadanoRepository,
                funcionarioRepository,
                solicitudRepository,
                respuestaRepository,
                apelacionRepository,
                expedienteRepository,
                elevacionRepository,
                encauzamientoRepository);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void verificarSolicitudInstitucionalAllowsFuncionarioFromSameEntidad() {
        authenticate("saip:user:v1:10", "ROLE_FUNCIONARIO");
        Entidad entidad = entidad(10L);
        when(funcionarioRepository.findById(10L))
                .thenReturn(Optional.of(funcionario(entidad)));
        when(solicitudRepository.findById(5L)).thenReturn(Optional.of(solicitud(entidad)));

        assertThatCode(() -> service.verificarSolicitudInstitucional(5L))
                .doesNotThrowAnyException();
    }

    @Test
    void verificarSolicitudInstitucionalRejectsFuncionarioFromOtherEntidad() {
        authenticate("saip:user:v1:10", "ROLE_FUNCIONARIO");
        when(funcionarioRepository.findById(10L))
                .thenReturn(Optional.of(funcionario(entidad(10L))));
        when(solicitudRepository.findById(5L)).thenReturn(Optional.of(solicitud(entidad(20L))));

        assertThatThrownBy(() -> service.verificarSolicitudInstitucional(5L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void verificarSolicitudInstitucionalAllowsAdministradorWithoutOwnershipLookup() {
        authenticate("saip:user:v1:99", "ROLE_ADMINISTRADOR");

        assertThatCode(() -> service.verificarSolicitudInstitucional(5L))
                .doesNotThrowAnyException();
        verifyNoInteractions(funcionarioRepository, solicitudRepository);
    }

    @Test
    void verificarUsuarioActualOAdministradorRejectsDifferentCitizenProfile() {
        authenticate("saip:user:v1:1", "ROLE_CIUDADANO");
        when(usuarioRepository.findById(1L))
                .thenReturn(Optional.of(usuario(1L)));

        assertThatThrownBy(() -> service.verificarUsuarioActualOAdministrador(2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void verificarSolicitudAccesibleAllowsCitizenOwner() {
        authenticate("saip:user:v1:1", "ROLE_CIUDADANO");
        when(ciudadanoRepository.findById(1L))
                .thenReturn(Optional.of(ciudadano(1L)));
        when(solicitudRepository.findById(5L))
                .thenReturn(Optional.of(solicitud(entidad(10L), ciudadano(1L))));

        assertThatCode(() -> service.verificarSolicitudAccesible(5L))
                .doesNotThrowAnyException();
    }

    @Test
    void verificarSolicitudAccesibleRejectsCitizenFromOtherOwner() {
        authenticate("saip:user:v1:1", "ROLE_CIUDADANO");
        when(ciudadanoRepository.findById(1L))
                .thenReturn(Optional.of(ciudadano(1L)));
        when(solicitudRepository.findById(5L))
                .thenReturn(Optional.of(solicitud(entidad(10L), ciudadano(2L))));

        assertThatThrownBy(() -> service.verificarSolicitudAccesible(5L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void verificarTrazabilidadEncauzamientoAccesibleAllowsOriginEntityAfterTotalRedirect() {
        authenticate("saip:user:v1:10", "ROLE_FUNCIONARIO");
        Entidad origen = entidad(10L);
        Entidad destino = entidad(20L);
        EncauzamientoSolicitud encauzamiento = new EncauzamientoSolicitud();
        encauzamiento.setEntidadOrigen(origen);
        encauzamiento.setEntidadDestino(destino);
        when(funcionarioRepository.findById(10L))
                .thenReturn(Optional.of(funcionario(origen)));
        when(solicitudRepository.findById(5L))
                .thenReturn(Optional.of(solicitud(destino)));
        when(encauzamientoRepository.findBySolicitud_IdSolicitudOrderByFechaEncauzamientoDesc(5L))
                .thenReturn(List.of(encauzamiento));

        assertThatCode(() -> service.verificarTrazabilidadEncauzamientoAccesible(5L))
                .doesNotThrowAnyException();
    }

    private void authenticate(String email, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        email,
                        null,
                        List.of(new SimpleGrantedAuthority(role))));
    }

    private Funcionario funcionario(Entidad entidad) {
        Funcionario funcionario = new Funcionario();
        funcionario.setEntidad(entidad);
        return funcionario;
    }

    private Solicitud solicitud(Entidad entidad) {
        Solicitud solicitud = new Solicitud();
        solicitud.setEntidad(entidad);
        return solicitud;
    }

    private Solicitud solicitud(Entidad entidad, Ciudadano ciudadano) {
        Solicitud solicitud = solicitud(entidad);
        solicitud.setCiudadano(ciudadano);
        return solicitud;
    }

    private Ciudadano ciudadano(Long id) {
        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setIdUsuario(id);
        return ciudadano;
    }

    private Usuario usuario(Long id) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(id);
        return usuario;
    }

    private Entidad entidad(Long id) {
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(id);
        return entidad;
    }
}
