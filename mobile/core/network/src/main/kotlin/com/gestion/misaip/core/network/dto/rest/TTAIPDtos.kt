package com.gestion.misaip.core.network.dto.rest

import kotlinx.serialization.Serializable

/**
 * Request para calificación de apelación por miembro TTAIP.
 * Mapea a CalificacionRequest del backend.
 */
@Serializable
data class CalificacionRestRequest(
    val fundamentos: String,
    val miembroId: Long? = null,
    val observaciones: String? = null,
    val diasSubsanacion: Int? = null
)

/**
 * Request para resolución final de apelación.
 * Mapea a ResolucionRequest del backend.
 */
@Serializable
data class ResolucionRestRequest(
    val fundamentos: String,
    val fundamentoLegal: String? = null,
    val observaciones: String? = null,
    val miembroId: Long? = null,
    val iniciarProcesoDisciplinario: Boolean? = null
)
