package pe.gob.saip.backend.model.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Durable operation identity and immutable-in-the-API manifest for a SAIP response. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "recepciones_respuesta_saip", uniqueConstraints = {
        @UniqueConstraint(name = "uk_recepcion_respuesta_solicitud", columnNames = "id_solicitud"),
        @UniqueConstraint(name = "uk_recepcion_respuesta", columnNames = "id_respuesta"),
        @UniqueConstraint(name = "uk_recepcion_respuesta_actor_clave", columnNames = {"id_creado_por", "clave_operacion"})
})
public class RespuestaSaipRecepcion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_recepcion")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_solicitud", nullable = false)
    private Solicitud solicitud;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_respuesta", nullable = false)
    private Respuesta respuesta;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_creado_por", nullable = false)
    private Usuario creadoPor;

    @Column(name = "clave_operacion", nullable = false, length = 36)
    private String claveOperacion;

    @Column(name = "huella_solicitud", nullable = false, length = 64)
    private String huellaSolicitud;

    @Column(name = "fecha_recepcion", nullable = false)
    private LocalDateTime fechaRecepcion;

    @ElementCollection
    @CollectionTable(name = "recepcion_respuesta_saip_documentos", joinColumns = @JoinColumn(name = "id_recepcion"))
    @Column(name = "id_documento", nullable = false)
    @OrderColumn(name = "orden")
    private List<Long> documentoIds = new ArrayList<>();
}
