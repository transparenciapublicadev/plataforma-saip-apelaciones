package com.gestion.misaip.core.data.mapper

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.database.Apelacion as ApelacionEntity
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString

/**
 * Mapper bidireccional entre modelo de Dominio y Entidad de BD para Apelaciones.
 */
object ApelacionMapper {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun toDomain(entity: ApelacionEntity): Apelacion {
        return Apelacion(
            id = entity.id,
            expediente = entity.expediente,
            expedienteSAIP = entity.expedienteSAIP.orEmpty(),
            solicitudId = entity.solicitudId,
            usuarioId = entity.usuarioId,
            apelante = Apelante(
                nombre = entity.apelanteNombre,
                dni = entity.apelanteDni,
                email = entity.apelanteEmail
            ),
            entidad = entity.entidad,
            entidadId = entity.entidadId,
            asunto = entity.asunto,
            fundamentoLegal = entity.fundamentoLegal,
            exposicionHechos = entity.exposicionHechos,
            pretension = entity.pretension,
            fechaPresentacion = entity.fechaPresentacion,
            estado = EstadoApelacion.fromString(entity.estado),
            funcionarioTTAIP = entity.funcionarioTTAIP,
            primeraCalificacion = entity.primeraCalificacion?.let { parseCalificacion(it) },
            segundaCalificacion = entity.segundaCalificacion?.let { parseCalificacion(it) },
            subsanacion = entity.subsanacion?.let { parseSubsanacion(it) },
            timeline = parseTimeline(entity.timeline),
            diasHabiles = entity.diasHabiles?.toInt(),
            diasRestantes = entity.diasRestantes?.toInt(),
            informeOralSolicitado = entity.informeOralSolicitado,
            timerPausado = entity.timerPausado,
            fechaElevacion = entity.fechaElevacion,
            elevacionExtemporanea = entity.elevacionExtemporanea,
            tipoOrigen = TipoOrigenApelacion.fromString(entity.tipoOrigen),
            datosExternos = entity.numeroSolicitudExterna?.let {
                DatosApelacionExterna(
                    numeroSolicitudExterna = it,
                    fechaPresentacionSolicitudExterna = entity.fechaPresentacionSolicitudExterna.orEmpty(),
                    tipoDenegatoria = TipoDenegatoria.fromString(entity.tipoDenegatoria) ?: TipoDenegatoria.TACITA,
                    fechaRespuestaEntidad = entity.fechaRespuestaEntidad,
                    resumenSolicitudOriginal = entity.resumenSolicitudOriginal.orEmpty(),
                    resumenRespuestaEntidad = entity.resumenRespuestaEntidad,
                    referenciaDocumentoSolicitud = entity.referenciaDocumentoSolicitud.orEmpty(),
                    referenciaCargoRecepcion = entity.referenciaCargoRecepcion,
                    referenciaRespuestaEntidad = entity.referenciaRespuestaEntidad,
                    evidenciaSilencioAdministrativo = entity.evidenciaSilencioAdministrativo,
                    observacion = entity.observacion
                )
            },
            elevacion = entity.estadoElevacion?.let {
                ElevacionApelacion(
                    id = "",
                    apelacionId = entity.id,
                    expedienteReservado = entity.expediente,
                    entidadOrigenId = entity.entidadId,
                    entidadOrigenNombre = entity.entidad,
                    fechaPresentacionAnteEntidad = "",
                    fechaLimiteElevacion = entity.fechaLimiteElevacion.orEmpty(),
                    estado = EstadoElevacionApelacion.fromString(it) ?: EstadoElevacionApelacion.PENDIENTE,
                    referenciaCargoPresentacion = entity.referenciaCargoPresentacionElevacion.orEmpty(),
                    referenciaExpedienteElevado = entity.referenciaExpedienteElevado,
                    referenciaPruebaOmision = entity.referenciaPruebaOmision
                )
            }
        )
    }

