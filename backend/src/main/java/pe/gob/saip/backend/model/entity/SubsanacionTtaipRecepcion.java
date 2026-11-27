package pe.gob.saip.backend.model.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Immutable acknowledgement of one concrete inadmissibility requirement, not of the entire appeal. */
@Getter @Setter @NoArgsConstructor @Entity
@Table(name = "recepciones_subsanacion_ttaip", uniqueConstraints = {
    @UniqueConstraint(name = "uk_subsanacion_ttaip_requerimiento", columnNames = "id_requerimiento"),
    @UniqueConstraint(name = "uk_subsanacion_ttaip_operacion", columnNames = "clave_operacion")
})
public class SubsanacionTtaipRecepcion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_recepcion") private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_requerimiento", nullable = false) private Resolucion requerimiento;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_creado_por", nullable = false) private Usuario creadoPor;
    @Column(name = "clave_operacion", nullable = false, length = 36) private String claveOperacion;
    @Column(name = "huella_solicitud", nullable = false, length = 64) private String huellaSolicitud;
    @Column(name = "fecha_recepcion", nullable = false) private LocalDateTime fechaRecepcion;
    @Column(nullable = false, columnDefinition = "TEXT") private String fundamentos;
    @ManyToMany
    @JoinTable(name = "recepcion_subsanacion_ttaip_documentos",
        joinColumns = @JoinColumn(name = "id_recepcion"),
        inverseJoinColumns = @JoinColumn(name = "id_documento"),
        uniqueConstraints = @UniqueConstraint(name = "uk_subsanacion_ttaip_documento", columnNames = "id_documento"))
    @OrderColumn(name = "posicion")
    private List<Documento> documentos = new ArrayList<>();
}
