package pe.gob.saip.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import pe.gob.saip.backend.config.ClockConfig;
import pe.gob.saip.backend.model.dto.CalendarioAnioResumenDTO;
import pe.gob.saip.backend.model.dto.DiaInhabilDTO;
import pe.gob.saip.backend.model.entity.FeriadoCalendario;
import pe.gob.saip.backend.repository.FeriadoCalendarioRepository;

import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementación robusta del motor de cálculo de plazos legales,
 * días hábiles oficiales peruanos y calendario institucional.
 */
@Service
public class PlazoCalculadorServiceImpl implements PlazoCalculadorService {

    private final Clock clock;
    private final FeriadoCalendarioRepository feriadoRepository;
    private final Map<Integer, List<DiaInhabilDTO>> cacheInhabilesPorAnio = new ConcurrentHashMap<>();

    // Feriados nacionales base por ley (D. Leg. N.° 713 y modificatorias)
    private static final Map<String, String> FERIADOS_FIJOS_BASE = new LinkedHashMap<>();
    static {
        FERIADOS_FIJOS_BASE.put("01-01", "Año Nuevo");
        FERIADOS_FIJOS_BASE.put("05-01", "Día del Trabajo");
        FERIADOS_FIJOS_BASE.put("06-07", "Batalla de Arica y Día de la Bandera");
        FERIADOS_FIJOS_BASE.put("06-29", "San Pedro y San Pablo");
        FERIADOS_FIJOS_BASE.put("07-23", "Día de la Fuerza Aérea del Perú");
        FERIADOS_FIJOS_BASE.put("07-28", "Fiestas Patrias");
        FERIADOS_FIJOS_BASE.put("07-29", "Fiestas Patrias");
        FERIADOS_FIJOS_BASE.put("08-06", "Batalla de Junín");
        FERIADOS_FIJOS_BASE.put("08-30", "Santa Rosa de Lima");
        FERIADOS_FIJOS_BASE.put("10-08", "Combate de Angamos");
        FERIADOS_FIJOS_BASE.put("11-01", "Día de Todos los Santos");
        FERIADOS_FIJOS_BASE.put("12-08", "Inmaculada Concepción");
        FERIADOS_FIJOS_BASE.put("12-09", "Batalla de Ayacucho");
        FERIADOS_FIJOS_BASE.put("12-25", "Navidad");
    }

    public PlazoCalculadorServiceImpl() {
        this(Clock.system(ClockConfig.ZONA_LIMA), null);
    }

    @Autowired
    public PlazoCalculadorServiceImpl(Clock clock, @Autowired(required = false) FeriadoCalendarioRepository feriadoRepository) {
        this.clock = clock != null ? clock : Clock.system(ClockConfig.ZONA_LIMA);
        this.feriadoRepository = feriadoRepository;
    }

    @Override
    public LocalDate hoy() {
        return LocalDate.now(clock);
    }

    @Override
    public LocalDateTime ahora() {
        return LocalDateTime.now(clock);
    }

    @Override
    public void invalidarCache() {
        cacheInhabilesPorAnio.clear();
    }

    @Override
    public LocalDate calcularFechaVencimiento(LocalDate fechaRegistro, int diasHabilesLimit) {
        return calcularFechaVencimiento(fechaRegistro, diasHabilesLimit, null);
    }

