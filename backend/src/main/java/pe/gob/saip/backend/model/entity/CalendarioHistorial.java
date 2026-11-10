package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "calendario_historial")
public class CalendarioHistorial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();

    @Column(length = 100)
    private String usuario;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String detalle;

    @Column(length = 255)
    private String norma;

    @PrePersist
    public void prePersist() {
        if (fecha == null) {
            fecha = LocalDateTime.now();
        }
    }
}
