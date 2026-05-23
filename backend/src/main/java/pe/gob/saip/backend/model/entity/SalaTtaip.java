package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "salas_ttaip", indexes = {
    @Index(name = "idx_sala_ttaip_nombre", columnList = "nombre", unique = true),
    @Index(name = "idx_sala_ttaip_activa", columnList = "activa")
})
public class SalaTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_sala_ttaip")
    private Long idSalaTtaip;

    @NotBlank(message = "El nombre de la sala no puede estar vacío")
    @Column(nullable = false, unique = true, length = 40)
    private String nombre;

    @Column(name = "periodo_inicio", nullable = false)
    private LocalDate periodoInicio;

    @Column(name = "periodo_fin", nullable = false)
    private LocalDate periodoFin;

    @ManyToOne
    @JoinColumn(name = "id_presidente_sala")
    private MiembroTTAIP presidenteSala;

    @Column(nullable = false)
    private Boolean activa = true;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "sala", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<ExpedienteTtaip> expedientes;

    public Long getId() {
        return this.idSalaTtaip;
    }
}
