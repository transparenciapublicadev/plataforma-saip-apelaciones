package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.ApelacionRepository
import com.gestion.misaip.core.domain.repository.SolicitudRepository
import com.gestion.misaip.core.domain.util.DiasHabilesUtil
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

/**
 * Caso de Uso: Obtener Apelaciones del Usuario
 */
class GetApelacionesUsuarioUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    operator fun invoke(usuarioId: String): Flow<List<Apelacion>> {
        return apelacionRepository.getApelacionesUsuario(usuarioId)
    }
}

/**
 * Caso de Uso: Obtener Todas las Apelaciones (TTAIP)
 */
class GetTodasLasApelacionesUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    operator fun invoke(): Flow<List<Apelacion>> {
        return apelacionRepository.getTodasLasApelaciones()
    }
}

/**
 * Caso de Uso: Obtener Apelación por Expediente
 */
class GetApelacionPorExpedienteUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    operator fun invoke(expediente: String): Flow<Apelacion?> {
        return apelacionRepository.getApelacionPorExpediente(expediente)
    }
}

/**
 * Caso de Uso: Crear Apelación
 *
 * Crea una nueva apelación ante el TTAIP.
 * Valida que la solicitud SAIP exista y pueda ser apelada.
 */
class CrearApelacionUseCase(
    private val apelacionRepository: ApelacionRepository,
    private val solicitudRepository: SolicitudRepository
) {

    data class Params(
        val expedienteSAIP: String,
        val usuarioId: String,
        val apelante: Apelante,
        val fundamentoLegal: String,
        val exposicionHechos: String,
        val pretension: String
    )

    sealed class Result {
        data class Success(val apelacion: Apelacion) : Result()
        data class Error(val mensaje: String) : Result()
    }

    suspend operator fun invoke(params: Params): Result {
        // Validaciones
        if (params.fundamentoLegal.isBlank()) {
            return Result.Error("El fundamento legal es obligatorio")
        }
        if (params.exposicionHechos.isBlank()) {
            return Result.Error("La exposición de hechos es obligatoria")
        }
        if (params.pretension.isBlank()) {
            return Result.Error("La pretensión es obligatoria")
        }

        // Verificar que la solicitud SAIP existe
        val solicitud = solicitudRepository.getSolicitudPorExpediente(params.expedienteSAIP).first()
            ?: return Result.Error("No se encontró la solicitud SAIP ${params.expedienteSAIP}")

        // Verificar que puede ser apelada
        if (!solicitud.puedeSerApelada) {
            return Result.Error("Esta solicitud no puede ser apelada. Solo se pueden apelar solicitudes denegadas o vencidas.")
        }

        // Verificar que pertenece al usuario
        if (solicitud.usuarioId != params.usuarioId) {
            return Result.Error("Solo puede apelar sus propias solicitudes")
        }

        // Verificar que no tenga ya una apelación
        val apelacionExistente = apelacionRepository.getApelacionPorSAIP(params.expedienteSAIP).first()
        if (apelacionExistente != null) {
            return Result.Error("Ya existe una apelación para esta solicitud: ${apelacionExistente.expediente}")
        }

        val fechaActual = System.currentTimeMillis()

        val apelacion = Apelacion(
            id = "",
            expediente = "",
            expedienteSAIP = params.expedienteSAIP,
            usuarioId = params.usuarioId,
            apelante = params.apelante,
            entidad = solicitud.entidad,
            entidadId = solicitud.entidadId,
            asunto = "Apelación: ${solicitud.asunto}",
            fundamentoLegal = params.fundamentoLegal,
            exposicionHechos = params.exposicionHechos,
            pretension = params.pretension,
            fechaPresentacion = fechaActual,
            estado = EstadoApelacion.PENDIENTE_ELEVACION,
            timeline = listOf(
                TimelineItem(
                    fecha = fechaActual,
                    evento = "Apelación presentada",
                    tipo = "recepcion",
                    completado = true
                )
            ),
            diasRestantes = 7
        )

        return try {
            val apelacionCreada = apelacionRepository.crearApelacion(apelacion)
            Result.Success(apelacionCreada)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error al crear la apelación")
        }
    }
}

/**
 * Caso de Uso: Calificar Apelación (TTAIP)
 *
 * Permite a un funcionario TTAIP emitir calificación de una apelación.
 */
