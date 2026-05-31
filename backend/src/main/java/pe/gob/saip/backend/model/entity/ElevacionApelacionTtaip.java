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
@Table(name = "elevaciones_apelacion_ttaip", indexes = {
        @Index(name = "idx_elevacion_apelacion", columnList = "id_apelacion", unique = true),
        @Index(name = "idx_elevacion_entidad", columnList = "id_entidad_origen"),
        @Index(name = "idx_elevacion_estado", columnList = "estado_elevacion"),
        @Index(name = "idx_elevacion_limite", columnList = "fecha_limite_elevacion")
})
public class ElevacionApelacionTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_elevacion")
    private Long idElevacion;

    @NotNull(message = "La apelación es obligatoria")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_apelacion", nullable = false, unique = true)
    private Apelacion apelacion;

    @NotNull(message = "La entidad de origen es obligatoria")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_entidad_origen", nullable = false)
    private Entidad entidadOrigen;

    @NotNull(message = "La fecha de presentación ante la entidad es obligatoria")
    @Column(name = "fecha_presentacion_ante_entidad", nullable = false)
    private LocalDate fechaPresentacionAnteEntidad;

    @NotNull(message = "La fecha límite de elevación es obligatoria")
    @Column(name = "fecha_limite_elevacion", nullable = false)
    private LocalDate fechaLimiteElevacion;

    @Column(name = "fecha_elevacion_ttaip")
    private LocalDateTime fechaElevacionTtaip;

    @Column(name = "fecha_comunicacion_ciudadano")
    private LocalDateTime fechaComunicacionCiudadano;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_elevacion", nullable = false, length = 40)
    private EstadoElevacion estadoElevacion;

    @NotBlank(message = "La referencia del cargo de presentación es obligatoria")
    @Column(name = "referencia_cargo_presentacion", nullable = false, length = 500)
    private String referenciaCargoPresentacion;

    @Column(name = "referencia_expediente_elevado", length = 500)
    private String referenciaExpedienteElevado;

    @Column(name = "referencia_prueba_omision", length = 500)
    private String referenciaPruebaOmision;

    @Column(name = "responsable_entidad", length = 120)
    private String responsableEntidad;

    @Column(name = "responsable_ttaip", length = 120)
    private String responsableTtaip;

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
        LocalDateTime now = LocalDateTime.now();
        if (estadoElevacion == null) {
            estadoElevacion = EstadoElevacion.PENDIENTE;
        }
        fechaCreacion = now;
        fechaActualizacion = now;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return idElevacion;
    }

    public enum EstadoElevacion {
        PENDIENTE,
        ELEVADA,
        VENCIDA_NO_ELEVADA,
        COMUNICADA_POR_CIUDADANO,
        ADMITIDA_EXCEPCIONALMENTE
    }
}
