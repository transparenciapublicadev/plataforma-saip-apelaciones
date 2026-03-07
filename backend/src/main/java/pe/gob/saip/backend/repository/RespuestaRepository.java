package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Respuesta;

import java.util.List;
import java.util.Optional;

@Repository
public interface RespuestaRepository extends JpaRepository<Respuesta, Long> {

    Optional<Respuesta> findBySolicitud_IdSolicitud(Long solicitudId);

    List<Respuesta> findByFuncionario_IdUsuario(Long funcionarioId);

    List<Respuesta> findByTipoRespuesta(Respuesta.TipoRespuesta tipo);
}

