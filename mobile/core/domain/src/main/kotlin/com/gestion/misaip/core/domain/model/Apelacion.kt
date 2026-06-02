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
    val solicitudId: String? = null,
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
    val elevacionExtemporanea: Boolean = false,
    val tipoOrigen: TipoOrigenApelacion = TipoOrigenApelacion.SAIP_INTERNA,
    val datosExternos: DatosApelacionExterna? = null,
    val elevacion: ElevacionApelacion? = null
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
        get() = estado.isTerminal()

    val referenciaSolicitudOrigen: String
        get() = expedienteSAIP.ifBlank {
            datosExternos?.numeroSolicitudExterna ?: "Sin SAIP local"
        }
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
    PENDIENTE_ELEVACION,
    EN_CALIFICACION_1,
    EN_SUBSANACION,
    EN_CALIFICACION_2,
    NOTIFICACION_SEGUNDA_CALIFICACION,
    EN_RESOLUCION,
    RESUELTO,
    TENER_POR_NO_PRESENTADO,
    CONCLUSION_SUSTRACCION_MATERIA,
    CONCLUSION_DESISTIMIENTO,
    RESUELTO_FUNDADO,
    RESUELTO_FUNDADO_EN_PARTE,
    RESUELTO_INFUNDADO,
    RESUELTO_INFUNDADO_EN_PARTE,
    RESUELTO_IMPROCEDENTE;

    companion object {
        fun fromString(value: String): EstadoApelacion {
            val normalized = value.trim().uppercase().replace(" ", "_").replace("-", "_")
            return entries.find { it.name == normalized } ?: EN_CALIFICACION_1
        }

        /** Estados terminales del expediente */
        val TERMINALES = setOf(
            RESUELTO, RESUELTO_FUNDADO, RESUELTO_FUNDADO_EN_PARTE,
            RESUELTO_INFUNDADO, RESUELTO_INFUNDADO_EN_PARTE,
            RESUELTO_IMPROCEDENTE, TENER_POR_NO_PRESENTADO,
            CONCLUSION_SUSTRACCION_MATERIA, CONCLUSION_DESISTIMIENTO
        )
    }

    fun isTerminal(): Boolean = this in TERMINALES

    fun toDisplayString(): String = when (this) {
        PENDIENTE_ELEVACION -> "Pendiente de Elevación"
        EN_CALIFICACION_1 -> "En Primera Calificación"
        EN_SUBSANACION -> "En Subsanación"
        EN_CALIFICACION_2 -> "En Segunda Calificación"
        NOTIFICACION_SEGUNDA_CALIFICACION -> "Notificación Segunda Calificación"
        EN_RESOLUCION -> "En Resolución"
        RESUELTO -> "Resuelto"
        TENER_POR_NO_PRESENTADO -> "Tener por No Presentado"
        CONCLUSION_SUSTRACCION_MATERIA -> "Conclusión por Sustracción de Materia"
        CONCLUSION_DESISTIMIENTO -> "Conclusión por Desistimiento"
        RESUELTO_FUNDADO -> "Resuelto - Fundado"
        RESUELTO_FUNDADO_EN_PARTE -> "Resuelto - Fundado en Parte"
        RESUELTO_INFUNDADO -> "Resuelto - Infundado"
        RESUELTO_INFUNDADO_EN_PARTE -> "Resuelto - Infundado en Parte"
        RESUELTO_IMPROCEDENTE -> "Resuelto - Improcedente"
    }
}

enum class TipoOrigenApelacion {
    SAIP_INTERNA,
    EXTERNA;

    companion object {
        fun fromString(value: String?): TipoOrigenApelacion {
            return entries.find { it.name == value?.uppercase() } ?: SAIP_INTERNA
        }
    }
}

enum class TipoDenegatoria {
    EXPRESA,
    TACITA;

    companion object {
        fun fromString(value: String?): TipoDenegatoria? {
            return entries.find { it.name == value?.uppercase() }
        }
    }
}

data class DatosApelacionExterna(
    val numeroSolicitudExterna: String,
    val fechaPresentacionSolicitudExterna: String,
    val tipoDenegatoria: TipoDenegatoria,
    val fechaRespuestaEntidad: String? = null,
    val resumenSolicitudOriginal: String,
    val resumenRespuestaEntidad: String? = null,
    val referenciaDocumentoSolicitud: String,
    val referenciaCargoRecepcion: String? = null,
    val referenciaRespuestaEntidad: String? = null,
    val evidenciaSilencioAdministrativo: String? = null,
    val observacion: String? = null
)

enum class EstadoElevacionApelacion {
    PENDIENTE,
    ELEVADA,
    VENCIDA_NO_ELEVADA,
    COMUNICADA_POR_CIUDADANO,
    ADMITIDA_EXCEPCIONALMENTE;

    companion object {
        fun fromString(value: String?): EstadoElevacionApelacion? {
            return entries.find { it.name == value?.uppercase() }
        }
    }
}

data class ElevacionApelacion(
    val id: String,
    val apelacionId: String,
    val expedienteReservado: String,
    val entidadOrigenId: String,
    val entidadOrigenNombre: String,
    val fechaPresentacionAnteEntidad: String,
    val fechaLimiteElevacion: String,
    val fechaElevacionTtaip: String? = null,
    val fechaComunicacionCiudadano: String? = null,
    val estado: EstadoElevacionApelacion,
    val referenciaCargoPresentacion: String,
    val referenciaExpedienteElevado: String? = null,
    val referenciaPruebaOmision: String? = null,
    val responsableEntidad: String? = null,
    val responsableTtaip: String? = null,
    val observacion: String? = null,
    val trazabilidad: String? = null
)

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
 * Resultado de una calificación (primera o segunda instancia).
 * ADMISIBLE/INADMISIBLE/IMPROCEDENTE aplican en primera calificación.
 * ADMITIDO/IMPROCEDENTE aplican en segunda calificación.
 */
enum class ResultadoCalificacion {
    ADMISIBLE,
    INADMISIBLE,
    IMPROCEDENTE,
    ADMITIDO;

    companion object {
        fun fromString(value: String): ResultadoCalificacion {
            return entries.find { it.name == value.uppercase().replace(" ", "_") } ?: ADMISIBLE
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

