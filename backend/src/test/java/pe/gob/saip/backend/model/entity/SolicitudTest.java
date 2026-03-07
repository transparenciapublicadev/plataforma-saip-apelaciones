package pe.gob.saip.backend.model.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class SolicitudTest {

    /**
     * Avanza días calendario asegurando que el resultado caiga en día hábil (lun-vie).
     */
    private static LocalDate avanzarDiasHabiles(LocalDate desde, int diasHabiles) {
        LocalDate fecha = desde;
        int contados = 0;
        while (contados < diasHabiles) {
            fecha = fecha.plusDays(1);
            DayOfWeek dow = fecha.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                contados++;
            }
        }
        return fecha;
    }

    private Solicitud crearSolicitud(Solicitud.EstadoSolicitud estado, LocalDate fechaLimite) {
        Solicitud s = new Solicitud();
        s.setIdSolicitud(1L);
        s.setExpediente("SAIP-2025-00001");
        s.setAsunto("Test");
        s.setDescripcion("Descripción");
        s.setEstado(estado);
        s.setFechaPresentacion(LocalDateTime.now());
        s.setFechaLimite(fechaLimite);
        return s;
    }

    @Test
    void getId_debeRetornarIdSolicitud() {
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, avanzarDiasHabiles(LocalDate.now(), 10));
        assertThat(s.getId()).isEqualTo(1L);
    }

    @Test
    void getSemaforo_conMuchosDiasRestantes_debeSerVerde() {
        // 7 días hábiles restantes → VERDE (>4)
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, avanzarDiasHabiles(LocalDate.now(), 7));
        assertThat(s.getSemaforo()).isEqualTo("VERDE");
    }

    @Test
    void getSemaforo_conPocosDiasRestantes_debeSerAmbar() {
        // 3 días hábiles restantes → AMBAR (3-4)
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, avanzarDiasHabiles(LocalDate.now(), 3));
        assertThat(s.getSemaforo()).isEqualTo("AMBAR");
    }

    @Test
    void getSemaforo_urgente_debeSerRojo() {
        // 1 día hábil restante → ROJO (0-2)
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, avanzarDiasHabiles(LocalDate.now(), 1));
        assertThat(s.getSemaforo()).isEqualTo("ROJO");
    }

    @Test
    void getSemaforo_vencido_debeSerNegro() {
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, LocalDate.now().minusDays(1));
        assertThat(s.getSemaforo()).isEqualTo("NEGRO");
    }

    @Test
    void isSilencioAdministrativo_vencidaYRecepcionada_debeSerTrue() {
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, LocalDate.now().minusDays(5));
        assertThat(s.isSilencioAdministrativo()).isTrue();
    }

    @Test
    void isSilencioAdministrativo_vencidaYEnRevision_debeSerTrue() {
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.EN_REVISION, LocalDate.now().minusDays(5));
        assertThat(s.isSilencioAdministrativo()).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = Solicitud.EstadoSolicitud.class, names = {"RESPONDIDA", "DENEGADA", "CONCLUIDA", "VENCIDA"})
    void isSilencioAdministrativo_estadosFinales_debeSerFalse(Solicitud.EstadoSolicitud estado) {
        Solicitud s = crearSolicitud(estado, LocalDate.now().minusDays(5));
        assertThat(s.isSilencioAdministrativo()).isFalse();
    }

    @Test
    void isSilencioAdministrativo_noVencida_debeSerFalse() {
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, LocalDate.now().plusDays(5));
        assertThat(s.isSilencioAdministrativo()).isFalse();
    }

    @Test
    void getDiasRestantes_sinFechaLimite_debeRetornarCero() {
        Solicitud s = crearSolicitud(Solicitud.EstadoSolicitud.RECEPCIONADA, null);
        assertThat(s.getDiasRestantes()).isZero();
    }
}
