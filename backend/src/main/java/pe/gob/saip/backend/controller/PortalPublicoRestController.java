package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.gob.saip.backend.model.dto.PortalPublicoDTO;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.EntidadRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.service.MiembroTTAIPService;

import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/portal")
@Tag(name = "Portal público", description = "Datos agregados no sensibles para la experiencia pública")
public class PortalPublicoRestController {

    private static final List<Solicitud.EstadoSolicitud> ESTADOS_SAIP_RESPONDIDOS = List.of(
            Solicitud.EstadoSolicitud.RESPONDIDA,
            Solicitud.EstadoSolicitud.DENEGADA,
            Solicitud.EstadoSolicitud.CONCLUIDA
    );

    private final SolicitudRepository solicitudRepository;
    private final ApelacionRepository apelacionRepository;
    private final EntidadRepository entidadRepository;
    private final MiembroTTAIPService miembroTTAIPService;

    public PortalPublicoRestController(SolicitudRepository solicitudRepository,
                                       ApelacionRepository apelacionRepository,
                                       EntidadRepository entidadRepository,
                                       MiembroTTAIPService miembroTTAIPService) {
        this.solicitudRepository = solicitudRepository;
        this.apelacionRepository = apelacionRepository;
        this.entidadRepository = entidadRepository;
        this.miembroTTAIPService = miembroTTAIPService;
    }

    @Operation(summary = "Obtener datos públicos de portada", description = "Devuelve métricas agregadas, tendencias y miembros TTAIP sin datos sensibles")
    @GetMapping
    public ResponseEntity<PortalPublicoDTO> obtenerPortal() {
        return ResponseEntity.ok(new PortalPublicoDTO(
                obtenerMetricas(),
                obtenerEjemplosSolicitud(),
                obtenerPreguntasFrecuentes(),
                obtenerDistribucionPorEntidad(),
                obtenerTendenciaMensual(LocalDate.now().getYear()),
                obtenerMiembrosTTAIP()
        ));
    }

    private PortalPublicoDTO.PortalMetricasDTO obtenerMetricas() {
        long totalSolicitudes = solicitudRepository.count();
        long respondidas = solicitudRepository.countByEstadoIn(ESTADOS_SAIP_RESPONDIDOS);
        long apelaciones = apelacionRepository.count();
        long entidades = entidadRepository.count();
        long personasApelantes = apelacionRepository.countDistinctCiudadanos();
        double tasaResolucion = totalSolicitudes == 0 ? 0 : (respondidas * 100.0) / totalSolicitudes;

        return new PortalPublicoDTO.PortalMetricasDTO(
                totalSolicitudes,
                respondidas,
                apelaciones,
                entidades,
                personasApelantes,
                tasaResolucion
        );
    }

    private List<PortalPublicoDTO.PortalEjemploDTO> obtenerEjemplosSolicitud() {
        return List.of(
                new PortalPublicoDTO.PortalEjemploDTO("coins", "¿En qué se gastó el presupuesto de mi municipalidad?"),
                new PortalPublicoDTO.PortalEjemploDTO("hammer", "¿Por qué se paralizó la obra de mi distrito?"),
                new PortalPublicoDTO.PortalEjemploDTO("graduation-cap", "¿Cuántos docentes contrató mi colegio público?"),
                new PortalPublicoDTO.PortalEjemploDTO("stethoscope", "¿Qué medicamentos tiene mi hospital del barrio?"),
                new PortalPublicoDTO.PortalEjemploDTO("file-text", "¿Qué contratos firmó la entidad este año?"),
                new PortalPublicoDTO.PortalEjemploDTO("users", "¿Cuántos funcionarios trabajan en mi municipio?")
        );
    }

