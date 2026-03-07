package com.gestion.misaip.core.domain.util

/**
 * Utilidades para cálculo de días hábiles según normativa peruana.
 *
 * Según la Ley N° 27806, los plazos se computan en días hábiles,
 * excluyendo sábados, domingos y feriados nacionales.
 *
 * Kotlin Puro - Sin dependencias de Android ni Firebase.
 */
object DiasHabilesUtil {

    /**
     * Feriados nacionales de Perú 2024-2026
     * Formato: Lista de timestamps en milisegundos
     */
    private val FERIADOS_PERU_STRINGS: List<String> = listOf(
        // 2024
        "2024-01-01", "2024-03-28", "2024-03-29", "2024-05-01", "2024-06-07", "2024-06-29",
        "2024-07-23", "2024-07-28", "2024-07-29", "2024-08-06", "2024-08-30", "2024-10-08",
        "2024-11-01", "2024-12-08", "2024-12-09", "2024-12-25",
        // 2025
        "2025-01-01", "2025-04-17", "2025-04-18", "2025-05-01", "2025-06-07", "2025-06-29",
        "2025-07-23", "2025-07-28", "2025-07-29", "2025-08-06", "2025-08-30", "2025-10-08",
        "2025-11-01", "2025-12-08", "2025-12-09", "2025-12-25",
        // 2026
        "2026-01-01", "2026-04-02", "2026-04-03", "2026-05-01", "2026-06-07", "2026-06-29",
        "2026-07-23", "2026-07-28", "2026-07-29", "2026-08-06", "2026-08-30", "2026-10-08",
        "2026-11-01", "2026-12-08", "2026-12-09", "2026-12-25"
    )

    /**
     * Convierte string de fecha a timestamp (milisegundos desde epoch).
     * Formato esperado: "YYYY-MM-DD"
     */
    private fun stringToTimestamp(dateString: String): Long {
        val parts = dateString.split("-")
        val year = parts[0].toInt()
        val month = parts[1].toInt()
        val day = parts[2].toInt()

        // Cálculo simple de días desde epoch (1970-01-01)
        // Aproximación que funciona para fechas entre 2024-2030
        val daysFromEpoch = (year - 1970) * 365L +
            ((year - 1969) / 4) + // Años bisiestos
            getDaysUntilMonth(month, isLeapYear(year)) +
            day - 1

        return daysFromEpoch * 24L * 60L * 60L * 1000L
    }

