package pe.gob.saip.backend.model.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity @Getter @Setter @NoArgsConstructor
@Table(name="recepciones_alta_apelacion")
public class AltaApelacionRecepcion {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) @Column(name="id_recepcion") private Long id;
    @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="id_apelacion",nullable=false,unique=true) private Apelacion apelacion;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="id_creado_por",nullable=false) private Usuario creadoPor;
    @Column(name="clave_operacion",nullable=false,length=36,unique=true) private String claveOperacion;
    @Column(name="huella_solicitud",nullable=false,length=90) private String huellaSolicitud;
    @Column(nullable=false,length=24) private String modalidad;
    @Column(name="fecha_recepcion",nullable=false) private LocalDateTime fechaRecepcion;
    @ElementCollection @CollectionTable(name="recepcion_alta_apelacion_documentos",joinColumns=@JoinColumn(name="id_recepcion"))
    @OrderColumn(name="orden") private List<Archivo> documentos=new ArrayList<>();

    @Embeddable @Getter @NoArgsConstructor
    public static class Archivo {
        @Column(name="id_documento",nullable=false,unique=true) private Long documentoId;
        @Column(name="id_documento_origen") private Long origenId;
        @Column(name="hash_aceptado",nullable=false,length=64) private String hash;
        public Archivo(Long documentoId,Long origenId,String hash) {this.documentoId=documentoId;this.origenId=origenId;this.hash=hash;}
    }
}