class CalificarApelacionUseCase(
    private val apelacionRepository: ApelacionRepository
) {

    data class Params(
        val expediente: String,
        val tipoCalificacion: String, // "primera" o "segunda"
        val resultado: ResultadoCalificacion,
        val fundamentacion: String,
        val resolucion: String? = null,
        val subsanacionRequerida: Boolean = false,
        val plazoSubsanacion: String? = null,
        val observacionesSubsanacion: String? = null,
        val ordenEntrega: Boolean = false,
        val plazoEntrega: String? = null
    )

    sealed class Result {
        data class Success(val apelacion: Apelacion) : Result()
        data class Error(val mensaje: String) : Result()
    }

    suspend operator fun invoke(params: Params): Result {
        if (params.fundamentacion.isBlank()) {
            return Result.Error("La fundamentación es obligatoria")
        }

        val fechaActual = System.currentTimeMillis()

        // Generar cédulas de notificación automáticamente
        val cedulaCiudadano = CedulaNotificacion(
            fechaNotificacion = fechaActual,
            contenido = generarContenidoCedulaCiudadano(params),
            destinatario = DestinatarioCedula.CIUDADANO,
            estado = EstadoCedula.PENDIENTE
        )

        val cedulaEntidad = if (params.ordenEntrega) {
            CedulaNotificacion(
                fechaNotificacion = fechaActual,
                contenido = generarContenidoCedulaEntidad(params),
                destinatario = DestinatarioCedula.ENTIDAD,
                estado = EstadoCedula.PENDIENTE
            )
        } else null

        val calificacion = Calificacion(
            fecha = fechaActual,
            resultado = params.resultado,
            fundamentacion = params.fundamentacion,
            resolucion = params.resolucion,
            // INADMISIBLE implica subsanación requerida automáticamente (BR-TTAIP-002)
            subsanacionRequerida = params.subsanacionRequerida || params.resultado == ResultadoCalificacion.INADMISIBLE,
            plazoSubsanacion = params.plazoSubsanacion,
            observacionesSubsanacion = params.observacionesSubsanacion,
            plazoEntrega = params.plazoEntrega,
            ordenEntrega = params.ordenEntrega,
            cedulaNotificacionCiudadano = cedulaCiudadano,
            cedulaNotificacionEntidad = cedulaEntidad
        )

        return try {
            apelacionRepository.calificarApelacion(params.expediente, params.tipoCalificacion, calificacion)
            val apelacionActualizada = apelacionRepository.getApelacionPorExpediente(params.expediente).first()
            if (apelacionActualizada != null) {
                Result.Success(apelacionActualizada)
            } else {
                Result.Error("No se pudo obtener la apelación actualizada")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error al calificar la apelación")
        }
    }

    private fun generarContenidoCedulaCiudadano(params: Params): String {
        return when (params.resultado) {
            ResultadoCalificacion.ADMISIBLE ->
                "Se le notifica que su apelación ha sido declarada ADMISIBLE. Se procede a solicitar descargos a la entidad."
            ResultadoCalificacion.ADMITIDO ->
                "Se le notifica que su apelación ha sido ADMITIDA. Se procederá con la resolución del recurso."
            ResultadoCalificacion.INADMISIBLE ->
                "Se le notifica que su apelación ha sido declarada INADMISIBLE. ${params.fundamentacion}"
            ResultadoCalificacion.IMPROCEDENTE ->
                "Se le notifica que su apelación ha sido declarada IMPROCEDENTE. ${params.fundamentacion}"
        }
    }

    private fun generarContenidoCedulaEntidad(params: Params): String {
        return "Se le ordena entregar la información solicitada en un plazo máximo de ${params.plazoEntrega ?: "5 días hábiles"} bajo apercibimiento de sanción."
    }
}

/**
 * Caso de Uso: Presentar Subsanación
 */
class PresentarSubsanacionUseCase(
    private val apelacionRepository: ApelacionRepository
) {

    data class Params(
        val expediente: String,
        val textoCorregido: String,
        val fundamentoLegalCorregido: String? = null,
        val documentos: List<String> = emptyList()
    )

    sealed class Result {
        data class Success(val apelacion: Apelacion) : Result()
        data class Error(val mensaje: String) : Result()
    }

    suspend operator fun invoke(params: Params): Result {
        if (params.textoCorregido.isBlank()) {
            return Result.Error("El texto corregido es obligatorio")
        }

        val subsanacion = Subsanacion(
            fecha = System.currentTimeMillis(),
            textoCorregido = params.textoCorregido,
            fundamentoLegalCorregido = params.fundamentoLegalCorregido,
            documentosAdjuntos = params.documentos
        )

        return try {
            apelacionRepository.presentarSubsanacion(params.expediente, subsanacion)
            val apelacionActualizada = apelacionRepository.getApelacionPorExpediente(params.expediente).first()
            if (apelacionActualizada != null) {
                Result.Success(apelacionActualizada)
            } else {
                Result.Error("No se pudo obtener la apelación actualizada")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error al presentar la subsanación")
        }
    }
}

