package com.gestion.misaip.core.domain.usecase.solicitud

import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.repository.SolicitudRepository

class CargarSolicitudesUsuarioPaginaUseCase(
    private val solicitudRepository: SolicitudRepository
) {
    suspend operator fun invoke(
        usuarioId: String,
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Solicitud> {
        validarPagina(pagina, tamano)
        require(usuarioId.isNotBlank()) { "El ID del usuario no puede estar vacío" }
        return solicitudRepository.cargarPaginaSolicitudesUsuario(usuarioId, pagina, tamano)
    }
}

class CargarSolicitudesEntidadPaginaUseCase(
    private val solicitudRepository: SolicitudRepository
) {
    suspend operator fun invoke(
        entidadId: String,
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Solicitud> {
        validarPagina(pagina, tamano)
        require(entidadId.isNotBlank()) { "El ID de la entidad no puede estar vacío" }
        return solicitudRepository.cargarPaginaSolicitudesEntidad(entidadId, pagina, tamano)
    }
}

class CargarSolicitudesPaginaUseCase(
    private val solicitudRepository: SolicitudRepository
) {
    suspend operator fun invoke(
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Solicitud> {
        validarPagina(pagina, tamano)
        return solicitudRepository.cargarPaginaSolicitudes(pagina, tamano)
    }
}

private fun validarPagina(pagina: Int, tamano: Int) {
    require(pagina >= 0) { "La página no puede ser negativa" }
    require(tamano in 1..100) { "El tamaño de página debe estar entre 1 y 100" }
}
