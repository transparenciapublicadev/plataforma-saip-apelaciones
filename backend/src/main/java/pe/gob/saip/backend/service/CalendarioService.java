package pe.gob.saip.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.CalendarioHistorial;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;
import pe.gob.saip.backend.model.entity.FeriadoCalendario;
import pe.gob.saip.backend.repository.CalendarioHistorialRepository;
import pe.gob.saip.backend.repository.ConfiguracionSistemaRepository;
import pe.gob.saip.backend.repository.FeriadoCalendarioRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class CalendarioService {

    private final FeriadoCalendarioRepository feriadoRepository;
    private final CalendarioHistorialRepository historialRepository;
    private final ConfiguracionSistemaRepository configRepository;
    private final PlazoCalculadorService plazoCalculadorService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CalendarioService(
            FeriadoCalendarioRepository feriadoRepository,
            CalendarioHistorialRepository historialRepository,
            ConfiguracionSistemaRepository configRepository,
            PlazoCalculadorService plazoCalculadorService) {
        this.feriadoRepository = feriadoRepository;
        this.historialRepository = historialRepository;
        this.configRepository = configRepository;
        this.plazoCalculadorService = plazoCalculadorService;
    }

    @Transactional(readOnly = true)
    public CalendarioConfigDTO obtenerConfiguracionCalendario() {
        ConfiguracionSistema config = configRepository.findById(1L).orElseGet(ConfiguracionSistema::new);
        List<FeriadoCalendario> entidades = feriadoRepository.findAll();

        List<FeriadoDTO> feriadosDTO = entidades.stream()
                .map(this::convertirAFeriadoDTO)
                .toList();

        Map<String, Integer> plazos = new LinkedHashMap<>();
        plazos.put("SAIP_OBSERVACION", config.getPlazoSaipObservacion() != null ? config.getPlazoSaipObservacion() : 2);
        plazos.put("SAIP_SUBSANACION", config.getPlazoSubsanacion() != null ? config.getPlazoSubsanacion() : 2);
        plazos.put("SAIP_ATENCION", config.getPlazoSaipRespuesta() != null ? config.getPlazoSaipRespuesta() : 10);
        plazos.put("SAIP_PRORROGA_COMUNICACION", config.getPlazoSaipProrrogaComunicacion() != null ? config.getPlazoSaipProrrogaComunicacion() : 2);
        plazos.put("SAIP_CRONOGRAMA_UMBRAL", config.getPlazoSaipCronogramaUmbral() != null ? config.getPlazoSaipCronogramaUmbral() : 30);
        plazos.put("SAIP_ENCAUZAMIENTO", config.getPlazoSaipEncauzamiento() != null ? config.getPlazoSaipEncauzamiento() : 4);
        plazos.put("SAIP_LIQUIDACION_PAGO", config.getPlazoSaipLiquidacionPago() != null ? config.getPlazoSaipLiquidacionPago() : 30);
        plazos.put("SAIP_RECOJO", config.getPlazoRecojoInformacion() != null ? config.getPlazoRecojoInformacion() : 30);
        plazos.put("APELACION_PLAZO", config.getPlazoApelacionInterposicion() != null ? config.getPlazoApelacionInterposicion() : 15);
        plazos.put("TTAIP_ELEVACION", config.getPlazoTtaipElevacion() != null ? config.getPlazoTtaipElevacion() : 2);
        plazos.put("TTAIP_CALIFICACION_1", config.getPlazoTtaipCalificacion() != null ? config.getPlazoTtaipCalificacion() : 7);
        plazos.put("TTAIP_SUBSANACION", config.getPlazoTtaipSubsanacion() != null ? config.getPlazoTtaipSubsanacion() : 2);
        plazos.put("TTAIP_CALIFICACION_2", 10);
        plazos.put("TTAIP_DESCARGOS", config.getPlazoTtaipDescargos() != null ? config.getPlazoTtaipDescargos() : 7);
        plazos.put("TTAIP_INFORME_ORAL", config.getPlazoTtaipInformeOral() != null ? config.getPlazoTtaipInformeOral() : 3);
        plazos.put("TTAIP_INFO_COMPLEMENTARIA", config.getPlazoTtaipInfoComplementaria() != null ? config.getPlazoTtaipInfoComplementaria() : 3);
        plazos.put("TTAIP_RESOLUCION", config.getPlazoTtaipResolucion() != null ? config.getPlazoTtaipResolucion() : 10);
        plazos.put("TTAIP_CUMPLIMIENTO", config.getPlazoTtaipCumplimiento() != null ? config.getPlazoTtaipCumplimiento() : 7);

        CalendarioConfigDTO.TarifasDTO tarifas = new CalendarioConfigDTO.TarifasDTO(
                config.getCostoPorCopia() != null ? config.getCostoPorCopia().doubleValue() : 0.10,
                config.getCopiaCertificada() != null ? config.getCopiaCertificada().doubleValue() : 0.50,
                config.getSoporteDigital() != null ? config.getSoporteDigital().doubleValue() : 1.00
        );

        List<CalendarioHistorial> historial = historialRepository.findAllByOrderByFechaDesc();
        List<CalendarioConfigDTO.CambioCalendarioDTO> historialDTO = historial.stream()
                .map(h -> new CalendarioConfigDTO.CambioCalendarioDTO(
                        h.getFecha() != null ? h.getFecha().toString() : "",
                        h.getUsuario(),
                        h.getDetalle(),
                        h.getNorma()
                ))
                .toList();

        CalendarioConfigDTO.ActualizadoDTO actualizado = null;
        if (config.getCalendarioActualizadoEn() != null) {
            actualizado = new CalendarioConfigDTO.ActualizadoDTO(
                    config.getCalendarioActualizadoEn().toString(),
                    config.getCalendarioActualizadoPor()
            );
        }

        return new CalendarioConfigDTO(
                1,
                feriadosDTO,
                Boolean.TRUE.equals(config.getSemanaSanta()),
                plazos,
                tarifas,
                historialDTO,
                actualizado
        );
    }

    @Transactional
    public CalendarioConfigDTO actualizarConfiguracionCalendario(CalendarioConfigDTO dto, String usuarioEmail) {
        ConfiguracionSistema config = configRepository.findById(1L).orElseGet(() -> {
            ConfiguracionSistema nueva = new ConfiguracionSistema();
            nueva.setId(1L);
            return nueva;
        });

        // 1. Actualizar plazos
        if (dto.plazos() != null) {
            Map<String, Integer> p = dto.plazos();
            if (p.containsKey("SAIP_ATENCION")) config.setPlazoSaipRespuesta(p.get("SAIP_ATENCION"));
            if (p.containsKey("SAIP_SUBSANACION")) config.setPlazoSubsanacion(p.get("SAIP_SUBSANACION"));
            if (p.containsKey("SAIP_OBSERVACION")) config.setPlazoSaipObservacion(p.get("SAIP_OBSERVACION"));
            if (p.containsKey("SAIP_PRORROGA_COMUNICACION")) config.setPlazoSaipProrrogaComunicacion(p.get("SAIP_PRORROGA_COMUNICACION"));
            if (p.containsKey("SAIP_CRONOGRAMA_UMBRAL")) config.setPlazoSaipCronogramaUmbral(p.get("SAIP_CRONOGRAMA_UMBRAL"));
            if (p.containsKey("SAIP_ENCAUZAMIENTO")) config.setPlazoSaipEncauzamiento(p.get("SAIP_ENCAUZAMIENTO"));
            if (p.containsKey("SAIP_LIQUIDACION_PAGO")) config.setPlazoSaipLiquidacionPago(p.get("SAIP_LIQUIDACION_PAGO"));
            if (p.containsKey("SAIP_RECOJO")) config.setPlazoRecojoInformacion(p.get("SAIP_RECOJO"));
            if (p.containsKey("APELACION_PLAZO")) config.setPlazoApelacionInterposicion(p.get("APELACION_PLAZO"));
            if (p.containsKey("TTAIP_ELEVACION")) config.setPlazoTtaipElevacion(p.get("TTAIP_ELEVACION"));
            if (p.containsKey("TTAIP_CALIFICACION_1")) config.setPlazoTtaipCalificacion(p.get("TTAIP_CALIFICACION_1"));
            if (p.containsKey("TTAIP_SUBSANACION")) config.setPlazoTtaipSubsanacion(p.get("TTAIP_SUBSANACION"));
            if (p.containsKey("TTAIP_DESCARGOS")) config.setPlazoTtaipDescargos(p.get("TTAIP_DESCARGOS"));
            if (p.containsKey("TTAIP_INFORME_ORAL")) config.setPlazoTtaipInformeOral(p.get("TTAIP_INFORME_ORAL"));
            if (p.containsKey("TTAIP_INFO_COMPLEMENTARIA")) config.setPlazoTtaipInfoComplementaria(p.get("TTAIP_INFO_COMPLEMENTARIA"));
            if (p.containsKey("TTAIP_RESOLUCION")) config.setPlazoTtaipResolucion(p.get("TTAIP_RESOLUCION"));
            if (p.containsKey("TTAIP_CUMPLIMIENTO")) config.setPlazoTtaipCumplimiento(p.get("TTAIP_CUMPLIMIENTO"));
        }

        // 2. Actualizar tarifas
        if (dto.tarifas() != null) {
            if (dto.tarifas().copiaSimple() != null) config.setCostoPorCopia(BigDecimal.valueOf(dto.tarifas().copiaSimple()));
            if (dto.tarifas().copiaCertificada() != null) config.setCopiaCertificada(BigDecimal.valueOf(dto.tarifas().copiaCertificada()));
            if (dto.tarifas().soporteDigital() != null) config.setSoporteDigital(BigDecimal.valueOf(dto.tarifas().soporteDigital()));
        }

        config.setSemanaSanta(dto.semanaSanta());
        config.setCalendarioActualizadoEn(LocalDateTime.now());
        config.setCalendarioActualizadoPor(usuarioEmail);
        configRepository.save(config);

        // 3. Sincronizar feriados si se enviaron
        if (dto.feriados() != null) {
            for (FeriadoDTO f : dto.feriados()) {
                if (f.id() != null) {
                    FeriadoCalendario fc = feriadoRepository.findById(f.id()).orElse(new FeriadoCalendario());
                    fc.setId(f.id());
                    fc.setNombre(f.nombre());
                    fc.setTipo(f.tipo() != null ? f.tipo() : "feriado");
                    fc.setRecurrente(Boolean.TRUE.equals(f.recurrente()));
                    fc.setMmdd(f.mmdd());
                    fc.setFecha(f.fecha() != null ? LocalDate.parse(f.fecha()) : null);
                    fc.setHasta(f.hasta() != null ? LocalDate.parse(f.hasta()) : null);
                    fc.setBaseLegal(f.baseLegal());
                    fc.setActivo(f.activo() != null ? f.activo() : true);
                    fc.setOrigen(f.origen() != null ? f.origen() : "admin");
                    fc.setAlcanceNacional(Boolean.TRUE.equals(f.alcanceNacional()) || (f.entidades() == null || f.entidades().isEmpty()));
                    if (f.entidades() != null && !f.entidades().isEmpty()) {
                        try {
                            fc.setEntidadesIds(objectMapper.writeValueAsString(f.entidades()));
                        } catch (Exception ignored) {
                            fc.setEntidadesIds("[]");
                        }
                    } else {
                        fc.setEntidadesIds(null);
                    }
                    feriadoRepository.save(fc);
                }
            }
        }

        // 4. Registrar auditoría si vino un nuevo cambio en historial
        if (dto.historial() != null && !dto.historial().isEmpty()) {
            CalendarioConfigDTO.CambioCalendarioDTO ultimo = dto.historial().get(0);
            CalendarioHistorial hist = new CalendarioHistorial();
            hist.setFecha(LocalDateTime.now());
            hist.setUsuario(usuarioEmail);
            hist.setDetalle(ultimo.detalle() != null ? ultimo.detalle() : "Actualización de plazos y calendario");
            hist.setNorma(ultimo.norma());
            historialRepository.save(hist);
        }

        plazoCalculadorService.invalidarCache();
        return obtenerConfiguracionCalendario();
    }

    @Transactional
    public FeriadoDTO crearOActualizarFeriado(FeriadoDTO dto, String usuarioEmail) {
        String id = (dto.id() != null && !dto.id().isBlank()) ? dto.id() : ("adm-" + UUID.randomUUID().toString().substring(0, 8));
        FeriadoCalendario fc = feriadoRepository.findById(id).orElseGet(() -> {
            FeriadoCalendario nuevo = new FeriadoCalendario();
            nuevo.setId(id);
            nuevo.setOrigen("admin");
            return nuevo;
        });

        fc.setNombre(dto.nombre());
        fc.setTipo(dto.tipo() != null ? dto.tipo() : "feriado");
        fc.setRecurrente(Boolean.TRUE.equals(dto.recurrente()));
        fc.setMmdd(dto.mmdd());
        fc.setFecha(dto.fecha() != null ? LocalDate.parse(dto.fecha()) : null);
        fc.setHasta(dto.hasta() != null ? LocalDate.parse(dto.hasta()) : null);
        fc.setBaseLegal(dto.baseLegal());
        fc.setActivo(dto.activo() != null ? dto.activo() : true);
        fc.setAlcanceNacional(dto.alcanceNacional() != null ? dto.alcanceNacional() : (dto.entidades() == null || dto.entidades().isEmpty()));

        if (dto.entidades() != null && !dto.entidades().isEmpty()) {
            try {
                fc.setEntidadesIds(objectMapper.writeValueAsString(dto.entidades()));
            } catch (Exception ignored) {
                fc.setEntidadesIds("[]");
            }
        } else {
            fc.setEntidadesIds(null);
        }

        FeriadoCalendario guardado = feriadoRepository.save(fc);

        CalendarioHistorial hist = new CalendarioHistorial();
        hist.setFecha(LocalDateTime.now());
        hist.setUsuario(usuarioEmail);
        hist.setDetalle((fc.getOrigen().equals("sistema") ? "Modifica feriado: " : "Registra nuevo día inhábil: ") + dto.nombre());
        hist.setNorma(dto.baseLegal());
        historialRepository.save(hist);

        plazoCalculadorService.invalidarCache();
        return convertirAFeriadoDTO(guardado);
    }

    @Transactional
    public void eliminarFeriado(String id, String usuarioEmail) {
        feriadoRepository.findById(id).ifPresent(f -> {
            if ("admin".equals(f.getOrigen())) {
                feriadoRepository.delete(f);
                CalendarioHistorial hist = new CalendarioHistorial();
                hist.setFecha(LocalDateTime.now());
                hist.setUsuario(usuarioEmail);
                hist.setDetalle("Elimina día inhábil: " + f.getNombre());
                historialRepository.save(hist);
            } else {
                f.setActivo(false);
                feriadoRepository.save(f);
                CalendarioHistorial hist = new CalendarioHistorial();
                hist.setFecha(LocalDateTime.now());
                hist.setUsuario(usuarioEmail);
                hist.setDetalle("Desactiva feriado del sistema: " + f.getNombre());
                historialRepository.save(hist);
            }
            plazoCalculadorService.invalidarCache();
        });
    }

    @Transactional(readOnly = true)
    public CalendarioAnioResumenDTO obtenerResumenAnio(int anio) {
        return plazoCalculadorService.obtenerResumenAnio(anio);
    }

    @Transactional(readOnly = true)
    public ComputoPlazoResponse computarPlazo(ComputoPlazoRequest request) {
        LocalDate inicio = request.fechaInicio() != null ? request.fechaInicio() : plazoCalculadorService.hoy();
        int dias = request.dias() != null ? request.dias() : 10;
        boolean esCalendario = "calendario".equalsIgnoreCase(request.tipo());

        LocalDate vencimiento;
        if (esCalendario) {
            vencimiento = inicio.plusDays(dias);
        } else {
            vencimiento = plazoCalculadorService.calcularFechaVencimiento(inicio, dias, request.entidadId());
        }

        int restantes = plazoCalculadorService.diasHabilesRestantes(vencimiento, request.entidadId());
        boolean esHabil = plazoCalculadorService.esDiaHabil(inicio, request.entidadId());
        String motivo = plazoCalculadorService.motivoInhabil(inicio, request.entidadId());

        return new ComputoPlazoResponse(inicio, vencimiento, restantes, esHabil, motivo);
    }

    private FeriadoDTO convertirAFeriadoDTO(FeriadoCalendario f) {
        List<FeriadoDTO.EntidadRefDTO> entidades = new ArrayList<>();
        if (f.getEntidadesIds() != null && !f.getEntidadesIds().isBlank()) {
            try {
                entidades = objectMapper.readValue(f.getEntidadesIds(), new TypeReference<>() {});
            } catch (Exception ignored) {}
        }

        return new FeriadoDTO(
                f.getId(),
                f.getNombre(),
                f.getTipo(),
                f.getRecurrente(),
                f.getFecha() != null ? f.getFecha().toString() : null,
                f.getHasta() != null ? f.getHasta().toString() : null,
                f.getMmdd(),
                f.getBaseLegal(),
                f.getActivo(),
                f.getOrigen(),
                f.getAlcanceNacional(),
                entidades
        );
    }
}
