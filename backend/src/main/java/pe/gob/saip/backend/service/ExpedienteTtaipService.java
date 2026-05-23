package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.HistorialTtaipRepository;
import pe.gob.saip.backend.repository.NotificacionTtaipRepository;
import pe.gob.saip.backend.repository.ResolucionRepository;
import pe.gob.saip.backend.repository.SalaTtaipRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class ExpedienteTtaipService {

    private static final String PRIMERA_SALA = "PRIMERA SALA";
    private static final String SEGUNDA_SALA = "SEGUNDA SALA";
    private static final int RESOLUCION_BASE = 1595;
    private static final int CEDULA_BASE = 15203;

    private final ExpedienteTtaipRepository expedienteRepository;
    private final SalaTtaipRepository salaRepository;
    private final MiembroTTAIPService miembroService;
    private final ResolucionRepository resolucionRepository;
    private final CedulaNotificacionRepository cedulaRepository;
    private final NotificacionTtaipRepository notificacionRepository;
    private final HistorialTtaipRepository historialRepository;

    public ExpedienteTtaipService(ExpedienteTtaipRepository expedienteRepository,
                                  SalaTtaipRepository salaRepository,
                                  MiembroTTAIPService miembroService,
                                  ResolucionRepository resolucionRepository,
                                  CedulaNotificacionRepository cedulaRepository,
                                  NotificacionTtaipRepository notificacionRepository,
                                  HistorialTtaipRepository historialRepository) {
        this.expedienteRepository = expedienteRepository;
        this.salaRepository = salaRepository;
        this.miembroService = miembroService;
        this.resolucionRepository = resolucionRepository;
        this.cedulaRepository = cedulaRepository;
        this.notificacionRepository = notificacionRepository;
        this.historialRepository = historialRepository;
    }

    @Transactional
    public ExpedienteTtaip obtenerOCrearParaApelacion(Apelacion apelacion) {
        if (apelacion.getId() == null) {
            throw new IllegalArgumentException("La apelación debe estar guardada antes de crear el expediente TTAIP");
        }

        return expedienteRepository.findByApelacion_IdApelacion(apelacion.getId())
                .map(expediente -> sincronizarEstado(expediente, apelacion))
                .orElseGet(() -> crearExpediente(apelacion));
    }

    @Transactional
    public Resolucion prepararResolucion(Resolucion resolucion) {
        ExpedienteTtaip expediente = obtenerOCrearParaApelacion(resolucion.getApelacion());
        resolucion.setExpedienteTtaip(expediente);
        resolucion.setSalaTtaip(expediente.getSala());

        if (resolucion.getNumeroResolucion() == null || resolucion.getNumeroResolucion().isBlank()) {
            resolucion.setNumeroResolucion(generarNumeroResolucion(expediente));
        }

        return resolucion;
    }

    @Transactional
    public void registrarResolucion(Resolucion resolucion) {
        if (resolucion.getId() == null) {
            throw new IllegalArgumentException("La resolución debe estar guardada antes de generar cédulas");
        }

        ExpedienteTtaip expediente = resolucion.getExpedienteTtaip() != null
                ? resolucion.getExpedienteTtaip()
                : obtenerOCrearParaApelacion(resolucion.getApelacion());

        actualizarFechasPorResolucion(expediente, resolucion);
        expediente.setEstado(resolucion.getApelacion().getEstado());
        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - %s emitida por %s".formatted(
                        LocalDateTime.now(),
                        resolucion.getTipoResolucion(),
                        resolucion.getSalaTtaip() != null ? resolucion.getSalaTtaip().getNombre() : "sala TTAIP"
                )
        ));
        expedienteRepository.save(expediente);
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.RESOLUCION_EMITIDA,
                "%s registrada en %s".formatted(
                        resolucion.getTipoResolucion(),
                        resolucion.getSalaTtaip() != null ? resolucion.getSalaTtaip().getNombre() : "sala TTAIP"
                ),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                "TTAIP",
                resolucion.getNumeroResolucion()
        );

        crearCedulaYNotificacionSiFalta(resolucion, expediente, CedulaNotificacion.DestinatarioNotificacion.CIUDADANO);
        crearCedulaYNotificacionSiFalta(resolucion, expediente, CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA);
    }

    private ExpedienteTtaip crearExpediente(Apelacion apelacion) {
        SalaTtaip sala = seleccionarSala();
        ExpedienteTtaip expediente = new ExpedienteTtaip();
        expediente.setNumeroExpediente(apelacion.getExpediente());
        expediente.setApelacion(apelacion);
        expediente.setSala(sala);
        expediente.setEstado(apelacion.getEstado());
        expediente.setFechaApertura(LocalDateTime.now());
        expediente.setTrazabilidadMinima(agregarTraza(null, LocalDateTime.now() + " - Expediente TTAIP abierto sin etapa de elevación"));
        expediente.setMiembrosAsignados(new LinkedHashSet<>(miembroService.obtenerMiembrosTTAIPActivosPorSala(sala.getNombre())));
        ExpedienteTtaip saved = expedienteRepository.save(expediente);
        registrarHistorial(
                saved,
                HistorialTtaip.TipoEvento.APERTURA_EXPEDIENTE,
                "Expediente TTAIP abierto sin etapa de elevación; sala asignada: " + sala.getNombre(),
                null,
                saved.getEstado() != null ? saved.getEstado().name() : null,
                "SISTEMA",
                saved.getNumeroExpediente()
        );
        apelacion.setExpedienteTtaip(saved);
        return saved;
    }

    private ExpedienteTtaip sincronizarEstado(ExpedienteTtaip expediente, Apelacion apelacion) {
        if (apelacion.getEstado() != null && apelacion.getEstado() != expediente.getEstado()) {
            String estadoAnterior = expediente.getEstado() != null ? expediente.getEstado().name() : null;
            expediente.setEstado(apelacion.getEstado());
            expedienteRepository.save(expediente);
            registrarHistorial(
                    expediente,
                    HistorialTtaip.TipoEvento.CAMBIO_ESTADO,
                    "Estado del expediente actualizado desde la apelación asociada.",
                    estadoAnterior,
                    apelacion.getEstado().name(),
                    "SISTEMA",
                    expediente.getNumeroExpediente()
            );
        }
        apelacion.setExpedienteTtaip(expediente);
        return expediente;
    }

    private SalaTtaip seleccionarSala() {
        List<SalaTtaip> salas = salaRepository.findByActivaTrueOrderByNombreAsc();
        if (salas.isEmpty()) {
            return crearSalaMinima(PRIMERA_SALA, LocalDate.of(LocalDate.now().getYear(), 3, 22), LocalDate.of(LocalDate.now().getYear() + 1, 3, 21));
        }

        SalaTtaip primera = salaRepository.findByNombre(PRIMERA_SALA).orElse(salas.get(0));
        SalaTtaip segunda = salaRepository.findByNombre(SEGUNDA_SALA).orElse(null);
        if (segunda == null) {
            return primera;
        }

        long expedientesPrimera = expedienteRepository.countBySala_Nombre(PRIMERA_SALA);
        long expedientesSegunda = expedienteRepository.countBySala_Nombre(SEGUNDA_SALA);
        return expedientesPrimera <= expedientesSegunda ? primera : segunda;
    }

    private SalaTtaip crearSalaMinima(String nombre, LocalDate inicio, LocalDate fin) {
        SalaTtaip sala = new SalaTtaip();
        sala.setNombre(nombre);
        sala.setPeriodoInicio(inicio);
        sala.setPeriodoFin(fin);
        sala.setActiva(true);
        return salaRepository.save(sala);
    }

    private String generarNumeroResolucion(ExpedienteTtaip expediente) {
        int year = LocalDate.now().getYear();
        long sequence = RESOLUCION_BASE + resolucionRepository.countByNumeroResolucionContaining("-" + year + "-JUS/TTAIP") + 1;
        return "RESOLUCIÓN N.° %06d-%d-JUS/TTAIP-%s".formatted(sequence, year, expediente.getSala().getNombre());
    }

    private String generarNumeroCedula() {
        int year = LocalDate.now().getYear();
        long sequence = CEDULA_BASE + cedulaRepository.countByNumeroCedulaStartingWith("") / 2;
        return "%05d-%d-JUS/TTAIP".formatted(sequence, year);
    }

    private void crearCedulaYNotificacionSiFalta(Resolucion resolucion,
                                                 ExpedienteTtaip expediente,
                                                 CedulaNotificacion.DestinatarioNotificacion destinatario) {
        if (cedulaRepository.existsByResolucion_IdResolucionAndDestinatario(resolucion.getId(), destinatario)) {
            return;
        }

        String numeroCedula = generarNumeroCedula();
        CedulaNotificacion cedula = new CedulaNotificacion();
        cedula.setResolucion(resolucion);
        cedula.setNumeroCedula(numeroCedula);
        cedula.setDestinatario(destinatario);
        cedula.setDestinatarioNombre(resolveNombreDestinatario(expediente, destinatario));
        cedula.setDestinatarioEmail(resolveEmailDestinatario(expediente, destinatario));
        cedula.setDocumentoReferencia("CÉDULA DE NOTIFICACIÓN N.° " + numeroCedula);
        CedulaNotificacion savedCedula = cedulaRepository.save(cedula);
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.CEDULA_EMITIDA,
                "Cédula emitida para " + etiquetaDestinatario(destinatario) + " por " + resolucion.getNumeroResolucion(),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                "TTAIP",
                savedCedula.getNumeroCedula() + ":" + destinatario.name()
        );

        if (!notificacionRepository.existsByCedula_IdCedula(savedCedula.getId())) {
            NotificacionTtaip notificacion = new NotificacionTtaip();
            notificacion.setExpediente(expediente);
            notificacion.setCedula(savedCedula);
            notificacion.setDestinatario(destinatario);
            notificacion.setDestinatarioNombre(savedCedula.getDestinatarioNombre());
            notificacion.setDestinatarioEmail(savedCedula.getDestinatarioEmail());
            notificacion.setDetalle("Notificación de " + resolucion.getNumeroResolucion());
            NotificacionTtaip savedNotificacion = notificacionRepository.save(notificacion);
            registrarHistorial(
                    expediente,
                    HistorialTtaip.TipoEvento.NOTIFICACION_REGISTRADA,
                    "Notificación registrada para " + etiquetaDestinatario(destinatario),
                    null,
                    expediente.getEstado() != null ? expediente.getEstado().name() : null,
                    "TTAIP",
                    "NOTIFICACION-" + savedCedula.getNumeroCedula() + ":" + savedNotificacion.getDestinatario().name()
            );
        }
    }

    private String resolveNombreDestinatario(ExpedienteTtaip expediente, CedulaNotificacion.DestinatarioNotificacion destinatario) {
        if (destinatario == CedulaNotificacion.DestinatarioNotificacion.CIUDADANO) {
            return expediente.getApelacion().getCiudadano().getNombreCompleto();
        }
        return expediente.getApelacion().getSolicitud().getEntidad().getNombre();
    }

    private String resolveEmailDestinatario(ExpedienteTtaip expediente, CedulaNotificacion.DestinatarioNotificacion destinatario) {
        if (destinatario == CedulaNotificacion.DestinatarioNotificacion.CIUDADANO) {
            return expediente.getApelacion().getCiudadano().getEmail();
        }
        return expediente.getApelacion().getSolicitud().getEntidad().getEmail();
    }

    private String etiquetaDestinatario(CedulaNotificacion.DestinatarioNotificacion destinatario) {
        return destinatario == CedulaNotificacion.DestinatarioNotificacion.CIUDADANO
                ? "ciudadano"
                : "entidad pública";
    }

    private void actualizarFechasPorResolucion(ExpedienteTtaip expediente, Resolucion resolucion) {
        if (resolucion.getTipoResolucion() == Resolucion.TipoResolucion.PRIMERA_CALIFICACION) {
            expediente.setFechaPrimeraCalificacion(resolucion.getFechaResolucion());
        } else if (resolucion.getTipoResolucion() == Resolucion.TipoResolucion.SEGUNDA_CALIFICACION) {
            expediente.setFechaSegundaCalificacion(resolucion.getFechaResolucion());
            expediente.setFechaLimiteResolucion(LocalDate.now().plusDays(10));
        } else if (resolucion.getTipoResolucion() == Resolucion.TipoResolucion.RESOLUCION_FINAL) {
            expediente.setFechaResolucionFinal(resolucion.getFechaResolucion());
        }
    }

    private String agregarTraza(String actual, String nuevaEntrada) {
        return actual == null || actual.isBlank()
                ? nuevaEntrada
                : actual + "\n" + nuevaEntrada;
    }

    private void registrarHistorial(ExpedienteTtaip expediente,
                                    HistorialTtaip.TipoEvento tipoEvento,
                                    String descripcion,
                                    String estadoAnterior,
                                    String estadoNuevo,
                                    String actor,
                                    String referencia) {
        boolean tieneReferenciaPersistible = referencia != null && expediente.getId() != null;
        if (tieneReferenciaPersistible && tipoEvento == HistorialTtaip.TipoEvento.CAMBIO_ESTADO) {
            if (historialRepository.existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferenciaAndEstadoAnteriorAndEstadoNuevo(
                    expediente.getId(),
                    tipoEvento,
                    referencia,
                    estadoAnterior,
                    estadoNuevo
            )) {
                return;
            }
        } else if (tieneReferenciaPersistible && tipoEvento != HistorialTtaip.TipoEvento.AUDITORIA) {
            if (historialRepository.existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferencia(
                    expediente.getId(),
                    tipoEvento,
                    referencia
            )) {
                return;
            }
        }

        HistorialTtaip historial = new HistorialTtaip();
        historial.setExpediente(expediente);
        historial.setTipoEvento(tipoEvento);
        historial.setDescripcion(descripcion);
        historial.setEstadoAnterior(estadoAnterior);
        historial.setEstadoNuevo(estadoNuevo);
        historial.setActor(actor);
        historial.setReferencia(referencia);
        historialRepository.save(historial);
    }
}
