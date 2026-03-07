package com.gestion.misaip.core.data.repository

import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToList
import app.cash.sqldelight.coroutines.mapToOneOrNull
import com.gestion.misaip.core.database.SaipDatabase
import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.NotificacionRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext

/**
 * Implementación del repositorio de Notificaciones.
 * Las notificaciones son principalmente locales con generación dinámica
 * basada en el estado de solicitudes y apelaciones.
 */
class NotificacionRepositoryImpl(
    private val database: SaipDatabase
) : NotificacionRepository {

    private val queries = database.notificacionQueries

    override fun getNotificacionesUsuario(usuarioId: String): Flow<List<Notificacion>> {
        return queries.getNotificacionesByUsuario(usuarioId)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities ->
                entities.map { entity ->
                    Notificacion(
                        id = entity.id,
                        tipo = TipoNotificacion.fromString(entity.tipo),
                        titulo = entity.titulo,
                        mensaje = entity.mensaje,
                        fecha = entity.fecha,
                        leida = entity.leida,
                        icono = entity.icono,
                        color = entity.color,
                        expediente = entity.expediente,
                        usuarioId = entity.usuarioId
                    )
                }
            }
    }

    override fun getNotificacionesNoLeidas(usuarioId: String): Flow<List<Notificacion>> {
        return queries.getNotificacionesNoLeidas(usuarioId)
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities ->
                entities.map { entity ->
                    Notificacion(
                        id = entity.id,
                        tipo = TipoNotificacion.fromString(entity.tipo),
                        titulo = entity.titulo,
                        mensaje = entity.mensaje,
                        fecha = entity.fecha,
                        leida = entity.leida,
                        icono = entity.icono,
                        color = entity.color,
                        expediente = entity.expediente,
                        usuarioId = entity.usuarioId
                    )
                }
            }
    }

    override fun getConteoNoLeidas(usuarioId: String): Flow<Int> {
        return queries.getConteoNoLeidas(usuarioId)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { it?.toInt() ?: 0 }
    }

    override suspend fun marcarComoLeida(notificacionId: Long) = withContext(Dispatchers.IO) {
        queries.marcarComoLeida(notificacionId)
        Unit
    }

    override suspend fun marcarTodasComoLeidas(usuarioId: String) = withContext(Dispatchers.IO) {
        queries.marcarTodasComoLeidas(usuarioId)
        Unit
    }

    override suspend fun crearNotificacion(notificacion: Notificacion): Notificacion = withContext(Dispatchers.IO) {
        queries.insertNotificacion(
            tipo = notificacion.tipo.name,
            titulo = notificacion.titulo,
            mensaje = notificacion.mensaje,
            fecha = notificacion.fecha,
            leida = notificacion.leida,
            icono = notificacion.icono,
            color = notificacion.color,
            expediente = notificacion.expediente,
            usuarioId = notificacion.usuarioId,
            sincronizado = false
        )
        val id = queries.lastInsertId().executeAsOne()
        notificacion.copy(id = id)
    }

    override suspend fun eliminarNotificacion(notificacionId: Long) = withContext(Dispatchers.IO) {
        queries.eliminarNotificacion(notificacionId)
        Unit
    }

    /**
     * Genera notificaciones dinámicas basadas en el estado actual del sistema.
     * Analiza solicitudes y apelaciones para crear notificaciones relevantes.
     */
    override suspend fun generarNotificacionesDinamicas(usuarioId: String): List<Notificacion> = withContext(Dispatchers.IO) {
        val notificaciones = mutableListOf<Notificacion>()
        val ahora = System.currentTimeMillis()

        // Verificar solicitudes con plazos próximos a vencer
        val solicitudes = database.solicitudQueries.getSolicitudesByUsuario(usuarioId).executeAsList()
        for (sol in solicitudes) {
            val diasRestantes = sol.diasRestantes?.toInt() ?: continue

            // Alerta de plazo próximo a vencer (2 días o menos)
            if (diasRestantes in 1..2 && sol.estado != "Respondida" && sol.estado != "Concluida") {
                notificaciones.add(
                    Notificacion(
                        id = 0,
                        tipo = TipoNotificacion.PLAZO_VENCIMIENTO,
                        titulo = "Plazo próximo a vencer",
                        mensaje = "La solicitud ${sol.expediente} vence en $diasRestantes día(s) hábil(es).",
                        fecha = ahora,
                        icono = "ic_warning",
                        color = "#FF9800",
                        expediente = sol.expediente,
                        usuarioId = usuarioId
                    )
                )
            }

            // Silencio administrativo
            if (diasRestantes <= 0 && sol.estado != "Respondida" && sol.estado != "Concluida" && !sol.silencioAdministrativo) {
                notificaciones.add(
                    Notificacion(
                        id = 0,
                        tipo = TipoNotificacion.SOLICITUD_VENCIDA,
                        titulo = "Silencio Administrativo Negativo",
                        mensaje = "La solicitud ${sol.expediente} ha vencido. Puede apelar ante el TTAIP.",
                        fecha = ahora,
                        icono = "ic_gavel",
                        color = "#F44336",
                        expediente = sol.expediente,
                        usuarioId = usuarioId
                    )
                )
            }

            // Alerta de costos (día 9)
            if (diasRestantes == 1 && sol.estado != "Respondida") {
                notificaciones.add(
                    Notificacion(
                        id = 0,
                        tipo = TipoNotificacion.SOLICITUD_URGENTE,
                        titulo = "Notificar Liquidación de Costos",
                        mensaje = "La solicitud ${sol.expediente} está por vencer. Recuerde notificar la liquidación de costos.",
                        fecha = ahora,
                        icono = "ic_monetization",
                        color = "#FF5722",
                        expediente = sol.expediente,
                        usuarioId = usuarioId
                    )
                )
            }
        }

        // Verificar apelaciones
        val apelaciones = database.apelacionQueries.getApelacionesByUsuario(usuarioId).executeAsList()
        for (ape in apelaciones) {
            if (ape.estado == "En Subsanación") {
                notificaciones.add(
                    Notificacion(
                        id = 0,
                        tipo = TipoNotificacion.SUBSANACION_REQUERIDA,
                        titulo = "Subsanación Requerida",
                        mensaje = "Su apelación ${ape.expediente} requiere subsanación.",
                        fecha = ahora,
                        icono = "ic_edit",
                        color = "#FF9800",
                        expediente = ape.expediente,
                        usuarioId = usuarioId
                    )
                )
            }
        }

        notificaciones
    }
}
