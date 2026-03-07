package com.gestion.misaip.core.common.util

import java.text.SimpleDateFormat
import java.util.*

/**
 * Utilidades para manejo de fechas con soporte para días hábiles peruanos.
 *
 * Considera feriados oficiales del Perú para el cálculo de plazos SAIP.
 */
object DateUtils {

    private val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale("es", "PE"))
    private val dateTimeFormat = SimpleDateFormat("dd MMM yyyy HH:mm", Locale("es", "PE"))
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    /**
     * Feriados oficiales del Perú (2024-2026)
     */
    private val FERIADOS_PERU = setOf(
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
     * Verifica si una fecha es día hábil (no fin de semana ni feriado).
     */
    fun esDiaHabil(fecha: Date): Boolean {
        val calendar = Calendar.getInstance().apply { time = fecha }
        val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)

        // Sábado o domingo no son días hábiles
        if (dayOfWeek == Calendar.SATURDAY || dayOfWeek == Calendar.SUNDAY) {
            return false
        }

        // Verificar si es feriado
        val fechaStr = isoFormat.format(fecha)
        return fechaStr !in FERIADOS_PERU
    }

    /**
     * Agrega días hábiles a una fecha.
     *
     * @param fechaInicio Fecha de inicio
     * @param diasHabiles Cantidad de días hábiles a agregar
     * @return Nueva fecha después de agregar los días hábiles
     */
    fun agregarDiasHabiles(fechaInicio: Date, diasHabiles: Int): Date {
        val calendar = Calendar.getInstance().apply { time = fechaInicio }
        var diasAgregados = 0

        while (diasAgregados < diasHabiles) {
            calendar.add(Calendar.DAY_OF_MONTH, 1)
            if (esDiaHabil(calendar.time)) {
                diasAgregados++
            }
        }

        return calendar.time
    }

    /**
     * Calcula los días hábiles transcurridos entre dos fechas.
     */
    fun calcularDiasHabilesTranscurridos(fechaInicio: Date, fechaFin: Date): Int {
        val calendar = Calendar.getInstance().apply { time = fechaInicio }
        var dias = 0

        while (calendar.time.before(fechaFin)) {
            calendar.add(Calendar.DAY_OF_MONTH, 1)
            if (esDiaHabil(calendar.time)) {
                dias++
            }
        }

        return dias
    }

    /**
     * Calcula los días hábiles restantes hasta una fecha límite.
     * Retorna negativo si la fecha ya venció.
     */
    fun calcularDiasHabilesRestantes(fechaLimite: Date): Int {
        val hoy = Date()
        return if (hoy.after(fechaLimite) || hoy == fechaLimite) {
            -calcularDiasHabilesTranscurridos(fechaLimite, hoy)
        } else {
            calcularDiasHabilesTranscurridos(hoy, fechaLimite)
        }
    }

    /**
     * Formatea una fecha a formato legible (dd MMM yyyy).
     */
    fun formatearFecha(fecha: Date): String = dateFormat.format(fecha)

    /**
     * Formatea una fecha con hora (dd MMM yyyy HH:mm).
     */
    fun formatearFechaHora(fecha: Date): String = dateTimeFormat.format(fecha)

    /**
     * Parsea una fecha en formato ISO (yyyy-MM-dd).
     */
    fun parsearFechaIso(fechaStr: String): Date? {
        return try {
            isoFormat.parse(fechaStr)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Obtiene la fecha actual.
     */
    fun ahora(): Date = Date()

    /**
     * Obtiene el timestamp actual en milisegundos.
     */
    fun timestampActual(): Long = System.currentTimeMillis()
}

