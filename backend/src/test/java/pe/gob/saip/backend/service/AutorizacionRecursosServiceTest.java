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
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ElevacionApelacionTtaipRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;

@ExtendWith(MockitoExtension.class)
class AutorizacionRecursosServiceTest {

    @Mock
    private FuncionarioRepository funcionarioRepository;

    @Mock
    private SolicitudRepository solicitudRepository;

    @Mock
    private ExpedienteTtaipRepository expedienteRepository;

    @Mock
    private ElevacionApelacionTtaipRepository elevacionRepository;

    private AutorizacionRecursosService service;

    @BeforeEach
    void setUp() {
        service = new AutorizacionRecursosService(
                funcionarioRepository,
                solicitudRepository,
                expedienteRepository,
                elevacionRepository);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void verificarSolicitudInstitucionalAllowsFuncionarioFromSameEntidad() {
        authenticate("funcionario@example.test", "ROLE_FUNCIONARIO");
        Entidad entidad = entidad(10L);
        when(funcionarioRepository.findByEmail("funcionario@example.test"))
                .thenReturn(Optional.of(funcionario(entidad)));
        when(solicitudRepository.findById(5L)).thenReturn(Optional.of(solicitud(entidad)));

        assertThatCode(() -> service.verificarSolicitudInstitucional(5L))
                .doesNotThrowAnyException();
    }

    @Test
    void verificarSolicitudInstitucionalRejectsFuncionarioFromOtherEntidad() {
        authenticate("funcionario@example.test", "ROLE_FUNCIONARIO");
        when(funcionarioRepository.findByEmail("funcionario@example.test"))
                .thenReturn(Optional.of(funcionario(entidad(10L))));
        when(solicitudRepository.findById(5L)).thenReturn(Optional.of(solicitud(entidad(20L))));

        assertThatThrownBy(() -> service.verificarSolicitudInstitucional(5L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void verificarSolicitudInstitucionalAllowsAdministradorWithoutOwnershipLookup() {
        authenticate("admin@example.test", "ROLE_ADMINISTRADOR");

        assertThatCode(() -> service.verificarSolicitudInstitucional(5L))
                .doesNotThrowAnyException();
        verifyNoInteractions(funcionarioRepository, solicitudRepository);
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

    private Entidad entidad(Long id) {
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(id);
        return entidad;
    }
}
