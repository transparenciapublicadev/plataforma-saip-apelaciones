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
@Table(name = "observaciones_solicitud", indexes = {
        @Index(name = "idx_obs_solicitud_solicitud", columnList = "id_solicitud"),
        @Index(name = "idx_obs_solicitud_estado", columnList = "estado"),
        @Index(name = "idx_obs_solicitud_limite", columnList = "fecha_limite_subsanacion")
})
public class ObservacionSolicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_observacion")
    private Long idObservacion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @NotNull(message = "La solicitud no puede ser nula")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_solicitud", nullable = false)
    private Solicitud solicitud;

    @NotBlank(message = "El motivo de observación es obligatorio")
    @Column(name = "motivo_observacion", nullable = false, columnDefinition = "TEXT")
    private String motivoObservacion;

    @Column(name = "fecha_observacion", nullable = false)
    private LocalDateTime fechaObservacion;

    @Column(name = "fecha_limite_subsanacion", nullable = false)
    private LocalDate fechaLimiteSubsanacion;

    @Column(name = "fecha_subsanacion")
    private LocalDateTime fechaSubsanacion;

    @Column(name = "comentario_subsanacion", columnDefinition = "TEXT")
    private String comentarioSubsanacion;

    @Column(name = "documento_subsanacion_nombre", length = 255)
    private String documentoSubsanacionNombre;

    @Column(name = "documento_subsanacion_ruta", length = 500)
    private String documentoSubsanacionRuta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoObservacion estado;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @Column(name = "responsable_observacion", length = 120)
    private String responsableObservacion;

    @Column(name = "responsable_subsanacion", length = 120)
    private String responsableSubsanacion;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (fechaObservacion == null) {
            fechaObservacion = now;
        }
        if (estado == null) {
            estado = EstadoObservacion.PENDIENTE_SUBSANACION;
        }
        fechaCreacion = now;
        fechaActualizacion = now;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return idObservacion;
    }

    public enum EstadoObservacion {
        PENDIENTE_SUBSANACION,
        SUBSANADA,
        NO_SUBSANADA,
        ARCHIVADA
    }
}
