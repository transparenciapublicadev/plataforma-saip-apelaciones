package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private String nombreArchivo;

    @Column(name = "ruta_archivo", nullable = false, length = 500)
    private String rutaArchivo;

    @Column(name = "tipo_archivo", length = 50)
    private String tipoArchivo;

    @Column(name = "tamanio")
    private Long tamanio;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_documento", length = 30)
    private TipoDocumento tipoDocumento;

    @Column(name = "fecha_subida", nullable = false)
    private LocalDateTime fechaSubida;

    @ManyToOne
    @JoinColumn(name = "id_solicitud")
    private Solicitud solicitud;

    @ManyToOne
    @JoinColumn(name = "id_respuesta")
    private Respuesta respuesta;

    @ManyToOne
    @JoinColumn(name = "id_apelacion")
    private Apelacion apelacion;

    @ManyToOne
    @JoinColumn(name = "id_resolucion")
    private Resolucion resolucion;

    @PrePersist
    protected void onCreate() {
        fechaSubida = LocalDateTime.now();
    }

    public enum TipoDocumento {
        SOLICITUD_ORIGINAL,
        RESPUESTA_ENTIDAD,
        RECURSO_APELACION,
        RESOLUCION_TTAIP,
        DOCUMENTO_ADJUNTO,
        SUBSANACION
    }

    public String getTamanioLegible() {
        if (tamanio == null) {
            return "N/D";
        }

        double size = tamanio.doubleValue();
        if (size < 1024) {
            return tamanio + " B";
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
