package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.util.List;

@Repository
public interface ResolucionRepository extends JpaRepository<Resolucion, Long> {

    List<Resolucion> findByApelacion_Id(Long apelacionId);

    List<Resolucion> findByMiembroTTAIP_IdUsuario(Long miembroId);

    List<Resolucion> findByTipoResolucion(Resolucion.TipoResolucion tipo);

    List<Resolucion> findByNumeroResolucionContaining(String yearToken);

    long countByNumeroResolucionContaining(String yearToken);
}

