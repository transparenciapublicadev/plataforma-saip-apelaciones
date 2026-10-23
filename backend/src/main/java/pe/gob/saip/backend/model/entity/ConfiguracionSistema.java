package pe.gob.saip.backend.model.entity;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "configuracion_sistema")
public class ConfiguracionSistema {

    @Id
    private Long id = 1L;

    // Plazos normativos (en días hábiles)
    @Column(name = "plazo_saip_respuesta", nullable = false)
    private Integer plazoSaipRespuesta = 10;

    @Column(name = "plazo_saip_prorroga", nullable = false)
    private Integer plazoSaipProrroga = 7;

    @Column(name = "plazo_subsanacion", nullable = false)
    private Integer plazoSubsanacion = 2;

    @Column(name = "plazo_recojo_informacion", nullable = false)
    private Integer plazoRecojoInformacion = 5;

    @Column(name = "plazo_apelacion_interposicion", nullable = false)
    private Integer plazoApelacionInterposicion = 15;

    @Column(name = "plazo_ttaip_resolucion", nullable = false)
    private Integer plazoTtaipResolucion = 10;

    @Column(name = "plazo_ttaip_calificacion", nullable = false)
    private Integer plazoTtaipCalificacion = 3;

    @Column(name = "plazo_ttaip_subsanacion", nullable = false)
    private Integer plazoTtaipSubsanacion = 2;

    // Reglas de notificación
    @Column(name = "notif_vencidas", nullable = false)
    private Boolean notifVencidas = true;

    @Column(name = "notif_proximos", nullable = false)
    private Boolean notifProximos = true;

    @Column(name = "notif_registros", nullable = false)
    private Boolean notifRegistros = false;

    @Column(name = "notif_umbral_proximo", nullable = false)
    private Integer notifUmbralProximo = 2;

    // Tarifas
    @Column(name = "costo_por_copia", nullable = false, precision = 10, scale = 2)
    private BigDecimal costoPorCopia = new BigDecimal("0.10");
}
