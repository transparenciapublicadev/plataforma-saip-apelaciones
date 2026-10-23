package pe.gob.saip.backend.model.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Durable receipt binding one observation to the exact uploaded precision. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "recepciones_precision_saip", uniqueConstraints = {
        @UniqueConstraint(name = "uk_precision_observacion", columnNames = "id_observacion"),
        @UniqueConstraint(name = "uk_precision_operacion", columnNames = "clave_operacion"),
        @UniqueConstraint(name = "uk_precision_documento", columnNames = "id_documento")
})
public class PrecisionSaipRecepcion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_recepcion")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_observacion", nullable = false)
    private ObservacionSolicitud observacion;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_documento", nullable = false)
    private Documento documento;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_creado_por", nullable = false)
    private Usuario creadoPor;

    @Column(name = "clave_operacion", nullable = false, length = 36)
    private String claveOperacion;

    @Column(name = "huella_solicitud", nullable = false, length = 64)
    private String huellaSolicitud;

    @Column(name = "fecha_recepcion", nullable = false)
    private LocalDateTime fechaRecepcion;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String comentario;
}
