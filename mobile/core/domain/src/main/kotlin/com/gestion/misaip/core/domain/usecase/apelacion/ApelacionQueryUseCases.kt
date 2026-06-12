package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

/**
 * Caso de Uso: Obtener Apelación por Expediente SAIP
 *
 * Busca una apelación relacionada con una solicitud SAIP específica.
 */
class GetApelacionPorSAIPUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    operator fun invoke(expedienteSAIP: String): Flow<Apelacion?> {
        require(expedienteSAIP.isNotBlank()) { "El expediente SAIP no puede estar vacío" }
        return apelacionRepository.getApelacionPorSAIP(expedienteSAIP)
    }
}

/**
 * Caso de Uso: Iniciar Calificación de Apelación
 *
 * El flujo vigente ya crea las apelaciones directas en EN_CALIFICACION_1.
 * Las apelaciones ante entidad avanzan únicamente mediante elevación formal o
 * admisión excepcional confirmada por backend.
 */
class IniciarCalificacionUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    suspend operator fun invoke(expediente: String) {
        require(expediente.isNotBlank()) { "El expediente no puede estar vacío" }

        val apelacion = apelacionRepository.getApelacionPorExpediente(expediente).first()
            ?: throw IllegalStateException("No se encontró la apelación $expediente")

        if (apelacion.estado == EstadoApelacion.EN_CALIFICACION_1) {
            return
        }

        throw IllegalStateException(
            "La apelación debe avanzar mediante elevación formal o admisión excepcional confirmada por el servidor"
        )
    }
}

class RefrescarApelacionDetalleUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    suspend operator fun invoke(expediente: String): Apelacion? {
        return apelacionRepository.refrescarDetalle(expediente)
    }
}
