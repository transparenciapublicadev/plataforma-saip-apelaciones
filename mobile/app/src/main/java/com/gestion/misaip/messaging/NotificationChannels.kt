package com.gestion.misaip.messaging

/**
 * Constantes de canales de notificación.
 * Centraliza los IDs usados en MiSaipApplication, NotificationPushHelper y MiSaipMessagingService.
 */
object NotificationChannels {
    /** Canal genérico por defecto (FCM default) */
    const val GENERAL = "misaip_notifications"

    /** Canal para solicitudes SAIP (nuevas, respuestas, subsanaciones) */
    const val SAIP = "saip_solicitudes"

    /** Canal para apelaciones TTAIP (calificaciones, resoluciones) */
    const val TTAIP = "ttaip_apelaciones"

    /** Canal para alertas urgentes (vencimientos, silencio administrativo) */
    const val ALERTAS = "alertas_urgentes"

    /**
     * Obtiene el canal adecuado según el tipo de notificación.
     */
    fun obtenerCanalPorTipo(tipo: String): String = when (tipo) {
        "nueva_solicitud", "respuesta_entidad", "subsanacion_requerida" -> SAIP
        "nueva_apelacion", "calificacion_ttaip", "resolucion_ttaip",
        "subsanacion_presentada" -> TTAIP
        "vencimiento_plazo", "silencio_administrativo" -> ALERTAS
        else -> GENERAL
    }
}
