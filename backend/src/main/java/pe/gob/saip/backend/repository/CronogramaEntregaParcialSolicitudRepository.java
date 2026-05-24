package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;

import java.util.List;

@Repository
public interface CronogramaEntregaParcialSolicitudRepository extends JpaRepository<CronogramaEntregaParcialSolicitud, Long> {

    List<CronogramaEntregaParcialSolicitud> findByAmpliacion_IdAmpliacionOrderByNumeroEntregaAsc(Long ampliacionId);

    List<CronogramaEntregaParcialSolicitud> findByAmpliacion_Solicitud_IdSolicitudOrderByNumeroEntregaAsc(Long solicitudId);
}
