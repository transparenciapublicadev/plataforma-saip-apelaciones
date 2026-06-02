package com.gestion.misaip.core.domain.model

/**
 * Trazabilidad operativa SAIP visible desde el detalle funcionario.
 *
 * Los actos administrativos se registran siempre contra el backend. La cache
 * local de bandejas sigue disponible offline, pero estas mutaciones requieren
 * conexión para no simular decisiones legales en el dispositivo.
 */
data class OperacionesSolicitudFuncionario(
    val observaciones: List<ObservacionSolicitud> = emptyList(),
    val ampliaciones: List<AmpliacionPlazoSolicitud> = emptyList(),
    val encauzamientos: List<EncauzamientoSolicitud> = emptyList(),
    val liquidaciones: List<LiquidacionCostoSolicitud> = emptyList()
)

data class ObservacionSolicitud(
    val id: Long,
    val solicitudId: Long,
    val expediente: String,
    val motivoObservacion: String,
    val fechaObservacion: String?,
    val fechaLimiteSubsanacion: String?,
    val fechaSubsanacion: String?,
    val comentarioSubsanacion: String?,
    val estado: String,
    val responsableObservacion: String?,
    val responsableSubsanacion: String?
)

data class AmpliacionPlazoSolicitud(
    val id: Long,
    val solicitudId: Long,
    val expediente: String,
    val motivoAmpliacion: String,
    val informeAmpliacion: String,
    val fechaNotificacionAmpliacion: String?,
    val fechaLimiteOriginal: String?,
    val fechaLimiteAmpliada: String?,
    val estadoAmpliacion: String,
    val responsable: String?,
    val cronograma: List<EntregaParcialProgramada>
)

data class EntregaParcialProgramada(
    val id: Long?,
    val numeroEntrega: Int,
    val descripcion: String,
    val fechaProgramada: String,
    val estado: String?,
    val fechaEntregaReal: String?,
    val observacion: String?
)

data class EncauzamientoSolicitud(
    val id: Long,
    val solicitudId: Long,
    val expediente: String,
    val entidadOrigenNombre: String?,
    val entidadDestinoId: Long,
    val entidadDestinoNombre: String?,
    val motivoEncauzamiento: String,
    val alcance: AlcanceEncauzamiento,
    val fechaEncauzamiento: String?,
    val fechaLimiteEncauzamiento: String?,
    val estadoEncauzamiento: String,
    val responsable: String?,
    val observacionSustento: String?
)

enum class AlcanceEncauzamiento {
    TOTAL,
    PARCIAL
}

data class LiquidacionCostoSolicitud(
    val id: Long,
    val solicitudId: Long,
    val expediente: String,
    val codigoLiquidacion: String?,
    val monto: String,
    val moneda: String,
    val concepto: String,
    val fechaNotificacion: String?,
    val fechaLimiteRecojo: String?,
    val estadoLiquidacion: String,
    val medioNotificacion: CanalNotificacion?,
    val responsable: String?,
    val observacion: String?
)

data class RegistrarObservacionSolicitud(
    val motivoObservacion: String,
    val responsable: String? = null
)

data class RegistrarAmpliacionPlazoSolicitud(
    val motivoAmpliacion: String,
    val informeAmpliacion: String,
    val fechaNotificacionAmpliacion: String,
    val responsable: String? = null,
    val cronograma: List<RegistrarEntregaParcial>
)

data class RegistrarEntregaParcial(
    val numeroEntrega: Int,
    val descripcion: String,
    val fechaProgramada: String,
    val observacion: String? = null
)

data class RegistrarEncauzamientoSolicitud(
    val entidadDestinoId: Long,
    val motivoEncauzamiento: String,
    val alcance: AlcanceEncauzamiento,
    val responsable: String? = null,
    val observacionSustento: String? = null
)

data class RegistrarLiquidacionCostoSolicitud(
    val codigoLiquidacion: String? = null,
    val monto: Double,
    val moneda: String = "PEN",
    val concepto: String,
    val fechaNotificacion: String,
    val medioNotificacion: CanalNotificacion,
    val responsable: String? = null,
    val observacion: String? = null
)
