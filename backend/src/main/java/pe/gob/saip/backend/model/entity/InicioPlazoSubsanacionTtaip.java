package pe.gob.saip.backend.model.entity;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

/** First evidenced efficacy for a concrete requirement and its citizen; never reset by a retry. */
@Entity @Getter @Setter @NoArgsConstructor @Immutable
@Table(name = "inicios_plazo_subsanacion_ttaip")
public class InicioPlazoSubsanacionTtaip {
    @Id @Column(name="id_requerimiento") private Long id;
    @MapsId @OneToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="id_requerimiento") private Resolucion requerimiento;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="id_notificacion", nullable=false) private NotificacionTtaip notificacion;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="id_ciudadano", nullable=false) private Usuario ciudadano;
    @Column(name="fecha_eficacia", nullable=false) private LocalDateTime fechaEficacia;
    @Column(name="dias_habiles", nullable=false) private int diasHabiles;
    @Column(nullable=false, length=40) private String fuente;
    @Column(nullable=false, columnDefinition="TEXT") private String sustento;
    @Column(name="fecha_registro", nullable=false) private LocalDateTime fechaRegistro;
}
