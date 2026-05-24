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
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ampliaciones_plazo_solicitud", indexes = {
        @Index(name = "idx_amp_solicitud", columnList = "id_solicitud"),
        @Index(name = "idx_amp_estado", columnList = "estado_ampliacion"),
        @Index(name = "idx_amp_fecha_notificacion", columnList = "fecha_notificacion_ampliacion")
})
public class AmpliacionPlazoSolicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ampliacion")
    private Long idAmpliacion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @NotNull(message = "La solicitud no puede ser nula")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_solicitud", nullable = false)
    private Solicitud solicitud;

    @NotBlank(message = "El motivo de ampliación es obligatorio")
    @Column(name = "motivo_ampliacion", nullable = false, columnDefinition = "TEXT")
    private String motivoAmpliacion;

    @NotBlank(message = "El informe de ampliación es obligatorio")
    @Column(name = "informe_ampliacion", nullable = false, columnDefinition = "TEXT")
    private String informeAmpliacion;

    @Column(name = "fecha_solicitud_ampliacion", nullable = false)
    private LocalDateTime fechaSolicitudAmpliacion;

    @Column(name = "fecha_notificacion_ampliacion", nullable = false)
    private LocalDate fechaNotificacionAmpliacion;

    @Column(name = "fecha_limite_original", nullable = false)
    private LocalDate fechaLimiteOriginal;

    @Column(name = "fecha_limite_ampliada", nullable = false)
    private LocalDate fechaLimiteAmpliada;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_ampliacion", nullable = false, length = 30)
    private EstadoAmpliacion estadoAmpliacion;

    @Column(length = 120)
    private String responsable;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "ampliacion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("numeroEntrega ASC")
    private List<CronogramaEntregaParcialSolicitud> cronograma;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (fechaSolicitudAmpliacion == null) {
            fechaSolicitudAmpliacion = now;
        }
        if (estadoAmpliacion == null) {
            estadoAmpliacion = EstadoAmpliacion.NOTIFICADA;
        }
        fechaCreacion = now;
        fechaActualizacion = now;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return idAmpliacion;
    }

    public enum EstadoAmpliacion {
        REGISTRADA,
        NOTIFICADA,
        COMPLETADA,
        CANCELADA,
        VENCIDA
    }
}
