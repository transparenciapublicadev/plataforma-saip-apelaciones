package pe.gob.saip.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.EnviarNotificacionRequest;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.IntentoNotificacion;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.HistorialTtaipRepository;
import pe.gob.saip.backend.repository.IntentoNotificacionRepository;
import pe.gob.saip.backend.repository.NotificacionTtaipRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.service.notification.CasillaElectronicaProveedorNotificacion;
import pe.gob.saip.backend.service.notification.FcmPushProveedorNotificacion;
import pe.gob.saip.backend.service.notification.MockProveedorNotificacion;
import pe.gob.saip.backend.service.notification.SmtpCorreoProveedorNotificacion;
import pe.gob.saip.backend.service.notification.TokenPushProtector;

@ExtendWith(MockitoExtension.class)
class MotorNotificacionesServiceTest {

    @Mock
    private IntentoNotificacionRepository intentoRepository;

    @Mock
    private NotificacionTtaipRepository notificacionRepository;

    @Mock
    private SolicitudRepository solicitudRepository;

    @Mock
    private HistorialTtaipRepository historialRepository;

    @Mock
    private SmtpCorreoProveedorNotificacion smtpProveedor;

    private MotorNotificacionesService service;

    @BeforeEach
    void setUp() {
        service = new MotorNotificacionesService(
                intentoRepository,
                notificacionRepository,
                solicitudRepository,
                historialRepository,
                new MockProveedorNotificacion(true),
                smtpProveedor,
                new CasillaElectronicaProveedorNotificacion(),
                crearProveedorFcm(),
                "MOCK",
                "localhost",
                "no-reply@example.test",
                false,
                "",
                "");
    }

    @Test
    void enviarNotificacionTtaipRegistraEntregaMockYActualizaEvidencia() {
        configurarPersistenciaIntento();
        NotificacionTtaip notificacion = crearNotificacionTtaip();
        when(notificacionRepository.findByIdNotificacionAndExpediente_IdExpedienteTtaip(7L, 5L))
                .thenReturn(Optional.of(notificacion));

        IntentoNotificacion intento = service.enviarNotificacionTtaip(
                5L,
                7L,
                new EnviarNotificacionRequest("Resolución TTAIP", "Contenido trazable", "TTAIP", false));

        assertThat(intento.getEstado()).isEqualTo(IntentoNotificacion.EstadoIntento.ENTREGADO);
        assertThat(intento.getProveedor()).isEqualTo("MOCK");
        assertThat(intento.getCodigoConstancia()).startsWith("CONST-MOCK-NOTIF-");
        assertThat(notificacion.getEstado()).isEqualTo("ENTREGADA");
        assertThat(notificacion.getResultadoNotificacion()).isEqualTo("ENTREGADA_POR_MOCK");
        assertThat(notificacion.getTrazabilidad()).contains("procesado por MOCK");
        verify(notificacionRepository).save(notificacion);
        verify(historialRepository).save(any());
    }

    @Test
    void enviarNotificacionTtaipConFalloMockPersisteFallaSinOcultarla() {
        configurarPersistenciaIntento();
        NotificacionTtaip notificacion = crearNotificacionTtaip();
        when(notificacionRepository.findByIdNotificacionAndExpediente_IdExpedienteTtaip(7L, 5L))
                .thenReturn(Optional.of(notificacion));

        IntentoNotificacion intento = service.enviarNotificacionTtaip(
                5L,
                7L,
                new EnviarNotificacionRequest("Resolución TTAIP", "Contenido trazable", "TTAIP", true));

        assertThat(intento.getEstado()).isEqualTo(IntentoNotificacion.EstadoIntento.FALLIDO);
        assertThat(intento.getMensajeTecnicoSanitizado()).isEqualTo("MOCK_PROVIDER_CONTROLLED_FAILURE");
        assertThat(notificacion.getEstado()).isEqualTo("FALLIDA");
        assertThat(notificacion.getResultadoNotificacion()).isEqualTo("FALLO_PROVEEDOR_MOCK");
    }

    @Test
    void enviarNotificacionSaipRespetaCanalFormalElegido() {
        configurarPersistenciaIntento();
        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setNombreCompleto("Ciudadano Demo");
        ciudadano.setEmail("ciudadano@example.test");

        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(9L);
        solicitud.setCiudadano(ciudadano);
        solicitud.setCanalNotificacion(Solicitud.CanalNotificacion.CASILLA_ELECTRONICA);
        when(solicitudRepository.findById(9L)).thenReturn(Optional.of(solicitud));

        IntentoNotificacion intento = service.enviarNotificacionSaip(
                9L,
                new EnviarNotificacionRequest("Estado SAIP", "Contenido trazable", "FUNCIONARIO", false));

        assertThat(intento.getOrigen()).isEqualTo(IntentoNotificacion.OrigenNotificacion.SAIP);
        assertThat(intento.getCanal()).isEqualTo(IntentoNotificacion.CanalEnvio.CASILLA_ELECTRONICA);
        assertThat(intento.getEstado()).isEqualTo(IntentoNotificacion.EstadoIntento.ENTREGADO);
        assertThat(intento.getSolicitud()).isSameAs(solicitud);
    }

