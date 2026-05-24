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
@Table(name = "encauzamientos_solicitud", indexes = {
        @Index(name = "idx_enc_solicitud", columnList = "id_solicitud"),
        @Index(name = "idx_enc_origen", columnList = "id_entidad_origen"),
        @Index(name = "idx_enc_destino", columnList = "id_entidad_destino"),
        @Index(name = "idx_enc_estado", columnList = "estado_encauzamiento"),
        @Index(name = "idx_enc_limite", columnList = "fecha_limite_encauzamiento")
})
public class EncauzamientoSolicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_encauzamiento")
    private Long idEncauzamiento;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @NotNull(message = "La solicitud no puede ser nula")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_solicitud", nullable = false)
    private Solicitud solicitud;

    @NotNull(message = "La entidad de origen es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_entidad_origen", nullable = false)
    private Entidad entidadOrigen;

    @NotNull(message = "La entidad de destino es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_entidad_destino", nullable = false)
    private Entidad entidadDestino;

    @NotBlank(message = "El motivo de encauzamiento es obligatorio")
    @Column(name = "motivo_encauzamiento", nullable = false, columnDefinition = "TEXT")
    private String motivoEncauzamiento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlcanceEncauzamiento alcance;

    @Column(name = "fecha_encauzamiento", nullable = false)
    private LocalDateTime fechaEncauzamiento;

    @Column(name = "fecha_limite_encauzamiento", nullable = false)
    private LocalDate fechaLimiteEncauzamiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_encauzamiento", nullable = false, length = 30)
    private EstadoEncauzamiento estadoEncauzamiento;

    @Column(length = 120)
    private String responsable;

    @Column(name = "observacion_sustento", columnDefinition = "TEXT")
    private String observacionSustento;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (fechaEncauzamiento == null) {
            fechaEncauzamiento = now;
        }
        if (estadoEncauzamiento == null) {
            estadoEncauzamiento = EstadoEncauzamiento.DERIVADO;
        }
        fechaCreacion = now;
        fechaActualizacion = now;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return idEncauzamiento;
    }

    public enum AlcanceEncauzamiento {
        TOTAL,
        PARCIAL
    }

    public enum EstadoEncauzamiento {
        REGISTRADO,
        DERIVADO,
        ATENDIDO,
        CANCELADO,
        VENCIDO
    }
}
