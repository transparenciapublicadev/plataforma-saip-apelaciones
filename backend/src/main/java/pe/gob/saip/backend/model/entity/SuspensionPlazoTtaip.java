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
@Table(name = "suspensiones_plazo_ttaip", indexes = {
    @Index(name = "idx_suspension_ttaip_expediente", columnList = "id_expediente_ttaip"),
    @Index(name = "idx_suspension_ttaip_descargo", columnList = "id_descargo"),
    @Index(name = "idx_suspension_ttaip_estado", columnList = "estado_suspension"),
    @Index(name = "idx_suspension_ttaip_motivo", columnList = "motivo_suspension")
})
public class SuspensionPlazoTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_suspension")
    private Long idSuspension;

    @NotNull(message = "El expediente TTAIP asociado es obligatorio")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_expediente_ttaip", nullable = false)
    private ExpedienteTtaip expediente;

    @ManyToOne
    @JoinColumn(name = "id_descargo")
    private DescargoEntidadTtaip descargo;

    @Enumerated(EnumType.STRING)
    @Column(name = "motivo_suspension", nullable = false, length = 40)
    private MotivoSuspension motivoSuspension;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private SolicitanteSuspension solicitante;

    @Column(name = "motivo_detalle", columnDefinition = "TEXT")
    private String motivoDetalle;

    @Column(name = "fecha_solicitud")
    private LocalDate fechaSolicitud;

    @Column(name = "fecha_inicio_suspension", nullable = false)
    private LocalDate fechaInicioSuspension;

    @Column(name = "fecha_fin_suspension")
    private LocalDate fechaFinSuspension;

    @Column(name = "dias_suspendidos", nullable = false)
    private Integer diasSuspendidos;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_suspension", nullable = false, length = 30)
    private EstadoSuspension estadoSuspension;

    @Column(length = 180)
    private String responsable;

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
        motivoSuspension = motivoSuspension != null ? motivoSuspension : MotivoSuspension.DESCARGOS_ENTIDAD;
        estadoSuspension = estadoSuspension != null ? estadoSuspension : EstadoSuspension.ACTIVA;
        diasSuspendidos = diasSuspendidos != null ? diasSuspendidos : 0;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return this.idSuspension;
    }

    public enum MotivoSuspension {
        DESCARGOS_ENTIDAD,
        INFORME_ORAL,
        INFORMACION_COMPLEMENTARIA
    }

    public enum SolicitanteSuspension {
        CIUDADANO,
        ENTIDAD_PUBLICA,
        TTAIP
    }

    public enum EstadoSuspension {
        ACTIVA,
        CERRADA,
        VENCIDA,
        CANCELADA
    }
}