    private fun getDaysUntilMonth(month: Int, isLeap: Boolean): Int {
        val daysInMonths = intArrayOf(0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        var days = 0
        for (i in 1 until month) {
            days += daysInMonths[i]
            if (i == 2 && isLeap) days += 1
        }
        return days
    }

    private fun isLeapYear(year: Int): Boolean {
        return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
    }

    /**
     * Verifica si un timestamp corresponde a un día hábil.
     * Un día hábil es aquel que no es sábado, domingo ni feriado.
     */
    fun esDiaHabil(timestamp: Long): Boolean {
        // Calcular día de la semana (0 = Jueves según epoch 1970-01-01)
        val daysSinceEpoch = timestamp / (24L * 60L * 60L * 1000L)
        val dayOfWeek = ((daysSinceEpoch + 4) % 7).toInt() // 0 = Domingo, 6 = Sábado

        // Si es sábado (6) o domingo (0), no es hábil
        if (dayOfWeek == 0 || dayOfWeek == 6) return false

        // Verificar si es feriado
        val fechaStr = timestampToDateString(timestamp)
        if (FERIADOS_PERU_STRINGS.contains(fechaStr)) return false

        return true
    }

    /**
     * Convierte un timestamp a string de fecha "YYYY-MM-DD"
     */
    fun timestampToDateString(timestamp: Long): String {
        val totalDays = (timestamp / (24L * 60L * 60L * 1000L)).toInt()

        var year = 1970
        var remainingDays = totalDays

        while (true) {
            val daysInYear = if (isLeapYear(year)) 366 else 365
            if (remainingDays < daysInYear) break
            remainingDays -= daysInYear
            year++
        }

        val daysInMonths = if (isLeapYear(year))
            intArrayOf(31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        else
            intArrayOf(31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)

        var month = 0
        while (month < 12 && remainingDays >= daysInMonths[month]) {
            remainingDays -= daysInMonths[month]
            month++
        }

        val day = remainingDays + 1
        month += 1

        return "${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}"
    }

    /**
     * Agrega días hábiles a una fecha.
     * @param fechaInicio Timestamp de inicio
     * @param dias Número de días hábiles a agregar
     * @return Timestamp de la fecha resultante
     */
    fun agregarDiasHabiles(fechaInicio: Long, dias: Int): Long {
        var resultado = fechaInicio
        var diasAgregados = 0
        val unDia = 24L * 60L * 60L * 1000L

        while (diasAgregados < dias) {
            resultado += unDia
            if (esDiaHabil(resultado)) {
                diasAgregados++
            }
        }

        return resultado
    }

    /**
     * Calcula los días hábiles transcurridos entre dos fechas.
     * @param fechaInicio Timestamp de inicio
     * @param fechaFin Timestamp de fin
     * @return Número de días hábiles
     */
    fun calcularDiasHabilesTranscurridos(fechaInicio: Long, fechaFin: Long): Int {
        var dias = 0
        var current = fechaInicio
        val unDia = 24L * 60L * 60L * 1000L

        while (current < fechaFin) {
            current += unDia
            if (esDiaHabil(current)) {
                dias++
            }
        }

        return dias
    }

    /**
     * Calcula los días hábiles restantes hasta una fecha límite.
     * @param fechaLimite Timestamp de la fecha límite
     * @return Días hábiles restantes (negativo si está vencido)
     */
    fun calcularDiasHabilesRestantes(fechaLimite: Long): Int {
        val ahora = System.currentTimeMillis()

        return if (ahora >= fechaLimite) {
            -calcularDiasHabilesTranscurridos(fechaLimite, ahora)
        } else {
            calcularDiasHabilesTranscurridos(ahora, fechaLimite)
        }
    }

    /**
     * Verifica si una solicitud está en periodo de observación (2 días hábiles).
     * Este periodo permite al funcionario revisar antes de responder.
     */
    fun puedeObservar(fechaCreacion: Long): Boolean {
        val diasTranscurridos = calcularDiasHabilesTranscurridos(fechaCreacion, System.currentTimeMillis())
        return diasTranscurridos <= 2
    }

    /**
     * Verifica si se ha producido silencio administrativo.
     * Según la Ley 27806, si no se responde en 10 días hábiles,
     * se configura silencio administrativo positivo.
     */
    fun esSilencioAdministrativo(fechaCreacion: Long, tieneRespuesta: Boolean): Boolean {
        if (tieneRespuesta) return false
        val diasTranscurridos = calcularDiasHabilesTranscurridos(fechaCreacion, System.currentTimeMillis())
        return diasTranscurridos > 10
    }

    /**
     * Calcula el deadline de una solicitud SAIP (10 días hábiles).
     */
    fun calcularDeadlineSAIP(fechaCreacion: Long): Long {
        return agregarDiasHabiles(fechaCreacion, 10)
    }

    /**
     * Calcula el deadline de una apelación TTAIP (7 días hábiles).
     */
    fun calcularDeadlineApelacion(fechaPresentacion: Long): Long {
        return agregarDiasHabiles(fechaPresentacion, 7)
    }

    /**
     * Calcula el plazo de apelación (15 días hábiles desde la notificación).
     */
    fun calcularPlazoApelacion(fechaNotificacion: Long): Long {
        return agregarDiasHabiles(fechaNotificacion, 15)
    }

    /**
     * Obtiene el timestamp actual.
     */
    fun ahora(): Long = System.currentTimeMillis()

    /**
     * Formatea un timestamp a una fecha legible.
     * Formato: "DD MMM YYYY"
     */
    fun formatearFecha(timestamp: Long): String {
        val dateStr = timestampToDateString(timestamp)
        val parts = dateStr.split("-")
        val day = parts[2].toInt()
        val month = parts[1].toInt()
        val year = parts[0]

        val meses = arrayOf(
            "Ene", "Feb", "Mar", "Abr", "May", "Jun",
            "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
        )

        return "$day ${meses[month - 1]} $year"
    }

    /**
     * Formatea un timestamp a una fecha y hora legible.
     * Formato: "DD MMM YYYY HH:MM"
     */
    fun formatearFechaHora(timestamp: Long): String {
        val fecha = formatearFecha(timestamp)
        val horaDelDia = ((timestamp % (24L * 60L * 60L * 1000L)) / (60L * 1000L)).toInt()
        val horas = horaDelDia / 60
        val minutos = horaDelDia % 60

        return "$fecha ${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}"
    }

    /**
     * Calcula tiempo relativo ("Hace X horas", "Hace X días").
     */
    fun tiempoRelativo(timestamp: Long): String {
        val ahora = System.currentTimeMillis()
        val diferencia = ahora - timestamp

        val segundos = diferencia / 1000
        val minutos = segundos / 60
        val horas = minutos / 60
        val dias = horas / 24

        return when {
            minutos < 1 -> "Hace un momento"
            minutos < 60 -> "Hace $minutos min"
            horas < 24 -> "Hace $horas hora${if (horas > 1) "s" else ""}"
            dias < 7 -> "Hace $dias día${if (dias > 1) "s" else ""}"
            dias < 30 -> "Hace ${dias / 7} semana${if (dias / 7 > 1) "s" else ""}"
            else -> formatearFecha(timestamp)
        }
    }
}

