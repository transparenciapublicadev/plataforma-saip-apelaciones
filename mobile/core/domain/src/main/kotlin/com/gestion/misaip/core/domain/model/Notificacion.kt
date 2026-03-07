package com.gestion.misaip.core.domain.model

/**
 * Entidad de Dominio: Notificación del Sistema
 *
 * Representa una notificación generada por el sistema SAIP.
 * Las notificaciones son dinámicas basadas en el estado de solicitudes y apelaciones.
 *
 * Kotlin Puro - Sin dependencias de Android ni Firebase.
 */
data class Notificacion(
    val id: Long,
    val tipo: TipoNotificacion,
    val titulo: String,
    val mensaje: String,
    val fecha: Long,
    val leida: Boolean = false,
    val icono: String,
    val color: String,
    val expediente: String? = null,
    val usuarioId: String
) {
    /**
     * Verifica si la notificación está relacionada con un expediente.
     */
    val tieneExpediente: Boolean get() = expediente != null
}

/**
 * Tipos de notificación del sistema.
 */
enum class TipoNotificacion {
    // Ciudadano
    SOLICITUD_RECEPCIONADA,
    SOLICITUD_EN_REVISION,
    SOLICITUD_RESPONDIDA,
    SOLICITUD_DENEGADA,
    SOLICITUD_VENCIDA,
    APELACION_RECEPCIONADA,
    APELACION_EN_CALIFICACION,
    APELACION_FUNDADA,
    APELACION_INFUNDADA,
    APELACION_INADMISIBLE,
    SUBSANACION_REQUERIDA,
    CEDULA_RECIBIDA,
    PLAZO_VENCIMIENTO,
    BIENVENIDA,

    // Funcionario
    NUEVA_SOLICITUD_ASIGNADA,
    SOLICITUD_URGENTE,
    ORDEN_TTAIP,
    CEDULA_ENTIDAD,

    // TTAIP
    NUEVA_APELACION,
    APELACION_URGENTE,
    PLAZO_SUBSANACION_VENCIDO,
    RESOLUCION_EMITIDA,

    // Admin
    REPORTE_GENERADO,
    SISTEMA_MANTENIMIENTO,
    ESTADISTICAS_ACTUALIZADAS;

    companion object {
        fun fromString(value: String): TipoNotificacion {
            return when (value.lowercase().replace("-", "_").replace(" ", "_")) {
                "solicitud_recepcionada" -> SOLICITUD_RECEPCIONADA
                "solicitud_en_revision" -> SOLICITUD_EN_REVISION
                "solicitud_respondida", "respuesta" -> SOLICITUD_RESPONDIDA
                "solicitud_denegada", "denegada" -> SOLICITUD_DENEGADA
                "solicitud_vencida", "vencida" -> SOLICITUD_VENCIDA
                "apelacion_recepcionada" -> APELACION_RECEPCIONADA
                "apelacion_en_calificacion" -> APELACION_EN_CALIFICACION
                "apelacion_fundada", "apelacion-fundada" -> APELACION_FUNDADA
                "apelacion_infundada" -> APELACION_INFUNDADA
                "apelacion_inadmisible" -> APELACION_INADMISIBLE
                "subsanacion_requerida" -> SUBSANACION_REQUERIDA
                "cedula", "cedula_recibida" -> CEDULA_RECIBIDA
                "plazo", "plazo_vencimiento" -> PLAZO_VENCIMIENTO
                "bienvenida" -> BIENVENIDA
                "nueva_solicitud", "nueva_solicitud_asignada", "nueva-solicitud" -> NUEVA_SOLICITUD_ASIGNADA
                "solicitud_urgente" -> SOLICITUD_URGENTE
                "orden_ttaip", "orden-ttaip" -> ORDEN_TTAIP
                "cedula_entidad", "cedula-entidad" -> CEDULA_ENTIDAD
                "nueva_apelacion", "nueva-apelacion" -> NUEVA_APELACION
                "apelacion_urgente" -> APELACION_URGENTE
                "plazo_subsanacion_vencido", "plazo-vencimiento" -> PLAZO_SUBSANACION_VENCIDO
                "resolucion_emitida", "resolucion-emitida" -> RESOLUCION_EMITIDA
                "reporte", "reporte_generado" -> REPORTE_GENERADO
                "sistema", "sistema_mantenimiento" -> SISTEMA_MANTENIMIENTO
                "estadisticas", "estadisticas_actualizadas" -> ESTADISTICAS_ACTUALIZADAS
                else -> SOLICITUD_RECEPCIONADA
            }
        }
    }

    fun toDisplayString(): String = when (this) {
        SOLICITUD_RECEPCIONADA -> "Solicitud Recepcionada"
        SOLICITUD_EN_REVISION -> "Solicitud en Revisión"
        SOLICITUD_RESPONDIDA -> "Solicitud Respondida"
        SOLICITUD_DENEGADA -> "Solicitud Denegada"
        SOLICITUD_VENCIDA -> "Solicitud Vencida"
        APELACION_RECEPCIONADA -> "Apelación Recepcionada"
        APELACION_EN_CALIFICACION -> "Apelación en Calificación"
        APELACION_FUNDADA -> "Apelación Fundada"
        APELACION_INFUNDADA -> "Apelación Infundada"
        APELACION_INADMISIBLE -> "Apelación Inadmisible"
        SUBSANACION_REQUERIDA -> "Subsanación Requerida"
        CEDULA_RECIBIDA -> "Cédula Recibida"
        PLAZO_VENCIMIENTO -> "Plazo de Vencimiento"
        BIENVENIDA -> "Bienvenida"
        NUEVA_SOLICITUD_ASIGNADA -> "Nueva Solicitud Asignada"
        SOLICITUD_URGENTE -> "Solicitud Urgente"
        ORDEN_TTAIP -> "Orden del TTAIP"
        CEDULA_ENTIDAD -> "Cédula de Entidad"
        NUEVA_APELACION -> "Nueva Apelación"
        APELACION_URGENTE -> "Apelación Urgente"
        PLAZO_SUBSANACION_VENCIDO -> "Plazo de Subsanación Vencido"
        RESOLUCION_EMITIDA -> "Resolución Emitida"
        REPORTE_GENERADO -> "Reporte Generado"
        SISTEMA_MANTENIMIENTO -> "Mantenimiento del Sistema"
        ESTADISTICAS_ACTUALIZADAS -> "Estadísticas Actualizadas"
    }
}

