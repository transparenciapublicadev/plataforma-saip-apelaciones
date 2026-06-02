package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.AlcanceEncauzamiento
import com.gestion.misaip.core.domain.model.AmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.LiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.ObservacionSolicitud
import com.gestion.misaip.core.domain.model.OperacionesSolicitudFuncionario
import com.gestion.misaip.core.domain.model.RegistrarAmpliacionPlazoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarEncauzamientoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarEntregaParcial
import com.gestion.misaip.core.domain.model.RegistrarLiquidacionCostoSolicitud
import com.gestion.misaip.core.domain.model.RegistrarObservacionSolicitud
import com.gestion.misaip.core.domain.repository.SolicitudRepository

class GetOperacionesSolicitudFuncionarioUseCase(
    private val repository: SolicitudRepository
) {
    suspend operator fun invoke(solicitudId: String): OperacionesSolicitudFuncionario {
        require(solicitudId.toLongOrNull() != null) { "La SAIP aún no tiene un ID remoto válido" }
        return repository.getOperacionesFuncionario(solicitudId)
    }
}

class RegistrarObservacionSolicitudUseCase(
    private val repository: SolicitudRepository
) {
    suspend operator fun invoke(
        solicitudId: String,
        motivo: String,
        responsable: String?
    ): ObservacionSolicitud {
        require(solicitudId.toLongOrNull() != null) { "La SAIP aún no tiene un ID remoto válido" }
        require(motivo.isNotBlank()) { "El motivo de observación es obligatorio" }
        require(motivo.length <= 3_000) { "El motivo no puede exceder 3000 caracteres" }
        return repository.registrarObservacion(
            solicitudId,
            RegistrarObservacionSolicitud(motivo.trim(), responsable.normalizar())
        )
    }
}

class RegistrarAmpliacionPlazoSolicitudUseCase(
    private val repository: SolicitudRepository
) {
    suspend operator fun invoke(
        solicitudId: String,
        motivo: String,
        informe: String,
        fechaNotificacion: String,
        responsable: String?,
        entregaDescripcion: String,
        entregaFechaProgramada: String,
        entregaObservacion: String?
    ): AmpliacionPlazoSolicitud {
        require(solicitudId.toLongOrNull() != null) { "La SAIP aún no tiene un ID remoto válido" }
        require(motivo.isNotBlank()) { "El motivo de ampliación es obligatorio" }
        require(informe.isNotBlank()) { "El informe de ampliación es obligatorio" }
        require(fechaNotificacion.esFechaIso()) { "La fecha de notificación debe usar formato AAAA-MM-DD" }
        require(entregaDescripcion.isNotBlank()) { "La descripción de la entrega parcial es obligatoria" }
        require(entregaFechaProgramada.esFechaIso()) { "La fecha programada debe usar formato AAAA-MM-DD" }
        return repository.registrarAmpliacion(
            solicitudId,
            RegistrarAmpliacionPlazoSolicitud(
                motivoAmpliacion = motivo.trim(),
                informeAmpliacion = informe.trim(),
                fechaNotificacionAmpliacion = fechaNotificacion,
                responsable = responsable.normalizar(),
                cronograma = listOf(
                    RegistrarEntregaParcial(
                        numeroEntrega = 1,
                        descripcion = entregaDescripcion.trim(),
                        fechaProgramada = entregaFechaProgramada,
                        observacion = entregaObservacion.normalizar()
                    )
                )
            )
        )
    }
}

class RegistrarEncauzamientoSolicitudUseCase(
    private val repository: SolicitudRepository
) {
    suspend operator fun invoke(
        solicitudId: String,
        entidadDestinoId: String,
        motivo: String,
        alcance: AlcanceEncauzamiento,
        responsable: String?,
        sustento: String?
    ): EncauzamientoSolicitud {
        require(solicitudId.toLongOrNull() != null) { "La SAIP aún no tiene un ID remoto válido" }
        val destino = entidadDestinoId.toLongOrNull()
        require(destino != null) { "Debe seleccionar una entidad de destino" }
        require(motivo.isNotBlank()) { "El motivo de encauzamiento es obligatorio" }
        return repository.registrarEncauzamiento(
            solicitudId,
            RegistrarEncauzamientoSolicitud(
                entidadDestinoId = destino,
                motivoEncauzamiento = motivo.trim(),
                alcance = alcance,
                responsable = responsable.normalizar(),
                observacionSustento = sustento.normalizar()
            )
        )
    }
}

class EmitirLiquidacionCostoSolicitudUseCase(
    private val repository: SolicitudRepository
) {
    suspend operator fun invoke(
        solicitudId: String,
        codigo: String?,
        monto: String,
        concepto: String,
        fechaNotificacion: String,
        medioNotificacion: CanalNotificacion,
        responsable: String?,
        observacion: String?
    ): LiquidacionCostoSolicitud {
        require(solicitudId.toLongOrNull() != null) { "La SAIP aún no tiene un ID remoto válido" }
        val montoNumerico = monto.replace(',', '.').toDoubleOrNull()
        require(montoNumerico != null && montoNumerico >= 0) { "El monto debe ser un número no negativo" }
        require(concepto.isNotBlank()) { "El concepto de liquidación es obligatorio" }
        require(fechaNotificacion.esFechaIso()) { "La fecha de notificación debe usar formato AAAA-MM-DD" }
        return repository.emitirLiquidacion(
            solicitudId,
            RegistrarLiquidacionCostoSolicitud(
                codigoLiquidacion = codigo.normalizar(),
                monto = montoNumerico,
                concepto = concepto.trim(),
                fechaNotificacion = fechaNotificacion,
                medioNotificacion = medioNotificacion,
                responsable = responsable.normalizar(),
                observacion = observacion.normalizar()
            )
        )
    }
}

private fun String?.normalizar(): String? = this?.trim()?.takeIf(String::isNotEmpty)

private fun String.esFechaIso(): Boolean = matches(Regex("""\d{4}-\d{2}-\d{2}"""))
