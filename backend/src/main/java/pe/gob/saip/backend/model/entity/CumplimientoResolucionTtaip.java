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
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cumplimientos_resolucion_ttaip", indexes = {
    @Index(name = "idx_cumplimiento_ttaip_expediente", columnList = "id_expediente_ttaip"),
    @Index(name = "idx_cumplimiento_ttaip_apelacion", columnList = "id_apelacion"),
    @Index(name = "idx_cumplimiento_ttaip_resolucion", columnList = "id_resolucion"),
    @Index(name = "idx_cumplimiento_ttaip_entidad", columnList = "id_entidad"),
    @Index(name = "idx_cumplimiento_ttaip_estado", columnList = "estado_cumplimiento"),
    @Index(name = "idx_cumplimiento_ttaip_limite", columnList = "fecha_limite_cumplimiento")
})
public class CumplimientoResolucionTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cumplimiento")
    private Long idCumplimiento;

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

    @NotNull(message = "La resolución final asociada es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_resolucion", nullable = false)
    private Resolucion resolucion;

    @NotNull(message = "La entidad pública obligada es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_entidad", nullable = false)
    private Entidad entidad;

    @Column(name = "fecha_requerimiento_cumplimiento", nullable = false)
    private LocalDate fechaRequerimientoCumplimiento;

    @Column(name = "fecha_limite_cumplimiento", nullable = false)
    private LocalDate fechaLimiteCumplimiento;

    @Column(name = "fecha_cumplimiento")
    private LocalDate fechaCumplimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_cumplimiento", nullable = false, length = 40)
    private EstadoCumplimiento estadoCumplimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_cumplimiento", length = 30)
    private TipoCumplimiento tipoCumplimiento;

    @Column(name = "descripcion_cumplimiento", columnDefinition = "TEXT")
    private String descripcionCumplimiento;

    @Column(name = "evidencia_cumplimiento", length = 500)
    private String evidenciaCumplimiento;

    @Column(name = "referencia_documento", length = 500)
    private String referenciaDocumento;

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

    @Column(name = "id_notificacion_inicio")
    private Long idNotificacionInicio;
    @Column(name = "operacion_entrega")
    private UUID operacionEntrega;
    @Column(name = "fecha_entrega")
    private LocalDateTime fechaEntrega;
    @Column(name = "id_actor_entrega")
    private Long idActorEntrega;
    @Column(name = "operacion_validacion_entrega")
    private UUID operacionValidacionEntrega;
    @Column(name = "fecha_eficacia_entrega")
    private LocalDate fechaEficaciaEntrega;
    @Column(name = "fecha_validacion_entrega")
    private LocalDateTime fechaValidacionEntrega;
    @Column(name = "id_actor_validacion")
    private Long idActorValidacion;
    @Column(name = "operacion_remision")
    private UUID operacionRemision;
    @Column(name = "numero_oficio", length = 120)
    private String numeroOficio;
    @Column(name = "id_actor_remision")
    private Long idActorRemision;

    public enum Adjunto {
        RESPUESTA, ANEXO_RESPUESTA, CARGO, ACUSE, OFICIO, ANEXO_OFICIO;

        public boolean visibleAlAdministrado() {
            return this == RESPUESTA || this == ANEXO_RESPUESTA;
        }
    }

    @PrePersist
    protected void onCreate() {
        fechaCreacion = fechaCreacion != null ? fechaCreacion : LocalDateTime.now();
        fechaActualizacion = LocalDateTime.now();
        estadoCumplimiento = estadoCumplimiento != null ? estadoCumplimiento : EstadoCumplimiento.PENDIENTE;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return this.idCumplimiento;
    }

    public enum EstadoCumplimiento {
        PENDIENTE,
        CUMPLIDO,
        CUMPLIDO_PARCIAL,
        VENCIDO,
        OBSERVADO,
        CERRADO
    }

    public enum TipoCumplimiento {
        TOTAL,
        PARCIAL,
        NO_CUMPLE
    }
}
