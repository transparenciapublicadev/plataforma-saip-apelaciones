package com.gestion.misaip.core.domain.model

/**
 * Entidad de Dominio: Apelación ante el TTAIP
 *
 * Representa una apelación presentada ante el Tribunal de Transparencia
 * y Acceso a la Información Pública (TTAIP).
 *
 * Kotlin Puro - Sin dependencias de Android ni Firebase.
 */
data class Apelacion(
    val id: String,
    val expediente: String,
    val expedienteSAIP: String,
    val usuarioId: String,
    val apelante: Apelante,
    val entidad: String,
    val entidadId: String,
    val asunto: String,
    val fundamentoLegal: String,
    val exposicionHechos: String,
    val pretension: String,
    val fechaPresentacion: Long,
    val estado: EstadoApelacion,
    val funcionarioTTAIP: String? = null,
    val primeraCalificacion: Calificacion? = null,
    val segundaCalificacion: Calificacion? = null,
    val subsanacion: Subsanacion? = null,
    val timeline: List<TimelineItem> = emptyList(),
    val diasHabiles: Int? = null,
    val diasRestantes: Int? = null,
    val informeOralSolicitado: Boolean = false,
    val timerPausado: Boolean = false,
    val fechaElevacion: Long? = null,
    val elevacionExtemporanea: Boolean = false
) {

    /**
     * Verifica si la apelación requiere subsanación.
     */
    val requiereSubsanacion: Boolean
        get() = estado == EstadoApelacion.EN_SUBSANACION &&
                primeraCalificacion?.subsanacionRequerida == true &&
                subsanacion == null

    /**
     * Verifica si la apelación fue declarada fundada.
     */
    val esFundada: Boolean
        get() = estado == EstadoApelacion.RESUELTO_FUNDADO

    /**
     * Verifica si la apelación fue declarada infundada.
     */
    val esInfundada: Boolean
        get() = estado == EstadoApelacion.RESUELTO_INFUNDADO

    /**
     * Verifica si la apelación está resuelta.
     */
    val estaResuelta: Boolean
        get() = estado == EstadoApelacion.RESUELTO_FUNDADO ||
                estado == EstadoApelacion.RESUELTO_INFUNDADO ||
                estado == EstadoApelacion.RESUELTO_INADMISIBLE ||
                estado == EstadoApelacion.RESUELTO_IMPROCEDENTE
}

/**
 * Datos del apelante.
 */
data class Apelante(
    val nombre: String,
    val dni: String,
    val email: String
)

/**
 * Estados de una apelación.
 */
enum class EstadoApelacion {
    PENDIENTE,
    EN_CALIFICACION,
    EN_SUBSANACION,
    SUBSANACION_PRESENTADA,
    PRIMERA_RESOLUCION,
    SEGUNDA_RESOLUCION,
    RESUELTO_FUNDADO,
    RESUELTO_INFUNDADO,
    RESUELTO_INADMISIBLE,
    RESUELTO_IMPROCEDENTE;

    companion object {
        fun fromString(value: String): EstadoApelacion {
            // Normalizar: quitar espacios extra alrededor de guiones, luego reemplazar
            val normalized = value.trim().lowercase()
                .replace(" - ", "_") // "Resuelto - Fundado" → "resuelto_fundado"
                .replace("-", "_")
                .replace(" ", "_")
            return when (normalized) {
                "pendiente" -> PENDIENTE
                "en_calificación", "en_calificacion" -> EN_CALIFICACION
                "en_subsanación", "en_subsanacion" -> EN_SUBSANACION
                "subsanación_presentada", "subsanacion_presentada" -> SUBSANACION_PRESENTADA
                "primera_resolución_emitida", "primera_resolucion_emitida", "primera_resolucion" -> PRIMERA_RESOLUCION
                "segunda_resolución_emitida", "segunda_resolucion_emitida", "segunda_resolucion" -> SEGUNDA_RESOLUCION
                "resuelto_fundado" -> RESUELTO_FUNDADO
                "resuelto_infundado" -> RESUELTO_INFUNDADO
                "resuelto_inadmisible" -> RESUELTO_INADMISIBLE
                "resuelto_improcedente" -> RESUELTO_IMPROCEDENTE
                else -> PENDIENTE
            }
        }
    }

