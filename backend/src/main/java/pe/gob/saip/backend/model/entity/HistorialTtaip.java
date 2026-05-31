package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "historial_ttaip", indexes = {
    @Index(name = "idx_historial_ttaip_expediente", columnList = "id_expediente_ttaip"),
    @Index(name = "idx_historial_ttaip_tipo", columnList = "tipo_evento"),
    @Index(name = "idx_historial_ttaip_fecha", columnList = "fecha_evento")
})
public class HistorialTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_historial")
    private Long idHistorial;

    @NotNull(message = "El expediente asociado es obligatorio")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_expediente_ttaip", nullable = false)
    private ExpedienteTtaip expediente;

    @NotNull(message = "El tipo de evento es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_evento", nullable = false, length = 40)
    private TipoEvento tipoEvento;

    @NotBlank(message = "La descripción del evento es obligatoria")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "estado_anterior", length = 60)
    private String estadoAnterior;

    @Column(name = "estado_nuevo", length = 60)
    private String estadoNuevo;

    @Column(length = 120)
    private String actor;

    @Column(length = 180)
    private String referencia;

    @Column(name = "fecha_evento", nullable = false)
    private LocalDateTime fechaEvento;

    @PrePersist
    protected void onCreate() {
        fechaEvento = fechaEvento != null ? fechaEvento : LocalDateTime.now();
        actor = actor != null && !actor.isBlank() ? actor : "SISTEMA";
    }

    public Long getId() {
        return this.idHistorial;
    }

    public enum TipoEvento {
        APERTURA_EXPEDIENTE,
        CAMBIO_ESTADO,
        RESOLUCION_EMITIDA,
        CEDULA_EMITIDA,
        NOTIFICACION_REGISTRADA,
        CONSTANCIA_ENVIO_REGISTRADA,
        ACUSE_NOTIFICACION_REGISTRADO,
        NOTIFICACION_VALIDADA,
        REPROCESO_REGISTRADO,
        DESCARGO_REQUERIDO,
        DESCARGO_PRESENTADO,
        SUSPENSION_PLAZO,
        CUMPLIMIENTO_REQUERIDO,
        CUMPLIMIENTO_PRESENTADO,
        CUMPLIMIENTO_OBSERVADO,
        CUMPLIMIENTO_CERRADO,
        CUMPLIMIENTO_VENCIDO,
        SUBSANACION,
        ENVIO_PROVEEDOR_REGISTRADO,
        AUDITORIA
    }
}
