package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.AlcanceEncauzamiento
import com.gestion.misaip.core.domain.model.AmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.EntregaParcialProgramada
import com.gestion.misaip.core.domain.model.LiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.ObservacionSolicitud
import com.gestion.misaip.core.domain.model.RegistrarAmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarEncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarLiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarObservacionSolicitud
import kotlinx.serialization.Serializable

@Serializable
data class ObservarSolicitudRestRequest(
    val motivoObservacion: String,
    val responsable: String? = null
)

@Serializable
data class RegistrarAmpliacionPlazoRestRequest(
    val motivoAmpliacion: String,
    val informeAmpliacion: String,
    val fechaNotificacionAmpliacion: String,
    val responsable: String? = null,
    val cronograma: List<RegistrarEntregaParcialRestRequest>
)

@Serializable
data class RegistrarEntregaParcialRestRequest(
    val numeroEntrega: Int,
    val descripcion: String,
    val fechaProgramada: String,
    val observacion: String? = null
)

@Serializable
data class RegistrarEncauzamientoSolicitudRestRequest(
    val entidadDestinoId: Long,
    val motivoEncauzamiento: String,
    val alcance: String,
    val responsable: String? = null,
    val observacionSustento: String? = null
)

@Serializable
data class RegistrarLiquidacionCostoRestRequest(
    val codigoLiquidacion: String? = null,
    val monto: Double,
    val moneda: String,
    val concepto: String,
    val fechaNotificacion: String,
    val medioNotificacion: String,
    val responsable: String? = null,
    val observacion: String? = null
)

@Serializable
data class ObservacionSolicitudRestDto(
    val id: Long? = null,
    val solicitudId: Long? = null,
    val expediente: String? = null,
    val motivoObservacion: String? = null,
    val fechaObservacion: String? = null,
    val fechaLimiteSubsanacion: String? = null,
    val fechaSubsanacion: String? = null,
    val comentarioSubsanacion: String? = null,
    val estado: String? = null,
    val responsableObservacion: String? = null,
    val responsableSubsanacion: String? = null
) {
    fun toDomain() = ObservacionSolicitud(
        id = id ?: 0,
        solicitudId = solicitudId ?: 0,
        expediente = expediente.orEmpty(),
        motivoObservacion = motivoObservacion.orEmpty(),
        fechaObservacion = fechaObservacion,
        fechaLimiteSubsanacion = fechaLimiteSubsanacion,
        fechaSubsanacion = fechaSubsanacion,
        comentarioSubsanacion = comentarioSubsanacion,
        estado = estado.orEmpty(),
        responsableObservacion = responsableObservacion,
        responsableSubsanacion = responsableSubsanacion
    )
}

@Serializable
data class AmpliacionPlazoSolicitudRestDto(
    val id: Long? = null,
    val solicitudId: Long? = null,
    val expediente: String? = null,
    val motivoAmpliacion: String? = null,
    val informeAmpliacion: String? = null,
    val fechaNotificacionAmpliacion: String? = null,
    val fechaLimiteOriginal: String? = null,
    val fechaLimiteAmpliada: String? = null,
    val estadoAmpliacion: String? = null,
    val responsable: String? = null,
    val cronograma: List<CronogramaEntregaParcialRestDto> = emptyList()
) {
    fun toDomain() = AmpliacionPlazoSolicitud(
        id = id ?: 0,
        solicitudId = solicitudId ?: 0,
        expediente = expediente.orEmpty(),
        motivoAmpliacion = motivoAmpliacion.orEmpty(),
        informeAmpliacion = informeAmpliacion.orEmpty(),
        fechaNotificacionAmpliacion = fechaNotificacionAmpliacion,
        fechaLimiteOriginal = fechaLimiteOriginal,
        fechaLimiteAmpliada = fechaLimiteAmpliada,
        estadoAmpliacion = estadoAmpliacion.orEmpty(),
        responsable = responsable,
        cronograma = cronograma.map(CronogramaEntregaParcialRestDto::toDomain)
    )
}

@Serializable
data class CronogramaEntregaParcialRestDto(
    val id: Long? = null,
    val numeroEntrega: Int? = null,
    val descripcion: String? = null,
    val fechaProgramada: String? = null,
    val estado: String? = null,
    val fechaEntregaReal: String? = null,
    val observacion: String? = null
) {
    fun toDomain() = EntregaParcialProgramada(
        id = id,
        numeroEntrega = numeroEntrega ?: 0,
        descripcion = descripcion.orEmpty(),
        fechaProgramada = fechaProgramada.orEmpty(),
        estado = estado,
        fechaEntregaReal = fechaEntregaReal,
        observacion = observacion
    )
}

