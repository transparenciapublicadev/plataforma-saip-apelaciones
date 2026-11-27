package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.BorradorSaip;

import java.util.List;
import java.util.Optional;

public interface BorradorSaipRepository extends JpaRepository<BorradorSaip, Long> {
    List<BorradorSaip> findByCiudadano_IdUsuarioOrderByActualizadoDesc(Long idUsuario);
    Optional<BorradorSaip> findByIdBorradorAndCiudadano_IdUsuario(Long idBorrador, Long idUsuario);
    long countByCiudadano_IdUsuario(Long idUsuario);
}
