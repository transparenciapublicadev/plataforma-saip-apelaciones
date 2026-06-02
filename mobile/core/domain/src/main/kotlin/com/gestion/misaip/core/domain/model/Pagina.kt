package com.gestion.misaip.core.domain.model

/**
 * Pagina liviana de resultados para bandejas mobile.
 *
 * SQLDelight conserva el cache offline; [desdeCache] permite distinguir
 * una respuesta remota de un fallback local sin filtrar detalles de red a UI.
 */
data class Pagina<T>(
    val contenido: List<T>,
    val pagina: Int,
    val tamano: Int,
    val totalElementos: Long,
    val totalPaginas: Int,
    val ultima: Boolean,
    val desdeCache: Boolean = false
) {
    val tieneSiguiente: Boolean
        get() = !ultima && pagina + 1 < totalPaginas
}
