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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "expedientes_ttaip", indexes = {
    @Index(name = "idx_expediente_ttaip_numero", columnList = "numero_expediente", unique = true),
    @Index(name = "idx_expediente_ttaip_apelacion", columnList = "id_apelacion", unique = true),
    @Index(name = "idx_expediente_ttaip_sala", columnList = "id_sala_ttaip"),
    @Index(name = "idx_expediente_ttaip_estado", columnList = "estado")
})
public class ExpedienteTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_expediente_ttaip")
    private Long idExpedienteTtaip;

    @NotBlank(message = "El número de expediente TTAIP no puede estar vacío")
    @Column(name = "numero_expediente", nullable = false, unique = true, length = 50)
    private String numeroExpediente;

    @NotNull(message = "La apelación asociada es obligatoria")
    @OneToOne
    @JoinColumn(name = "id_apelacion", nullable = false, unique = true)
    private Apelacion apelacion;

    @NotNull(message = "La sala TTAIP es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_sala_ttaip", nullable = false)
    private SalaTtaip sala;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Apelacion.EstadoApelacion estado;

    @Column(name = "fecha_apertura", nullable = false)
    private LocalDateTime fechaApertura;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @Column(name = "fecha_primera_calificacion")
    private LocalDateTime fechaPrimeraCalificacion;

    @Column(name = "fecha_segunda_calificacion")
    private LocalDateTime fechaSegundaCalificacion;

    @Column(name = "fecha_resolucion_final")
    private LocalDateTime fechaResolucionFinal;

    @Column(name = "fecha_limite_resolucion")
    private LocalDate fechaLimiteResolucion;

    @Column(name = "trazabilidad_minima", columnDefinition = "TEXT")
    private String trazabilidadMinima;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToMany
    @JoinTable(
        name = "expediente_ttaip_miembros",
        joinColumns = @JoinColumn(name = "id_expediente_ttaip"),
        inverseJoinColumns = @JoinColumn(name = "id_miembro_ttaip")
    )
    private Set<MiembroTTAIP> miembrosAsignados = new LinkedHashSet<>();

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expedienteTtaip", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Resolucion> resoluciones;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expediente", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<NotificacionTtaip> notificaciones;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expediente", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @OrderBy("fechaEvento ASC")
    private List<HistorialTtaip> historial;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expediente", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @OrderBy("fechaCreacion ASC")
    private List<ReprocesoNotificacion> reprocesos;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expediente", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @OrderBy("fechaRequerimiento DESC")
    private List<DescargoEntidadTtaip> descargosEntidad;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expediente", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @OrderBy("fechaInicioSuspension ASC")
    private List<SuspensionPlazoTtaip> suspensionesPlazo;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "expediente", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @OrderBy("fechaRequerimientoCumplimiento DESC")
    private List<CumplimientoResolucionTtaip> cumplimientosResolucion;

    @PrePersist
    protected void onCreate() {
        fechaApertura = fechaApertura != null ? fechaApertura : LocalDateTime.now();
        fechaActualizacion = LocalDateTime.now();
        if (estado == null && apelacion != null) {
            estado = apelacion.getEstado();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public Long getId() {
        return this.idExpedienteTtaip;
    }
}
