package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ExpedienteTtaipRepository

class GetExpedienteTtaipUseCase(private val repository: ExpedienteTtaipRepository) {
    suspend operator fun invoke(numeroExpediente: String) = repository.obtenerPorNumero(numeroExpediente)
}

class GestionarExpedienteTtaipUseCase(private val repository: ExpedienteTtaipRepository) {
    suspend fun listarIntentosNotificacion(expedienteId: String, notificacionId: String) =
        repository.listarIntentosNotificacion(expedienteId, notificacionId)

    suspend fun admitirExcepcionalmente(apelacionId: String, responsable: String, observacion: String) {
        require(responsable.isNotBlank()) { "El responsable TTAIP es obligatorio" }
        require(observacion.isNotBlank()) { "El sustento de admisión excepcional es obligatorio" }
        repository.admitirExcepcionalmente(apelacionId, AdmitirElevacionExcepcional(responsable, observacion))
    }

    suspend fun requerirDescargo(expedienteId: String, responsable: String, observacion: String?) {
        require(responsable.isNotBlank()) { "El responsable TTAIP es obligatorio" }
        repository.requerirDescargo(expedienteId, RequerirDescargoTtaip(responsable, observacion))
    }

    suspend fun registrarSuspension(
        expedienteId: String,
        tipo: TipoSuspensionTtaip,
        solicitante: String,
        motivo: String,
        responsable: String
    ) {
        require(solicitante.isNotBlank()) { "El solicitante es obligatorio" }
        require(motivo.isNotBlank()) { "El motivo es obligatorio" }
        require(responsable.isNotBlank()) { "El responsable es obligatorio" }
        repository.registrarSuspension(
            expedienteId,
            tipo,
            RegistrarSuspensionTtaip(solicitante, motivo, responsable, null)
        )
    }

    suspend fun cancelarSuspension(expedienteId: String, suspensionId: String, responsable: String, observacion: String?) {
        require(responsable.isNotBlank()) { "El responsable es obligatorio" }
        repository.cancelarSuspension(expedienteId, suspensionId, CancelarSuspensionTtaip(responsable, observacion))
    }

    suspend fun enviarNotificacion(expedienteId: String, notificacionId: String, asunto: String, contenido: String, responsable: String?) {
        require(asunto.isNotBlank()) { "El asunto es obligatorio" }
        require(contenido.isNotBlank()) { "El contenido es obligatorio" }
        repository.enviarNotificacion(expedienteId, notificacionId, EnviarNotificacionTtaip(asunto, contenido, responsable))
    }

    suspend fun registrarConstancia(expedienteId: String, notificacionId: String, medio: String, constancia: String, responsable: String) {
        require(medio.isNotBlank()) { "El medio de notificación es obligatorio" }
        require(constancia.isNotBlank()) { "La constancia es obligatoria" }
        require(responsable.isNotBlank()) { "El responsable es obligatorio" }
        repository.registrarConstancia(expedienteId, notificacionId, RegistrarConstanciaTtaip(medio, constancia, responsable, null))
    }

    suspend fun registrarAcuse(expedienteId: String, notificacionId: String, estado: String, acuse: String, responsable: String?) {
        require(estado in setOf("ENTREGADO", "FALLIDO", "NO_RECIBIDO", "OBSERVADO")) { "El estado de acuse no es válido" }
        require(acuse.isNotBlank()) { "El acuse es obligatorio" }
        repository.registrarAcuse(expedienteId, notificacionId, RegistrarAcuseTtaip(estado, acuse, responsable, null))
    }

    suspend fun validarNotificacion(expedienteId: String, notificacionId: String, responsable: String, sustento: String) {
        require(responsable.isNotBlank()) { "El responsable es obligatorio" }
        require(sustento.isNotBlank()) { "El sustento es obligatorio" }
        repository.validarNotificacion(expedienteId, notificacionId, ValidarNotificacionTtaip(responsable, sustento, null))
    }

    suspend fun reprocesarNotificacion(numeroCedula: String, destinatario: String, observacion: String, responsable: String?) {
        require(numeroCedula.isNotBlank()) { "La cédula original es obligatoria" }
        require(destinatario in setOf("CIUDADANO", "ENTIDAD_PUBLICA")) { "El destinatario no es válido" }
        require(observacion.isNotBlank()) { "La observación es obligatoria" }
        repository.reprocesarNotificacion(ReprocesarNotificacionTtaip(numeroCedula, destinatario, observacion, responsable))
    }

    suspend fun crearSeguimiento(expedienteId: String, resolucionId: String, responsable: String?, observacion: String?) {
        repository.crearSeguimientoCumplimiento(expedienteId, resolucionId, CrearSeguimientoCumplimientoTtaip(responsable, observacion))
    }

    suspend fun observarCumplimiento(expedienteId: String, cumplimientoId: String, responsable: String?, observacion: String) {
        require(observacion.isNotBlank()) { "La observación es obligatoria" }
        repository.observarCumplimiento(expedienteId, cumplimientoId, ObservarCumplimientoTtaip(observacion, responsable))
    }

    suspend fun cerrarCumplimiento(expedienteId: String, cumplimientoId: String, responsable: String?, observacion: String?) {
        repository.cerrarCumplimiento(expedienteId, cumplimientoId, CerrarCumplimientoTtaip(responsable, observacion))
    }

    suspend fun resolver(apelacionId: String, decision: DecisionResolucionTtaip, fundamentos: String, fundamentoLegal: String?, observaciones: String?) {
        require(fundamentos.isNotBlank()) { "Los fundamentos son obligatorios" }
        repository.resolverApelacion(apelacionId, ResolverApelacionTtaip(decision, fundamentos, fundamentoLegal, observaciones))
    }
}
