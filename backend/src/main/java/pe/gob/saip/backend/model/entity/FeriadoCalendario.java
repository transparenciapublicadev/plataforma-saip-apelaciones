package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "calendario_feriado")
public class FeriadoCalendario {

    @Id
    @Column(length = 100, nullable = false)
    private String id;

    @Column(nullable = false, length = 255)
    private String nombre;

    @Column(nullable = false, length = 30)
    private String tipo = "feriado";

    @Column(nullable = false)
    private Boolean recurrente = false;

    @Column(length = 10)
    private String mmdd;

    private LocalDate fecha;

    private LocalDate hasta;

    @Column(name = "base_legal", length = 255)
    private String baseLegal;

    @Column(nullable = false)
    private Boolean activo = true;

    @Column(nullable = false, length = 20)
    private String origen = "sistema";

    @Column(name = "alcance_nacional", nullable = false)
    private Boolean alcanceNacional = true;

    @Column(name = "entidades_ids", columnDefinition = "TEXT")
    private String entidadesIds;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (creadoEn == null) {
            creadoEn = LocalDateTime.now();
        }
        if (actualizadoEn == null) {
            actualizadoEn = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        actualizadoEn = LocalDateTime.now();
    }
}
