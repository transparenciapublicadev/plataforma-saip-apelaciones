package com.gestion.misaip.data

import android.content.Context
import android.content.SharedPreferences

/**
 * Rastrea el estado de lectura de notificaciones usando SharedPreferences.
 * Persiste entre recreaciones de Activity/ViewModel.
 *
 * Cada usuario tiene su propio conjunto de notificaciones leídas,
 * usando claves con prefijo del userId.
 */
class NotificacionReadTracker(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("notificacion_read_state", Context.MODE_PRIVATE)

    /**
     * Marca una notificación como leída para un usuario.
     */
    fun marcarNotificacionLeida(usuarioId: String, notificacionId: Int) {
        val key = buildKey(usuarioId)
        val leidas = obtenerLeidasSet(key).toMutableSet()
        leidas.add(notificacionId.toString())
        prefs.edit().putStringSet(key, leidas).apply()
    }

    /**
     * Verifica si una notificación fue leída por un usuario.
     */
    fun esNotificacionLeida(usuarioId: String, notificacionId: Int): Boolean {
        val key = buildKey(usuarioId)
        val leidas = obtenerLeidasSet(key)
        return leidas.contains(notificacionId.toString())
    }

    /**
     * Marca todas las notificaciones como leídas para un usuario.
     */
    fun marcarTodasLeidas(usuarioId: String, ids: List<Int>) {
        val key = buildKey(usuarioId)
        val leidas = ids.map { it.toString() }.toSet()
        prefs.edit().putStringSet(key, leidas).apply()
    }

    private fun buildKey(usuarioId: String) = "leidas_$usuarioId"

    private fun obtenerLeidasSet(key: String): Set<String> {
        return prefs.getStringSet(key, emptySet()) ?: emptySet()
    }
}
