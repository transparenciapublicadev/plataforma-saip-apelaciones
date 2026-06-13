package com.gestion.misaip.core.domain.model

/**
 * Entidad de Dominio: Solicitud SAIP
 *
 * Representa una solicitud de acceso a información pública.
 * Basado en la Ley N° 27806 - Ley de Transparencia y Acceso a la Información Pública.
 *
 * Kotlin Puro - Sin dependencias de Android ni Firebase.
 */
data class Solicitud(
    val id: String,
    val expediente: String,
    val tipo: TipoSolicitud,
    val entidad: String,
    val entidadId: String,
    val usuarioId: String,
    val solicitante: Solicitante,
    val asunto: String,
    val descripcion: String,
    val consentimientoDatosPersonales: Boolean = false,
    val canalNotificacion: CanalNotificacion? = null,
    val fechaCreacion: Long,
    val fechaLimite: Long,
    val estado: EstadoSolicitud,
    val diasRestantes: Int? = null,
    val prioridad: Prioridad = Prioridad.MEDIA,
    val respuestaEntidad: RespuestaEntidad? = null,
    val silencioAdministrativo: Boolean = false,
    val timeline: List<TimelineItem> = emptyList(),
    val documentos: List<Documento> = emptyList()
) {

    /**
     * Verifica si la solicitud está pendiente de respuesta.
     * Incluye PENDIENTE_INFORMACION porque desde la perspectiva del ciudadano
     * la solicitud aún no tiene respuesta definitiva.
     */
    val estaPendiente: Boolean
        get() = estado in listOf(
            EstadoSolicitud.RECEPCIONADA,
            EstadoSolicitud.EN_REVISION,
            EstadoSolicitud.PENDIENTE_INFORMACION
        )

    /**
     * Verifica si la solicitud fue denegada.
     */
    val fueDenegada: Boolean
        get() = estado == EstadoSolicitud.DENEGADA

    /**
     * Verifica si la solicitud está vencida.
     */
    val estaVencida: Boolean
        get() = estado == EstadoSolicitud.VENCIDA

    /**
     * Verifica si la solicitud puede ser apelada.
     * Según Ley N° 27806 y BR-SAIP-006:
     * Aplica para cualquier tipo de respuesta (entrega total, parcial, denegación)
     * y también por silencio administrativo (vencida).
     * Plazo: 15 días calendario desde la recepción de la respuesta.
     */
    val puedeSerApelada: Boolean
        get() = fueDenegada || estaVencida || fueRespondida

    /**
     * Verifica si la solicitud fue respondida satisfactoriamente.
     */
    val fueRespondida: Boolean
        get() = estado == EstadoSolicitud.RESPONDIDA
}

/**
 * Canal formal elegido por el ciudadano para recibir notificaciones SAIP.
 */
enum class CanalNotificacion {
    CORREO_ELECTRONICO,
    CASILLA_ELECTRONICA,
    PLATAFORMA,
    FISICA;

    fun toDisplayString(): String = when (this) {
        CORREO_ELECTRONICO -> "Correo electrónico"
        CASILLA_ELECTRONICA -> "Casilla electrónica"
        PLATAFORMA -> "Plataforma"
        FISICA -> "Entrega física"
    }

    companion object {
        fun fromStringOrNull(value: String?): CanalNotificacion? {
            return entries.firstOrNull { it.name == value?.trim()?.uppercase() }
        }
    }
}

/**
 * Tipos de solicitud SAIP.
 */
enum class TipoSolicitud {
    ACCESO_INFORMACION,
    INFORMACION_ESPECIFICA,
    COPIA_DOCUMENTOS;

    companion object {
        fun fromString(value: String): TipoSolicitud {
            return when (value.lowercase()) {
                "acceso a información", "acceso_informacion" -> ACCESO_INFORMACION
                "información específica", "informacion_especifica" -> INFORMACION_ESPECIFICA
                "copia de documentos", "copia_documentos" -> COPIA_DOCUMENTOS
                else -> ACCESO_INFORMACION
            }
        }
    }

    fun toDisplayString(): String = when (this) {
        ACCESO_INFORMACION -> "Acceso a Información"
        INFORMACION_ESPECIFICA -> "Información Específica"
        COPIA_DOCUMENTOS -> "Copia de Documentos"
    }
}

/**
 * Estados de una solicitud SAIP.
 */
enum class EstadoSolicitud {
    RECEPCIONADA,
    EN_REVISION,
    PENDIENTE_INFORMACION,
    RESPONDIDA,
    DENEGADA,
    CONCLUIDA,
    VENCIDA;

    companion object {
        fun fromString(value: String): EstadoSolicitud {
            return when (value.lowercase().replace(" ", "_")) {
                "recepcionada" -> RECEPCIONADA
                "en_revisión", "en_revision" -> EN_REVISION
                "pendiente_de_información", "pendiente_informacion" -> PENDIENTE_INFORMACION
                "respondida" -> RESPONDIDA
                "denegada" -> DENEGADA
                "concluida" -> CONCLUIDA
                "vencida" -> VENCIDA
                else -> RECEPCIONADA
            }
        }
    }

    fun toDisplayString(): String = when (this) {
        RECEPCIONADA -> "Recepcionada"
        EN_REVISION -> "En Revisión"
        PENDIENTE_INFORMACION -> "Pendiente de Información"
        RESPONDIDA -> "Respondida"
        DENEGADA -> "Denegada"
        CONCLUIDA -> "Concluida"
        VENCIDA -> "Vencida"
    }
}

/**
 * Prioridades de una solicitud.
 */
enum class Prioridad {
    BAJA,
    MEDIA,
    ALTA,
    URGENTE;

    companion object {
        fun fromString(value: String): Prioridad {
            return when (value.lowercase()) {
                "baja" -> BAJA
                "media" -> MEDIA
                "alta" -> ALTA
                "urgente" -> URGENTE
                else -> MEDIA
            }
        }
    }
}

/**
 * Respuesta de la entidad a una solicitud.
 */
data class RespuestaEntidad(
    val id: String = "",
    val fechaRespuesta: Long,
    val funcionario: String,
    val tipo: TipoRespuesta,
    val fundamentacion: String,
    val documentos: List<Documento> = emptyList()
)

/**
 * Tipos de respuesta de una entidad.
 */
enum class TipoRespuesta {
    ENTREGA_TOTAL,
    ENTREGA_PARCIAL,
    DENEGACION_TOTAL,
    SILENCIO_ADMINISTRATIVO;

    companion object {
        fun fromString(value: String): TipoRespuesta {
            return when (value.lowercase().replace(" ", "_")) {
                "entrega_total" -> ENTREGA_TOTAL
                "entrega_parcial" -> ENTREGA_PARCIAL
                "denegación_total", "denegacion_total" -> DENEGACION_TOTAL
                "silencio_administrativo" -> SILENCIO_ADMINISTRATIVO
                // Compatibilidad con datos antiguos
                "denegación_parcial", "denegacion_parcial" -> SILENCIO_ADMINISTRATIVO
                else -> ENTREGA_TOTAL
            }
        }
    }
}

/**
 * Elemento del timeline de una solicitud o apelación.
 */
data class TimelineItem(
    val fecha: Long,
    val evento: String,
    val tipo: String,
    val completado: Boolean,
    val detalle: String? = null
)