    fun toEntity(domain: Apelacion, pendienteSubida: Boolean = true): ApelacionEntity {
        return ApelacionEntity(
            id = domain.id,
            expediente = domain.expediente,
            expedienteSAIP = domain.expedienteSAIP.ifBlank { null },
            solicitudId = domain.solicitudId,
            usuarioId = domain.usuarioId,
            apelanteNombre = domain.apelante.nombre,
            apelanteDni = domain.apelante.dni,
            apelanteEmail = domain.apelante.email,
            entidad = domain.entidad,
            entidadId = domain.entidadId,
            asunto = domain.asunto,
            fundamentoLegal = domain.fundamentoLegal,
            exposicionHechos = domain.exposicionHechos,
            pretension = domain.pretension,
            fechaPresentacion = domain.fechaPresentacion,
            estado = domain.estado.toDisplayString(),
            funcionarioTTAIP = domain.funcionarioTTAIP,
            primeraCalificacion = domain.primeraCalificacion?.let { encodeCalificacion(it) },
            segundaCalificacion = domain.segundaCalificacion?.let { encodeCalificacion(it) },
            subsanacion = domain.subsanacion?.let { encodeSubsanacion(it) },
            timeline = json.encodeToString(domain.timeline.map { TimelineSerializable(it) }),
            diasHabiles = domain.diasHabiles?.toLong(),
            diasRestantes = domain.diasRestantes?.toLong(),
            informeOralSolicitado = domain.informeOralSolicitado,
            timerPausado = domain.timerPausado,
            fechaElevacion = domain.fechaElevacion,
            elevacionExtemporanea = domain.elevacionExtemporanea,
            tipoOrigen = domain.tipoOrigen.name,
            numeroSolicitudExterna = domain.datosExternos?.numeroSolicitudExterna,
            tipoDenegatoria = domain.datosExternos?.tipoDenegatoria?.name,
            fechaPresentacionSolicitudExterna = domain.datosExternos?.fechaPresentacionSolicitudExterna,
            fechaRespuestaEntidad = domain.datosExternos?.fechaRespuestaEntidad,
            resumenSolicitudOriginal = domain.datosExternos?.resumenSolicitudOriginal,
            resumenRespuestaEntidad = domain.datosExternos?.resumenRespuestaEntidad,
            referenciaDocumentoSolicitud = domain.datosExternos?.referenciaDocumentoSolicitud,
            referenciaCargoRecepcion = domain.datosExternos?.referenciaCargoRecepcion,
            referenciaRespuestaEntidad = domain.datosExternos?.referenciaRespuestaEntidad,
            evidenciaSilencioAdministrativo = domain.datosExternos?.evidenciaSilencioAdministrativo,
            observacion = domain.datosExternos?.observacion,
            estadoElevacion = domain.elevacion?.estado?.name,
            fechaLimiteElevacion = domain.elevacion?.fechaLimiteElevacion,
            referenciaCargoPresentacionElevacion = domain.elevacion?.referenciaCargoPresentacion,
            referenciaExpedienteElevado = domain.elevacion?.referenciaExpedienteElevado,
            referenciaPruebaOmision = domain.elevacion?.referenciaPruebaOmision,
            sincronizado = false,
            pendienteSubida = pendienteSubida,
            ultimaModificacion = System.currentTimeMillis()
        )
    }

    private fun parseCalificacion(jsonStr: String): Calificacion? {
        if (jsonStr.isBlank()) return null
        return try {
            val dto: CalificacionSerializable = json.decodeFromString(jsonStr)
            dto.toDomain()
        } catch (_: Exception) { null }
    }

    private fun encodeCalificacion(cal: Calificacion): String {
        return json.encodeToString(CalificacionSerializable.from(cal))
    }

    private fun parseSubsanacion(jsonStr: String): Subsanacion? {
        if (jsonStr.isBlank()) return null
        return try {
            val dto: SubsanacionSerializable = json.decodeFromString(jsonStr)
            dto.toDomain()
        } catch (_: Exception) { null }
    }

    private fun encodeSubsanacion(sub: Subsanacion): String {
        return json.encodeToString(SubsanacionSerializable.from(sub))
    }

    private fun parseTimeline(jsonStr: String): List<TimelineItem> {
        if (jsonStr.isBlank() || jsonStr == "[]") return emptyList()
        return try {
            val dtos: List<TimelineSerializable> = json.decodeFromString(jsonStr)
            dtos.map { it.toDomain() }
        } catch (_: Exception) { emptyList() }
    }
}

@kotlinx.serialization.Serializable
data class CalificacionSerializable(
    val fecha: Long,
    val resultado: String,
    val fundamentacion: String,
    val resolucion: String? = null,
    val subsanacionRequerida: Boolean = false,
    val plazoSubsanacion: String? = null,
    val observacionesSubsanacion: String? = null,
    val plazoEntrega: String? = null,
    val ordenEntrega: Boolean = false
) {
    fun toDomain() = Calificacion(
        fecha = fecha,
        resultado = ResultadoCalificacion.fromString(resultado),
        fundamentacion = fundamentacion,
        resolucion = resolucion,
        subsanacionRequerida = subsanacionRequerida,
        plazoSubsanacion = plazoSubsanacion,
        observacionesSubsanacion = observacionesSubsanacion,
        plazoEntrega = plazoEntrega,
        ordenEntrega = ordenEntrega
    )

    companion object {
        fun from(cal: Calificacion) = CalificacionSerializable(
            fecha = cal.fecha,
            resultado = cal.resultado.name,
            fundamentacion = cal.fundamentacion,
            resolucion = cal.resolucion,
            subsanacionRequerida = cal.subsanacionRequerida,
            plazoSubsanacion = cal.plazoSubsanacion,
            observacionesSubsanacion = cal.observacionesSubsanacion,
            plazoEntrega = cal.plazoEntrega,
            ordenEntrega = cal.ordenEntrega
        )
    }
}

@kotlinx.serialization.Serializable
data class SubsanacionSerializable(
    val fecha: Long,
    val textoCorregido: String,
    val fundamentoLegalCorregido: String? = null,
    val documentosAdjuntos: List<String> = emptyList()
) {
    fun toDomain() = Subsanacion(
        fecha = fecha,
        textoCorregido = textoCorregido,
        fundamentoLegalCorregido = fundamentoLegalCorregido,
        documentosAdjuntos = documentosAdjuntos
    )

    companion object {
        fun from(sub: Subsanacion) = SubsanacionSerializable(
            fecha = sub.fecha,
            textoCorregido = sub.textoCorregido,
            fundamentoLegalCorregido = sub.fundamentoLegalCorregido,
            documentosAdjuntos = sub.documentosAdjuntos
        )
    }
}

@kotlinx.serialization.Serializable
data class TimelineSerializable(
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
