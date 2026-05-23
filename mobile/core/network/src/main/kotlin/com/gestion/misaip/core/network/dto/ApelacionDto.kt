package com.gestion.misaip.core.network.dto

import com.gestion.misaip.core.domain.model.*

/**
 * DTO para Apelación TTAIP.
 * Representa los datos provenientes del backend REST.
 */
data class ApelacionDto(
    val id: String = "",
    val expediente: String = "",
    val expedienteSAIP: String = "",
    val usuarioId: String = "",
    val apelanteNombre: String = "",
    val apelanteDni: String = "",
    val apelanteEmail: String = "",
    val entidad: String = "",
    val entidadId: String = "",
    val asunto: String = "",
    val fundamentoLegal: String = "",
    val exposicionHechos: String = "",
    val pretension: String = "",
    val fechaPresentacion: Long = 0,
    val estado: String = "",
    val funcionarioTTAIP: String? = null,
    val primeraCalificacion: Map<String, Any?>? = null,
    val segundaCalificacion: Map<String, Any?>? = null,
    val subsanacion: Map<String, Any?>? = null,
    val timeline: List<Map<String, Any>>? = null,
    val diasHabiles: Int? = null,
    val diasRestantes: Int? = null,
    val informeOralSolicitado: Boolean = false,
    val timerPausado: Boolean = false,
    val fechaElevacion: Long? = null,
    val elevacionExtemporanea: Boolean = false,
    val ultimaModificacion: Long = System.currentTimeMillis()
) {

    fun toDomain(): Apelacion {
        return Apelacion(
            id = id,
            expediente = expediente,
            expedienteSAIP = expedienteSAIP,
            usuarioId = usuarioId,
            apelante = Apelante(
                nombre = apelanteNombre,
                dni = apelanteDni,
                email = apelanteEmail
            ),
            entidad = entidad,
            entidadId = entidadId,
            asunto = asunto,
            fundamentoLegal = fundamentoLegal,
            exposicionHechos = exposicionHechos,
            pretension = pretension,
            fechaPresentacion = fechaPresentacion,
            estado = EstadoApelacion.fromString(estado),
            funcionarioTTAIP = funcionarioTTAIP,
            primeraCalificacion = primeraCalificacion?.let { parseCalificacion(it) },
            segundaCalificacion = segundaCalificacion?.let { parseCalificacion(it) },
            subsanacion = subsanacion?.let { parseSubsanacion(it) },
            timeline = timeline?.map { map ->
                TimelineItem(
                    fecha = (map["fecha"] as? Number)?.toLong() ?: 0L,
                    evento = map["evento"] as? String ?: "",
                    tipo = map["tipo"] as? String ?: "",
                    completado = map["completado"] as? Boolean ?: false,
                    detalle = map["detalle"] as? String
                )
            } ?: emptyList(),
            diasHabiles = diasHabiles,
            diasRestantes = diasRestantes,
            informeOralSolicitado = informeOralSolicitado,
            timerPausado = timerPausado,
            fechaElevacion = fechaElevacion,
            elevacionExtemporanea = elevacionExtemporanea
        )
    }

    fun toMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "expediente" to expediente,
            "expedienteSAIP" to expedienteSAIP,
            "usuarioId" to usuarioId,
            "apelanteNombre" to apelanteNombre,
            "apelanteDni" to apelanteDni,
            "apelanteEmail" to apelanteEmail,
            "entidad" to entidad,
            "entidadId" to entidadId,
            "asunto" to asunto,
            "fundamentoLegal" to fundamentoLegal,
            "exposicionHechos" to exposicionHechos,
            "pretension" to pretension,
            "fechaPresentacion" to fechaPresentacion,
            "estado" to estado,
            "funcionarioTTAIP" to funcionarioTTAIP,
            "primeraCalificacion" to primeraCalificacion,
            "segundaCalificacion" to segundaCalificacion,
            "subsanacion" to subsanacion,
            "timeline" to timeline,
            "diasHabiles" to diasHabiles,
            "diasRestantes" to diasRestantes,
            "informeOralSolicitado" to informeOralSolicitado,
            "timerPausado" to timerPausado,
            "fechaElevacion" to fechaElevacion,
            "elevacionExtemporanea" to elevacionExtemporanea,
            "ultimaModificacion" to ultimaModificacion
        )
    }

    companion object {
        fun fromDomain(apelacion: Apelacion): ApelacionDto {
            return ApelacionDto(
                id = apelacion.id,
                expediente = apelacion.expediente,
                expedienteSAIP = apelacion.expedienteSAIP,
                usuarioId = apelacion.usuarioId,
                apelanteNombre = apelacion.apelante.nombre,
                apelanteDni = apelacion.apelante.dni,
                apelanteEmail = apelacion.apelante.email,
                entidad = apelacion.entidad,
                entidadId = apelacion.entidadId,
                asunto = apelacion.asunto,
                fundamentoLegal = apelacion.fundamentoLegal,
                exposicionHechos = apelacion.exposicionHechos,
                pretension = apelacion.pretension,
                fechaPresentacion = apelacion.fechaPresentacion,
                estado = apelacion.estado.toDisplayString(),
                funcionarioTTAIP = apelacion.funcionarioTTAIP,
                primeraCalificacion = apelacion.primeraCalificacion?.let { calificacionToMap(it) },
                segundaCalificacion = apelacion.segundaCalificacion?.let { calificacionToMap(it) },
                subsanacion = apelacion.subsanacion?.let { subsanacionToMap(it) },
                timeline = apelacion.timeline.map { item ->
                    mutableMapOf<String, Any>(
                        "fecha" to item.fecha,
                        "evento" to item.evento,
                        "tipo" to item.tipo,
                        "completado" to item.completado
                    ).also { map -> item.detalle?.let { map["detalle"] = it } }
                },
                diasHabiles = apelacion.diasHabiles,
                diasRestantes = apelacion.diasRestantes,
                informeOralSolicitado = apelacion.informeOralSolicitado,
                timerPausado = apelacion.timerPausado,
                fechaElevacion = apelacion.fechaElevacion,
                elevacionExtemporanea = apelacion.elevacionExtemporanea,
                ultimaModificacion = System.currentTimeMillis()
            )
        }

        @Suppress("UNCHECKED_CAST")
        fun fromMap(map: Map<String, Any?>): ApelacionDto {
            return ApelacionDto(
                id = map["id"] as? String ?: "",
                expediente = map["expediente"] as? String ?: "",
                expedienteSAIP = map["expedienteSAIP"] as? String ?: "",
                usuarioId = map["usuarioId"] as? String ?: "",
                apelanteNombre = map["apelanteNombre"] as? String ?: "",
                apelanteDni = map["apelanteDni"] as? String ?: "",
                apelanteEmail = map["apelanteEmail"] as? String ?: "",
                entidad = map["entidad"] as? String ?: "",
                entidadId = map["entidadId"] as? String ?: "",
                asunto = map["asunto"] as? String ?: "",
                fundamentoLegal = map["fundamentoLegal"] as? String ?: "",
                exposicionHechos = map["exposicionHechos"] as? String ?: "",
                pretension = map["pretension"] as? String ?: "",
                fechaPresentacion = (map["fechaPresentacion"] as? Number)?.toLong() ?: 0L,
                estado = map["estado"] as? String ?: "",
                funcionarioTTAIP = map["funcionarioTTAIP"] as? String,
                primeraCalificacion = map["primeraCalificacion"] as? Map<String, Any?>,
                segundaCalificacion = map["segundaCalificacion"] as? Map<String, Any?>,
                subsanacion = map["subsanacion"] as? Map<String, Any?>,
                timeline = map["timeline"] as? List<Map<String, Any>>,
                diasHabiles = (map["diasHabiles"] as? Number)?.toInt(),
                diasRestantes = (map["diasRestantes"] as? Number)?.toInt(),
                informeOralSolicitado = map["informeOralSolicitado"] as? Boolean ?: false,
                timerPausado = map["timerPausado"] as? Boolean ?: false,
                fechaElevacion = (map["fechaElevacion"] as? Number)?.toLong(),
                elevacionExtemporanea = map["elevacionExtemporanea"] as? Boolean ?: false,
                ultimaModificacion = (map["ultimaModificacion"] as? Number)?.toLong() ?: System.currentTimeMillis()
            )
        }

        private fun calificacionToMap(cal: Calificacion): Map<String, Any?> {
            return mapOf(
                "fecha" to cal.fecha,
                "resultado" to cal.resultado.name,
                "fundamentacion" to cal.fundamentacion,
                "resolucion" to cal.resolucion,
                "subsanacionRequerida" to cal.subsanacionRequerida,
                "plazoSubsanacion" to cal.plazoSubsanacion,
                "observacionesSubsanacion" to cal.observacionesSubsanacion,
                "plazoEntrega" to cal.plazoEntrega,
                "ordenEntrega" to cal.ordenEntrega
            )
        }

        private fun subsanacionToMap(sub: Subsanacion): Map<String, Any?> {
            return mapOf(
                "fecha" to sub.fecha,
                "textoCorregido" to sub.textoCorregido,
                "fundamentoLegalCorregido" to sub.fundamentoLegalCorregido,
                "documentosAdjuntos" to sub.documentosAdjuntos
            )
        }

        private fun parseCalificacion(map: Map<String, Any?>): Calificacion {
            return Calificacion(
                fecha = (map["fecha"] as? Number)?.toLong() ?: 0L,
                resultado = ResultadoCalificacion.fromString(map["resultado"] as? String ?: ""),
                fundamentacion = map["fundamentacion"] as? String ?: "",
                resolucion = map["resolucion"] as? String,
                subsanacionRequerida = map["subsanacionRequerida"] as? Boolean ?: false,
                plazoSubsanacion = map["plazoSubsanacion"] as? String,
                observacionesSubsanacion = map["observacionesSubsanacion"] as? String,
                plazoEntrega = map["plazoEntrega"] as? String,
                ordenEntrega = map["ordenEntrega"] as? Boolean ?: false
            )
        }

        @Suppress("UNCHECKED_CAST")
        private fun parseSubsanacion(map: Map<String, Any?>): Subsanacion {
            return Subsanacion(
                fecha = (map["fecha"] as? Number)?.toLong() ?: 0L,
                textoCorregido = map["textoCorregido"] as? String ?: "",
                fundamentoLegalCorregido = map["fundamentoLegalCorregido"] as? String,
                documentosAdjuntos = (map["documentosAdjuntos"] as? List<String>) ?: emptyList()
            )
        }
    }
}
