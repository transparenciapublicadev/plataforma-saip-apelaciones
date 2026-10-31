package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.ActualizarEntregaParcialRequest;
import pe.gob.saip.backend.model.dto.ActualizarLiquidacionCostoRequest;
import pe.gob.saip.backend.model.dto.ObservarSolicitudRequest;
import pe.gob.saip.backend.model.dto.PlazoSeguimientoDTO;
import pe.gob.saip.backend.model.dto.SolicitudDTO;
import pe.gob.saip.backend.model.dto.RegistrarAmpliacionPlazoRequest;
import pe.gob.saip.backend.model.dto.RegistrarEncauzamientoSolicitudRequest;
import pe.gob.saip.backend.model.dto.RegistrarEntregaParcialRequest;
import pe.gob.saip.backend.model.dto.RegistrarLiquidacionCostoRequest;
import pe.gob.saip.backend.model.dto.SubsanarSolicitudRequest;
import pe.gob.saip.backend.model.entity.AmpliacionPlazoSolicitud;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;
import pe.gob.saip.backend.model.entity.EncauzamientoSolicitud;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.LiquidacionCostoSolicitud;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.AmpliacionPlazoSolicitudRepository;
import pe.gob.saip.backend.repository.CronogramaEntregaParcialSolicitudRepository;
import pe.gob.saip.backend.repository.EncauzamientoSolicitudRepository;
import pe.gob.saip.backend.repository.EntidadRepository;
import pe.gob.saip.backend.repository.LiquidacionCostoSolicitudRepository;
import pe.gob.saip.backend.repository.ObservacionSolicitudRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SolicitudServiceTest {

    @Mock
    SolicitudRepository solicitudRepository;

    @Mock
    ObservacionSolicitudRepository observacionRepository;

    @Mock
    AmpliacionPlazoSolicitudRepository ampliacionRepository;

    @Mock
    CronogramaEntregaParcialSolicitudRepository cronogramaRepository;

    @Mock
    EncauzamientoSolicitudRepository encauzamientoRepository;

    @Mock
    LiquidacionCostoSolicitudRepository liquidacionRepository;

    @Mock
    EntidadRepository entidadRepository;

    @Mock
    PlazoCalculadorService plazoCalculadorService;

    @Mock AutorizacionRecursosService autorizacion;
    @Mock EntityManager entityManager;
    @InjectMocks
    SolicitudService solicitudService;

    @BeforeEach void bloqueos() {
        lenient().when(solicitudRepository.findByIdForUpdate(anyLong()))
            .thenAnswer(inv -> solicitudRepository.findById(inv.getArgument(0)));
    }

    private Solicitud crearSolicitud(Long id, String expediente, Solicitud.EstadoSolicitud estado) {
        Solicitud s = new Solicitud();
        s.setIdSolicitud(id);
        s.setExpediente(expediente);
        s.setAsunto("Solicitud de prueba");
        s.setDescripcion("Descripción de prueba");
        Ciudadano ciudadano = new Ciudadano(); ciudadano.setIdUsuario(9L); s.setCiudadano(ciudadano);
        s.setEstado(estado);
        s.setFechaPresentacion(LocalDateTime.now());
        s.setFechaLimite(LocalDate.now().plusDays(10));
        return s;
    }

    private Entidad crearEntidad(Long id, String acronimo, boolean activa) {
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(id);
        entidad.setNombre("Entidad " + acronimo);
        entidad.setAcronimo(acronimo);
        entidad.setActiva(activa);
        entidad.setEstado(activa ? "Activa" : "Inactiva");
        return entidad;
    }

    @Test
    void obtenerTodasLasSolicitudes_debeRetornarLista() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA),
            crearSolicitud(2L, "SAIP-2025-00002", Solicitud.EstadoSolicitud.EN_REVISION)
        );
        when(solicitudRepository.findAll()).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.obtenerTodasLasSolicitudes();

        assertThat(resultado).hasSize(2);
        verify(solicitudRepository).findAll();
    }

    @Test
    void obtenerSolicitudPorId_existente_debeRetornarPresente() {
        var solicitud = crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));

        Optional<Solicitud> resultado = solicitudService.obtenerSolicitudPorId(1L);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getExpediente()).isEqualTo("SAIP-2025-00001");
    }

    @Test
    void obtenerSolicitudPorId_noExistente_debeRetornarVacio() {
        when(solicitudRepository.findById(999L)).thenReturn(Optional.empty());

        Optional<Solicitud> resultado = solicitudService.obtenerSolicitudPorId(999L);

        assertThat(resultado).isEmpty();
    }

    @Test
    void obtenerSolicitudPorExpediente_debeRetornarSolicitud() {
        var solicitud = crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findByExpediente("SAIP-2025-00001")).thenReturn(Optional.of(solicitud));

        Optional<Solicitud> resultado = solicitudService.obtenerSolicitudPorExpediente("SAIP-2025-00001");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getId()).isEqualTo(1L);
    }

    @Test
    void findByCiudadanoId_debeRetornarSolicitudesDelCiudadano() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA)
        );
        when(solicitudRepository.findByCiudadano_IdUsuarioOrderByFechaPresentacionDesc(10L)).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.findByCiudadanoId(10L);

        assertThat(resultado).hasSize(1);
        verify(solicitudRepository).findByCiudadano_IdUsuarioOrderByFechaPresentacionDesc(10L);
    }

    @Test
    void findByEntidadId_debeRetornarSolicitudesDeLaEntidad() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.EN_REVISION),
            crearSolicitud(2L, "SAIP-2025-00002", Solicitud.EstadoSolicitud.RECEPCIONADA)
        );
        when(solicitudRepository.findByEntidad_IdEntidadOrderByFechaPresentacionDesc(5L)).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.findByEntidadId(5L);

        assertThat(resultado).hasSize(2);
    }

    @Test
    void obtenerSolicitudesPorEstado_debeRetornarFiltradasPorEstado() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.VENCIDA)
        );
        when(solicitudRepository.findByEstado(Solicitud.EstadoSolicitud.VENCIDA)).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.obtenerSolicitudesPorEstado(Solicitud.EstadoSolicitud.VENCIDA);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstado()).isEqualTo(Solicitud.EstadoSolicitud.VENCIDA);
    }

    @Test
    void contarSolicitudesPorEstado_debeRetornarCuenta() {
        when(solicitudRepository.countByEstado(Solicitud.EstadoSolicitud.RECEPCIONADA)).thenReturn(15L);

        long resultado = solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);

        assertThat(resultado).isEqualTo(15L);
    }

    @Test
    void generarExpediente_sinSolicitudesPrevias_debeGenerarPrimero() {
        int year = LocalDate.now().getYear();
        String prefix = "SAIP-" + year + "-";
        when(solicitudRepository.findMaxExpedienteNumber(prefix + "%")).thenReturn(null);

        String expediente = solicitudService.generarExpediente();

        assertThat(expediente).isEqualTo(prefix + "00001");
    }

    @Test
    void generarExpediente_conSolicitudesPrevias_debeIncrementar() {
        int year = LocalDate.now().getYear();
        String prefix = "SAIP-" + year + "-";
        when(solicitudRepository.findMaxExpedienteNumber(prefix + "%")).thenReturn(42);

        String expediente = solicitudService.generarExpediente();

        assertThat(expediente).isEqualTo(prefix + "00043");
    }

    @Test
    void save_sinExpediente_debeGenerarExpediente() {
        Solicitud solicitud = crearSolicitud(null, null, Solicitud.EstadoSolicitud.RECEPCIONADA);
        int year = LocalDate.now().getYear();
        when(solicitudRepository.findMaxExpedienteNumber(anyString())).thenReturn(null);
        when(solicitudRepository.save(any())).thenAnswer(inv -> {
            Solicitud s = inv.getArgument(0);
            s.setIdSolicitud(1L);
            return s;
        });

        Solicitud resultado = solicitudService.save(solicitud);

        assertThat(resultado.getExpediente()).startsWith("SAIP-" + year + "-");
        verify(solicitudRepository).save(solicitud);
    }

    @Test
    void save_conExpediente_noDebeRegenerar() {
        Solicitud solicitud = crearSolicitud(1L, "SAIP-2025-00010", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.save(solicitud)).thenReturn(solicitud);

        Solicitud resultado = solicitudService.save(solicitud);

        assertThat(resultado.getExpediente()).isEqualTo("SAIP-2025-00010");
        verify(solicitudRepository, never()).findMaxExpedienteNumber(anyString());
    }

    @Test
    void detectarSilencioAdministrativo_debeMarcarComoVencidas() {
        var solicitud = crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setFechaLimite(LocalDate.now().minusDays(1));
        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(solicitudRepository.findVencidas(any(LocalDate.class), anyList())).thenReturn(List.of(solicitud));
        when(solicitudRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<Solicitud> resultado = solicitudService.detectarSilencioAdministrativo();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstado()).isEqualTo(Solicitud.EstadoSolicitud.VENCIDA);
    }

    @Test
    void observarSolicitud_debeCrearObservacionYMarcarPendienteInformacion() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setFechaPresentacion(LocalDateTime.now());
        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(observacionRepository.existsBySolicitud_IdSolicitudAndEstado(
                eq(1L),
                eq(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION)))
                .thenReturn(false);
        when(observacionRepository.save(any(ObservacionSolicitud.class))).thenAnswer(inv -> {
            ObservacionSolicitud observacion = inv.getArgument(0);
            observacion.setIdObservacion(10L);
            return observacion;
        });

        ObservacionSolicitud resultado = solicitudService.observarSolicitud(
                1L,
                new ObservarSolicitudRequest("Falta precisar la información solicitada", "Funcionario")
        );

        assertThat(resultado.getEstado()).isEqualTo(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION);
        assertThat(resultado.getFechaLimiteSubsanacion()).isEqualTo(DiasHabilesUtil.sumarDiasHabiles(LocalDate.now(), 2));
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
        verify(solicitudRepository).save(solicitud);
        verify(observacionRepository).save(any(ObservacionSolicitud.class));
    }

    @Test
    void observarSolicitud_fueraDePlazo_debeLanzarReglaNegocio() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setFechaPresentacion(LocalDateTime.now().minusDays(10));
        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.observarSolicitud(
                        1L,
                        new ObservarSolicitudRequest("Falta DNI", "Funcionario")
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("plazo de 2 días hábiles");
    }

    @Test
    void subsanarSolicitud_debeMarcarSubsanadaYVolverARevision() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
        var observacion = new ObservacionSolicitud();
        observacion.setIdObservacion(20L);
        observacion.setSolicitud(solicitud);
        observacion.setMotivoObservacion("Falta precisión");
        observacion.setEstado(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION);
        observacion.setFechaLimiteSubsanacion(LocalDate.now().plusDays(2));
        observacion.setTrazabilidad("Observación registrada");

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(observacionRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(observacion));
        when(observacionRepository.save(observacion)).thenReturn(observacion);

        ObservacionSolicitud resultado = solicitudService.subsanarSolicitud(
                1L,
                20L,
                new SubsanarSolicitudRequest("Preciso el pedido requerido", null, null, "Ciudadano")
        );

        assertThat(resultado.getEstado()).isEqualTo(ObservacionSolicitud.EstadoObservacion.SUBSANADA);
        assertThat(resultado.getFechaSubsanacion()).isNotNull();
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.EN_REVISION);
        verify(solicitudRepository).save(solicitud);
    }

    @Test
    void procesarObservacionesVencidas_debeMarcarNoSubsanadaYConcluirSolicitud() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
        var observacion = new ObservacionSolicitud();
        observacion.setIdObservacion(20L);
        observacion.setSolicitud(solicitud);
        observacion.setEstado(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION);
        observacion.setFechaLimiteSubsanacion(LocalDate.now().minusDays(1));

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(observacionRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(observacion));
        when(observacionRepository.findByEstadoAndFechaLimiteSubsanacionBefore(
                eq(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION),
                any(LocalDate.class)))
                .thenReturn(List.of(observacion));
        when(observacionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<ObservacionSolicitud> resultado = solicitudService.procesarObservacionesVencidas();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstado()).isEqualTo(ObservacionSolicitud.EstadoObservacion.NO_SUBSANADA);
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.CONCLUIDA);
        verify(solicitudRepository).save(solicitud);
    }

    @Test
    void registrarAmpliacion_debeActualizarFechaLimiteYCrearCronograma() {
        LocalDate hoy = LocalDate.now();
        LocalDate fechaLimiteOriginal = DiasHabilesUtil.sumarDiasHabiles(hoy, 10);
        LocalDate entrega1 = hoy.plusDays(15);
        LocalDate entrega2 = hoy.plusDays(30);
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFechaPresentacion(LocalDateTime.now());
        solicitud.setFechaLimite(fechaLimiteOriginal);

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(ampliacionRepository.existsBySolicitud_IdSolicitudAndEstadoAmpliacionIn(eq(1L), anyList()))
                .thenReturn(false);
        when(ampliacionRepository.save(any(AmpliacionPlazoSolicitud.class))).thenAnswer(inv -> {
            AmpliacionPlazoSolicitud ampliacion = inv.getArgument(0);
            ampliacion.setIdAmpliacion(50L);
            return ampliacion;
        });

        AmpliacionPlazoSolicitud resultado = solicitudService.registrarAmpliacion(
                1L,
                new RegistrarAmpliacionPlazoRequest(
                        "Pedido voluminoso",
                        "Informe con cronograma de entregas parciales",
                        hoy,
                        "Funcionario",
                        List.of(
                                new RegistrarEntregaParcialRequest(1, "Primer bloque", entrega1, null),
                                new RegistrarEntregaParcialRequest(2, "Segundo bloque", entrega2, "Cierre del cronograma")
                        )
                )
        );

        assertThat(resultado.getEstadoAmpliacion()).isEqualTo(AmpliacionPlazoSolicitud.EstadoAmpliacion.NOTIFICADA);
        assertThat(resultado.getFechaLimiteOriginal()).isEqualTo(fechaLimiteOriginal);
        assertThat(resultado.getFechaLimiteAmpliada()).isEqualTo(entrega2);
        assertThat(resultado.getCronograma()).hasSize(2);
        assertThat(solicitud.getFechaLimite()).isEqualTo(entrega2);
        verify(solicitudRepository).save(solicitud);
        verify(ampliacionRepository).save(any(AmpliacionPlazoSolicitud.class));
    }

    @Test
    void registrarAmpliacion_despuesDelDia4_debeLanzarReglaNegocio() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFechaPresentacion(LocalDateTime.now().minusDays(20));
        solicitud.setFechaLimite(LocalDate.now().plusDays(10));

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(ampliacionRepository.existsBySolicitud_IdSolicitudAndEstadoAmpliacionIn(eq(1L), anyList()))
                .thenReturn(false);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.registrarAmpliacion(
                        1L,
                        new RegistrarAmpliacionPlazoRequest(
                                "Pedido voluminoso",
                                "Informe con cronograma",
                                LocalDate.now(),
                                "Funcionario",
                                List.of(new RegistrarEntregaParcialRequest(1, "Entrega", LocalDate.now().plusDays(20), null))
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("día 4");
    }

    @Test
    void registrarAmpliacion_conEntregaMayorA30Dias_debeLanzarReglaNegocio() {
        LocalDate hoy = LocalDate.now();
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFechaPresentacion(LocalDateTime.now());
        solicitud.setFechaLimite(DiasHabilesUtil.sumarDiasHabiles(hoy, 10));

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(ampliacionRepository.existsBySolicitud_IdSolicitudAndEstadoAmpliacionIn(eq(1L), anyList()))
                .thenReturn(false);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.registrarAmpliacion(
                        1L,
                        new RegistrarAmpliacionPlazoRequest(
                                "Pedido voluminoso",
                                "Informe con cronograma",
                                hoy,
                                "Funcionario",
                                List.of(new RegistrarEntregaParcialRequest(1, "Entrega", hoy.plusDays(31), null))
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("30 días");
    }

    @Test
    void registrarAmpliacion_conAmpliacionActiva_debeLanzarReglaNegocio() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFechaPresentacion(LocalDateTime.now());
        solicitud.setFechaLimite(LocalDate.now().plusDays(10));

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(ampliacionRepository.existsBySolicitud_IdSolicitudAndEstadoAmpliacionIn(eq(1L), anyList()))
                .thenReturn(true);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.registrarAmpliacion(
                        1L,
                        new RegistrarAmpliacionPlazoRequest(
                                "Pedido voluminoso",
                                "Informe",
                                LocalDate.now(),
                                "Funcionario",
                                List.of(new RegistrarEntregaParcialRequest(1, "Entrega", LocalDate.now().plusDays(20), null))
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ampliación activa");
    }

    @Test
    void registrarEncauzamientoTotal_debeCambiarEntidadResponsable() {
        var origen = crearEntidad(1L, "MINJUS", true);
        var destino = crearEntidad(2L, "MINEDU", true);
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setEntidad(origen);
        solicitud.setFechaPresentacion(LocalDateTime.now());

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(encauzamientoRepository.existsBySolicitud_IdSolicitudAndEstadoEncauzamientoIn(eq(1L), anyList()))
                .thenReturn(false);
        when(entidadRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(encauzamientoRepository.save(any(EncauzamientoSolicitud.class))).thenAnswer(inv -> {
            EncauzamientoSolicitud encauzamiento = inv.getArgument(0);
            encauzamiento.setIdEncauzamiento(60L);
            return encauzamiento;
        });

        EncauzamientoSolicitud resultado = solicitudService.registrarEncauzamiento(
                1L,
                new RegistrarEncauzamientoSolicitudRequest(
                        2L,
                        "La información solicitada corresponde a MINEDU",
                        "TOTAL",
                        "Funcionario",
                        "Se deriva el íntegro de la solicitud"
                )
        );

        assertThat(resultado.getAlcance()).isEqualTo(EncauzamientoSolicitud.AlcanceEncauzamiento.TOTAL);
        assertThat(resultado.getEstadoEncauzamiento()).isEqualTo(EncauzamientoSolicitud.EstadoEncauzamiento.DERIVADO);
        assertThat(resultado.getFechaLimiteEncauzamiento()).isEqualTo(DiasHabilesUtil.sumarDiasHabiles(LocalDate.now(), 2));
        assertThat(solicitud.getEntidad()).isEqualTo(destino);
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.EN_REVISION);
        verify(solicitudRepository).save(solicitud);
        verify(encauzamientoRepository).save(any(EncauzamientoSolicitud.class));
    }

    @Test
    void registrarEncauzamientoParcial_debeMantenerEntidadOrigen() {
        var origen = crearEntidad(1L, "MINJUS", true);
        var destino = crearEntidad(2L, "MINEDU", true);
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setEntidad(origen);
        solicitud.setFechaPresentacion(LocalDateTime.now());

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(encauzamientoRepository.existsBySolicitud_IdSolicitudAndEstadoEncauzamientoIn(eq(1L), anyList()))
                .thenReturn(false);
        when(entidadRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(encauzamientoRepository.save(any(EncauzamientoSolicitud.class))).thenAnswer(inv -> inv.getArgument(0));

        EncauzamientoSolicitud resultado = solicitudService.registrarEncauzamiento(
                1L,
                new RegistrarEncauzamientoSolicitudRequest(
                        2L,
                        "Solo una parte corresponde a MINEDU",
                        "PARCIAL",
                        "Funcionario",
                        "La entidad origen mantiene atención del resto"
                )
        );

        assertThat(resultado.getAlcance()).isEqualTo(EncauzamientoSolicitud.AlcanceEncauzamiento.PARCIAL);
        assertThat(solicitud.getEntidad()).isEqualTo(origen);
        verify(solicitudRepository, never()).save(solicitud);
        verify(encauzamientoRepository).save(any(EncauzamientoSolicitud.class));
    }

    @Test
    void registrarEncauzamiento_fueraDePlazo_debeLanzarReglaNegocio() {
        var origen = crearEntidad(1L, "MINJUS", true);
        var destino = crearEntidad(2L, "MINEDU", true);
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setEntidad(origen);
        solicitud.setFechaPresentacion(LocalDateTime.now().minusDays(10));

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(encauzamientoRepository.existsBySolicitud_IdSolicitudAndEstadoEncauzamientoIn(eq(1L), anyList()))
                .thenReturn(false);
        when(entidadRepository.findById(2L)).thenReturn(Optional.of(destino));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.registrarEncauzamiento(
                        1L,
                        new RegistrarEncauzamientoSolicitudRequest(
                                2L,
                                "Competencia de otra entidad",
                                "TOTAL",
                                "Funcionario",
                                null
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("2 días hábiles");
    }

    @Test
    void registrarEncauzamiento_conMismaEntidad_debeLanzarReglaNegocio() {
        var origen = crearEntidad(1L, "MINJUS", true);
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setEntidad(origen);
        solicitud.setFechaPresentacion(LocalDateTime.now());

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(encauzamientoRepository.existsBySolicitud_IdSolicitudAndEstadoEncauzamientoIn(eq(1L), anyList()))
                .thenReturn(false);
        when(entidadRepository.findById(1L)).thenReturn(Optional.of(origen));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.registrarEncauzamiento(
                        1L,
                        new RegistrarEncauzamientoSolicitudRequest(
                                1L,
                                "Competencia de la misma entidad",
                                "TOTAL",
                                "Funcionario",
                                null
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("distinta");
    }

    @Test
    void emitirLiquidacion_debeCalcularLimiteRecojo30DiasHabiles() {
        LocalDate hoy = LocalDate.now();
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFormatoFisico(true);
        solicitud.setFechaPresentacion(LocalDateTime.now());

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(liquidacionRepository.existsBySolicitud_IdSolicitudAndEstadoLiquidacionIn(eq(1L), anyList()))
                .thenReturn(false);
        when(liquidacionRepository.countBySolicitud_IdSolicitud(1L)).thenReturn(0L);
        when(liquidacionRepository.save(any(LiquidacionCostoSolicitud.class))).thenAnswer(inv -> {
            LiquidacionCostoSolicitud liquidacion = inv.getArgument(0);
            liquidacion.setIdLiquidacion(70L);
            return liquidacion;
        });

        LiquidacionCostoSolicitud resultado = solicitudService.emitirLiquidacion(
                1L,
                new RegistrarLiquidacionCostoRequest(
                        null,
                        new BigDecimal("18.50"),
                        "PEN",
                        "Copias simples de 37 folios",
                        hoy,
                        "CASILLA_ELECTRONICA",
                        "Funcionario",
                        "Se notifica cupón por casilla"
                )
        );

        assertThat(resultado.getCodigoLiquidacion()).startsWith("CUPON-" + hoy.getYear() + "-00001-");
        assertThat(resultado.getEstadoLiquidacion()).isEqualTo(LiquidacionCostoSolicitud.EstadoLiquidacion.NOTIFICADA);
        assertThat(resultado.getFechaLimiteRecojo()).isEqualTo(DiasHabilesUtil.sumarDiasHabiles(hoy, 30));
        assertThat(resultado.getMedioNotificacion()).isEqualTo(Solicitud.CanalNotificacion.CASILLA_ELECTRONICA);
        verify(liquidacionRepository).save(any(LiquidacionCostoSolicitud.class));
    }

    @Test
    void emitirLiquidacion_despuesDelDia9_debeLanzarReglaNegocio() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFormatoFisico(true);
        solicitud.setFechaPresentacion(LocalDateTime.now().minusDays(20));

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(liquidacionRepository.existsBySolicitud_IdSolicitudAndEstadoLiquidacionIn(eq(1L), anyList()))
                .thenReturn(false);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.emitirLiquidacion(
                        1L,
                        new RegistrarLiquidacionCostoRequest(
                                null,
                                BigDecimal.ONE,
                                "PEN",
                                "Copias físicas",
                                LocalDate.now(),
                                "CASILLA_ELECTRONICA",
                                "Funcionario",
                                null
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("día 9");
    }

    @Test
    void emitirLiquidacion_sinEntregaFisica_debeLanzarReglaNegocio() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFormatoDigital(true);
        solicitud.setFormatoFisico(false);
        solicitud.setCopiaSimple(false);
        solicitud.setCopiaCertificada(false);
        solicitud.setFechaPresentacion(LocalDateTime.now());

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> solicitudService.emitirLiquidacion(
                        1L,
                        new RegistrarLiquidacionCostoRequest(
                                null,
                                BigDecimal.ONE,
                                "PEN",
                                "Copias físicas",
                                LocalDate.now(),
                                "CASILLA_ELECTRONICA",
                                "Funcionario",
                                null
                        )
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("entrega física");
    }

    @Test
    void actualizarLiquidacion_recojoDebeMarcarSolicitudRespondida() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        var liquidacion = new LiquidacionCostoSolicitud();
        liquidacion.setIdLiquidacion(70L);
        liquidacion.setSolicitud(solicitud);
        liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.PAGADA);
        liquidacion.setMonto(BigDecimal.ONE);
        liquidacion.setTrazabilidad("Liquidación notificada");

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(liquidacionRepository.findById(70L)).thenReturn(Optional.of(liquidacion));
        when(liquidacionRepository.save(liquidacion)).thenReturn(liquidacion);

        LiquidacionCostoSolicitud resultado = solicitudService.actualizarLiquidacion(
                1L,
                70L,
                new ActualizarLiquidacionCostoRequest("RECOGIDA", null, LocalDate.now(), "Funcionario", "Ciudadano recogió copias")
        );

        assertThat(resultado.getEstadoLiquidacion()).isEqualTo(LiquidacionCostoSolicitud.EstadoLiquidacion.RECOGIDA);
        assertThat(resultado.getFechaRecojo()).isEqualTo(LocalDate.now());
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.RESPONDIDA);
        verify(solicitudRepository).save(solicitud);
    }

    @Test
    void procesarLiquidacionesVencidas_debeArchivarPorNoRecojo() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        var liquidacion = new LiquidacionCostoSolicitud();
        liquidacion.setIdLiquidacion(70L);
        liquidacion.setSolicitud(solicitud);
        liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.NOTIFICADA);
        liquidacion.setFechaLimiteRecojo(LocalDate.now().minusDays(1));
        liquidacion.setTrazabilidad("Liquidación notificada");

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(liquidacionRepository.findById(liquidacion.getId())).thenReturn(Optional.of(liquidacion));
        when(liquidacionRepository.findByEstadoLiquidacionInAndFechaLimiteRecojoBefore(anyList(), any(LocalDate.class)))
                .thenReturn(List.of(liquidacion));
        when(liquidacionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<LiquidacionCostoSolicitud> resultado = solicitudService.procesarLiquidacionesVencidas();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstadoLiquidacion()).isEqualTo(LiquidacionCostoSolicitud.EstadoLiquidacion.ARCHIVADA);
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.CONCLUIDA);
        verify(solicitudRepository).save(solicitud);
    }

    @Test
    void actualizarEntregaParcial_entregadaDebeMarcarFechaReal() {
        var solicitud = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.EN_REVISION);
        var ampliacion = new AmpliacionPlazoSolicitud();
        ampliacion.setIdAmpliacion(50L);
        ampliacion.setSolicitud(solicitud);
        ampliacion.setEstadoAmpliacion(AmpliacionPlazoSolicitud.EstadoAmpliacion.NOTIFICADA);
        var entrega = new CronogramaEntregaParcialSolicitud();
        entrega.setIdEntrega(80L);
        entrega.setAmpliacion(ampliacion);
        entrega.setNumeroEntrega(1);
        entrega.setFechaProgramada(LocalDate.now().plusDays(5));
        entrega.setEstado(CronogramaEntregaParcialSolicitud.EstadoEntregaParcial.PROGRAMADA);

        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));
        when(ampliacionRepository.findById(50L)).thenReturn(Optional.of(ampliacion));
        when(cronogramaRepository.findById(80L)).thenReturn(Optional.of(entrega));
        when(cronogramaRepository.save(entrega)).thenReturn(entrega);
        when(cronogramaRepository.findByAmpliacion_IdAmpliacionOrderByNumeroEntregaAsc(50L)).thenReturn(List.of(entrega));

        CronogramaEntregaParcialSolicitud resultado = solicitudService.actualizarEntregaParcial(
                1L,
                50L,
                80L,
                new ActualizarEntregaParcialRequest("ENTREGADA", LocalDate.now(), "Entregado por casilla")
        );

        assertThat(resultado.getEstado()).isEqualTo(CronogramaEntregaParcialSolicitud.EstadoEntregaParcial.ENTREGADA);
        assertThat(resultado.getFechaEntregaReal()).isEqualTo(LocalDate.now());
        verify(cronogramaRepository).save(entrega);
        verify(ampliacionRepository).save(ampliacion);
    }

    @Test
    void eliminarSolicitud_debeInvocarDeleteById() {
        solicitudService.eliminarSolicitud(1L);

        verify(solicitudRepository).deleteById(1L);
    }

    @Test
    void count_debeRetornarCuenta() {
        when(solicitudRepository.count()).thenReturn(25L);

        long resultado = solicitudService.count();

        assertThat(resultado).isEqualTo(25L);
    }

    @Test
    void countByEntidadIdAndEstado_debeConvertirEstadoYContar() {
        when(solicitudRepository.countByEntidadAndEstado(eq(5L), eq(Solicitud.EstadoSolicitud.EN_REVISION)))
                .thenReturn(3L);

        long resultado = solicitudService.countByEntidadIdAndEstado(5L, "EN_REVISION");

        assertThat(resultado).isEqualTo(3L);
    }

    @Test
    void countByEntidadIdAndEstado_estadoInvalido_debeUsarRecepcionada() {
        when(solicitudRepository.countByEntidadAndEstado(eq(5L), eq(Solicitud.EstadoSolicitud.RECEPCIONADA)))
                .thenReturn(1L);

        long resultado = solicitudService.countByEntidadIdAndEstado(5L, "INVALIDO");

        assertThat(resultado).isEqualTo(1L);
    }

    @Test
    void obtenerSeguimientoPlazo_debeCalcularPlazosYRetornarDTO() {
        Long solicitudId = 1L;
        Solicitud solicitud = crearSolicitud(solicitudId, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        LocalDateTime fechaPresentacion = LocalDateTime.of(2026, 7, 1, 10, 0); // Miércoles 1 de julio
        solicitud.setFechaPresentacion(fechaPresentacion);

        when(solicitudRepository.findById(eq(solicitudId))).thenReturn(Optional.of(solicitud));
        
        LocalDate fechaRegistro = fechaPresentacion.toLocalDate();
        LocalDate fechaVencimiento = LocalDate.of(2026, 7, 15);
        when(plazoCalculadorService.calcularFechaVencimiento(eq(fechaRegistro), eq(10)))
                .thenReturn(fechaVencimiento);
        when(plazoCalculadorService.verificarExcesoDePlazo(eq(fechaRegistro), eq(10)))
                .thenReturn(false);

        PlazoSeguimientoDTO resultado = solicitudService.obtenerSeguimientoPlazo(solicitudId);

        assertThat(resultado).isNotNull();
        assertThat(resultado.fechaRegistro()).isEqualTo(fechaRegistro);
        assertThat(resultado.fechaVencimiento()).isEqualTo(fechaVencimiento);
        assertThat(resultado.enSilencioAdministrativo()).isFalse();
        assertThat(resultado.diasRestantes()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void listarTodasAccesibles_debeFiltrarYMapearDTO() {
        Solicitud s = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findAll()).thenReturn(List.of(s));
        when(autorizacion.filtrarSolicitudesAccesibles(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<SolicitudDTO> resultado = solicitudService.listarTodasAccesibles();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        assertThat(resultado.get(0).expediente()).isEqualTo("SAIP-2026-00001");
        verify(autorizacion).filtrarSolicitudesAccesibles(anyList());
    }

    @Test
    void listarPorCiudadano_debeVerificarAutorizacionYMapearDTO() {
        Solicitud s = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findByCiudadano_IdUsuarioOrderByFechaPresentacionDesc(9L)).thenReturn(List.of(s));

        List<SolicitudDTO> resultado = solicitudService.listarPorCiudadano(9L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        verify(autorizacion).verificarCiudadanoActualOPrivilegiado(9L);
    }

    @Test
    void listarPorEntidad_debeVerificarAutorizacionYMapearDTO() {
        Solicitud s = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findByEntidad_IdEntidadOrderByFechaPresentacionDesc(5L)).thenReturn(List.of(s));

        List<SolicitudDTO> resultado = solicitudService.listarPorEntidad(5L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        verify(autorizacion).verificarEntidadInstitucional(5L);
    }

    @Test
    void listarPorEstado_debeFiltrarYMapearDTO() {
        Solicitud s = crearSolicitud(1L, "SAIP-2026-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findByEstado(Solicitud.EstadoSolicitud.RECEPCIONADA)).thenReturn(List.of(s));
        when(autorizacion.filtrarSolicitudesAccesibles(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<SolicitudDTO> resultado = solicitudService.listarPorEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(1L);
        verify(autorizacion).filtrarSolicitudesAccesibles(anyList());
    }
}
