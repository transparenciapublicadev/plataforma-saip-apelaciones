package com.gestion.misaip.messaging

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.gestion.misaip.R
import com.gestion.misaip.MainActivity
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Helper para enviar notificaciones push a otros usuarios del sistema.
 *
 * Estrategia:
 * 1. Escribe un documento en Firestore `notificaciones_push/` como cola de envío.
 *    Cuando se desplieguen Cloud Functions, estas procesarán la cola y enviarán FCM real.
 * 2. Muestra una notificación local inmediata para confirmar la acción al usuario actual.
 *
 * Tipos de notificación soportados:
 * - nueva_solicitud: Ciudadano crea SAIP → notifica a funcionarios de la entidad
 * - respuesta_entidad: Funcionario responde → notifica al ciudadano
 * - nueva_apelacion: Ciudadano apela → notifica al TTAIP
 * - calificacion_ttaip: TTAIP califica → notifica al ciudadano
 * - subsanacion_requerida: TTAIP declara inadmisible → notifica al ciudadano
 * - subsanacion_presentada: Ciudadano presenta subsanación → notifica al TTAIP
 * - resolucion_ttaip: TTAIP emite resolución → notifica a ciudadano y entidad
 * - vencimiento_plazo: Solicitud próxima a vencer → notifica al funcionario
 * - silencio_administrativo: Plazo vencido → notifica al ciudadano
 *
 * Inicializar en MiSaipApplication.onCreate() con NotificationPushHelper.init(this)
 */
object NotificationPushHelper {

    private const val TAG = "NotificationPush"
    private const val COLLECTION = "notificaciones_push"
    private const val FIRESTORE_DB = "misaipdb"
    private lateinit var appContext: Context

    // Listener único de Firestore para recibir notificaciones en tiempo real
    private var listenerNotificaciones: ListenerRegistration? = null

    // ── Deduplicación persistente via SharedPreferences ──
    // Reemplaza el antiguo idsPreExistentes (in-memory) que se perdía entre reinicios
    private const val PREFS_NAME = "misaip_notification_prefs"
    private const val KEY_PROCESSED_IDS = "processed_ids"
    private const val KEY_LAST_CLEANUP = "last_cleanup"
    private const val CLEANUP_INTERVAL_MS = 7L * 24 * 60 * 60 * 1000 // 7 días
    private const val MAX_PROCESSED_IDS = 500

    // ── Agrupación de notificaciones por canal ──
    private const val GROUP_SAIP = "misaip_group_saip"
    private const val GROUP_TTAIP = "misaip_group_ttaip"
    private const val GROUP_ALERTAS = "misaip_group_alertas"
    private const val GROUP_GENERAL = "misaip_group_general"

    // Señal para notificar a los ViewModels que hay datos nuevos disponibles.
    // Emite el tipo de notificación recibida para que los dashboards sincronicen.
    private val _refreshSignal = MutableSharedFlow<String>(extraBufferCapacity = 10)
    val refreshSignal: SharedFlow<String> = _refreshSignal.asSharedFlow()

    // Criterios de matching del usuario actual (para filtrar client-side)
    private var usuarioIdActual: String? = null
    private var topicsUsuarioActual: List<String> = emptyList()

    /**
     * Inicializa el helper con el contexto de la aplicación.
     * Debe llamarse desde MiSaipApplication.onCreate().
     */
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    // ── SharedPreferences: deduplicación persistente ──

    private fun estaYaProcesado(docId: String): Boolean {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getStringSet(KEY_PROCESSED_IDS, emptySet())?.contains(docId) == true
    }

