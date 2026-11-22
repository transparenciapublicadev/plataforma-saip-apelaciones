package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "presentaciones_admision_ttaip")
public class PresentacionAdmisionTtaip {
    public enum Tipo { DESCARGOS, INFORME_ORAL, DOCUMENTACION_ADICIONAL }
    public enum Adjunto { PRINCIPAL, ANEXO, RESPUESTA }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_expediente_ttaip", nullable = false)
    private ExpedienteTtaip expediente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_descargo", unique = true)
    private DescargoEntidadTtaip descargo;

    @Column(nullable = false)
    private UUID operacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Tipo tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CedulaNotificacion.DestinatarioNotificacion origen;

    @Column(columnDefinition = "TEXT")
    private String texto;

    @Column(name = "numero_oficio", length = 120)
    private String numeroOficio;

    @Column(name = "fecha_presentacion", nullable = false)
    private LocalDateTime fechaPresentacion;

    private Boolean aceptada;

    @Column(name = "fecha_respuesta")
    private LocalDateTime fechaRespuesta;

    @Column(name = "operacion_respuesta")
    private UUID operacionRespuesta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario_respuesta")
    private Usuario usuarioRespuesta;

    public boolean visiblePara(CedulaNotificacion.DestinatarioNotificacion parte, boolean respuesta) {
        return origen == parte || (respuesta && Boolean.TRUE.equals(aceptada));
    }
}
