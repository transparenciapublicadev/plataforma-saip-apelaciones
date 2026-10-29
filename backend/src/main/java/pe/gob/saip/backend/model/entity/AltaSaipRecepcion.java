package pe.gob.saip.backend.model.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

/** Durable original actor, operation identity and exact accepted document manifest. */
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="recepciones_alta_saip", uniqueConstraints={
    @UniqueConstraint(name="uk_recepcion_alta_solicitud",columnNames="id_solicitud"),
    @UniqueConstraint(name="uk_recepcion_alta_clave",columnNames="clave_operacion")
})
public class AltaSaipRecepcion {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) @Column(name="id_recepcion") private Long id;
    @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="id_solicitud",nullable=false) private Solicitud solicitud;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="id_creado_por",nullable=false) private Usuario creadoPor;
    @Column(name="clave_operacion",nullable=false,length=36) private String claveOperacion;
    @Column(name="huella_solicitud",nullable=false,length=80) private String huellaSolicitud;
    @Column(name="fecha_recepcion",nullable=false) private LocalDateTime fechaRecepcion;
    @Column(name="declara_veracidad",nullable=false) private Boolean declaraVeracidad;
    @ElementCollection
    @CollectionTable(name="recepcion_alta_saip_documentos",joinColumns=@JoinColumn(name="id_recepcion"))
    @Column(name="id_documento",nullable=false) @OrderColumn(name="orden")
    private List<Long> documentoIds=new ArrayList<>();
}
