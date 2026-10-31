package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.CrearApelacionExternaRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.repository.ApelacionRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApelacionServiceTest {

    @Mock
    ApelacionRepository apelacionRepository;

    @Mock
    CiudadanoService ciudadanoService;

    @Mock
    EntidadService entidadService;

    @Mock
    AutorizacionRecursosService autorizacion;

    @InjectMocks
    ApelacionService apelacionService;

    private Apelacion crearApelacion(Long id, String expediente, Apelacion.EstadoApelacion estado) {
        Apelacion a = new Apelacion();
        a.setIdApelacion(id);
        a.setExpediente(expediente);
        a.setFundamentos("Fundamentos de prueba");
        a.setEstado(estado);
        a.setFechaApelacion(LocalDateTime.now());
        return a;
    }

    @Test
    void obtenerTodasLasApelaciones_debeRetornarLista() {
        var apelaciones = List.of(
            crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION),
            crearApelacion(2L, "00002-2025-JUS/TTAIP", Apelacion.EstadoApelacion.EN_CALIFICACION_1)
        );
        when(apelacionRepository.findAll()).thenReturn(apelaciones);

        List<Apelacion> resultado = apelacionService.obtenerTodasLasApelaciones();

        assertThat(resultado).hasSize(2);
    }

    @Test
    void obtenerApelacionPorId_existente_debeRetornarPresente() {
        var apelacion = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.findById(1L)).thenReturn(Optional.of(apelacion));

        Optional<Apelacion> resultado = apelacionService.obtenerApelacionPorId(1L);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getExpediente()).isEqualTo("00001-2025-JUS/TTAIP");
    }

    @Test
    void obtenerApelacionPorId_noExistente_debeRetornarVacio() {
        when(apelacionRepository.findById(999L)).thenReturn(Optional.empty());

        Optional<Apelacion> resultado = apelacionService.obtenerApelacionPorId(999L);

        assertThat(resultado).isEmpty();
    }

    @Test
    void obtenerApelacionPorExpediente_debeRetornarApelacion() {
        var apelacion = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.findByExpediente("00001-2025-JUS/TTAIP")).thenReturn(Optional.of(apelacion));

        Optional<Apelacion> resultado = apelacionService.obtenerApelacionPorExpediente("00001-2025-JUS/TTAIP");

        assertThat(resultado).isPresent();
    }

    @Test
    void obtenerApelacionesPorEstado_debeRetornarFiltradas() {
        var apelaciones = List.of(
            crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.EN_CALIFICACION_1)
        );
        when(apelacionRepository.findByEstadoOrderByFechaApelacionDesc(Apelacion.EstadoApelacion.EN_CALIFICACION_1)).thenReturn(apelaciones);

        List<Apelacion> resultado = apelacionService.obtenerApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);

        assertThat(resultado).hasSize(1);
    }

    @Test
    void contarApelacionesPorEstado_debeRetornarCuenta() {
        when(apelacionRepository.countByEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION)).thenReturn(7L);

        long resultado = apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);

        assertThat(resultado).isEqualTo(7L);
    }

    @Test
    void findByCiudadanoId_debeRetornarApelacionesDelCiudadano() {
        var apelaciones = List.of(
            crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION)
        );
        when(apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(10L)).thenReturn(apelaciones);

        List<Apelacion> resultado = apelacionService.findByCiudadanoId(10L);

        assertThat(resultado).hasSize(1);
    }

    @Test
    void findPendientes_debeRetornarApelacionesPendientes() {
        var apelaciones = List.of(
            crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION)
        );
        when(apelacionRepository.findPendientes(anyList())).thenReturn(apelaciones);

        List<Apelacion> resultado = apelacionService.findPendientes();

        assertThat(resultado).hasSize(1);
    }

    @Test
    void generarExpediente_debeGenerarFormatoTTAIP() {
        int year = LocalDate.now().getYear();
        when(apelacionRepository.count()).thenReturn(5L);

        String expediente = apelacionService.generarExpediente();

        assertThat(expediente).isEqualTo("00006-" + year + "-JUS/TTAIP");
    }

    @Test
    void save_sinExpediente_debeGenerarExpediente() {
        Apelacion apelacion = crearApelacion(null, null, Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.count()).thenReturn(0L);
        when(apelacionRepository.save(any())).thenAnswer(inv -> {
            Apelacion a = inv.getArgument(0);
            a.setIdApelacion(1L);
            return a;
        });

        Apelacion resultado = apelacionService.save(apelacion);

        assertThat(resultado.getExpediente()).endsWith("-JUS/TTAIP");
        verify(apelacionRepository).save(apelacion);
    }

    @Test
    void save_conExpediente_noDebeRegenerar() {
        Apelacion apelacion = crearApelacion(1L, "00010-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.save(apelacion)).thenReturn(apelacion);

        Apelacion resultado = apelacionService.save(apelacion);

        assertThat(resultado.getExpediente()).isEqualTo("00010-2025-JUS/TTAIP");
    }

    @Test
    void eliminarApelacion_debeInvocarDeleteById() {
        apelacionService.eliminarApelacion(1L);

        verify(apelacionRepository).deleteById(1L);
    }

    @Test
    void count_debeRetornarCuenta() {
        when(apelacionRepository.count()).thenReturn(12L);

        long resultado = apelacionService.count();

        assertThat(resultado).isEqualTo(12L);
    }

    @Test
    void countByCiudadanoId_debeRetornarCantidad() {
        var apelaciones = List.of(
            crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION),
            crearApelacion(2L, "00002-2025-JUS/TTAIP", Apelacion.EstadoApelacion.EN_CALIFICACION_1)
        );
        when(apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(10L)).thenReturn(apelaciones);

        long resultado = apelacionService.countByCiudadanoId(10L);

        assertThat(resultado).isEqualTo(2L);
    }

    @Test
    void crearExterna_denegatoriaExpresa_debeGuardarSinSolicitudLocal() {
        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setIdUsuario(10L);
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(5L);
        entidad.setNombre("Ministerio de Prueba");
        CrearApelacionExternaRequest request = new CrearApelacionExternaRequest(
                10L,
                5L,
                null,
                null,
                null,
                "EXT-2026-001",
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 12),
                Apelacion.TipoDenegatoria.EXPRESA,
                "Solicitud original de información pública.",
                "La entidad denegó expresamente el pedido.",
                "documentos/solicitud-externa.pdf",
                "documentos/cargo-externo.pdf",
                "documentos/respuesta-externa.pdf",
                null,
                "Fundamentos suficientes para interponer la apelación externa ante el TTAIP.",
                null);
        when(ciudadanoService.findById(10L)).thenReturn(Optional.of(ciudadano));
        when(entidadService.findById(5L)).thenReturn(Optional.of(entidad));
        when(apelacionRepository.existsByTipoOrigenAndNumeroSolicitudExternaIgnoreCaseAndCiudadano_IdUsuario(
                Apelacion.TipoOrigenApelacion.EXTERNA,
                "EXT-2026-001",
                10L)).thenReturn(false);
        when(apelacionRepository.count()).thenReturn(0L);
        when(apelacionRepository.save(any(Apelacion.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Apelacion resultado = apelacionService.crearExterna(request);

        assertThat(resultado.getTipoOrigen()).isEqualTo(Apelacion.TipoOrigenApelacion.EXTERNA);
        assertThat(resultado.getSolicitud()).isNull();
        assertThat(resultado.getEntidadApelada()).isEqualTo(entidad);
        assertThat(resultado.getEstado()).isEqualTo(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        assertThat(resultado.getExpediente()).endsWith("-JUS/TTAIP");
    }

    @Test
    void crearExterna_denegatoriaTacitaSinSustento_debeRechazar() {
        CrearApelacionExternaRequest request = new CrearApelacionExternaRequest(
                10L,
                null,
                "Entidad externa",
                null,
                null,
                "EXT-2026-002",
                LocalDate.of(2026, 5, 1),
                null,
                Apelacion.TipoDenegatoria.TACITA,
                "Solicitud original de información pública.",
                null,
                "documentos/solicitud-externa.pdf",
                null,
                null,
                null,
                "Fundamentos suficientes para interponer la apelación externa ante el TTAIP.",
                null);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> apelacionService.crearExterna(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("silencio administrativo");

        verifyNoInteractions(ciudadanoService, entidadService);
        verify(apelacionRepository, never()).save(any());
    }

    @Test
    void listarTodasAccesibles_debeFiltrarYMapearDTO() {
        var a1 = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.findAll()).thenReturn(List.of(a1));
        when(autorizacion.filtrarApelacionesAccesibles(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<ApelacionDTO> resultado = apelacionService.listarTodasAccesibles();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        assertThat(resultado.get(0).expediente()).isEqualTo("00001-2025-JUS/TTAIP");
        verify(autorizacion).filtrarApelacionesAccesibles(anyList());
    }

    @Test
    void listarPorCiudadano_debeVerificarAutorizacionYMapearDTO() {
        var a1 = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(10L)).thenReturn(List.of(a1));

        List<ApelacionDTO> resultado = apelacionService.listarPorCiudadano(10L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        verify(autorizacion).verificarCiudadanoActualOPrivilegiado(10L);
    }

    @Test
    void listarPorEstado_debeFiltrarYMapearDTO() {
        var a1 = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        when(apelacionRepository.findByEstadoOrderByFechaApelacionDesc(Apelacion.EstadoApelacion.EN_CALIFICACION_1)).thenReturn(List.of(a1));
        when(autorizacion.filtrarApelacionesAccesibles(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<ApelacionDTO> resultado = apelacionService.listarPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        verify(autorizacion).filtrarApelacionesAccesibles(anyList());
    }

    @Test
    void obtenerDetalle_debeVerificarAutorizacionYMapearDTO() {
        var a1 = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.findByIdWithDetails(1L)).thenReturn(Optional.of(a1));

        ApelacionDTO resultado = apelacionService.obtenerDetalle(1L);

        assertThat(resultado).isNotNull();
        assertThat(resultado.id()).isEqualTo(1L);
        verify(autorizacion).verificarApelacionAccesible(a1);
    }

    @Test
    void obtenerDetallePorExpediente_debeVerificarAutorizacionYMapearDTO() {
        var a1 = crearApelacion(1L, "00001-2025-JUS/TTAIP", Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        when(apelacionRepository.findByExpedienteWithDetails("00001-2025-JUS/TTAIP")).thenReturn(Optional.of(a1));

        ApelacionDTO resultado = apelacionService.obtenerDetallePorExpediente("00001-2025-JUS/TTAIP");

        assertThat(resultado).isNotNull();
        assertThat(resultado.expediente()).isEqualTo("00001-2025-JUS/TTAIP");
        verify(autorizacion).verificarApelacionAccesible(a1);
    }
}
