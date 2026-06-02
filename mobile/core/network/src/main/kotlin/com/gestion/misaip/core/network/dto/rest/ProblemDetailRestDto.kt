package com.gestion.misaip.core.network.dto.rest

import kotlinx.serialization.Serializable

/**
 * Representacion liviana de RFC 9457 Problem Details.
 *
 * `mensaje` se conserva temporalmente para respuestas legacy del backend.
 */
@Serializable
data class ProblemDetailRestDto(
    val type: String? = null,
    val title: String? = null,
    val status: Int? = null,
    val detail: String? = null,
    val instance: String? = null,
    val mensaje: String? = null
) {
    fun mensajeUsuario(): String? {
        return detail?.takeIf { it.isNotBlank() }
            ?: mensaje?.takeIf { it.isNotBlank() }
            ?: title?.takeIf { it.isNotBlank() }
    }
}