    private fun guardarComoProcesado(docId: String) {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet(KEY_PROCESSED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        ids.add(docId)
        prefs.edit().putStringSet(KEY_PROCESSED_IDS, ids).apply()
    }

    /**
     * Limpia IDs procesados antiguos para evitar crecimiento ilimitado de SharedPreferences.
     * Se ejecuta máximo una vez cada 7 días.
     */
    private fun limpiarIdsAntiguos() {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastCleanup = prefs.getLong(KEY_LAST_CLEANUP, 0)
        val now = System.currentTimeMillis()
        if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
            val ids = prefs.getStringSet(KEY_PROCESSED_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
            if (ids.size > MAX_PROCESSED_IDS) {
                // Firestore enviado=true ya impide que reaparezcan; podemos limpiar
                ids.clear()
            }
            prefs.edit()
                .putStringSet(KEY_PROCESSED_IDS, ids)
                .putLong(KEY_LAST_CLEANUP, now)
                .apply()
            Log.d(TAG, "Limpieza periódica de IDs procesados completada (${ids.size} restantes)")
        }
    }

    /**
     * Limpia datos de sesión de notificaciones al cerrar sesión.
     * Evita que las notificaciones de un usuario afecten a otro.
     */
    fun limpiarDatosSesion() {
        if (::appContext.isInitialized) {
            appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().clear().apply()
            Log.d(TAG, "Datos de sesión de notificaciones limpiados")
        }
    }

    /**
     * Obtiene la clave de grupo para agrupar notificaciones del mismo tipo.
     */
    private fun obtenerGroupKey(tipo: String): String = when (tipo) {
        "nueva_solicitud", "respuesta_entidad", "subsanacion_requerida" -> GROUP_SAIP
        "nueva_apelacion", "calificacion_ttaip", "resolucion_ttaip",
        "subsanacion_presentada" -> GROUP_TTAIP
        "vencimiento_plazo", "silencio_administrativo" -> GROUP_ALERTAS
        else -> GROUP_GENERAL
    }

    // ═══════════════════════════════════════════════════════════════════
    // Escucha en tiempo real (reemplaza Cloud Functions mientras no estén desplegadas)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Inicia la escucha en tiempo real de notificaciones push dirigidas al usuario.
     *
     * Estrategia enterprise de deduplicación:
     * - SharedPreferences almacena IDs de notificaciones ya procesadas (persiste entre reinicios)
     * - Al abrir la app, se cancela las notificaciones del sistema (el usuario ya está en la app)
     * - Las notificaciones nuevas (llegadas mientras la app estaba cerrada) se muestran correctamente
     * - Las ya procesadas se ignoran incluso si Firestore no pudo marcar enviado=true
     *
     * Llamar desde SplashScreen (auto-login) o LoginViewModel (login manual).
     */
    fun iniciarEscuchaNotificaciones(
        usuarioId: String,
        tipoUsuario: String,
        entidadId: String? = null
    ) {
        // Detener escucha anterior si existe (ej: re-login sin logout)
        detenerEscuchaNotificaciones()

        // Guardar criterios de matching del usuario actual
        usuarioIdActual = usuarioId
        topicsUsuarioActual = construirTopicsUsuario(tipoUsuario, entidadId)

        Log.d(TAG, "Iniciando escucha de notificaciones para usuario=$usuarioId, tipo=$tipoUsuario, entidad=$entidadId")
        Log.d(TAG, "Topics suscritos: $topicsUsuarioActual")

        // Limpiar notificaciones del sistema — el usuario está activamente en la app
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancelAll()

        // Limpieza periódica de IDs procesados antiguos
        limpiarIdsAntiguos()

        // Log estado de Firebase Auth (requerido por Firestore security rules)
        val authUser = FirebaseAuth.getInstance().currentUser
        if (authUser != null) {
            Log.d(TAG, "Firebase Auth activo: uid=${authUser.uid}, email=${authUser.email}")
        } else {
            Log.e(TAG, "⚠️ Firebase Auth NO autenticado — el listener de Firestore será rechazado por security rules")
        }

        // Usar la base de datos nombrada 'misaipdb' (NO la default)
        val firestore = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), FIRESTORE_DB)

