package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CalendarioHistorial;

import java.util.List;

@Repository
public interface CalendarioHistorialRepository extends JpaRepository<CalendarioHistorial, Long> {

    List<CalendarioHistorial> findAllByOrderByFechaDesc();
}