    @Override
    public LocalDate calcularFechaVencimiento(LocalDate fechaRegistro, int diasHabilesLimit, Long entidadId) {
        if (fechaRegistro == null) {
            throw new IllegalArgumentException("La fecha de registro no puede ser nula");
        }
        if (diasHabilesLimit < 0) {
            throw new IllegalArgumentException("El límite de días hábiles no puede ser negativo");
        }
        if (diasHabilesLimit == 0) {
            return fechaRegistro;
        }

        List<FeriadoCalendario> suspensiones = entidadId != null && feriadoRepository != null
                ? feriadoRepository.findByActivoTrue() : List.of();
        LocalDate fechaVencimiento = fechaRegistro;
        LocalDate horizonte = fechaRegistro.plusYears(200);
        int diasContados = 0;

        while (diasContados < diasHabilesLimit) {
            if (!fechaVencimiento.isBefore(horizonte)) {
                throw new IllegalArgumentException("El calendario oficial no cubre esa cantidad de días hábiles");
            }
            fechaVencimiento = fechaVencimiento.plusDays(1);
            if (diaHabil(fechaVencimiento, entidadId, suspensiones)) {
                diasContados++;
            }
        }

        return fechaVencimiento;
    }

    @Override
    public boolean verificarExcesoDePlazo(LocalDate fechaRegistro, int diasHabilesLimit) {
        return verificarExcesoDePlazo(fechaRegistro, diasHabilesLimit, null);
    }

    @Override
    public boolean verificarExcesoDePlazo(LocalDate fechaRegistro, int diasHabilesLimit, Long entidadId) {
        LocalDate fechaVencimiento = calcularFechaVencimiento(fechaRegistro, diasHabilesLimit, entidadId);
        return hoy().isAfter(fechaVencimiento);
    }

    @Override
    public boolean esDiaHabil(LocalDate fecha) {
        return esDiaHabil(fecha, null);
    }

    @Override
    public boolean esDiaHabil(LocalDate fecha, Long entidadId) {
        List<FeriadoCalendario> suspensiones = entidadId != null && feriadoRepository != null
                ? feriadoRepository.findByActivoTrue() : List.of();
        return diaHabil(fecha, entidadId, suspensiones);
    }

    private boolean diaHabil(LocalDate fecha, Long entidadId, List<FeriadoCalendario> suspensiones) {
        if (fecha == null) return false;
        DayOfWeek dw = fecha.getDayOfWeek();
        if (dw == DayOfWeek.SATURDAY || dw == DayOfWeek.SUNDAY) {
            return false;
        }

        for (DiaInhabilDTO inhabil : obtenerInhabilesDelAnio(fecha.getYear())) {
            if (inhabil.fecha().equals(fecha)) {
                return false;
            }
        }

        if (entidadId == null || suspensiones == null) return true;
        for (FeriadoCalendario f : suspensiones) {
            if ("suspension".equals(f.getTipo()) && Boolean.FALSE.equals(f.getAlcanceNacional())
                    && f.getFecha() != null) {
                LocalDate fin = (f.getHasta() != null && !f.getHasta().isBefore(f.getFecha())) ? f.getHasta() : f.getFecha();
                if (!fecha.isBefore(f.getFecha()) && !fecha.isAfter(fin)
                        && f.getEntidadesIds() != null && f.getEntidadesIds().contains(String.valueOf(entidadId))) {
                    return false;
                }
            }
        }

        return true;
    }

    @Override
    public String motivoInhabil(LocalDate fecha, Long entidadId) {
        if (fecha == null) return null;
        DayOfWeek dw = fecha.getDayOfWeek();
        if (dw == DayOfWeek.SUNDAY) return "Domingo";
        if (dw == DayOfWeek.SATURDAY) return "Sábado";

        List<DiaInhabilDTO> inhabiles = obtenerInhabilesDelAnio(fecha.getYear());
        for (DiaInhabilDTO inhabil : inhabiles) {
            if (inhabil.fecha().equals(fecha)) {
                return inhabil.nombre();
            }
        }

        if (entidadId != null && feriadoRepository != null) {
            List<FeriadoCalendario> activos = feriadoRepository.findByActivoTrue();
            for (FeriadoCalendario f : activos) {
                if ("suspension".equals(f.getTipo()) && Boolean.FALSE.equals(f.getAlcanceNacional())
                        && f.getFecha() != null) {
                    LocalDate fin = (f.getHasta() != null && !f.getHasta().isBefore(f.getFecha())) ? f.getHasta() : f.getFecha();
                    if (!fecha.isBefore(f.getFecha()) && !fecha.isAfter(fin)) {
                        if (f.getEntidadesIds() != null && f.getEntidadesIds().contains(String.valueOf(entidadId))) {
                            return f.getNombre() != null ? f.getNombre() : "Suspensión de plazos";
                        }
                    }
                }
            }
        }

        return null;
    }

