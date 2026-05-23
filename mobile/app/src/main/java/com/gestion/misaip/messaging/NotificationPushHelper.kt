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
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Helper de notificaciones push en modo FCM-only.
 *
 * La app mobile ya no usa Firebase Auth ni Firestore como backend. La emision real
 * de notificaciones debe realizarla el backend Spring Boot, que luego enviara FCM.
 * Este helper conserva la API interna usada por los ViewModels, registra topics y
 * emite senales locales para refrescar pantallas cuando llega un mensaje FCM.
 */
object NotificationPushHelper {

    private const val TAG = "NotificationPush"
    private lateinit var appContext: Context

    private const val PREFS_NAME = "misaip_notification_prefs"
    private const val KEY_PROCESSED_IDS = "processed_ids"

    private const val GROUP_SAIP = "misaip_group_saip"
    private const val GROUP_TTAIP = "misaip_group_ttaip"
    private const val GROUP_ALERTAS = "misaip_group_alertas"
    private const val GROUP_GENERAL = "misaip_group_general"

    private val _refreshSignal = MutableSharedFlow<String>(extraBufferCapacity = 10)
    val refreshSignal: SharedFlow<String> = _refreshSignal.asSharedFlow()

    private var usuarioIdActual: String? = null
    private var topicsUsuarioActual: List<String> = emptyList()

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    fun limpiarDatosSesion() {
        if (::appContext.isInitialized) {
            appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
        }
        usuarioIdActual = null
        topicsUsuarioActual = emptyList()
        Log.d(TAG, "Datos locales de notificaciones limpiados")
    }

    fun iniciarEscuchaNotificaciones(
        usuarioId: String,
        tipoUsuario: String,
        entidadId: String? = null
    ) {
        usuarioIdActual = usuarioId
        topicsUsuarioActual = construirTopicsUsuario(tipoUsuario, entidadId)

        if (::appContext.isInitialized) {
            val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancelAll()
        }

        Log.d(
            TAG,
            "FCM-only activo para usuario=$usuarioId, tipo=$tipoUsuario, topics=$topicsUsuarioActual"
        )
    }

    fun detenerEscuchaNotificaciones() {
        usuarioIdActual = null
        topicsUsuarioActual = emptyList()
        Log.d(TAG, "Escucha local de notificaciones detenida")
    }

    fun publicarRefresh(tipo: String) {
        _refreshSignal.tryEmit(tipo)
    }

    fun enviarATopic(
        tipo: String,
        topic: String,
        titulo: String,
        mensaje: String,
        expediente: String? = null,
        datos: Map<String, String> = emptyMap()
    ) {
        registrarEventoBackend(tipo, "topic", topic, titulo, mensaje, expediente, datos)
    }

    fun enviarAUsuario(
        tipo: String,
        usuarioId: String,
        titulo: String,
        mensaje: String,
        expediente: String? = null,
        datos: Map<String, String> = emptyMap()
    ) {
        registrarEventoBackend(tipo, "usuario", usuarioId, titulo, mensaje, expediente, datos)
    }

    fun notificarNuevaSolicitud(
        expedienteSaip: String,
        entidadId: String,
        entidadNombre: String,
        solicitante: String
    ) {
        enviarATopic(
            tipo = "nueva_solicitud",
            topic = FCMHelper.Topics.entidad(entidadId),
            titulo = appContext.getString(R.string.push_nueva_solicitud_titulo),
            mensaje = appContext.getString(R.string.push_nueva_solicitud_msg, expedienteSaip, solicitante, entidadNombre),
            expediente = expedienteSaip,
            datos = mapOf("entidadId" to entidadId)
        )
    }