    fun toDisplayString(): String = when (this) {
        PENDIENTE -> "Pendiente"
        EN_CALIFICACION -> "En Calificación"
        EN_SUBSANACION -> "En Subsanación"
        SUBSANACION_PRESENTADA -> "Subsanación Presentada"
        PRIMERA_RESOLUCION -> "Primera Resolución Emitida"
        SEGUNDA_RESOLUCION -> "Segunda Resolución Emitida"
        RESUELTO_FUNDADO -> "Resuelto - Fundado"
        RESUELTO_INFUNDADO -> "Resuelto - Infundado"
        RESUELTO_INADMISIBLE -> "Resuelto - Inadmisible"
        RESUELTO_IMPROCEDENTE -> "Resuelto - Improcedente"
    }
}

/**
 * Calificación de una apelación (primera o segunda instancia).
 */
data class Calificacion(
    val fecha: Long,
    val resultado: ResultadoCalificacion,
    val fundamentacion: String,
    val resolucion: String? = null,
    val subsanacionRequerida: Boolean = false,
    val plazoSubsanacion: String? = null,
    val observacionesSubsanacion: String? = null,
    val plazoEntrega: String? = null,
    val ordenEntrega: Boolean = false,
    val cedulaNotificacionCiudadano: CedulaNotificacion? = null,
    val cedulaNotificacionEntidad: CedulaNotificacion? = null
)

/**
 * Resultado de una calificación.
 */
enum class ResultadoCalificacion {
    ADMISIBLE,
    INADMISIBLE,
    IMPROCEDENTE,
    FUNDADO,
    INFUNDADO,
    SUBSANACION_REQUERIDA;

    companion object {
        fun fromString(value: String): ResultadoCalificacion {
            return when (value.uppercase().replace(" ", "_")) {
                "ADMISIBLE" -> ADMISIBLE
                "INADMISIBLE" -> INADMISIBLE
                "IMPROCEDENTE" -> IMPROCEDENTE
                "FUNDADO" -> FUNDADO
                "INFUNDADO" -> INFUNDADO
                "SUBSANACIÓN_REQUERIDA", "SUBSANACION_REQUERIDA" -> SUBSANACION_REQUERIDA
                else -> ADMISIBLE
            }
        }
    }
}

/**
 * Subsanación presentada por el ciudadano.
 */
data class Subsanacion(
    val fecha: Long,
    val textoCorregido: String,
    val fundamentoLegalCorregido: String? = null,
    val documentosAdjuntos: List<String> = emptyList()
)

/**
 * Cédula de notificación.
 */
data class CedulaNotificacion(
    val id: String? = null,
    val numero: String? = null,
    val fechaNotificacion: Long,
    val contenido: String,
    val destinatario: DestinatarioCedula = DestinatarioCedula.CIUDADANO,
    val estado: EstadoCedula = EstadoCedula.PENDIENTE,
    val modalidad: ModalidadCedula = ModalidadCedula.VIRTUAL,
    val documentosAdjuntos: List<String> = emptyList(),
    val expedienteRelacionado: String? = null
)

/**
 * Destinatario de una cédula.
 */
enum class DestinatarioCedula {
    CIUDADANO,
    ENTIDAD
}

/**
 * Estado de una cédula de notificación.
 */
enum class EstadoCedula {
    PENDIENTE,
    NOTIFICADO,
    RECHAZADO
}

/**
 * Modalidad de notificación.
 */
enum class ModalidadCedula {
    FISICO,
    VIRTUAL
}

