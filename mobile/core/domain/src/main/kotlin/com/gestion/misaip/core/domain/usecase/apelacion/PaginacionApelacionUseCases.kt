package com.gestion.misaip.core.domain.usecase.apelacion

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.Pagina
import com.gestion.misaip.core.domain.repository.ApelacionRepository

class CargarApelacionesUsuarioPaginaUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    suspend operator fun invoke(
        usuarioId: String,
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Apelacion> {
        validarPagina(pagina, tamano)
        require(usuarioId.isNotBlank()) { "El ID del usuario no puede estar vacío" }
        return apelacionRepository.cargarPaginaApelacionesUsuario(usuarioId, pagina, tamano)
    }
}

class CargarApelacionesPaginaUseCase(
    private val apelacionRepository: ApelacionRepository
) {
    suspend operator fun invoke(
        pagina: Int = 0,
        tamano: Int = 20
    ): Pagina<Apelacion> {
        validarPagina(pagina, tamano)
        return apelacionRepository.cargarPaginaApelaciones(pagina, tamano)
    }
}

private fun validarPagina(pagina: Int, tamano: Int) {
    require(pagina >= 0) { "La página no puede ser negativa" }
    require(tamano in 1..100) { "El tamaño de página debe estar entre 1 y 100" }
}
