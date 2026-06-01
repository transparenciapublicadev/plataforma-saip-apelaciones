package pe.gob.saip.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.EnviarNotificacionRequest;
import pe.gob.saip.backend.model.dto.EstadoMotorNotificacionesDTO;
import pe.gob.saip.backend.model.entity.HistorialTtaip;
import pe.gob.saip.backend.model.entity.IntentoNotificacion;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.HistorialTtaipRepository;
import pe.gob.saip.backend.repository.IntentoNotificacionRepository;
import pe.gob.saip.backend.repository.NotificacionTtaipRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.service.notification.CasillaElectronicaProveedorNotificacion;
import pe.gob.saip.backend.service.notification.MockProveedorNotificacion;
import pe.gob.saip.backend.service.notification.NotificacionProveedorRequest;
import pe.gob.saip.backend.service.notification.NotificacionProveedorResultado;
import pe.gob.saip.backend.service.notification.ProveedorNotificacion;
import pe.gob.saip.backend.service.notification.SmtpCorreoProveedorNotificacion;

@Service
public class MotorNotificacionesService {

    private static final String MODO_MOCK = "MOCK";
    private static final String MODO_SMTP = "SMTP";

    private final IntentoNotificacionRepository intentoRepository;
    private final NotificacionTtaipRepository notificacionRepository;
    private final SolicitudRepository solicitudRepository;
    private final HistorialTtaipRepository historialRepository;
    private final MockProveedorNotificacion mockProveedor;
    private final SmtpCorreoProveedorNotificacion smtpProveedor;
    private final CasillaElectronicaProveedorNotificacion casillaProveedor;
    private final String modo;
    private final String smtpHost;
    private final String smtpRemitente;
    private final boolean smtpAuth;
    private final String smtpUsername;
    private final String smtpPassword;