    private List<PortalPublicoDTO.PortalFaqDTO> obtenerPreguntasFrecuentes() {
        return List.of(
                new PortalPublicoDTO.PortalFaqDTO(
                        "¿Tengo que pagar algo para pedir información?",
                        "No. Es completamente gratis. La Constitución y la Ley N° 27806 garantizan su derecho de acceso a la información pública sin costo."
                ),
                new PortalPublicoDTO.PortalFaqDTO(
                        "¿Necesito un abogado para presentar mi solicitud?",
                        "No. La plataforma está diseñada para que cualquier persona pueda usarla. Si necesita ayuda, tiene un asistente, una línea gratuita y correo de soporte."
                ),
                new PortalPublicoDTO.PortalFaqDTO(
                        "¿Cuánto demora la respuesta?",
                        "La entidad tiene 10 días hábiles para responderle. Si no responde en ese plazo, usted puede reclamar al Tribunal."
                ),
                new PortalPublicoDTO.PortalFaqDTO(
                        "¿Pueden negarme la información?",
                        "Solo en casos puntuales que indica la ley (información clasificada, datos personales protegidos). Si le niegan información que considera pública, puede apelar al Tribunal en 15 días calendario."
                ),
                new PortalPublicoDTO.PortalFaqDTO(
                        "¿Qué pasa si la entidad no me responde?",
                        "Aplica el silencio administrativo negativo: se entiende que su solicitud fue denegada y usted puede reclamar al Tribunal de inmediato."
                ),
                new PortalPublicoDTO.PortalFaqDTO(
                        "¿Mis datos están seguros?",
                        "Sí. La plataforma usa conexión cifrada (SSL), almacenamiento seguro y cumple los estándares del Estado peruano para datos personales."
                )
        );
    }

    private List<PortalPublicoDTO.PortalDistribucionDTO> obtenerDistribucionPorEntidad() {
        return apelacionRepository.countByEntidad().stream()
                .limit(9)
                .map(row -> new PortalPublicoDTO.PortalDistribucionDTO(
                        String.valueOf(row[0]),
                        toLong(row[1])
                ))
                .toList();
    }

    private List<PortalPublicoDTO.PortalTendenciaDTO> obtenerTendenciaMensual(int year) {
        Map<Integer, Long> solicitudesPorMes = toMonthMap(solicitudRepository.countByMonth(year));
        Map<Integer, Long> apelacionesPorMes = toMonthMap(apelacionRepository.countByMonth(year));
        int currentMonth = LocalDate.now().getMonthValue();

        return java.util.stream.IntStream.rangeClosed(1, currentMonth)
                .mapToObj(month -> new PortalPublicoDTO.PortalTendenciaDTO(
                        month,
                        Month.of(month).getDisplayName(TextStyle.SHORT, Locale.forLanguageTag("es-PE")),
                        solicitudesPorMes.getOrDefault(month, 0L),
                        apelacionesPorMes.getOrDefault(month, 0L)
                ))
                .toList();
    }

    private List<PortalPublicoDTO.PortalMiembroTTAIPDTO> obtenerMiembrosTTAIP() {
        return miembroTTAIPService.obtenerMiembrosTTAIPActivos().stream()
                .map(this::toMiembroDTO)
                .toList();
    }

    private PortalPublicoDTO.PortalMiembroTTAIPDTO toMiembroDTO(MiembroTTAIP miembro) {
        return new PortalPublicoDTO.PortalMiembroTTAIPDTO(
                miembro.getId(),
                miembro.getNombreCompleto(),
                miembro.getCargo(),
                miembro.getSala(),
                miembro.getEspecialidad(),
                miembro.getEmail(),
                miembro.getPeriodoInicio() != null ? miembro.getPeriodoInicio().toString() : null,
                miembro.getPeriodoFin() != null ? miembro.getPeriodoFin().toString() : null,
                Boolean.TRUE.equals(miembro.getPresidenteTribunal())
        );
    }

    private Map<Integer, Long> toMonthMap(Collection<Object[]> rows) {
        return rows.stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).intValue(),
                        row -> toLong(row[1])
                ));
    }

    private long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }
}
