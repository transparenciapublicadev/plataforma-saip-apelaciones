package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "funcionarios")
@PrimaryKeyJoinColumn(name = "id_usuario")
public class Funcionario extends Usuario {

    @NotBlank(message = "El nombre completo no puede estar vacío")
    @Column(name = "nombre_completo", nullable = false, length = 200)
    private String nombreCompleto;

    @Column(length = 100)
    private String cargo;

    @Column(length = 100)
    private String area;

    @Column(length = 20)
    private String telefono;

    @ManyToOne
    @JoinColumn(name = "id_entidad", nullable = false)
    private Entidad entidad;

    @OneToMany(mappedBy = "funcionario", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Respuesta> respuestas;

    public Long getId() {
        return this.getIdUsuario();
    }
}