    public MotorNotificacionesService(
            IntentoNotificacionRepository intentoRepository,
            NotificacionTtaipRepository notificacionRepository,
            SolicitudRepository solicitudRepository,
            HistorialTtaipRepository historialRepository,
            MockProveedorNotificacion mockProveedor,
            SmtpCorreoProveedorNotificacion smtpProveedor,
            CasillaElectronicaProveedorNotificacion casillaProveedor,
            @Value("${app.notifications.mode:MOCK}") String modo,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${app.notifications.mail.from:}") String smtpRemitente,
            @Value("${spring.mail.properties.mail.smtp.auth:false}") boolean smtpAuth,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.password:}") String smtpPassword) {
        this.intentoRepository = intentoRepository;
        this.notificacionRepository = notificacionRepository;
        this.solicitudRepository = solicitudRepository;
        this.historialRepository = historialRepository;
        this.mockProveedor = mockProveedor;
        this.smtpProveedor = smtpProveedor;
        this.casillaProveedor = casillaProveedor;
        this.modo = normalizar(modo, MODO_MOCK);
        this.smtpHost = smtpHost;
        this.smtpRemitente = smtpRemitente;
        this.smtpAuth = smtpAuth;
        this.smtpUsername = smtpUsername;
        this.smtpPassword = smtpPassword;
    }

    @Transactional
    public IntentoNotificacion enviarNotificacionTtaip(
            Long expedienteId,
            Long notificacionId,
            EnviarNotificacionRequest request) {
        NotificacionTtaip notificacion = notificacionRepository
                .findByIdNotificacionAndExpediente_IdExpedienteTtaip(notificacionId, expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Notificación TTAIP no encontrada"));

        IntentoNotificacion.CanalEnvio canal = resolverCanal(
                primerValor(notificacion.getMedioNotificacion(), notificacion.getMedio()));
        String correlacion = nuevaCorrelacion();
        NotificacionProveedorResultado resultado = invocarProveedor(
                correlacion,
                canal,
                notificacion.getDestinatarioEmail(),
                request);

        IntentoNotificacion intento = construirIntento(
                IntentoNotificacion.OrigenNotificacion.TTAIP,
                canal,
                resultado,
                correlacion,
                request,
                notificacion.getDestinatarioNombre(),
                notificacion.getDestinatarioEmail());
        intento.setNotificacionTtaip(notificacion);
        intento = intentoRepository.save(intento);

        actualizarNotificacionTtaip(notificacion, canal, resultado, intento);
        notificacionRepository.save(notificacion);
        registrarHistorialProveedor(notificacion, intento);
        return intento;
    }

    @Transactional(readOnly = true)
    public List<IntentoNotificacion> listarIntentosTtaip(Long expedienteId, Long notificacionId) {
        notificacionRepository.findByIdNotificacionAndExpediente_IdExpedienteTtaip(notificacionId, expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Notificación TTAIP no encontrada"));
        return intentoRepository.findByNotificacionTtaip_IdNotificacionOrderByFechaIntentoAsc(notificacionId);
    }

    @Transactional
    public IntentoNotificacion enviarNotificacionSaip(Long solicitudId, EnviarNotificacionRequest request) {
        Solicitud solicitud = solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud SAIP no encontrada"));
        IntentoNotificacion.CanalEnvio canal = resolverCanal(
                solicitud.getCanalNotificacion() == null ? null : solicitud.getCanalNotificacion().name());
        String correlacion = nuevaCorrelacion();
        String contacto = solicitud.getCiudadano() == null ? null : solicitud.getCiudadano().getEmail();
        String destinatario = solicitud.getCiudadano() == null ? null : solicitud.getCiudadano().getNombreCompleto();
        NotificacionProveedorResultado resultado = invocarProveedor(correlacion, canal, contacto, request);

        IntentoNotificacion intento = construirIntento(
                IntentoNotificacion.OrigenNotificacion.SAIP,
                canal,
                resultado,
                correlacion,
                request,
                destinatario,
                contacto);
        intento.setSolicitud(solicitud);
        return intentoRepository.save(intento);
    }

    @Transactional(readOnly = true)
    public List<IntentoNotificacion> listarIntentosSaip(Long solicitudId) {
        solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud SAIP no encontrada"));
        return intentoRepository.findBySolicitud_IdSolicitudOrderByFechaIntentoAsc(solicitudId);
    }

    public EstadoMotorNotificacionesDTO obtenerEstadoSeguro() {
        return new EstadoMotorNotificacionesDTO(
                modo,
                true,
                true,
                smtpConfigurado(),
                "PENDIENTE_CONTRATO_API_OFICIAL",
                "La respuesta no expone credenciales ni valores sensibles de configuración.");
    }

    private NotificacionProveedorResultado invocarProveedor(
            String correlacion,
            IntentoNotificacion.CanalEnvio canal,
            String destinatario,
            EnviarNotificacionRequest request) {
        boolean forzarFalloMock = Boolean.TRUE.equals(request.forzarFalloMock());
        if (forzarFalloMock && !MODO_MOCK.equals(modo)) {
            throw new IllegalArgumentException("El fallo forzado solo está disponible en modo MOCK");
        }

        ProveedorNotificacion proveedor = resolverProveedor(canal);
        if (proveedor == null) {
            return NotificacionProveedorResultado.noDisponible(
                    "CANAL_SIN_PROVEEDOR_CONFIGURADO_" + canal.name());
        }
        try {
            return proveedor.enviar(new NotificacionProveedorRequest(
                    correlacion,
                    canal,
                    destinatario,
                    request.asunto(),
                    request.contenido(),
                    forzarFalloMock));
        } catch (RuntimeException ex) {
            return NotificacionProveedorResultado.fallido(
                    "PROVIDER_FAILURE:" + ex.getClass().getSimpleName());
        }
    }

    private ProveedorNotificacion resolverProveedor(IntentoNotificacion.CanalEnvio canal) {
        if (MODO_MOCK.equals(modo)) {
            return mockProveedor;
        }
        if (MODO_SMTP.equals(modo)
                && canal == IntentoNotificacion.CanalEnvio.CORREO_ELECTRONICO
                && smtpConfigurado()) {
            return smtpProveedor;
        }
        if (canal == IntentoNotificacion.CanalEnvio.CASILLA_ELECTRONICA) {
            return casillaProveedor;
        }
        return null;
    }

    private IntentoNotificacion construirIntento(
            IntentoNotificacion.OrigenNotificacion origen,
            IntentoNotificacion.CanalEnvio canal,
            NotificacionProveedorResultado resultado,
            String correlacion,
            EnviarNotificacionRequest request,
            String destinatario,
            String contacto) {
        IntentoNotificacion intento = new IntentoNotificacion();
        intento.setOrigen(origen);
        intento.setCanal(canal);
        intento.setProveedor(resolverNombreProveedor(canal));
        intento.setEstado(resultado.estado());
        intento.setDestinatarioNombre(destinatario);
        intento.setDestinatarioContacto(contacto);
        intento.setAsunto(request.asunto());
        intento.setCodigoCorrelacion(correlacion);
        intento.setCodigoEnvio(resultado.codigoEnvio());
        intento.setCodigoConstancia(resultado.codigoConstancia());
        intento.setConstanciaEnvio(resultado.constanciaEnvio());
        intento.setAcuseAutomatico(resultado.acuseAutomatico());
        intento.setEstadoAcuse(resultado.estadoAcuse());
        intento.setMensajeTecnicoSanitizado(sanitizar(resultado.mensajeTecnicoSanitizado()));
        intento.setResponsable(request.responsable());
        intento.setFechaRespuesta(LocalDateTime.now());
        intento.setTrazabilidad("Intento " + correlacion + " procesado por " + intento.getProveedor()
                + " con resultado " + resultado.estado());
        return intento;
    }

    private void actualizarNotificacionTtaip(
            NotificacionTtaip notificacion,
            IntentoNotificacion.CanalEnvio canal,
            NotificacionProveedorResultado resultado,
            IntentoNotificacion intento) {
        notificacion.setMedioNotificacion(canal.name());
        notificacion.setMedio(canal.name());
        notificacion.setFechaEnvio(LocalDateTime.now());
        asignarSiPresente(resultado.codigoEnvio(), notificacion::setCodigoEnvio);
        asignarSiPresente(resultado.codigoConstancia(), notificacion::setCodigoConstancia);
        asignarSiPresente(resultado.constanciaEnvio(), notificacion::setConstanciaEnvio);
        asignarSiPresente(resultado.acuseAutomatico(), notificacion::setAcuseAutomatico);
        asignarSiPresente(resultado.estadoAcuse(), notificacion::setEstadoAcuse);

        switch (resultado.estado()) {
            case ENTREGADO -> {
                notificacion.setEstado("ENTREGADA");
                notificacion.setResultadoNotificacion("ENTREGADA_POR_" + intento.getProveedor());
            }
            case ENVIADO -> {
                notificacion.setEstado("ENVIADA");
                notificacion.setResultadoNotificacion("ENVIADA_POR_" + intento.getProveedor());
            }
            case FALLIDO, NO_DISPONIBLE -> {
                notificacion.setEstado("FALLIDA");
                notificacion.setResultadoNotificacion("FALLO_PROVEEDOR_" + intento.getProveedor());
            }
            default -> notificacion.setEstado("PENDIENTE");
        }
        notificacion.setTrazabilidad(anexar(
                notificacion.getTrazabilidad(),
                intento.getTrazabilidad() + detalleSanitizado(intento.getMensajeTecnicoSanitizado())));
    }

    private void registrarHistorialProveedor(NotificacionTtaip notificacion, IntentoNotificacion intento) {
        HistorialTtaip historial = new HistorialTtaip();
        historial.setExpediente(notificacion.getExpediente());
        historial.setTipoEvento(HistorialTtaip.TipoEvento.ENVIO_PROVEEDOR_REGISTRADO);
        historial.setDescripcion("Intento de notificación " + intento.getCodigoCorrelacion()
                + " procesado por " + intento.getProveedor() + " con resultado " + intento.getEstado());
        historial.setActor(intento.getResponsable());
        historialRepository.save(historial);
    }

    private String resolverNombreProveedor(IntentoNotificacion.CanalEnvio canal) {
        ProveedorNotificacion proveedor = resolverProveedor(canal);
        return proveedor == null ? "NO_CONFIGURADO" : proveedor.nombre();
    }

    private IntentoNotificacion.CanalEnvio resolverCanal(String canal) {
        String valor = normalizar(canal, IntentoNotificacion.CanalEnvio.CASILLA_ELECTRONICA.name());
        try {
            return IntentoNotificacion.CanalEnvio.valueOf(valor);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Canal de notificación no válido: " + valor, ex);
        }
    }

    private boolean smtpConfigurado() {
        return tieneValor(smtpHost)
                && tieneValor(smtpRemitente)
                && (!smtpAuth || (tieneValor(smtpUsername) && tieneValor(smtpPassword)));
    }

    private boolean tieneValor(String valor) {
        return valor != null && !valor.isBlank();
    }

    private String nuevaCorrelacion() {
        return "NOTIF-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 16).toUpperCase(Locale.ROOT);
    }

    private String primerValor(String principal, String alternativo) {
        return principal == null || principal.isBlank() ? alternativo : principal;
    }

    private String normalizar(String valor, String fallback) {
        return valor == null || valor.isBlank() ? fallback : valor.trim().toUpperCase(Locale.ROOT);
    }

    private String sanitizar(String mensaje) {
        if (mensaje == null) {
            return null;
        }
        String sanitizado = mensaje.replace("\r", " ").replace("\n", " ");
        return sanitizado.substring(0, Math.min(sanitizado.length(), 500));
    }

    private String detalleSanitizado(String mensaje) {
        return mensaje == null || mensaje.isBlank() ? "" : ". Detalle: " + mensaje;
    }

    private String anexar(String actual, String nuevoValor) {
        return actual == null || actual.isBlank() ? nuevoValor : actual + System.lineSeparator() + nuevoValor;
    }

    private void asignarSiPresente(String valor, java.util.function.Consumer<String> asignador) {
        if (valor != null && !valor.isBlank()) {
            asignador.accept(valor);
        }
    }
}
