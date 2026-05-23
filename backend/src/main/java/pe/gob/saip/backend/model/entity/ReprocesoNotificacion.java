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
@Table(
    name = "reprocesos_notificacion",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uk_reproceso_cedula_destinatario_intento",
            columnNames = {"id_cedula_original", "destinatario", "numero_intento"}
        )
    },
    indexes = {
        @Index(name = "idx_reproceso_expediente", columnList = "id_expediente_ttaip"),
        @Index(name = "idx_reproceso_cedula", columnList = "id_cedula_original"),
        @Index(name = "idx_reproceso_destinatario", columnList = "destinatario"),
        @Index(name = "idx_reproceso_estado", columnList = "estado")
    }
)
public class ReprocesoNotificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_reproceso")
    private Long idReproceso;

    @NotNull(message = "El expediente asociado es obligatorio")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_expediente_ttaip", nullable = false)
    private ExpedienteTtaip expediente;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_notificacion")
    private NotificacionTtaip notificacion;

    @NotNull(message = "La cédula original es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_cedula_original", nullable = false)
    private CedulaNotificacion cedulaOriginal;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_reproceso_padre")
    private ReprocesoNotificacion reprocesoPadre;

    @NotNull(message = "El destinatario del reproceso es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CedulaNotificacion.DestinatarioNotificacion destinatario;

    @NotBlank(message = "El número de cédula original es obligatorio")
    @Column(name = "numero_cedula_original", nullable = false, length = 50)
    private String numeroCedulaOriginal;

    @Column(name = "fecha_ingreso_cargo")
    private LocalDate fechaIngresoCargo;

    @Column(name = "observacion_reproceso", columnDefinition = "TEXT")
    private String observacionReproceso;

    @Column(name = "fecha_subsanacion")
    private LocalDate fechaSubsanacion;

    @Column(name = "cedula_subsanacion", length = 50)
    private String cedulaSubsanacion;

    @Column(name = "fecha_cedula_subsanacion")
    private LocalDate fechaCedulaSubsanacion;

    @Column(name = "numero_intento", nullable = false)
    private Integer numeroIntento;

    @NotNull(message = "El estado del reproceso es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoReproceso estado;

    @Column(name = "responsable_notificacion", length = 120)
    private String responsableNotificacion;

    @Column(name = "responsable_subsanacion", length = 120)
    private String responsableSubsanacion;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        fechaCreacion = fechaCreacion != null ? fechaCreacion : LocalDateTime.now();
        fechaActualizacion = LocalDateTime.now();
        fechaIngresoCargo = fechaIngresoCargo != null ? fechaIngresoCargo : LocalDate.now();
        numeroIntento = numeroIntento != null ? numeroIntento : 1;
        estado = estado != null ? estado : EstadoReproceso.PENDIENTE;
        if (cedulaOriginal != null) {
            numeroCedulaOriginal = numeroCedulaOriginal != null ? numeroCedulaOriginal : cedulaOriginal.getNumeroCedula();
            destinatario = destinatario != null ? destinatario : cedulaOriginal.getDestinatario();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return this.idReproceso;
    }

    public enum EstadoReproceso {
        PENDIENTE,
        EN_PROCESO,
        ATENDIDO,
        URGENTE
    }
}
