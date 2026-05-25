package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
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
@Table(name = "descargos_entidad_ttaip", indexes = {
    @Index(name = "idx_descargo_ttaip_expediente", columnList = "id_expediente_ttaip"),
    @Index(name = "idx_descargo_ttaip_apelacion", columnList = "id_apelacion"),
    @Index(name = "idx_descargo_ttaip_entidad", columnList = "id_entidad"),
    @Index(name = "idx_descargo_ttaip_estado", columnList = "estado_descargo"),
    @Index(name = "idx_descargo_ttaip_limite", columnList = "fecha_limite_descargo")
})
public class DescargoEntidadTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_descargo")
    private Long idDescargo;

    @NotNull(message = "El expediente TTAIP asociado es obligatorio")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_expediente_ttaip", nullable = false)
    private ExpedienteTtaip expediente;

    @NotNull(message = "La apelación asociada es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_apelacion", nullable = false)
    private Apelacion apelacion;

    @NotNull(message = "La entidad pública requerida es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_entidad", nullable = false)
    private Entidad entidad;

    @Column(name = "fecha_requerimiento", nullable = false)
    private LocalDate fechaRequerimiento;

    @Column(name = "fecha_limite_descargo", nullable = false)
    private LocalDate fechaLimiteDescargo;

    @Column(name = "fecha_presentacion")
    private LocalDate fechaPresentacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_descargo", nullable = false, length = 40)
    private EstadoDescargo estadoDescargo;

    @Column(name = "resumen_descargo", columnDefinition = "TEXT")
    private String resumenDescargo;

    @Column(name = "documento_descargo", length = 500)
    private String documentoDescargo;

    @Column(name = "responsable_entidad", length = 120)
    private String responsableEntidad;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        fechaCreacion = fechaCreacion != null ? fechaCreacion : LocalDateTime.now();
        fechaActualizacion = LocalDateTime.now();
        fechaRequerimiento = fechaRequerimiento != null ? fechaRequerimiento : LocalDate.now();
        estadoDescargo = estadoDescargo != null ? estadoDescargo : EstadoDescargo.REQUERIDO;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return this.idDescargo;
    }

    public enum EstadoDescargo {
        REQUERIDO,
        PRESENTADO,
        PRESENTADO_EXTEMPORANEO,
        VENCIDO_SIN_PRESENTACION,
        CANCELADO
    }
}