    fun notificarRespuestaEntidad(
        expedienteSaip: String,
        usuarioId: String,
        tipoRespuesta: String,
        entidadNombre: String
    ) {
        val descripcionRespuesta = when (tipoRespuesta) {
            "ENTREGA_TOTAL" -> appContext.getString(R.string.push_tipo_entrega_total)
            "ENTREGA_PARCIAL" -> appContext.getString(R.string.push_tipo_entrega_parcial)
            "DENEGACION_TOTAL" -> appContext.getString(R.string.push_tipo_denegacion)
            "SILENCIO_ADMINISTRATIVO" -> appContext.getString(R.string.push_tipo_silencio)
            else -> appContext.getString(R.string.push_tipo_respuesta)
        }

        enviarAUsuario(
            tipo = "respuesta_entidad",
            usuarioId = usuarioId,
            titulo = appContext.getString(R.string.push_respuesta_titulo, expedienteSaip),
            mensaje = appContext.getString(R.string.push_respuesta_msg, entidadNombre, descripcionRespuesta),
            expediente = expedienteSaip,
            datos = mapOf("tipoRespuesta" to tipoRespuesta)
        )
    }

    fun notificarNuevaApelacion(
        expedienteApelacion: String,
        saipOrigen: String,
        recurrente: String,
        entidadNombre: String
    ) {
        enviarATopic(
            tipo = "nueva_apelacion",
            topic = FCMHelper.Topics.TTAIP,
            titulo = appContext.getString(R.string.push_nueva_apelacion_titulo),
            mensaje = appContext.getString(R.string.push_nueva_apelacion_msg, expedienteApelacion, recurrente, entidadNombre, saipOrigen),
            expediente = expedienteApelacion,
            datos = mapOf("saipOrigen" to saipOrigen)
        )
    }

    fun notificarCalificacionTTAIP(
        expediente: String,
        usuarioId: String,
        resultado: String,
        tipoCalificacion: String
    ) {
        val descripcion = when (resultado.uppercase()) {
            "ADMISIBLE", "ADMISION" -> appContext.getString(R.string.push_resultado_admitida)
            "INADMISIBLE" -> appContext.getString(R.string.push_resultado_inadmisible)
            "IMPROCEDENTE" -> appContext.getString(R.string.push_resultado_improcedente)
            else -> resultado
        }
        val tipoCalf = if (tipoCalificacion == "primera") "Primera" else "Segunda"

        enviarAUsuario(
            tipo = "calificacion_ttaip",
            usuarioId = usuarioId,
            titulo = appContext.getString(R.string.push_calificacion_titulo, tipoCalf, expediente),
            mensaje = appContext.getString(R.string.push_calificacion_msg, tipoCalf, descripcion),
            expediente = expediente,
            datos = mapOf("resultado" to resultado, "tipoCalificacion" to tipoCalificacion)
        )

        if (resultado.uppercase() == "INADMISIBLE") {
            enviarAUsuario(
                tipo = "subsanacion_requerida",
                usuarioId = usuarioId,
                titulo = appContext.getString(R.string.push_subsanacion_requerida_titulo, expediente),
                mensaje = appContext.getString(R.string.push_subsanacion_requerida_msg),
                expediente = expediente
            )
        }
    }

    fun notificarSubsanacionPresentada(
        expediente: String,
        recurrente: String
    ) {
        enviarATopic(
            tipo = "subsanacion_presentada",
            topic = FCMHelper.Topics.TTAIP,
            titulo = appContext.getString(R.string.push_subsanacion_presentada_titulo, expediente),
            mensaje = appContext.getString(R.string.push_subsanacion_presentada_msg, recurrente, expediente),
            expediente = expediente
        )
    }

    fun notificarVencimientoProximo(
        expedienteSaip: String,
        entidadId: String,
        diasRestantes: Int
    ) {
        enviarATopic(
            tipo = "vencimiento_plazo",
            topic = FCMHelper.Topics.entidad(entidadId),
            titulo = appContext.getString(R.string.push_vencimiento_titulo),
            mensaje = appContext.getString(R.string.push_vencimiento_msg, expedienteSaip, diasRestantes),
            expediente = expedienteSaip
        )
    }

    fun notificarSilencioAdministrativo(
        expedienteSaip: String,
        usuarioId: String,
        entidadNombre: String
    ) {
        enviarAUsuario(
            tipo = "silencio_administrativo",
            usuarioId = usuarioId,
            titulo = appContext.getString(R.string.push_silencio_titulo, expedienteSaip),
            mensaje = appContext.getString(R.string.push_silencio_msg, entidadNombre),
            expediente = expedienteSaip
        )
    }