    @Override
    public LocalDate siguienteDiaHabil(LocalDate fecha, Long entidadId) {
        if (fecha == null) return null;
        LocalDate d = fecha.plusDays(1);
        while (!esDiaHabil(d, entidadId)) {
            d = d.plusDays(1);
        }
        return d;
    }

    @Override
    public LocalDate recepcionEfectiva(LocalDate fecha, Long entidadId) {
        if (fecha == null) return null;
        return esDiaHabil(fecha, entidadId) ? fecha : siguienteDiaHabil(fecha, entidadId);
    }

    @Override
    public int contarDiasHabiles(LocalDate desde, LocalDate hasta) {
        return contarDiasHabiles(desde, hasta, null);
    }

    @Override
    public int contarDiasHabiles(LocalDate desde, LocalDate hasta, Long entidadId) {
        if (desde == null || hasta == null || !hasta.isAfter(desde)) {
            return 0;
        }
        int count = 0;
        LocalDate curr = desde.plusDays(1);
        while (!curr.isAfter(hasta)) {
            if (esDiaHabil(curr, entidadId)) {
                count++;
            }
            curr = curr.plusDays(1);
        }
        return count;
    }

    @Override
    public int diasHabilesRestantes(LocalDate fechaLimite) {
        return diasHabilesRestantes(fechaLimite, null);
    }

    @Override
    public int diasHabilesRestantes(LocalDate fechaLimite, Long entidadId) {
        if (fechaLimite == null) return 0;
        LocalDate hoy = hoy();
        if (hoy.isAfter(fechaLimite)) {
            return -contarDiasHabiles(fechaLimite, hoy, entidadId);
        }
        return contarDiasHabiles(hoy, fechaLimite, entidadId);
    }

    @Override
    public List<DiaInhabilDTO> obtenerInhabilesDelAnio(int anio) {
        return cacheInhabilesPorAnio.computeIfAbsent(anio, this::calcularInhabilesDelAnio);
    }

