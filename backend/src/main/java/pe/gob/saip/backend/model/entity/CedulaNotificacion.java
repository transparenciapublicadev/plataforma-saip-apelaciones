package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cedulas_notificacion", indexes = {
    @Index(name = "idx_cedula_resolucion", columnList = "id_resolucion"),
    @Index(name = "idx_cedula_numero_destinatario", columnList = "numero_cedula,destinatario", unique = true)
})
public class CedulaNotificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cedula")
    private Long idCedula;

    @NotNull(message = "La resolución asociada es obligatoria")
    @ManyToOne
    @JoinColumn(name = "id_resolucion", nullable = false)
    private Resolucion resolucion;

    @NotBlank(message = "El número de cédula es obligatorio")
    @Column(name = "numero_cedula", nullable = false, length = 50)
    private String numeroCedula;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DestinatarioNotificacion destinatario;

    @Column(name = "destinatario_nombre", length = 200)
    private String destinatarioNombre;

    @Column(name = "destinatario_email", length = 150)
    private String destinatarioEmail;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDateTime fechaEmision;

    @Column(length = 40)
    private String canal;

    @Column(length = 40)
    private String estado;

    @Column(name = "documento_referencia", length = 500)
    private String documentoReferencia;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "cedulaNotificacion", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Documento> documentos;

    @PrePersist
    protected void onCreate() {
        fechaEmision = fechaEmision != null ? fechaEmision : LocalDateTime.now();
        canal = canal != null ? canal : "CASILLA_ELECTRONICA";
        estado = estado != null ? estado : "EMITIDA";
    }

    public Long getId() {
        return this.idCedula;
    }

    public enum DestinatarioNotificacion {
        CIUDADANO,
        ENTIDAD_PUBLICA
    }
}
