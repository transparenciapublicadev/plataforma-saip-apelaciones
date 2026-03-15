package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.SolicitudRepository

/**
 * Caso de Uso: Crear Solicitud SAIP
 *
 * Crea una nueva solicitud de acceso a información pública.
 * La solicitud se guarda localmente y se programa para sincronización.
 *
 * @param solicitudRepository Repositorio de solicitudes (inyectado por Koin)
 */
class CrearSolicitudUseCase(
    private val solicitudRepository: SolicitudRepository
) {

    /**
     * Parámetros para crear una nueva solicitud.
     */
    data class Params(
        val tipo: TipoSolicitud,
        val entidad: String,
        val entidadId: String,
        val usuarioId: String,
        val solicitante: Solicitante,
        val asunto: String,
        val descripcion: String
    )

    /**
     * Ejecuta el caso de uso.
     *
     * @param params Parámetros de la nueva solicitud
     * @return La solicitud creada con su expediente asignado
     * @throws IllegalArgumentException si los parámetros son inválidos
     */
    suspend operator fun invoke(params: Params): Solicitud {
        // Validaciones de negocio
        require(params.asunto.isNotBlank()) { "El asunto es obligatorio" }
        require(params.descripcion.isNotBlank()) { "La descripción es obligatoria" }
        require(params.entidadId.isNotBlank()) { "Debe seleccionar una entidad" }
        require(params.descripcion.length <= 2000) { "La descripción no puede exceder 2000 caracteres" }

        val fechaActual = System.currentTimeMillis()
        // El cálculo de fecha límite (10 días hábiles) se hace en el repositorio

        val solicitud = Solicitud(
            id = "", // Se generará en el repositorio
            expediente = "", // Se generará en el repositorio
            tipo = params.tipo,
            entidad = params.entidad,
            entidadId = params.entidadId,
            usuarioId = params.usuarioId,
            solicitante = params.solicitante,
            asunto = params.asunto,
            descripcion = params.descripcion,
            fechaCreacion = fechaActual,
            fechaLimite = 0, // Se calculará en el repositorio
            estado = EstadoSolicitud.RECEPCIONADA,
            prioridad = Prioridad.MEDIA,
            timeline = listOf(
                TimelineItem(
                    fecha = fechaActual,
                    evento = "Solicitud recepcionada",
                    tipo = "recepcion",
                    completado = true
                )
            )
        )

        return solicitudRepository.crearSolicitud(solicitud)
    }
}

/**
 * Caso de Uso: Responder Solicitud (Funcionario)
 *
 * Permite a un funcionario de entidad responder una solicitud SAIP.
 *
 * @param solicitudRepository Repositorio de solicitudes (inyectado por Koin)
 */
class ResponderSolicitudUseCase(
    private val solicitudRepository: SolicitudRepository
) {

    /**
     * Parámetros para responder una solicitud.
     */
    data class Params(
        val expediente: String,
        val funcionario: String,
        val tipoRespuesta: TipoRespuesta,
        val fundamentacion: String,
        val archivos: List<String> = emptyList()
    )

    /**
     * Ejecuta el caso de uso.
     *
     * @param params Parámetros de la respuesta
     * @throws IllegalArgumentException si los parámetros son inválidos
     */
    suspend operator fun invoke(params: Params) {
        require(params.expediente.isNotBlank()) { "El expediente es obligatorio" }
        require(params.fundamentacion.isNotBlank()) { "La fundamentación es obligatoria" }
        require(params.tipoRespuesta != TipoRespuesta.SILENCIO_ADMINISTRATIVO) {
            "Silencio administrativo se aplica automáticamente y no debe registrarse manualmente"
        }

        val respuesta = RespuestaEntidad(
            fechaRespuesta = System.currentTimeMillis(),
            funcionario = params.funcionario,
            tipo = params.tipoRespuesta,
            fundamentacion = params.fundamentacion,
            archivos = params.archivos
        )

        solicitudRepository.responderSolicitud(params.expediente, respuesta)
    }
}

