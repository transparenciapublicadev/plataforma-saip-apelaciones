package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "liquidaciones_costo_solicitud", indexes = {
        @Index(name = "idx_liq_solicitud", columnList = "id_solicitud"),
        @Index(name = "idx_liq_codigo", columnList = "codigo_liquidacion", unique = true),
        @Index(name = "idx_liq_estado", columnList = "estado_liquidacion"),
        @Index(name = "idx_liq_fecha_notificacion", columnList = "fecha_notificacion"),
        @Index(name = "idx_liq_limite_recojo", columnList = "fecha_limite_recojo")
})
public class LiquidacionCostoSolicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_liquidacion")
    private Long idLiquidacion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @NotNull(message = "La solicitud no puede ser nula")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_solicitud", nullable = false)
    private Solicitud solicitud;

    @NotBlank(message = "El código de liquidación es obligatorio")
    @Column(name = "codigo_liquidacion", nullable = false, unique = true, length = 60)
    private String codigoLiquidacion;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.00", message = "El monto no puede ser negativo")
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @NotBlank(message = "La moneda es obligatoria")
    @Column(nullable = false, length = 3)
    private String moneda;

    @NotBlank(message = "El concepto es obligatorio")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String concepto;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDateTime fechaEmision;

    @Column(name = "fecha_notificacion", nullable = false)
    private LocalDate fechaNotificacion;

    @Column(name = "fecha_limite_recojo", nullable = false)
    private LocalDate fechaLimiteRecojo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_liquidacion", nullable = false, length = 30)
    private EstadoLiquidacion estadoLiquidacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "medio_notificacion", nullable = false, length = 40)
    private Solicitud.CanalNotificacion medioNotificacion;

    @Column(length = 120)
    private String responsable;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @Column(name = "fecha_pago")
    private LocalDate fechaPago;

    @Column(name = "fecha_recojo")
    private LocalDate fechaRecojo;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (fechaEmision == null) {
            fechaEmision = now;
        }
        if (estadoLiquidacion == null) {
            estadoLiquidacion = EstadoLiquidacion.NOTIFICADA;
        }
        if (moneda == null || moneda.isBlank()) {
            moneda = "PEN";
        }
        fechaCreacion = now;
        fechaActualizacion = now;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return idLiquidacion;
    }

    public enum EstadoLiquidacion {
        EMITIDA,
        NOTIFICADA,
        PAGADA,
        RECOGIDA,
        ARCHIVADA,
        CANCELADA,
        VENCIDA
    }
}
