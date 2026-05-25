package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.CancelarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.PresentarDescargoEntidadRequest;
import pe.gob.saip.backend.model.dto.RegistrarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.RequerirDescargoEntidadRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.DescargoEntidadTtaip;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.SuspensionPlazoTtaip;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DescargoEntidadTtaipRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.HistorialTtaipRepository;
import pe.gob.saip.backend.repository.NotificacionTtaipRepository;
import pe.gob.saip.backend.repository.ReprocesoNotificacionRepository;
import pe.gob.saip.backend.repository.ResolucionRepository;
import pe.gob.saip.backend.repository.SalaTtaipRepository;
import pe.gob.saip.backend.repository.SuspensionPlazoTtaipRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpedienteTtaipServiceTest {

    @Mock
    ExpedienteTtaipRepository expedienteRepository;

    @Mock
    SalaTtaipRepository salaRepository;

    @Mock
    MiembroTTAIPService miembroService;

    @Mock
    ResolucionRepository resolucionRepository;

    @Mock
    CedulaNotificacionRepository cedulaRepository;

    @Mock
    NotificacionTtaipRepository notificacionRepository;

    @Mock
    ReprocesoNotificacionRepository reprocesoRepository;

    @Mock
    HistorialTtaipRepository historialRepository;

    @Mock
    DescargoEntidadTtaipRepository descargoRepository;

    @Mock
    SuspensionPlazoTtaipRepository suspensionRepository;

    @InjectMocks
    ExpedienteTtaipService service;

    @Test
    void requerirDescargos_debeCrearDescargoYSuspenderPlazoResolucionPor7DiasHabiles() {
        LocalDate fechaAdmision = LocalDate.of(2026, 5, 4);
        LocalDate fechaRequerimiento = LocalDate.of(2026, 5, 5);
        ExpedienteTtaip expediente = crearExpedienteAdmitido(fechaAdmision);
        AtomicReference<SuspensionPlazoTtaip> suspensionGuardada = new AtomicReference<>();

        when(expedienteRepository.findById(100L)).thenReturn(Optional.of(expediente));
        when(descargoRepository.existsByExpediente_IdExpedienteTtaipAndEstadoDescargoIn(eq(100L), anyList()))
                .thenReturn(false);
        when(descargoRepository.save(any(DescargoEntidadTtaip.class))).thenAnswer(inv -> {
            DescargoEntidadTtaip descargo = inv.getArgument(0);
            descargo.setIdDescargo(200L);
            return descargo;
        });
        when(suspensionRepository.save(any(SuspensionPlazoTtaip.class))).thenAnswer(inv -> {
            SuspensionPlazoTtaip suspension = inv.getArgument(0);
            suspension.setIdSuspension(300L);
            suspensionGuardada.set(suspension);
            return suspension;
        });
        when(suspensionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(100L))
                .thenAnswer(inv -> suspensionGuardada.get() != null ? List.of(suspensionGuardada.get()) : List.of());

        DescargoEntidadTtaip resultado = service.requerirDescargos(
                100L,
                new RequerirDescargoEntidadRequest(
                        fechaRequerimiento,
                        "Secretaría Técnica TTAIP",
                        "Se requiere expediente administrativo")
        );

        LocalDate limiteDescargo = DiasHabilesUtil.sumarDiasHabiles(fechaRequerimiento, 7);
        LocalDate limiteBaseResolucion = DiasHabilesUtil.sumarDiasHabiles(fechaAdmision, 10);
        assertThat(resultado.getEstadoDescargo()).isEqualTo(DescargoEntidadTtaip.EstadoDescargo.REQUERIDO);
        assertThat(resultado.getFechaLimiteDescargo()).isEqualTo(limiteDescargo);
        assertThat(suspensionGuardada.get().getDiasSuspendidos()).isEqualTo(7);
        assertThat(expediente.getFechaLimiteResolucion())
                .isEqualTo(DiasHabilesUtil.sumarDiasHabiles(limiteBaseResolucion, 7));
        verify(expedienteRepository).save(expediente);
    }

    @Test
    void presentarDescargo_debeCerrarSuspensionYRecalcularPlazoConDiasEfectivos() {
        LocalDate fechaAdmision = LocalDate.of(2026, 5, 4);
        LocalDate fechaRequerimiento = LocalDate.of(2026, 5, 5);
        LocalDate fechaPresentacion = LocalDate.of(2026, 5, 7);
        ExpedienteTtaip expediente = crearExpedienteAdmitido(fechaAdmision);
        DescargoEntidadTtaip descargo = crearDescargo(expediente, fechaRequerimiento);
        SuspensionPlazoTtaip suspension = crearSuspension(expediente, descargo);

        when(expedienteRepository.findById(100L)).thenReturn(Optional.of(expediente));
        when(descargoRepository.findById(200L)).thenReturn(Optional.of(descargo));
        when(descargoRepository.save(descargo)).thenReturn(descargo);
        when(suspensionRepository.findFirstByDescargo_IdDescargoOrderByFechaCreacionDesc(200L))
                .thenReturn(Optional.of(suspension));
        when(suspensionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(100L))
                .thenReturn(List.of(suspension));

        DescargoEntidadTtaip resultado = service.presentarDescargo(
                100L,
                200L,
                new PresentarDescargoEntidadRequest(
                        fechaPresentacion,
                        "La entidad remite expediente administrativo completo.",
                        "DESCARGO-2026-0001.pdf",
                        "Funcionario de Transparencia",
                        "Cargo recibido")
        );

        LocalDate limiteBaseResolucion = DiasHabilesUtil.sumarDiasHabiles(fechaAdmision, 10);
        assertThat(resultado.getEstadoDescargo()).isEqualTo(DescargoEntidadTtaip.EstadoDescargo.PRESENTADO);
        assertThat(suspension.getEstadoSuspension()).isEqualTo(SuspensionPlazoTtaip.EstadoSuspension.CERRADA);
        assertThat(suspension.getDiasSuspendidos()).isEqualTo(2);
        assertThat(expediente.getFechaLimiteResolucion())
                .isEqualTo(DiasHabilesUtil.sumarDiasHabiles(limiteBaseResolucion, 2));
    }

    @Test
    void procesarDescargosVencidos_debeMarcarVencidoYCerrarSuspensionSinBloquearExpediente() {
        LocalDate fechaAdmision = LocalDate.of(2026, 5, 4);
        LocalDate fechaRequerimiento = LocalDate.of(2026, 5, 5);
        ExpedienteTtaip expediente = crearExpedienteAdmitido(fechaAdmision);
        DescargoEntidadTtaip descargo = crearDescargo(expediente, fechaRequerimiento);
        descargo.setFechaLimiteDescargo(LocalDate.now().minusDays(1));
        SuspensionPlazoTtaip suspension = crearSuspension(expediente, descargo);

        when(descargoRepository.findByEstadoDescargoInAndFechaLimiteDescargoBefore(anyList(), any(LocalDate.class)))
                .thenReturn(List.of(descargo));
        when(suspensionRepository.findFirstByDescargo_IdDescargoOrderByFechaCreacionDesc(200L))
                .thenReturn(Optional.of(suspension));
        when(suspensionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(100L))
                .thenReturn(List.of(suspension));
        when(descargoRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<DescargoEntidadTtaip> resultado = service.procesarDescargosVencidos();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstadoDescargo())
                .isEqualTo(DescargoEntidadTtaip.EstadoDescargo.VENCIDO_SIN_PRESENTACION);
        assertThat(suspension.getEstadoSuspension()).isEqualTo(SuspensionPlazoTtaip.EstadoSuspension.VENCIDA);
        assertThat(expediente.getEstado()).isEqualTo(Apelacion.EstadoApelacion.EN_RESOLUCION);
    }

    @Test
    void registrarInformeOral_debeCrearSuspensionAdicionalPor3DiasHabiles() {
        LocalDate fechaAdmision = LocalDate.of(2026, 5, 4);
        LocalDate fechaSolicitud = LocalDate.of(2026, 5, 6);
        ExpedienteTtaip expediente = crearExpedienteAdmitido(fechaAdmision);
        AtomicReference<SuspensionPlazoTtaip> suspensionGuardada = new AtomicReference<>();

        when(expedienteRepository.findById(100L)).thenReturn(Optional.of(expediente));
        when(suspensionRepository.existsByExpediente_IdExpedienteTtaipAndMotivoSuspensionAndEstadoSuspension(
                100L,
                SuspensionPlazoTtaip.MotivoSuspension.INFORME_ORAL,
                SuspensionPlazoTtaip.EstadoSuspension.ACTIVA)).thenReturn(false);
        when(suspensionRepository.save(any(SuspensionPlazoTtaip.class))).thenAnswer(inv -> {
            SuspensionPlazoTtaip suspension = inv.getArgument(0);
            suspension.setIdSuspension(400L);
            suspensionGuardada.set(suspension);
            return suspension;
        });
        when(suspensionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(100L))
                .thenAnswer(inv -> suspensionGuardada.get() != null ? List.of(suspensionGuardada.get()) : List.of());

        SuspensionPlazoTtaip resultado = service.registrarSuspensionPorInformeOral(
                100L,
                new RegistrarSuspensionTtaipRequest(
                        fechaSolicitud,
                        "CIUDADANO",
                        "Solicitud de informe oral para sustentar la apelación.",
                        "Secretaría Técnica TTAIP",
                        "Registro operativo")
        );

        LocalDate limiteBaseResolucion = DiasHabilesUtil.sumarDiasHabiles(fechaAdmision, 10);
        assertThat(resultado.getMotivoSuspension()).isEqualTo(SuspensionPlazoTtaip.MotivoSuspension.INFORME_ORAL);
        assertThat(resultado.getSolicitante()).isEqualTo(SuspensionPlazoTtaip.SolicitanteSuspension.CIUDADANO);
        assertThat(resultado.getDiasSuspendidos()).isEqualTo(3);
        assertThat(resultado.getFechaFinSuspension()).isEqualTo(DiasHabilesUtil.sumarDiasHabiles(fechaSolicitud, 3));
        assertThat(expediente.getFechaLimiteResolucion())
                .isEqualTo(DiasHabilesUtil.sumarDiasHabiles(limiteBaseResolucion, 3));
    }

    @Test
    void registrarInformacionComplementaria_conDuplicadoActivo_debeLanzarConflictoDeNegocio() {
        ExpedienteTtaip expediente = crearExpedienteAdmitido(LocalDate.of(2026, 5, 4));

        when(expedienteRepository.findById(100L)).thenReturn(Optional.of(expediente));
        when(suspensionRepository.existsByExpediente_IdExpedienteTtaipAndMotivoSuspensionAndEstadoSuspension(
                100L,
                SuspensionPlazoTtaip.MotivoSuspension.INFORMACION_COMPLEMENTARIA,
                SuspensionPlazoTtaip.EstadoSuspension.ACTIVA)).thenReturn(true);

        assertThatThrownBy(() -> service.registrarSuspensionPorInformacionComplementaria(
                        100L,
                        new RegistrarSuspensionTtaipRequest(
                                LocalDate.of(2026, 5, 6),
                                "TTAIP",
                                "Se requiere información complementaria para resolver.",
                                "Secretaría Técnica TTAIP",
                                null)
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ya existe una suspensión activa");
    }

    @Test
    void cancelarSuspensionAdicional_debeQuitarDiasYRecalcularPlazoResolucion() {
        LocalDate fechaAdmision = LocalDate.of(2026, 5, 4);
        ExpedienteTtaip expediente = crearExpedienteAdmitido(fechaAdmision);
        SuspensionPlazoTtaip suspension = crearSuspensionAdicional(
                expediente,
                SuspensionPlazoTtaip.MotivoSuspension.INFORMACION_COMPLEMENTARIA);

        when(expedienteRepository.findById(100L)).thenReturn(Optional.of(expediente));
        when(suspensionRepository.findById(400L)).thenReturn(Optional.of(suspension));
        when(suspensionRepository.save(suspension)).thenReturn(suspension);
        when(suspensionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(100L))
                .thenReturn(List.of(suspension));

        SuspensionPlazoTtaip resultado = service.cancelarSuspension(
                100L,
                400L,
                new CancelarSuspensionTtaipRequest(
                        LocalDate.of(2026, 5, 7),
                        "Secretaría Técnica TTAIP",
                        "Solicitud dejada sin efecto")
        );

        assertThat(resultado.getEstadoSuspension()).isEqualTo(SuspensionPlazoTtaip.EstadoSuspension.CANCELADA);
        assertThat(resultado.getDiasSuspendidos()).isZero();
        assertThat(expediente.getFechaLimiteResolucion())
                .isEqualTo(DiasHabilesUtil.sumarDiasHabiles(fechaAdmision, 10));
    }

    @Test
    void requerirDescargos_sinAdmisionValida_debeLanzarReglaNegocio() {
        ExpedienteTtaip expediente = crearExpedienteAdmitido(LocalDate.of(2026, 5, 4));
        expediente.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        when(expedienteRepository.findById(100L)).thenReturn(Optional.of(expediente));

        assertThatThrownBy(() -> service.requerirDescargos(
                        100L,
                        new RequerirDescargoEntidadRequest(LocalDate.of(2026, 5, 5), "TTAIP", null)
                ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("admisión válida");
    }

    private ExpedienteTtaip crearExpedienteAdmitido(LocalDate fechaAdmision) {
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(10L);
        entidad.setNombre("Ministerio de Justicia y Derechos Humanos");
        entidad.setAcronimo("MINJUS");
        entidad.setActiva(true);

        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(20L);
        solicitud.setEntidad(entidad);

        Apelacion apelacion = new Apelacion();
        apelacion.setIdApelacion(30L);
        apelacion.setSolicitud(solicitud);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_RESOLUCION);

        ExpedienteTtaip expediente = new ExpedienteTtaip();
        expediente.setIdExpedienteTtaip(100L);
        expediente.setNumeroExpediente("00030-2026-JUS/TTAIP");
        expediente.setApelacion(apelacion);
        expediente.setEstado(Apelacion.EstadoApelacion.EN_RESOLUCION);
        expediente.setFechaApertura(fechaAdmision.atStartOfDay());
        expediente.setFechaPrimeraCalificacion(LocalDateTime.of(fechaAdmision, java.time.LocalTime.NOON));
        return expediente;
    }

    private DescargoEntidadTtaip crearDescargo(ExpedienteTtaip expediente, LocalDate fechaRequerimiento) {
        DescargoEntidadTtaip descargo = new DescargoEntidadTtaip();
        descargo.setIdDescargo(200L);
        descargo.setExpediente(expediente);
        descargo.setApelacion(expediente.getApelacion());
        descargo.setEntidad(expediente.getApelacion().getSolicitud().getEntidad());
        descargo.setFechaRequerimiento(fechaRequerimiento);
        descargo.setFechaLimiteDescargo(DiasHabilesUtil.sumarDiasHabiles(fechaRequerimiento, 7));
        descargo.setEstadoDescargo(DescargoEntidadTtaip.EstadoDescargo.REQUERIDO);
        descargo.setTrazabilidad("Requerimiento registrado");
        return descargo;
    }

    private SuspensionPlazoTtaip crearSuspension(ExpedienteTtaip expediente, DescargoEntidadTtaip descargo) {
        SuspensionPlazoTtaip suspension = new SuspensionPlazoTtaip();
        suspension.setIdSuspension(300L);
        suspension.setExpediente(expediente);
        suspension.setDescargo(descargo);
        suspension.setMotivoSuspension(SuspensionPlazoTtaip.MotivoSuspension.DESCARGOS_ENTIDAD);
        suspension.setFechaInicioSuspension(descargo.getFechaRequerimiento());
        suspension.setFechaFinSuspension(descargo.getFechaLimiteDescargo());
        suspension.setDiasSuspendidos(7);
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.ACTIVA);
        return suspension;
    }

    private SuspensionPlazoTtaip crearSuspensionAdicional(ExpedienteTtaip expediente,
                                                         SuspensionPlazoTtaip.MotivoSuspension motivo) {
        SuspensionPlazoTtaip suspension = new SuspensionPlazoTtaip();
        suspension.setIdSuspension(400L);
        suspension.setExpediente(expediente);
        suspension.setMotivoSuspension(motivo);
        suspension.setSolicitante(SuspensionPlazoTtaip.SolicitanteSuspension.TTAIP);
        suspension.setMotivoDetalle("Solicitud de suspensión adicional");
        suspension.setFechaSolicitud(LocalDate.of(2026, 5, 6));
        suspension.setFechaInicioSuspension(LocalDate.of(2026, 5, 6));
        suspension.setFechaFinSuspension(DiasHabilesUtil.sumarDiasHabiles(LocalDate.of(2026, 5, 6), 3));
        suspension.setDiasSuspendidos(3);
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.ACTIVA);
        return suspension;
    }
}
