package pe.gob.saip.backend.model.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    @Column(name = "copia_certificada", nullable = false, precision = 10, scale = 2)
    private BigDecimal copiaCertificada = new BigDecimal("0.50");

    @Column(name = "soporte_digital", nullable = false, precision = 10, scale = 2)
    private BigDecimal soporteDigital = new BigDecimal("1.00");

    // Calendario Oficial y Mapa Integral
    @Column(name = "semana_santa", nullable = false)
    private Boolean semanaSanta = true;

    @Column(name = "plazo_saip_observacion", nullable = false)
    private Integer plazoSaipObservacion = 2;

    @Column(name = "plazo_saip_prorroga_comunicacion", nullable = false)
    private Integer plazoSaipProrrogaComunicacion = 2;

    @Column(name = "plazo_saip_cronograma_umbral", nullable = false)
    private Integer plazoSaipCronogramaUmbral = 30;

    @Column(name = "plazo_saip_encauzamiento", nullable = false)
    private Integer plazoSaipEncauzamiento = 4;

    @Column(name = "plazo_saip_liquidacion_pago", nullable = false)
    private Integer plazoSaipLiquidacionPago = 30;

    @Column(name = "plazo_ttaip_elevacion", nullable = false)
    private Integer plazoTtaipElevacion = 2;

    @Column(name = "plazo_ttaip_descargos", nullable = false)
    private Integer plazoTtaipDescargos = 7;

    @Column(name = "plazo_ttaip_informe_oral", nullable = false)
    private Integer plazoTtaipInformeOral = 3;

    @Column(name = "plazo_ttaip_info_complementaria", nullable = false)
    private Integer plazoTtaipInfoComplementaria = 3;

    @Column(name = "plazo_ttaip_cumplimiento", nullable = false)
    private Integer plazoTtaipCumplimiento = 7;

    @Column(name = "calendario_actualizado_en")
    private LocalDateTime calendarioActualizadoEn;

    @Column(name = "calendario_actualizado_por", length = 100)
    private String calendarioActualizadoPor;
}
