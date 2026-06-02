package com.gestion.misaip.core.network.dto

import com.gestion.misaip.core.domain.model.*

/**
 * DTO (Data Transfer Object) para Solicitud.
 *
 * Representa los datos provenientes del backend REST.
 * Implementa el mapeo bidireccional entre la red y el modelo de dominio.
 */
data class SolicitudDto(
    val id: String = "",
    val expediente: String = "",
    val tipo: String = "",
    val entidad: String = "",
    val entidadId: String = "",
    val usuarioId: String = "",
    val solicitanteNombre: String = "",
    val solicitanteDni: String = "",
    val solicitanteEmail: String = "",
    val solicitanteTelefono: String = "",
    val solicitanteDireccion: String = "",
    val asunto: String = "",
    val descripcion: String = "",
    val consentimientoDatosPersonales: Boolean = false,
    val canalNotificacion: String? = null,
    val fechaCreacion: Long = 0,
    val fechaLimite: Long = 0,
    val estado: String = "",
    val diasRestantes: Int? = null,
    val prioridad: String = "MEDIA",
    val silencioAdministrativo: Boolean = false,
    val respuestaFecha: Long? = null,
    val respuestaFuncionario: String? = null,
    val respuestaTipo: String? = null,
    val respuestaFundamentacion: String? = null,
    val respuestaArchivos: List<String>? = null,
    val timeline: List<Map<String, Any>>? = null,
    val ultimaModificacion: Long = System.currentTimeMillis()
) {

    /**
     * Convierte el DTO a modelo de dominio.
     */
    fun toDomain(): Solicitud {
        return Solicitud(
            id = id,
            expediente = expediente,
            tipo = TipoSolicitud.fromString(tipo),
            entidad = entidad,
            entidadId = entidadId,
            usuarioId = usuarioId,
            solicitante = Solicitante(
                nombre = solicitanteNombre,
                dni = solicitanteDni,
                email = solicitanteEmail,
                telefono = solicitanteTelefono,
                direccion = solicitanteDireccion
            ),
            asunto = asunto,
            descripcion = descripcion,
            consentimientoDatosPersonales = consentimientoDatosPersonales,
            canalNotificacion = CanalNotificacion.fromStringOrNull(canalNotificacion),
            fechaCreacion = fechaCreacion,
            fechaLimite = fechaLimite,
            estado = EstadoSolicitud.fromString(estado),
            diasRestantes = diasRestantes,
            prioridad = Prioridad.fromString(prioridad),
            respuestaEntidad = respuestaFecha?.let {
                RespuestaEntidad(
                    fechaRespuesta = it,
                    funcionario = respuestaFuncionario ?: "",
                    tipo = TipoRespuesta.fromString(respuestaTipo ?: ""),
                    fundamentacion = respuestaFundamentacion ?: "",
                    archivos = respuestaArchivos ?: emptyList()
                )
            },
            silencioAdministrativo = silencioAdministrativo,
            timeline = timeline?.map { map ->
                TimelineItem(
                    fecha = (map["fecha"] as? Number)?.toLong() ?: 0L,
                    evento = map["evento"] as? String ?: "",
                    tipo = map["tipo"] as? String ?: "",
                    completado = map["completado"] as? Boolean ?: false,
                    detalle = map["detalle"] as? String
                )
            } ?: emptyList()
        )
    }

    /**
     * Convierte el DTO a Map para compatibilidad con almacenamiento local.
     */
    fun toMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "expediente" to expediente,
            "tipo" to tipo,
            "entidad" to entidad,
            "entidadId" to entidadId,
            "usuarioId" to usuarioId,
            "solicitanteNombre" to solicitanteNombre,
            "solicitanteDni" to solicitanteDni,
            "solicitanteEmail" to solicitanteEmail,
            "solicitanteTelefono" to solicitanteTelefono,
            "solicitanteDireccion" to solicitanteDireccion,
            "asunto" to asunto,
            "descripcion" to descripcion,
            "consentimientoDatosPersonales" to consentimientoDatosPersonales,
            "canalNotificacion" to canalNotificacion,
            "fechaCreacion" to fechaCreacion,
            "fechaLimite" to fechaLimite,
            "estado" to estado,
            "diasRestantes" to diasRestantes,
            "prioridad" to prioridad,
            "silencioAdministrativo" to silencioAdministrativo,
            "respuestaFecha" to respuestaFecha,
            "respuestaFuncionario" to respuestaFuncionario,
            "respuestaTipo" to respuestaTipo,
            "respuestaFundamentacion" to respuestaFundamentacion,
            "respuestaArchivos" to respuestaArchivos,
            "timeline" to timeline,
            "ultimaModificacion" to ultimaModificacion
        )
    }

    companion object {
        /**
         * Crea un DTO desde el modelo de dominio.
         */
        fun fromDomain(solicitud: Solicitud): SolicitudDto {
            return SolicitudDto(
                id = solicitud.id,
                expediente = solicitud.expediente,
                tipo = solicitud.tipo.toDisplayString(),
                entidad = solicitud.entidad,
                entidadId = solicitud.entidadId,
                usuarioId = solicitud.usuarioId,
                solicitanteNombre = solicitud.solicitante.nombre,
                solicitanteDni = solicitud.solicitante.dni,
                solicitanteEmail = solicitud.solicitante.email,
                solicitanteTelefono = solicitud.solicitante.telefono,
                solicitanteDireccion = solicitud.solicitante.direccion,
                asunto = solicitud.asunto,
                descripcion = solicitud.descripcion,
                consentimientoDatosPersonales = solicitud.consentimientoDatosPersonales,
                canalNotificacion = solicitud.canalNotificacion?.name,
                fechaCreacion = solicitud.fechaCreacion,
                fechaLimite = solicitud.fechaLimite,
                estado = solicitud.estado.toDisplayString(),
                diasRestantes = solicitud.diasRestantes,
                prioridad = solicitud.prioridad.name,
                silencioAdministrativo = solicitud.silencioAdministrativo,
                respuestaFecha = solicitud.respuestaEntidad?.fechaRespuesta,
                respuestaFuncionario = solicitud.respuestaEntidad?.funcionario,
                respuestaTipo = solicitud.respuestaEntidad?.tipo?.name,
                respuestaFundamentacion = solicitud.respuestaEntidad?.fundamentacion,
                respuestaArchivos = solicitud.respuestaEntidad?.archivos,
                timeline = solicitud.timeline.map { item ->
                    mutableMapOf<String, Any>(
                        "fecha" to item.fecha,
                        "evento" to item.evento,
                        "tipo" to item.tipo,
                        "completado" to item.completado
                    ).also { map ->
                        item.detalle?.let { map["detalle"] = it }
                    }
                },
                ultimaModificacion = System.currentTimeMillis()
            )
        }

        /**
         * Crea un DTO desde un Map local.
         */
        @Suppress("UNCHECKED_CAST")
        fun fromMap(map: Map<String, Any?>): SolicitudDto {
            return SolicitudDto(
                id = map["id"] as? String ?: "",
                expediente = map["expediente"] as? String ?: "",
                tipo = map["tipo"] as? String ?: "",
                entidad = map["entidad"] as? String ?: "",
                entidadId = map["entidadId"] as? String ?: "",
                usuarioId = map["usuarioId"] as? String ?: "",
                solicitanteNombre = map["solicitanteNombre"] as? String ?: "",
                solicitanteDni = map["solicitanteDni"] as? String ?: "",
                solicitanteEmail = map["solicitanteEmail"] as? String ?: "",
                solicitanteTelefono = map["solicitanteTelefono"] as? String ?: "",
                solicitanteDireccion = map["solicitanteDireccion"] as? String ?: "",
                asunto = map["asunto"] as? String ?: "",
                descripcion = map["descripcion"] as? String ?: "",
                consentimientoDatosPersonales = map["consentimientoDatosPersonales"] as? Boolean ?: false,
                canalNotificacion = map["canalNotificacion"] as? String,
                fechaCreacion = (map["fechaCreacion"] as? Number)?.toLong() ?: 0L,
                fechaLimite = (map["fechaLimite"] as? Number)?.toLong() ?: 0L,
                estado = map["estado"] as? String ?: "",
                diasRestantes = (map["diasRestantes"] as? Number)?.toInt(),
                prioridad = map["prioridad"] as? String ?: "MEDIA",
                silencioAdministrativo = map["silencioAdministrativo"] as? Boolean ?: false,
                respuestaFecha = (map["respuestaFecha"] as? Number)?.toLong(),
                respuestaFuncionario = map["respuestaFuncionario"] as? String,
                respuestaTipo = map["respuestaTipo"] as? String,
                respuestaFundamentacion = map["respuestaFundamentacion"] as? String,
                respuestaArchivos = map["respuestaArchivos"] as? List<String>,
                timeline = map["timeline"] as? List<Map<String, Any>>,
                ultimaModificacion = (map["ultimaModificacion"] as? Number)?.toLong()
                    ?: System.currentTimeMillis()
            )
        }
    }
}
