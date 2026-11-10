package pe.gob.saip.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;
import pe.gob.saip.backend.model.entity.FeriadoCalendario;
import pe.gob.saip.backend.repository.CalendarioHistorialRepository;
import pe.gob.saip.backend.repository.ConfiguracionSistemaRepository;
import pe.gob.saip.backend.repository.FeriadoCalendarioRepository;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CalendarioServiceTest {

    private FeriadoCalendarioRepository feriadoRepository;
    private CalendarioHistorialRepository historialRepository;
    private ConfiguracionSistemaRepository configRepository;
    private PlazoCalculadorService plazoCalculadorService;
    private CalendarioService calendarioService;

    @BeforeEach
    void setUp() {
        feriadoRepository = mock(FeriadoCalendarioRepository.class);
        historialRepository = mock(CalendarioHistorialRepository.class);
        configRepository = mock(ConfiguracionSistemaRepository.class);
        plazoCalculadorService = mock(PlazoCalculadorService.class);

        calendarioService = new CalendarioService(
                feriadoRepository,
                historialRepository,
                configRepository,
                plazoCalculadorService
        );
    }

    @Test
    @DisplayName("obtenerConfiguracionCalendario devuelve estructura completa")
    void obtenerConfiguracionCalendario_ShouldReturnCompleteStructure() {
        ConfiguracionSistema config = new ConfiguracionSistema();
        config.setId(1L);
        config.setPlazoSaipRespuesta(10);
        when(configRepository.findById(1L)).thenReturn(Optional.of(config));
        when(feriadoRepository.findAll()).thenReturn(List.of());
        when(historialRepository.findAllByOrderByFechaDesc()).thenReturn(List.of());

        CalendarioConfigDTO dto = calendarioService.obtenerConfiguracionCalendario();

        assertThat(dto).isNotNull();
        assertThat(dto.version()).isEqualTo(1);
        assertThat(dto.plazos()).containsEntry("SAIP_ATENCION", 10);
        assertThat(dto.tarifas()).isNotNull();
    }

    @Test
    @DisplayName("crearOActualizarFeriado persiste y registra historial")
    void crearOActualizarFeriado_ShouldSaveAndLogAudit() {
        FeriadoDTO input = new FeriadoDTO(
                "adm-feriado-test",
                "Feriado Cívico Local",
                "feriado",
                false,
                "2026-10-15",
                null,
                null,
                "Ordenanza Municipal",
                true,
                "admin",
                true,
                List.of()
        );

        when(feriadoRepository.findById("adm-feriado-test")).thenReturn(Optional.empty());
        when(feriadoRepository.save(any(FeriadoCalendario.class))).thenAnswer(inv -> inv.getArgument(0));

        FeriadoDTO result = calendarioService.crearOActualizarFeriado(input, "admin@yaiku.gob.pe");

        assertThat(result.nombre()).isEqualTo("Feriado Cívico Local");
        verify(historialRepository).save(any());
        verify(plazoCalculadorService).invalidarCache();
    }

    @Test
    @DisplayName("computarPlazo delega correctamente en PlazoCalculadorService")
    void computarPlazo_ShouldDelegateToEngine() {
        LocalDate inicio = LocalDate.of(2026, 7, 1);
        ComputoPlazoRequest req = new ComputoPlazoRequest(inicio, 10, "habiles", null);

        LocalDate esperado = LocalDate.of(2026, 7, 15);
        when(plazoCalculadorService.calcularFechaVencimiento(inicio, 10, null)).thenReturn(esperado);
        when(plazoCalculadorService.diasHabilesRestantes(esperado, null)).thenReturn(10);
        when(plazoCalculadorService.esDiaHabil(inicio, null)).thenReturn(true);
        when(plazoCalculadorService.motivoInhabil(inicio, null)).thenReturn(null);

        ComputoPlazoResponse resp = calendarioService.computarPlazo(req);

        assertThat(resp.fechaVencimiento()).isEqualTo(esperado);
        assertThat(resp.diasHabilesRestantes()).isEqualTo(10);
        assertThat(resp.esDiaHabil()).isTrue();
    }
}
