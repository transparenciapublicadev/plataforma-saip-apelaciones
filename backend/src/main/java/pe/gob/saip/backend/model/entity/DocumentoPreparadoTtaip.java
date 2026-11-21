package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "documentos_preparados_ttaip")
public class DocumentoPreparadoTtaip {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_expediente")
    private ExpedienteTtaip expediente;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Resolucion.TipoResolucion etapa;

    @Column(nullable = false, length = 64)
    private String clave;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Resolucion.DecisionResolucion decision;

    @Column(length = 120)
    private String numero;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_sala")
    private SalaTtaip sala;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_documento")
    private Documento documento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_resolucion")
    private Resolucion resolucion;
}
