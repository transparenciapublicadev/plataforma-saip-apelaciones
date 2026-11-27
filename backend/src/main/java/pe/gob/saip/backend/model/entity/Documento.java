package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import pe.gob.saip.backend.storage.StorageProviderType;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "documentos")
public class Documento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_documento")
    private Long idDocumento;

    @NotBlank(message = "El nombre del archivo no puede estar vacío")
    @Column(name = "nombre_archivo", nullable = false, length = 255)
    private String nombreOriginal;

    @Column(name = "ruta_archivo", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "tipo_archivo", nullable = false, length = 150)
    private String contentType;

    @Column(name = "tamanio")
    private Long sizeBytes;

    @Column(name = "hash_sha256", length = 64)
    private String hashSha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_provider", nullable = false, length = 30)
    private StorageProviderType storageProvider;

    @Column(name = "storage_bucket", length = 120)
    private String storageBucket;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_documento", length = 30)
    private TipoDocumento tipoDocumento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoDocumento estado;

    @Column(name = "fecha_subida", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_creado_por")
    private Usuario creadoPor;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_solicitud")
    private Solicitud solicitud;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_respuesta")
    private Respuesta respuesta;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_apelacion")
    private Apelacion apelacion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_resolucion")
    private Resolucion resolucion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_expediente_ttaip")
    private ExpedienteTtaip expedienteTtaip;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_cedula")
    private CedulaNotificacion cedulaNotificacion;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_entrega_parcial")
    private CronogramaEntregaParcialSolicitud entregaParcial;

    @Column(name = "borrador_ttaip", nullable = false)
    private boolean borradorTtaip;

    @Column(name = "solo_institucional_ttaip", nullable = false)
    private boolean soloInstitucionalTtaip;

    /** Expediente en el que el administrado presentó el archivo, cuando llegó por encauzamiento. */
    @Column(name = "expediente_origen", length = 40)
    private String expedienteOrigen;

    /** Entidad ante la que el administrado presentó el archivo, cuando llegó por encauzamiento. */
    @Column(name = "entidad_origen", length = 200)
    private String entidadOrigen;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_presentacion_admision")
    private PresentacionAdmisionTtaip presentacionAdmision;

    @Enumerated(EnumType.STRING)
    @Column(name = "clase_adjunto_admision", length = 10)
    private PresentacionAdmisionTtaip.Adjunto claseAdjuntoAdmision;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_cumplimiento")
    private CumplimientoResolucionTtaip cumplimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "clase_adjunto_cumplimiento", length = 24)
    private CumplimientoResolucionTtaip.Adjunto claseAdjuntoCumplimiento;

    @PrePersist
    protected void onCreate() {
        fechaCreacion = fechaCreacion != null ? fechaCreacion : LocalDateTime.now();
        fechaActualizacion = fechaCreacion;
        storageProvider = storageProvider != null ? storageProvider : StorageProviderType.LOCAL;
        estado = estado != null ? estado : EstadoDocumento.ACTIVO;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public enum TipoDocumento {
        SOLICITUD_ORIGINAL,
        RESPUESTA_ENTIDAD,
        RECURSO_APELACION,
        RESOLUCION_TTAIP,
        CEDULA_NOTIFICACION,
        CARGO_NOTIFICACION_TTAIP,
        ACUSE_NOTIFICACION_TTAIP,
        CARTA_NOTIFICACION_TTAIP,
        OFICIO_CARTA_TTAIP,
        EXPEDIENTE_ADMINISTRATIVO,
        INFORME,
        DOCUMENTO_ADJUNTO,
        SUBSANACION,
        OTRO
    }

    public enum EstadoDocumento {
        ACTIVO,
        ELIMINADO
    }

    public String getTamanioLegible() {
        if (sizeBytes == null) {
            return "N/D";
        }

        double size = sizeBytes.doubleValue();
        if (size < 1024) {
            return sizeBytes + " B";
        }

        size /= 1024.0;
        if (size < 1024) {
            return String.format(java.util.Locale.US, "%.1f KB", size);
        }

        size /= 1024.0;
        return String.format(java.util.Locale.US, "%.1f MB", size);
    }

    public Long getId() {
        return this.idDocumento;
    }
}