        // Iniciar listener directamente — la deduplicación se maneja con SharedPreferences
        // (elimina la race condition del antiguo get() + addSnapshotListener)
        listenerNotificaciones = firestore.collection(COLLECTION)
            .whereEqualTo("enviado", false)
            .addSnapshotListener { snapshots, error ->
                if (error != null) {
                    Log.e(TAG, "Error en listener de notificaciones: ${error.message}", error)
                    return@addSnapshotListener
                }

                snapshots?.documentChanges?.forEach { cambio ->
                    if (cambio.type == DocumentChange.Type.ADDED) {
                        procesarDocumento(cambio.document)
                    }
                }
            }
        Log.d(TAG, "Listener de Firestore iniciado correctamente")
    }

    /**
     * Detiene la escucha de notificaciones push en tiempo real.
     * Llamar desde ProfileViewModel al cerrar sesión.
     */
    fun detenerEscuchaNotificaciones() {
        listenerNotificaciones?.remove()
        listenerNotificaciones = null
        usuarioIdActual = null
        topicsUsuarioActual = emptyList()
        Log.d(TAG, "Escucha de notificaciones detenida")
    }

    /**
     * Procesa un documento individual de notificación.
     *
     * Deduplicación en dos capas:
     * 1. SharedPreferences local — persiste entre reinicios, el usuario nunca ve la misma notificación dos veces
     * 2. Firestore enviado=true — impide que el listener reciba el documento en futuras consultas
     *
     * Si ambas capas coinciden en que el doc es nuevo y es para el usuario actual,
     * muestra la notificación local y marca como enviada.
     */
    private fun procesarDocumento(doc: DocumentSnapshot) {
        val docId = doc.id

        // Capa 1: Deduplicación persistente via SharedPreferences
        if (estaYaProcesado(docId)) {
            // Reintentar marcar como enviado en Firestore (pudo haber fallado antes)
            doc.reference.update("enviado", true)
            return
        }

        val destinoTipo = doc.getString("destinoTipo") ?: return
        val destinoValor = doc.getString("destinoValor") ?: return

        // Verificar si esta notificación es para el usuario actual
        val esParaMi = when (destinoTipo) {
            "usuario" -> destinoValor == usuarioIdActual
            "topic" -> destinoValor in topicsUsuarioActual
            else -> false
        }

        if (!esParaMi) {
            Log.d(TAG, "Notificación $docId no es para mí (destino=$destinoTipo/$destinoValor)")
            return
        }

        val tipo = doc.getString("tipo") ?: ""
        val titulo = doc.getString("titulo") ?: ""
        val mensaje = doc.getString("mensaje") ?: ""
        val expediente = doc.getString("expediente")?.takeIf { it.isNotBlank() }

        Log.d(TAG, "✅ Notificación recibida para mí: tipo=$tipo, titulo=$titulo, docId=$docId")

        // Señalizar a dashboards y detail views que hay datos nuevos para sincronizar
        _refreshSignal.tryEmit(tipo)

        // Mostrar notificación local al destinatario (ID determinístico basado en docId)
        mostrarNotificacionLocal(tipo, titulo, mensaje, expediente, docId)

        // Capa 1: Marcar como procesado localmente (persiste entre reinicios)
        guardarComoProcesado(docId)

        // Capa 2: Marcar como enviada en Firestore (evita futuras consultas)
        doc.reference.update("enviado", true)
            .addOnSuccessListener {
                Log.d(TAG, "Notificación $docId marcada como enviada en Firestore")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error marcando notificación $docId como enviada (se reintentará)", e)
            }
    }

    /**
     * Construye la lista de topics FCM a los que está suscrito el usuario según su rol.
     */
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

    /**
     * Envía una notificación push a un topic (grupo de usuarios).
     * Solo encola en Firestore — la notificación se muestra en los dispositivos
     * de destino cuando Cloud Functions procesen la cola y envíen el FCM real.
     */
    fun enviarATopic(
        tipo: String,
        topic: String,
        titulo: String,
        mensaje: String,
        expediente: String? = null,
        datos: Map<String, String> = emptyMap()
    ) {
        encolarEnFirestore(tipo, "topic", topic, titulo, mensaje, expediente, datos)
    }

    /**
     * Envía una notificación push a un usuario específico por su ID.
     * Solo encola en Firestore — la notificación se muestra en el dispositivo
     * del destinatario cuando Cloud Functions procesen la cola.
     */
    fun enviarAUsuario(
        tipo: String,
        usuarioId: String,
        titulo: String,
        mensaje: String,
        expediente: String? = null,
        datos: Map<String, String> = emptyMap()
    ) {
        encolarEnFirestore(tipo, "usuario", usuarioId, titulo, mensaje, expediente, datos)
    }

    /**
     * Escribe un documento de notificación en la cola de Firestore.
     */
    private fun encolarEnFirestore(
        tipo: String,
        destinoTipo: String,
        destinoValor: String,
        titulo: String,
        mensaje: String,
        expediente: String?,
        datos: Map<String, String>
    ) {
        // Verificar estado Firebase Auth (requerido por Firestore security rules)
        val authUser = FirebaseAuth.getInstance().currentUser
        if (authUser == null) {
            Log.e(TAG, "⚠️ Firebase Auth NO autenticado — la escritura a notificaciones_push será rechazada por security rules")
        } else {
            Log.d(TAG, "Encolando notificación con auth uid=${authUser.uid}")
        }

        val notificacion = hashMapOf(
            "tipo" to tipo,
            "destinoTipo" to destinoTipo,
            "destinoValor" to destinoValor,
            "titulo" to titulo,
            "mensaje" to mensaje,
            "expediente" to (expediente ?: ""),
            "datos" to datos,
            "timestamp" to System.currentTimeMillis(),
            "enviado" to false,
            "plataforma" to "android"
        )

        FirebaseFirestore.getInstance(FirebaseApp.getInstance(), FIRESTORE_DB)
            .collection(COLLECTION)
            .add(notificacion)
            .addOnSuccessListener { docRef ->
                Log.d(TAG, "Notificación encolada: ${docRef.id} → $destinoTipo=$destinoValor, tipo=$tipo")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Error encolando notificación push", e)
            }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Métodos de conveniencia para cada módulo
    // ═══════════════════════════════════════════════════════════════════

    /**
     * CIUDADANO crea solicitud SAIP → Notificar a funcionarios de la entidad.
     */
    fun notificarNuevaSolicitud(
        expedienteSaip: String,
        entidadId: String,
        entidadNombre: String,
        solicitante: String
    ) {
        enviarATopic(
            tipo = "nueva_solicitud",
            topic = "entidad_$entidadId",
            titulo = appContext.getString(R.string.push_nueva_solicitud_titulo),
            mensaje = appContext.getString(R.string.push_nueva_solicitud_msg, expedienteSaip, solicitante, entidadNombre),
            expediente = expedienteSaip,
            datos = mapOf("entidadId" to entidadId)
        )
    }

    /**
     * FUNCIONARIO responde solicitud → Notificar al ciudadano solicitante.
     */
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

    /**
     * CIUDADANO crea apelación → Notificar al TTAIP.
     */
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

    /**
     * TTAIP califica apelación → Notificar al ciudadano.
     */
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

        // Si es inadmisible, enviar notificación adicional de subsanación requerida
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

    /**
     * CIUDADANO presenta subsanación → Notificar al TTAIP.
     */
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

    /**
     * Alerta de vencimiento próximo → Notificar al funcionario.
     */
    fun notificarVencimientoProximo(
        expedienteSaip: String,
        entidadId: String,
        diasRestantes: Int
    ) {
        enviarATopic(
            tipo = "vencimiento_plazo",
            topic = "entidad_$entidadId",
            titulo = appContext.getString(R.string.push_vencimiento_titulo),
            mensaje = appContext.getString(R.string.push_vencimiento_msg, expedienteSaip, diasRestantes),
            expediente = expedienteSaip
        )
    }

    /**
     * Silencio administrativo negativo → Notificar al ciudadano.
     */
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

    // ═══════════════════════════════════════════════════════════════════
    // Notificación local
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Muestra una notificación local en el dispositivo actual.
     *
     * Mejoras enterprise:
     * - ID determinístico basado en docId (evita duplicados en el shade)
     * - Agrupación por tipo de canal (SAIP, TTAIP, alertas)
     * - Notificación resumen para el grupo (API 24+)
     */
    private fun mostrarNotificacionLocal(
        tipo: String,
        titulo: String,
        mensaje: String,
        expediente: String?,
        docId: String
    ) {
        if (!::appContext.isInitialized) {
            Log.w(TAG, "NotificationPushHelper no inicializado, omitiendo notificación local")
            return
        }

        try {
            val notificationManager =
                appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Seleccionar canal según tipo
            val channelId = NotificationChannels.obtenerCanalPorTipo(tipo)

            // ID determinístico — la misma notificación siempre usa el mismo ID del sistema,
            // evitando duplicados en el notification shade
            val notificationId = docId.hashCode() and Int.MAX_VALUE

            // Clave de grupo para agrupar notificaciones del mismo dominio
            val groupKey = obtenerGroupKey(tipo)

            // Intent al tocar la notificación
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
                    if (tipo in listOf("vencimiento_plazo", "silencio_administrativo"))
                        NotificationCompat.PRIORITY_MAX
                    else NotificationCompat.PRIORITY_HIGH
                )
                .setContentIntent(pendingIntent)
                .setStyle(NotificationCompat.BigTextStyle().bigText(mensaje))
                .build()

            notificationManager.notify(notificationId, notification)

            // Notificación resumen del grupo (Android 7.0+) — agrupa notificaciones
            // del mismo dominio bajo un solo encabezado colapsable
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

            Log.d(TAG, "Notificación local mostrada: tipo=$tipo, id=$notificationId, grupo=$groupKey")
        } catch (e: Exception) {
            Log.e(TAG, "Error mostrando notificación local", e)
        }
    }
}
