package com.gestion.misaip.core.network.dto.rest

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Apelante
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EstadoApelacion
import com.gestion.misaip.core.domain.model.EstadoSolicitud
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.Prioridad
import com.gestion.misaip.core.domain.model.Solicitante
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.TipoSolicitud
import kotlinx.serialization.Serializable
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Contrato generico de pagina expuesto por backend.
 */
@Serializable
data class PaginaRestDto<T>(
    val contenido: List<T> = emptyList(),
    val pagina: Int = 0,
    val tamano: Int = 20,
    val totalElementos: Long = 0,
    val totalPaginas: Int = 0,
    val ultima: Boolean = true
) {
    fun <R> map(transform: (T) -> R): Pagina<R> = Pagina(
        contenido = contenido.map(transform),
        pagina = pagina,
        tamano = tamano,
        totalElementos = totalElementos,
        totalPaginas = totalPaginas,
        ultima = ultima
    )
}

/**
 * DTO liviano para bandejas SAIP. El resumen no incluye consentimiento;
 * cuando existe cache local se preservan sus campos de detalle.
 */
@Serializable
data class SolicitudResumenRestDto(
    val id: Long? = null,
    val expediente: String? = null,
    val asunto: String? = null,
    val estado: String? = null,
    val prioridad: String? = null,
    val semaforo: String? = null,
    val fechaPresentacion: String? = null,
    val fechaLimite: String? = null,
    val diasRestantes: Int? = null,
    val ciudadanoId: Long? = null,
    val ciudadanoNombre: String? = null,
    val entidadId: Long? = null,
    val entidadNombre: String? = null,
    val entidadAcronimo: String? = null,
    val canalNotificacion: String? = null
) {
    fun toDomain(cached: Solicitud? = null): Solicitud {
        val base = cached ?: Solicitud(
            id = id?.toString().orEmpty(),
            expediente = expediente.orEmpty(),
            tipo = TipoSolicitud.ACCESO_INFORMACION,
            entidad = entidadNombre.orEmpty(),
            entidadId = entidadId?.toString().orEmpty(),
            usuarioId = ciudadanoId?.toString().orEmpty(),
            solicitante = Solicitante(
                nombre = ciudadanoNombre.orEmpty(),
                dni = "",
                email = ""
            ),
            asunto = asunto.orEmpty(),
            descripcion = "",
            fechaCreacion = parseSummaryDate(fechaPresentacion),
            fechaLimite = parseSummaryDate(fechaLimite),
            estado = EstadoSolicitud.fromString(estado ?: "RECEPCIONADA")
        )

        return base.copy(
            id = id?.toString() ?: base.id,
            expediente = expediente ?: base.expediente,
            entidad = entidadNombre ?: base.entidad,
            entidadId = entidadId?.toString() ?: base.entidadId,
            usuarioId = ciudadanoId?.toString() ?: base.usuarioId,
            solicitante = base.solicitante.copy(
                nombre = ciudadanoNombre ?: base.solicitante.nombre
            ),
            asunto = asunto ?: base.asunto,
            canalNotificacion = CanalNotificacion.fromStringOrNull(canalNotificacion)
                ?: base.canalNotificacion,
            fechaCreacion = fechaPresentacion?.let(::parseSummaryDate) ?: base.fechaCreacion,
            fechaLimite = fechaLimite?.let(::parseSummaryDate) ?: base.fechaLimite,
            estado = EstadoSolicitud.fromString(estado ?: base.estado.name),
            diasRestantes = diasRestantes ?: base.diasRestantes,
            prioridad = Prioridad.fromString(prioridad ?: base.prioridad.name)
        )
    }
}

/**
 * DTO liviano para bandejas TTAIP.
 */
@Serializable
data class ApelacionResumenRestDto(
    val id: Long? = null,
    val expediente: String? = null,
    val estado: String? = null,
    val resultado: String? = null,
    val fechaApelacion: String? = null,
    val solicitudId: Long? = null,
    val solicitudExpediente: String? = null,
    val ciudadanoId: Long? = null,
    val ciudadanoNombre: String? = null,
    val entidadId: Long? = null,
    val entidadNombre: String? = null,
    val tipoOrigen: String? = null,
    val numeroSolicitudExterna: String? = null
) {
    fun toDomain(cached: Apelacion? = null): Apelacion {
        val base = cached ?: Apelacion(
            id = id?.toString().orEmpty(),
            expediente = expediente.orEmpty(),
            expedienteSAIP = solicitudExpediente ?: numeroSolicitudExterna.orEmpty(),
            usuarioId = ciudadanoId?.toString().orEmpty(),
            apelante = Apelante(
                nombre = ciudadanoNombre.orEmpty(),
                dni = "",
                email = ""
            ),
            entidad = entidadNombre.orEmpty(),
            entidadId = entidadId?.toString().orEmpty(),
            asunto = solicitudExpediente ?: numeroSolicitudExterna ?: "Apelación TTAIP",
            fundamentoLegal = "",
            exposicionHechos = "",
            pretension = "",
            fechaPresentacion = parseSummaryDate(fechaApelacion),
            estado = EstadoApelacion.fromString(estado ?: "EN_CALIFICACION_1")
        )

        return base.copy(
            id = id?.toString() ?: base.id,
            expediente = expediente ?: base.expediente,
            expedienteSAIP = solicitudExpediente ?: numeroSolicitudExterna ?: base.expedienteSAIP,
            usuarioId = ciudadanoId?.toString() ?: base.usuarioId,
            apelante = base.apelante.copy(
                nombre = ciudadanoNombre ?: base.apelante.nombre
            ),
            entidad = entidadNombre ?: base.entidad,
            entidadId = entidadId?.toString() ?: base.entidadId,
            fechaPresentacion = fechaApelacion?.let(::parseSummaryDate) ?: base.fechaPresentacion,
            estado = EstadoApelacion.fromString(estado ?: base.estado.name)
        )
    }
}

private fun parseSummaryDate(value: String?): Long {
    if (value.isNullOrBlank()) return 0L
    return try {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).parse(value)?.time ?: 0L
    } catch (_: Exception) {
        try {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(value)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }
}
