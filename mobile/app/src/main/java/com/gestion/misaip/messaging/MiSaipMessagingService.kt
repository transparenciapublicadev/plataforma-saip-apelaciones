package com.gestion.misaip.messaging

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.gestion.misaip.MainActivity
import com.gestion.misaip.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

/**
 * Servicio para manejar notificaciones push de Firebase Cloud Messaging.
 */
class MiSaipMessagingService : FirebaseMessagingService(), KoinComponent {

    private val pushTokenSyncCoordinator: PushTokenSyncCoordinator by inject()

    companion object {
        private const val TAG = "MiSaipFCM"
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "Mensaje recibido de: ${remoteMessage.from}")

        // Verificar si hay datos
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Mensaje con datos recibido. Claves: ${remoteMessage.data.keys}")
            handleDataMessage(remoteMessage.data)
        }

        // Verificar si hay notificación
        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "Notificacion visual recibida")
            showNotification(
                title = notification.title ?: getString(R.string.app_name),
                body = notification.body ?: "",
                data = remoteMessage.data
            )
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Token FCM renovado")
        pushTokenSyncCoordinator.registrarEnSegundoPlano(token)
    }

    private fun handleDataMessage(data: Map<String, String>) {
        val tipo = data["tipo"] ?: "general"
        val expediente = data["expediente"]
        val titulo = data["titulo"] ?: getString(R.string.nueva_notificacion)
        val mensaje = data["mensaje"] ?: ""
        val notificationKey = data["notificationId"]
            ?: data["id"]
            ?: "fcm_${tipo}_${expediente ?: titulo}"

        // Procesar según el tipo de notificación
        when (tipo) {
            "nueva_solicitud" -> {
                Log.d(TAG, "Nueva solicitud: $expediente")
            }
            "respuesta_entidad" -> {
                Log.d(TAG, "Respuesta de entidad para: $expediente")
            }
            "nueva_apelacion" -> {
                Log.d(TAG, "Nueva apelación: $expediente")
            }
            "calificacion_ttaip" -> {
                Log.d(TAG, "Calificación TTAIP para: $expediente")
            }
            "subsanacion_requerida" -> {
                Log.d(TAG, "Subsanación requerida para: $expediente")
            }
            else -> {
                Log.d(TAG, "Notificación general")
            }
        }

        // Mostrar notificación local
        NotificationPushHelper.mostrarNotificacionLocal(
            tipo = tipo,
            titulo = titulo,
            mensaje = mensaje,
            expediente = expediente,
            notificationKey = notificationKey
        )
    }

    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val tipo = data["tipo"] ?: ""
        val expediente = data["expediente"]

        // Determinar canal según tipo de notificación
        val channelId = NotificationChannels.obtenerCanalPorTipo(tipo)

        // ID determinístico basado en contenido — evita duplicados en el notification shade
        val notificationId = ("fcm_${tipo}_${expediente ?: title}").hashCode() and Int.MAX_VALUE

        // Intent al tocar la notificación
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            expediente?.let { putExtra("EXPEDIENTE", it) }
            data["tipo"]?.let { putExtra("TIPO_NOTIFICACION", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Construir la notificación con agrupación por tipo
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        notificationManager.notify(notificationId, notification)
    }
}