    private List<DiaInhabilDTO> calcularInhabilesDelAnio(int anio) {
        Map<LocalDate, DiaInhabilDTO> map = new TreeMap<>();

        // 1. Feriados cargados desde BD si existe repositorio
        if (feriadoRepository != null) {
            try {
                List<FeriadoCalendario> activos = feriadoRepository.findByActivoTrue();
                for (FeriadoCalendario f : activos) {
                    // Si es una suspensión limitada a entidades específicas, no es inhábil a nivel nacional
                    if (Boolean.FALSE.equals(f.getAlcanceNacional())) {
                        continue;
                    }
                    if (Boolean.TRUE.equals(f.getRecurrente()) && f.getMmdd() != null) {
                        try {
                            String[] parts = f.getMmdd().split("-");
                            LocalDate fecha = LocalDate.of(anio, Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
                            map.put(fecha, new DiaInhabilDTO(fecha, f.getNombre(), f.getTipo(), false, f.getId(), f.getBaseLegal()));
                        } catch (Exception ignored) {}
                    } else if (f.getFecha() != null) {
                        LocalDate fin = (f.getHasta() != null && !f.getHasta().isBefore(f.getFecha())) ? f.getHasta() : f.getFecha();
                        for (LocalDate d = f.getFecha(); !d.isAfter(fin); d = d.plusDays(1)) {
                            if (d.getYear() == anio) {
                                map.put(d, new DiaInhabilDTO(d, f.getNombre(), f.getTipo(), false, f.getId(), f.getBaseLegal()));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Fallback a feriados por defecto en caso de que la tabla aún no esté lista
            }
        }

        // 2. Feriados base nacionales por defecto si faltan en map
        for (Map.Entry<String, String> entry : FERIADOS_FIJOS_BASE.entrySet()) {
            String[] parts = entry.getKey().split("-");
            LocalDate f = LocalDate.of(anio, Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
            map.putIfAbsent(f, new DiaInhabilDTO(f, entry.getValue(), "feriado", false, "nac-" + entry.getKey(), "D. Leg. N.° 713 y modificatorias"));
        }

        // 3. Feriados móviles: Jueves y Viernes Santo (Semana Santa)
        LocalDate pascua = domingoPascua(anio);
        LocalDate juevesSanto = pascua.minusDays(3);
        LocalDate viernesSanto = pascua.minusDays(2);
        map.put(juevesSanto, new DiaInhabilDTO(juevesSanto, "Jueves Santo", "feriado", true, "movil-jueves-santo-" + anio, "D. Leg. N.° 713 y modificatorias"));
        map.put(viernesSanto, new DiaInhabilDTO(viernesSanto, "Viernes Santo", "feriado", true, "movil-viernes-santo-" + anio, "D. Leg. N.° 713 y modificatorias"));

        // 4. Días no laborables por defecto para 2026 si aplica
        if (anio == 2026) {
            LocalDate nl1 = LocalDate.of(2026, 1, 2);
            LocalDate nl2 = LocalDate.of(2026, 7, 27);
            map.putIfAbsent(nl1, new DiaInhabilDTO(nl1, "Día no laborable para el sector público", "no_laborable", false, "nl-2026-01-02", "Decreto Supremo (PCM)"));
            map.putIfAbsent(nl2, new DiaInhabilDTO(nl2, "Día no laborable para el sector público", "no_laborable", false, "nl-2026-07-27", "D.S. N.° 075-2026-PCM"));
        }

        return new ArrayList<>(map.values());
    }

    @Override
    public CalendarioAnioResumenDTO obtenerResumenAnio(int anio) {
        List<DiaInhabilDTO> inhabiles = obtenerInhabilesDelAnio(anio);
        int feriadosLab = 0;
        int noLaborablesLab = 0;
        int suspensionesLab = 0;
        int diasHabilesTotal = 0;

        LocalDate inicio = LocalDate.of(anio, 1, 1);
        LocalDate fin = LocalDate.of(anio, 12, 31);

        Set<LocalDate> inhabilesSet = new HashSet<>();
        for (DiaInhabilDTO inh : inhabiles) {
            inhabilesSet.add(inh.fecha());
            DayOfWeek dw = inh.fecha().getDayOfWeek();
            if (dw != DayOfWeek.SATURDAY && dw != DayOfWeek.SUNDAY) {
                if ("feriado".equals(inh.tipo())) feriadosLab++;
                else if ("no_laborable".equals(inh.tipo())) noLaborablesLab++;
                else if ("suspension".equals(inh.tipo())) suspensionesLab++;
            }
        }

        for (LocalDate d = inicio; !d.isAfter(fin); d = d.plusDays(1)) {
            DayOfWeek dw = d.getDayOfWeek();
            if (dw != DayOfWeek.SATURDAY && dw != DayOfWeek.SUNDAY && !inhabilesSet.contains(d)) {
                diasHabilesTotal++;
            }
        }

        return new CalendarioAnioResumenDTO(
                anio,
                diasHabilesTotal,
                feriadosLab,
                noLaborablesLab,
                suspensionesLab,
                inhabiles
        );
    }

    /**
     * Algoritmo gregoriano anónimo para el cálculo del Domingo de Pascua.
     */
    public static LocalDate domingoPascua(int y) {
        int a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4;
        int f = (b + 8) / 25, g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451;
        int mes = (h + l - 7 * m + 114) / 31;
        int dia = ((h + l - 7 * m + 114) % 31) + 1;
        return LocalDate.of(y, mes, dia);
    }
}
