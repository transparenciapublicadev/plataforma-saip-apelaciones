package com.gestion.misaip.core.data.repository

import java.io.IOException

/**
 * Usa cache local solo para fallas reales de conectividad.
 * Los rechazos HTTP y errores de contrato se propagan para no ocultar problemas backend.
 */
internal suspend fun <T> withOfflinePageFallback(
    remote: suspend () -> T,
    local: suspend () -> T
): T {
    return try {
        remote()
    } catch (_: IOException) {
        local()
    }
}
