package com.gestion.misaip.data

/**
 * Modelos de estadísticas para los dashboards.
 * Calculadas a partir de los datos reales de Firebase/SQLite.
 */

// Estadísticas para el dashboard del ciudadano
data class EstadisticasCiudadano(
    val total: Int,
    val enProceso: Int,
    val respondidas: Int,
    val denegadas: Int
)

// Estadísticas para el dashboard de la entidad
data class EstadisticasEntidad(
    val pendientes: Int,
    val vencidas: Int,
    val respondidas: Int,
    val total: Int
)

// Estadísticas para el dashboard del TTAIP
data class EstadisticasTTAIP(
    val pendientesAdmision: Int,
    val enProceso: Int,
    val enSubsanacion: Int,
    val resueltas: Int,
    val total: Int
)
