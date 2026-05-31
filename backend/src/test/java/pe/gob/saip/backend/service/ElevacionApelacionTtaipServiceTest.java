package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.AdmitirElevacionExcepcionalRequest;
import pe.gob.saip.backend.model.dto.ComunicarOmisionElevacionRequest;
import pe.gob.saip.backend.model.dto.CrearApelacionAnteEntidadRequest;
import pe.gob.saip.backend.model.dto.ElevarApelacionTtaipRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.ElevacionApelacionTtaip;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ElevacionApelacionTtaipRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ElevacionApelacionTtaipServiceTest {

    @Mock
    ElevacionApelacionTtaipRepository elevacionRepository;

    @Mock
    ApelacionService apelacionService;

    @Mock
    SolicitudService solicitudService;

    @Mock
    CiudadanoService ciudadanoService;

    @Mock
    ExpedienteTtaipService expedienteTtaipService;

    @InjectMocks
    ElevacionApelacionTtaipService service;

    @Test
    void registrarPresentacionAnteEntidad_debeReservarApelacionYCalcularDosDiasHabiles() {
        Solicitud solicitud = crearSolicitud();
        Ciudadano ciudadano = solicitud.getCiudadano();
        LocalDate fechaPresentacion = LocalDate.now();
        when(solicitudService.findById(15L)).thenReturn(Optional.of(solicitud));
        when(ciudadanoService.findById(10L)).thenReturn(Optional.of(ciudadano));
        when(apelacionService.save(any(Apelacion.class))).thenAnswer(invocation -> {
            Apelacion apelacion = invocation.getArgument(0);
            apelacion.setIdApelacion(30L);
            apelacion.setExpediente("00030-2026-JUS/TTAIP");
            return apelacion;
        });
        when(elevacionRepository.save(any(ElevacionApelacionTtaip.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Apelacion apelacion = service.registrarPresentacionAnteEntidad(new CrearApelacionAnteEntidadRequest(
                15L,
                10L,
                "Fundamentos suficientes para presentar la apelación ante la entidad pública.",
                fechaPresentacion,
                "cargo-entidad-001.pdf",
                null));

        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        assertThat(apelacion.getExpedienteTtaip()).isNull();
        assertThat(apelacion.getElevacion().getFechaLimiteElevacion())
                .isEqualTo(DiasHabilesUtil.sumarDiasHabiles(fechaPresentacion, 2));
        assertThat(apelacion.getElevacion().getEstadoElevacion())
                .isEqualTo(ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE);
    }

    @Test
    void elevar_dentroDelPlazo_debeAbrirExpedienteEnPrimeraCalificacion() {
        ElevacionApelacionTtaip elevacion = crearElevacion(
                ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE,
                DiasHabilesUtil.sumarDiasHabiles(LocalDate.now(), 2));
        when(elevacionRepository.findByApelacion_IdApelacion(30L)).thenReturn(Optional.of(elevacion));
        when(elevacionRepository.save(elevacion)).thenReturn(elevacion);
        when(apelacionService.save(elevacion.getApelacion())).thenReturn(elevacion.getApelacion());

        Apelacion apelacion = service.elevar(30L, new ElevarApelacionTtaipRequest(
                "Funcionario de Transparencia",
                "expediente-elevado-030.pdf",
                null));

        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        assertThat(elevacion.getEstadoElevacion()).isEqualTo(ElevacionApelacionTtaip.EstadoElevacion.ELEVADA);
        assertThat(elevacion.getFechaElevacionTtaip()).isNotNull();
        verify(expedienteTtaipService).obtenerOCrearParaApelacion(apelacion);
    }

    @Test
    void admitirExcepcionalmente_conOmisionComunicada_debeAbrirExpediente() {
        ElevacionApelacionTtaip elevacion = crearElevacion(
                ElevacionApelacionTtaip.EstadoElevacion.VENCIDA_NO_ELEVADA,
                LocalDate.now().minusDays(1));
        when(elevacionRepository.findByApelacion_IdApelacion(30L)).thenReturn(Optional.of(elevacion));
        when(elevacionRepository.save(elevacion)).thenReturn(elevacion);

        service.comunicarOmision(30L, new ComunicarOmisionElevacionRequest(
                "cargo-y-captura-omision.pdf",
                "La entidad no elevó el recurso dentro del plazo."));
        when(apelacionService.save(elevacion.getApelacion())).thenReturn(elevacion.getApelacion());

        Apelacion apelacion = service.admitirExcepcionalmente(30L, new AdmitirElevacionExcepcionalRequest(
                "Secretaría Técnica TTAIP",
                "Se admite excepcionalmente por omisión acreditada."));

        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        assertThat(elevacion.getEstadoElevacion())
                .isEqualTo(ElevacionApelacionTtaip.EstadoElevacion.ADMITIDA_EXCEPCIONALMENTE);
        assertThat(elevacion.getReferenciaPruebaOmision()).isEqualTo("cargo-y-captura-omision.pdf");
        verify(expedienteTtaipService).obtenerOCrearParaApelacion(apelacion);
    }

    private Solicitud crearSolicitud() {
        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setIdUsuario(10L);
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(5L);
        entidad.setNombre("Entidad Pública");
        entidad.setActiva(true);
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(15L);
        solicitud.setCiudadano(ciudadano);
        solicitud.setEntidad(entidad);
        return solicitud;
    }

    private ElevacionApelacionTtaip crearElevacion(ElevacionApelacionTtaip.EstadoElevacion estado,
                                                    LocalDate fechaLimite) {
        Solicitud solicitud = crearSolicitud();
        Apelacion apelacion = new Apelacion();
        apelacion.setIdApelacion(30L);
        apelacion.setExpediente("00030-2026-JUS/TTAIP");
        apelacion.setSolicitud(solicitud);
        apelacion.setCiudadano(solicitud.getCiudadano());
        apelacion.setEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);

        ElevacionApelacionTtaip elevacion = new ElevacionApelacionTtaip();
        elevacion.setIdElevacion(20L);
        elevacion.setApelacion(apelacion);
        elevacion.setEntidadOrigen(solicitud.getEntidad());
        elevacion.setFechaPresentacionAnteEntidad(LocalDate.now().minusDays(4));
        elevacion.setFechaLimiteElevacion(fechaLimite);
        elevacion.setReferenciaCargoPresentacion("cargo-entidad.pdf");
        elevacion.setEstadoElevacion(estado);
        apelacion.setElevacion(elevacion);
        return elevacion;
    }
}