    fun mostrarNotificacionLocal(
        tipo: String,
        titulo: String,
        mensaje: String,
        expediente: String?,
        notificationKey: String
    ) {
        if (!::appContext.isInitialized) {
            Log.w(TAG, "NotificationPushHelper no inicializado, omitiendo notificacion local")
            return
        }

        if (estaYaProcesado(notificationKey)) {
            return
        }

        guardarComoProcesado(notificationKey)
        publicarRefresh(tipo)

        val notificationManager =
            appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = NotificationChannels.obtenerCanalPorTipo(tipo)
        val notificationId = notificationKey.hashCode() and Int.MAX_VALUE
        val groupKey = obtenerGroupKey(tipo)

        val intent = Intent(appContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (!expediente.isNullOrBlank()) {
                putExtra("EXPEDIENTE", expediente)
                putExtra("TIPO_NOTIFICACION", tipo)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            appContext,
            notificationId,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(appContext, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(titulo)
            .setContentText(mensaje)
            .setAutoCancel(true)
            .setGroup(groupKey)
            .setPriority(
                if (tipo in listOf("vencimiento_plazo", "silencio_administrativo")) {
                    NotificationCompat.PRIORITY_MAX
                } else {
                    NotificationCompat.PRIORITY_HIGH
                }
            )
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(mensaje))
            .build()

        notificationManager.notify(notificationId, notification)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val summaryNotification = NotificationCompat.Builder(appContext, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(appContext.getString(R.string.app_name))
                .setGroupSummary(true)
                .setGroup(groupKey)
                .setAutoCancel(true)
                .build()
            notificationManager.notify(groupKey.hashCode(), summaryNotification)
        }
    }

    private fun registrarEventoBackend(
        tipo: String,
        destinoTipo: String,
        destinoValor: String,
        titulo: String,
        mensaje: String,
        expediente: String?,
        datos: Map<String, String>
    ) {
        _refreshSignal.tryEmit(tipo)
        Log.d(
            TAG,
            "Evento push delegado al backend: tipo=$tipo, destino=$destinoTipo/$destinoValor, expediente=$expediente, titulo=$titulo, datos=$datos"
        )
    }

    private fun construirTopicsUsuario(tipoUsuario: String, entidadId: String?): List<String> {
        val topics = mutableListOf(FCMHelper.Topics.ALL_USERS)
        when (tipoUsuario.uppercase()) {
            "CIUDADANO" -> topics.add(FCMHelper.Topics.CIUDADANOS)
            "FUNCIONARIO" -> {
                topics.add(FCMHelper.Topics.FUNCIONARIOS)
                entidadId?.let { topics.add(FCMHelper.Topics.entidad(it)) }
            }
            "TTAIP" -> topics.add(FCMHelper.Topics.TTAIP)
            "ADMIN" -> topics.add(FCMHelper.Topics.ADMIN)
        }
        return topics
    }

    private fun obtenerGroupKey(tipo: String): String = when (tipo) {
        "nueva_solicitud", "respuesta_entidad", "subsanacion_requerida" -> GROUP_SAIP
        "nueva_apelacion", "calificacion_ttaip", "resolucion_ttaip", "subsanacion_presentada" -> GROUP_TTAIP
        "vencimiento_plazo", "silencio_administrativo" -> GROUP_ALERTAS
        else -> GROUP_GENERAL
    }

    private fun estaYaProcesado(docId: String): Boolean {
        if (!::appContext.isInitialized) return false
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getStringSet(KEY_PROCESSED_IDS, emptySet())?.contains(docId) == true
    }

    private fun guardarComoProcesado(docId: String) {
        if (!::appContext.isInitialized) return
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet(KEY_PROCESSED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        ids.add(docId)
        prefs.edit().putStringSet(KEY_PROCESSED_IDS, ids).apply()
    }
}
