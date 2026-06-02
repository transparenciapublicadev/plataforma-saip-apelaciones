package com.gestion.misaip.core.common.util

/**
 * Constantes globales de la aplicación SAIP.
 */
object Constants {

    // ===========================================
    // PLAZOS LEGALES (en días hábiles)
    // ===========================================

    /** Plazo para que la entidad responda una solicitud SAIP (Art. 11 TUO Ley 27806) */
    const val PLAZO_RESPUESTA_SAIP = 10

    /** Plazo para presentar apelación ante el TTAIP (Art. 11-B TUO Ley 27806) */
    const val PLAZO_APELACION = 15

    /** Plazo para subsanar una apelación ante el TTAIP */
    const val PLAZO_SUBSANACION = 3

    /** Plazo para que la entidad cumpla la orden del TTAIP */
    const val PLAZO_CUMPLIMIENTO_ORDEN = 5

    /** Plazo para emitir resolución TTAIP */
    const val PLAZO_RESOLUCION_TTAIP = 10

    // ===========================================
    // ESTADOS DE SOLICITUD SAIP
    // ===========================================

    object EstadoSolicitud {
        const val RECEPCIONADA = "Recepcionada"
        const val EN_REVISION = "En Revisión"
        const val PENDIENTE_INFORMACION = "Pendiente de Información"
        const val RESPONDIDA = "Respondida"
        const val DENEGADA = "Denegada"
        const val CONCLUIDA = "Concluida"
        const val VENCIDA = "Vencida"
    }

    // ===========================================
    // ESTADOS DE APELACIÓN
    // ===========================================

    object EstadoApelacion {
        const val PENDIENTE_ELEVACION = "Pendiente de Elevación"
        const val EN_CALIFICACION_1 = "En Primera Calificación"
        const val EN_SUBSANACION = "En Subsanación"
        const val EN_CALIFICACION_2 = "En Segunda Calificación"
        const val NOTIFICACION_SEGUNDA_CALIFICACION = "Notificación Segunda Calificación"
        const val EN_RESOLUCION = "En Resolución"
        const val RESUELTO = "Resuelto"
        const val TENER_POR_NO_PRESENTADO = "Tener por No Presentado"
        const val CONCLUSION_SUSTRACCION_MATERIA = "Conclusión por Sustracción de Materia"
        const val CONCLUSION_DESISTIMIENTO = "Conclusión por Desistimiento"
        const val RESUELTO_FUNDADO = "Resuelto - Fundado"
        const val RESUELTO_FUNDADO_EN_PARTE = "Resuelto - Fundado en Parte"
        const val RESUELTO_INFUNDADO = "Resuelto - Infundado"
        const val RESUELTO_INFUNDADO_EN_PARTE = "Resuelto - Infundado en Parte"
        const val RESUELTO_IMPROCEDENTE = "Resuelto - Improcedente"
    }

    // ===========================================
    // TIPOS DE USUARIO
    // ===========================================

    object TipoUsuario {
        const val CIUDADANO = "ciudadano"
        const val FUNCIONARIO = "funcionario"
        const val TTAIP = "ttaip"
        const val ADMIN = "admin"
    }

    // ===========================================
    // TIPOS DE SOLICITUD
    // ===========================================

    object TipoSolicitud {
        const val ACCESO_INFORMACION = "Acceso a Información"
        const val INFORMACION_ESPECIFICA = "Información Específica"
        const val COPIA_DOCUMENTOS = "Copia de Documentos"
    }

    // ===========================================
    // TIPOS DE DOCUMENTO
    // ===========================================

    object TipoDocumento {
        const val DNI = "DNI"
        const val CE = "CE"
        const val PASAPORTE = "Pasaporte"
        const val RUC = "RUC"
    }

    // ===========================================
    // PRIORIDADES
    // ===========================================

    object Prioridad {
        const val BAJA = "baja"
        const val MEDIA = "media"
        const val ALTA = "alta"
        const val URGENTE = "urgente"
    }

    // ===========================================
    // PREFIJOS DE EXPEDIENTE
    // ===========================================

    const val PREFIJO_SAIP = "SAIP"
    const val PREFIJO_TTAIP = "TTAIP"
    const val PREFIJO_CEDULA = "CED"

    // ===========================================
    // PATRONES REGEX
    // ===========================================

    val PATRON_DNI = Regex("^[0-9]{8}$")
    val PATRON_RUC = Regex("^[0-9]{11}$")
    val PATRON_EMAIL = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
    val PATRON_TELEFONO = Regex("^[0-9]{9}$")
    val PATRON_EXPEDIENTE_SAIP = Regex("^SAIP-[0-9]{4}-[0-9]{5}$")
    val PATRON_EXPEDIENTE_TTAIP = Regex("^TTAIP-[0-9]{4}-[0-9]{5}$")
}

