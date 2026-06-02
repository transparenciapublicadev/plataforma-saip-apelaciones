package com.gestion.misaip.messaging

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Helper para gestionar Firebase Cloud Messaging.
 */
object FCMHelper {

    private const val TAG = "FCMHelper"
    private var pushTokenSyncCoordinator: PushTokenSyncCoordinator? = null

    fun init(coordinator: PushTokenSyncCoordinator) {
        pushTokenSyncCoordinator = coordinator
    }

    /**
     * Obtiene el token FCM actual del dispositivo.
     * @param onTokenReceived Callback con el token recibido
     * @param onError Callback en caso de error
     */
    fun getToken(
        onTokenReceived: (String) -> Unit,
        onError: (Exception) -> Unit = { Log.e(TAG, "Error obteniendo token", it) }
    ) {
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    Log.d(TAG, "Token FCM obtenido correctamente")
                    onTokenReceived(token)
                } else {
                    task.exception?.let { onError(it) }
                }
            }
    }

    /**
     * Suscribe al dispositivo a un tema específico.
     * Útil para enviar notificaciones a grupos de usuarios.
     *
     * @param topic Nombre del tema (ej: "ciudadanos", "funcionarios_minedu", "ttaip")
     */
    fun subscribeToTopic(topic: String, onSuccess: () -> Unit = {}, onError: (Exception) -> Unit = {}) {
        FirebaseMessaging.getInstance().subscribeToTopic(topic)
            .addOnSuccessListener {
                Log.d(TAG, "Suscrito al tema: $topic")
                onSuccess()
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error suscribiendo al tema: $topic", e)
                onError(e)
            }
    }

    /**
     * Cancela la suscripción a un tema.
     */
    fun unsubscribeFromTopic(topic: String, onSuccess: () -> Unit = {}, onError: (Exception) -> Unit = {}) {
        FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
            .addOnSuccessListener {
                Log.d(TAG, "Desuscrito del tema: $topic")
                onSuccess()
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error desuscribiendo del tema: $topic", e)
                onError(e)
            }
    }

    /**
     * Verifica si el permiso de notificaciones está concedido.
     * Solo necesario para Android 13 (API 33) y superior.
     */
    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Permiso no requerido en versiones anteriores
        }
    }

    /**
     * Verifica si las push notifications están realmente habilitadas para la app.
     * Incluye permiso runtime (Android 13+) y estado global de notificaciones.
     */
    fun arePushNotificationsEnabled(context: Context): Boolean {
        return hasNotificationPermission(context) &&
            NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    /**
     * Solicita el permiso de notificaciones.
     * Debe llamarse desde una Activity.
     *
     * @param permissionLauncher El ActivityResultLauncher para solicitar permisos
     */
    fun requestNotificationPermission(permissionLauncher: ActivityResultLauncher<String>) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /**
     * Temas disponibles para suscripción según el tipo de usuario.
     */
    object Topics {
        const val ALL_USERS = "all_users"
        const val CIUDADANOS = "ciudadanos"
        const val FUNCIONARIOS = "funcionarios"
        const val TTAIP = "ttaip"
        const val ADMIN = "admin"

        // Temas por entidad
        fun entidad(entidadId: String) = "entidad_$entidadId"
    }

    /**
     * Suscribe al usuario según su tipo.
     */
    fun subscribeUserByType(tipoUsuario: String, entidadId: String? = null) {
        // Suscribir a todos los usuarios
        subscribeToTopic(Topics.ALL_USERS)

        // Suscribir según tipo
        when (tipoUsuario.uppercase()) {
            "CIUDADANO" -> subscribeToTopic(Topics.CIUDADANOS)
            "FUNCIONARIO" -> {
                subscribeToTopic(Topics.FUNCIONARIOS)
                entidadId?.let { subscribeToTopic(Topics.entidad(it)) }
            }
            "TTAIP" -> subscribeToTopic(Topics.TTAIP)
            "ADMIN" -> subscribeToTopic(Topics.ADMIN)
        }
    }

    /**
     * Desuscribe al usuario de todos los temas (para logout).
     */
    fun unsubscribeAll(tipoUsuario: String, entidadId: String? = null) {
        unsubscribeFromTopic(Topics.ALL_USERS)
        unsubscribeFromTopic(Topics.CIUDADANOS)
        unsubscribeFromTopic(Topics.FUNCIONARIOS)
        unsubscribeFromTopic(Topics.TTAIP)
        unsubscribeFromTopic(Topics.ADMIN)
        entidadId?.let { unsubscribeFromTopic(Topics.entidad(it)) }
    }

    /**
     * Registra el token FCM en el backend Spring Boot.
     *
     * La app ya no escribe tokens en Firestore. El backend debe exponer el endpoint
     * de registro de token y usarlo para enviar FCM desde servidor.
     */
    fun registerTokenWithBackend(token: String) {
        val coordinator = pushTokenSyncCoordinator
        if (coordinator == null) {
            Log.w(TAG, "Coordinador push aún no inicializado")
            return
        }
        coordinator.registrarEnSegundoPlano(token)
    }

    /**
     * Revoca el token FCM en el backend Spring Boot durante logout.
     */
    suspend fun unregisterTokenFromBackend() {
        pushTokenSyncCoordinator?.revocarActualSiEsPosible()
    }
}
