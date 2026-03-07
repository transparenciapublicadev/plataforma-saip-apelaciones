package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.database.Solicitud as SolicitudEntity
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString

/**
 * Mappers entre modelos de Dominio y Entidades de Base de Datos.
 *
 * Implementa la transformación bidireccional de datos siguiendo
 * el principio de Clean Architecture donde cada capa tiene sus propios modelos.
 */
object SolicitudMapper {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    /**
     * Convierte una entidad de BD a modelo de dominio.
     */
    fun toDomain(entity: SolicitudEntity): Solicitud {
        return Solicitud(
            id = entity.id,
            expediente = entity.expediente,
            tipo = TipoSolicitud.fromString(entity.tipo),
            entidad = entity.entidad,
            entidadId = entity.entidadId,
            usuarioId = entity.usuarioId,
            solicitante = Solicitante(
                nombre = entity.solicitanteNombre,
                dni = entity.solicitanteDni,
                email = entity.solicitanteEmail,
                telefono = entity.solicitanteTelefono,
                direccion = entity.solicitanteDireccion
            ),
            asunto = entity.asunto,
            descripcion = entity.descripcion,
            fechaCreacion = entity.fechaCreacion,
            fechaLimite = entity.fechaLimite,
            estado = EstadoSolicitud.fromString(entity.estado),
            diasRestantes = entity.diasRestantes?.toInt(),
            prioridad = Prioridad.fromString(entity.prioridad),
            respuestaEntidad = entity.respuestaFecha?.let { fecha ->
                RespuestaEntidad(
                    fechaRespuesta = fecha,
                    funcionario = entity.respuestaFuncionario ?: "",
                    tipo = TipoRespuesta.fromString(entity.respuestaTipo ?: ""),
                    fundamentacion = entity.respuestaFundamentacion ?: "",
                    archivos = parseJsonList(entity.respuestaArchivos)
                )
            },
            silencioAdministrativo = entity.silencioAdministrativo,
            timeline = parseTimeline(entity.timeline)
        )
    }

    /**
     * Convierte un modelo de dominio a entidad de BD.
     */
    fun toEntity(domain: Solicitud, pendienteSubida: Boolean = true): SolicitudEntity {
        return SolicitudEntity(
            id = domain.id,
            expediente = domain.expediente,
            tipo = domain.tipo.toDisplayString(),
            entidad = domain.entidad,
            entidadId = domain.entidadId,
            usuarioId = domain.usuarioId,
            solicitanteNombre = domain.solicitante.nombre,
            solicitanteDni = domain.solicitante.dni,
            solicitanteEmail = domain.solicitante.email,
            solicitanteTelefono = domain.solicitante.telefono,
            solicitanteDireccion = domain.solicitante.direccion,
            asunto = domain.asunto,
            descripcion = domain.descripcion,
            fechaCreacion = domain.fechaCreacion,
            fechaLimite = domain.fechaLimite,
            estado = domain.estado.toDisplayString(),
            diasRestantes = domain.diasRestantes?.toLong(),
            prioridad = domain.prioridad.name,
            silencioAdministrativo = domain.silencioAdministrativo,
            respuestaFecha = domain.respuestaEntidad?.fechaRespuesta,
            respuestaFuncionario = domain.respuestaEntidad?.funcionario,
            respuestaTipo = domain.respuestaEntidad?.tipo?.name,
            respuestaFundamentacion = domain.respuestaEntidad?.fundamentacion,
            respuestaArchivos = domain.respuestaEntidad?.archivos?.let { json.encodeToString(it) },
            timeline = json.encodeToString(domain.timeline.map { TimelineDto(it) }),
            sincronizado = false,
            pendienteSubida = pendienteSubida,
            ultimaModificacion = System.currentTimeMillis()
        )
    }

    private fun parseJsonList(jsonStr: String?): List<String> {
        if (jsonStr.isNullOrBlank()) return emptyList()
        return try {
            json.decodeFromString(jsonStr)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun parseTimeline(jsonStr: String): List<TimelineItem> {
        if (jsonStr.isBlank() || jsonStr == "[]") return emptyList()
        return try {
            val dtos: List<TimelineDto> = json.decodeFromString(jsonStr)
            dtos.map { it.toDomain() }
        } catch (e: Exception) {
            emptyList()
        }
    }
}

/**
 * DTO para serialización de TimelineItem.
 */
@kotlinx.serialization.Serializable
data class TimelineDto(
    val fecha: Long,
    val evento: String,
    val tipo: String,
    val completado: Boolean,
    val detalle: String? = null
) {
    constructor(domain: TimelineItem) : this(
        fecha = domain.fecha,
        evento = domain.evento,
        tipo = domain.tipo,
        completado = domain.completado,
        detalle = domain.detalle
    )

    fun toDomain() = TimelineItem(
        fecha = fecha,
        evento = evento,
        tipo = tipo,
        completado = completado,
        detalle = detalle
    )
}

