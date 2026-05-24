package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cronograma_entregas_parciales_solicitud", indexes = {
        @Index(name = "idx_cronograma_ampliacion", columnList = "id_ampliacion"),
        @Index(name = "idx_cronograma_estado", columnList = "estado"),
        @Index(name = "idx_cronograma_fecha_programada", columnList = "fecha_programada")
})
public class CronogramaEntregaParcialSolicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_entrega")
    private Long idEntrega;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @NotNull(message = "La ampliación no puede ser nula")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_ampliacion", nullable = false)
    private AmpliacionPlazoSolicitud ampliacion;

    @NotNull(message = "El número de entrega es obligatorio")
    @Column(name = "numero_entrega", nullable = false)
    private Integer numeroEntrega;

    @NotBlank(message = "La descripción de la entrega es obligatoria")
    @Column(nullable = false, length = 1000)
    private String descripcion;

    @NotNull(message = "La fecha programada es obligatoria")
    @Column(name = "fecha_programada", nullable = false)
    private LocalDate fechaProgramada;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoEntregaParcial estado;

    @Column(name = "fecha_entrega_real")
    private LocalDate fechaEntregaReal;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (estado == null) {
            estado = EstadoEntregaParcial.PROGRAMADA;
        }
        fechaCreacion = now;
        fechaActualizacion = now;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return idEntrega;
    }

    public enum EstadoEntregaParcial {
        PROGRAMADA,
        ENTREGADA,
        OBSERVADA,
        CANCELADA,
        VENCIDA
    }
}
