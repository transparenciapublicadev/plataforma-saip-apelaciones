package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.Notificacion
import kotlinx.coroutines.flow.Flow

/**
 * Interfaz del Repositorio de Notificaciones.
 *
 * Define el contrato para el acceso a notificaciones del sistema.
 *
 * IMPORTANTE: Esta interfaz está en el módulo de DOMINIO,
 * por lo tanto NO debe tener dependencias de Android ni Firebase.
 */
interface NotificacionRepository {

    /**
     * Obtiene todas las notificaciones del usuario actual.
     *
     * @param usuarioId ID del usuario
     * @return Flow de lista de notificaciones
     */
    fun getNotificacionesUsuario(usuarioId: String): Flow<List<Notificacion>>

    /**
     * Obtiene las notificaciones no leídas del usuario.
     *
     * @param usuarioId ID del usuario
     * @return Flow de lista de notificaciones no leídas
     */
    fun getNotificacionesNoLeidas(usuarioId: String): Flow<List<Notificacion>>

    /**
     * Obtiene el conteo de notificaciones no leídas.
     *
     * @param usuarioId ID del usuario
     * @return Flow con el conteo
     */
    fun getConteoNoLeidas(usuarioId: String): Flow<Int>

    /**
     * Marca una notificación como leída.
     *
     * @param notificacionId ID de la notificación
     */
    suspend fun marcarComoLeida(notificacionId: Long)

    /**
     * Marca todas las notificaciones del usuario como leídas.
     *
     * @param usuarioId ID del usuario
     */
    suspend fun marcarTodasComoLeidas(usuarioId: String)

    /**
     * Crea una nueva notificación.
     *
     * @param notificacion Datos de la notificación
     * @return Notificación creada
     */
    suspend fun crearNotificacion(notificacion: Notificacion): Notificacion

    /**
     * Elimina una notificación.
     *
     * @param notificacionId ID de la notificación
     */
    suspend fun eliminarNotificacion(notificacionId: Long)

    /**
     * Genera notificaciones dinámicas basadas en el estado actual del sistema.
     * Este método analiza solicitudes, apelaciones y cédulas para generar
     * notificaciones relevantes para el usuario.
     *
     * @param usuarioId ID del usuario
     * @return Lista de notificaciones generadas
     */
    suspend fun generarNotificacionesDinamicas(usuarioId: String): List<Notificacion>
}