    @Test
    void enviarNotificacionTtaipRechazaCanalDesconocidoSinConvertirloEnCasillaElectronica() {
        NotificacionTtaip notificacion = crearNotificacionTtaip();
        notificacion.setMedioNotificacion("CANAL_DESCONOCIDO");
        when(notificacionRepository.findByIdNotificacionAndExpediente_IdExpedienteTtaip(7L, 5L))
                .thenReturn(Optional.of(notificacion));

        assertThatThrownBy(() -> service.enviarNotificacionTtaip(
                5L,
                7L,
                new EnviarNotificacionRequest("Resolución TTAIP", "Contenido trazable", "TTAIP", false)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Canal de notificación no válido");
    }

    @Test
    void enviarNotificacionSaipConSmtpIncompletoReportaProveedorNoConfigurado() {
        service = new MotorNotificacionesService(
                intentoRepository,
                notificacionRepository,
                solicitudRepository,
                historialRepository,
                new MockProveedorNotificacion(true),
                smtpProveedor,
                new CasillaElectronicaProveedorNotificacion(),
                crearProveedorFcm(),
                "SMTP",
                "",
                "",
                true,
                "",
                "");
        configurarPersistenciaIntento();
        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setNombreCompleto("Ciudadano Demo");
        ciudadano.setEmail("ciudadano@example.test");
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(9L);
        solicitud.setCiudadano(ciudadano);
        solicitud.setCanalNotificacion(Solicitud.CanalNotificacion.CORREO_ELECTRONICO);
        when(solicitudRepository.findById(9L)).thenReturn(Optional.of(solicitud));

        IntentoNotificacion intento = service.enviarNotificacionSaip(
                9L,
                new EnviarNotificacionRequest("Estado SAIP", "Contenido trazable", "FUNCIONARIO", false));

        assertThat(intento.getProveedor()).isEqualTo("NO_CONFIGURADO");
        assertThat(intento.getEstado()).isEqualTo(IntentoNotificacion.EstadoIntento.NO_DISPONIBLE);
        assertThat(service.obtenerEstadoSeguro().smtpHostConfigurado()).isFalse();
    }

    @Test
    void enviarNotificacionTtaipPushSinCredencialesReportaFcmNoConfigurado() {
        service = new MotorNotificacionesService(
                intentoRepository,
                notificacionRepository,
                solicitudRepository,
                historialRepository,
                new MockProveedorNotificacion(true),
                smtpProveedor,
                new CasillaElectronicaProveedorNotificacion(),
                crearProveedorFcm(),
                "SMTP",
                "localhost",
                "no-reply@example.test",
                false,
                "",
                "");
        configurarPersistenciaIntento();
        NotificacionTtaip notificacion = crearNotificacionTtaip();
        notificacion.setMedioNotificacion("PUSH_FCM");
        when(notificacionRepository.findByIdNotificacionAndExpediente_IdExpedienteTtaip(7L, 5L))
                .thenReturn(Optional.of(notificacion));

        IntentoNotificacion intento = service.enviarNotificacionTtaip(
                5L,
                7L,
                new EnviarNotificacionRequest("Resolución TTAIP", "Contenido trazable", "TTAIP", false));

        assertThat(intento.getCanal()).isEqualTo(IntentoNotificacion.CanalEnvio.PUSH_FCM);
        assertThat(intento.getProveedor()).isEqualTo("FCM");
        assertThat(intento.getEstado()).isEqualTo(IntentoNotificacion.EstadoIntento.NO_DISPONIBLE);
        assertThat(intento.getMensajeTecnicoSanitizado()).isEqualTo("FCM_PUSH_NO_CONFIGURADO");
        assertThat(notificacion.getEstado()).isEqualTo("FALLIDA");
        assertThat(notificacion.getResultadoNotificacion()).isEqualTo("FALLO_PROVEEDOR_FCM");
    }

    private void configurarPersistenciaIntento() {
        when(intentoRepository.save(any(IntentoNotificacion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private NotificacionTtaip crearNotificacionTtaip() {
        ExpedienteTtaip expediente = new ExpedienteTtaip();
        expediente.setIdExpedienteTtaip(5L);

        NotificacionTtaip notificacion = new NotificacionTtaip();
        notificacion.setIdNotificacion(7L);
        notificacion.setExpediente(expediente);
        notificacion.setDestinatarioNombre("Ciudadano Demo");
        notificacion.setDestinatarioEmail("ciudadano@example.test");
        notificacion.setMedioNotificacion("CORREO_ELECTRONICO");
        return notificacion;
    }

    private FcmPushProveedorNotificacion crearProveedorFcm() {
        return new FcmPushProveedorNotificacion(false, "", new TokenPushProtector(""));
    }
}
