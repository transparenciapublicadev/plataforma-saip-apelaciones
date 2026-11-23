package pe.gob.saip.backend.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Texto de una SAIP que el administrado aún no presenta. No es un expediente. */
@Entity
@Table(name = "borradores_saip")
@Getter
@Setter
@NoArgsConstructor
public class BorradorSaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_borrador")
    private Long idBorrador;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_ciudadano", nullable = false)
    private Ciudadano ciudadano;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_entidad")
    private Entidad entidad;

    @Column(length = 500)
    private String asunto;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "tipo_informacion", length = 100)
    private String tipoInformacion;

    @Column(name = "oficina_destinataria", length = 160)
    private String oficinaDestinataria;

    @Column(name = "formato_correo", nullable = false)
    private boolean formatoCorreo;

    @Column(name = "copia_simple", nullable = false)
    private boolean copiaSimple;

    @Column(name = "copia_certificada", nullable = false)
    private boolean copiaCertificada;

    @Column(name = "soporte_magnetico", nullable = false)
    private boolean soporteMagnetico;

    @Column(name = "canal_notificacion", length = 20)
    private String canalNotificacion;

    @Column(name = "acepta_canal", nullable = false)
    private boolean aceptaCanal;

    @Column(name = "consentimiento_datos", nullable = false)
    private boolean consentimientoDatos;

    @Column(name = "declara_veracidad", nullable = false)
    private boolean declaraVeracidad;

    @Column(nullable = false)
    private short paso = 1;

    @Column(nullable = false)
    private LocalDateTime creado;

    @Column(nullable = false)
    private LocalDateTime actualizado;
}