@Serializable
data class EncauzamientoSolicitudRestDto(
    val id: Long? = null,
    val solicitudId: Long? = null,
    val expediente: String? = null,
    val entidadOrigenNombre: String? = null,
    val entidadDestinoId: Long? = null,
    val entidadDestinoNombre: String? = null,
    val motivoEncauzamiento: String? = null,
    val alcance: String? = null,
    val fechaEncauzamiento: String? = null,
    val fechaLimiteEncauzamiento: String? = null,
    val estadoEncauzamiento: String? = null,
    val responsable: String? = null,
    val observacionSustento: String? = null
) {
    fun toDomain() = EncauzamientoSolicitud(
        id = id ?: 0,
        solicitudId = solicitudId ?: 0,
        expediente = expediente.orEmpty(),
        entidadOrigenNombre = entidadOrigenNombre,
        entidadDestinoId = entidadDestinoId ?: 0,
        entidadDestinoNombre = entidadDestinoNombre,
        motivoEncauzamiento = motivoEncauzamiento.orEmpty(),
        alcance = runCatching { AlcanceEncauzamiento.valueOf(alcance.orEmpty()) }
            .getOrDefault(AlcanceEncauzamiento.PARCIAL),
        fechaEncauzamiento = fechaEncauzamiento,
        fechaLimiteEncauzamiento = fechaLimiteEncauzamiento,
        estadoEncauzamiento = estadoEncauzamiento.orEmpty(),
        responsable = responsable,
        observacionSustento = observacionSustento
    )
}

@Serializable
data class LiquidacionCostoSolicitudRestDto(
    val id: Long? = null,
    val solicitudId: Long? = null,
    val expediente: String? = null,
    val codigoLiquidacion: String? = null,
    val monto: String? = null,
    val moneda: String? = null,
    val concepto: String? = null,
    val fechaNotificacion: String? = null,
    val fechaLimiteRecojo: String? = null,
    val estadoLiquidacion: String? = null,
    val medioNotificacion: String? = null,
    val responsable: String? = null,
    val observacion: String? = null
) {
    fun toDomain() = LiquidacionCostoSolicitud(
        id = id ?: 0,
        solicitudId = solicitudId ?: 0,
        expediente = expediente.orEmpty(),
        codigoLiquidacion = codigoLiquidacion,
        monto = monto.orEmpty(),
        moneda = moneda.orEmpty(),
        concepto = concepto.orEmpty(),
        fechaNotificacion = fechaNotificacion,
        fechaLimiteRecojo = fechaLimiteRecojo,
        estadoLiquidacion = estadoLiquidacion.orEmpty(),
        medioNotificacion = CanalNotificacion.fromStringOrNull(medioNotificacion),
        responsable = responsable,
        observacion = observacion
    )
}

fun RegistrarObservacionSolicitud.toRest() = ObservarSolicitudRestRequest(
    motivoObservacion = motivoObservacion,
    responsable = responsable
)

fun RegistrarAmpliacionPlazoSolicitud.toRest() = RegistrarAmpliacionPlazoRestRequest(
    motivoAmpliacion = motivoAmpliacion,
    informeAmpliacion = informeAmpliacion,
    fechaNotificacionAmpliacion = fechaNotificacionAmpliacion,
    responsable = responsable,
    cronograma = cronograma.map {
        RegistrarEntregaParcialRestRequest(
            numeroEntrega = it.numeroEntrega,
            descripcion = it.descripcion,
            fechaProgramada = it.fechaProgramada,
            observacion = it.observacion
        )
    }
)

fun RegistrarEncauzamientoSolicitud.toRest() = RegistrarEncauzamientoSolicitudRestRequest(
    entidadDestinoId = entidadDestinoId,
    motivoEncauzamiento = motivoEncauzamiento,
    alcance = alcance.name,
    responsable = responsable,
    observacionSustento = observacionSustento
)

fun RegistrarLiquidacionCostoSolicitud.toRest() = RegistrarLiquidacionCostoRestRequest(
    codigoLiquidacion = codigoLiquidacion,
    monto = monto,
    moneda = moneda,
    concepto = concepto,
    fechaNotificacion = fechaNotificacion,
    medioNotificacion = medioNotificacion.name,
    responsable = responsable,
    observacion = observacion
)
