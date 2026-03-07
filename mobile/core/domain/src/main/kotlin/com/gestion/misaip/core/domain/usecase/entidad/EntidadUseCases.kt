package com.gestion.misaip.core.domain.usecase.entidad

import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.repository.EntidadPublicaRepository
import kotlinx.coroutines.flow.Flow

/**
 * Caso de Uso: Obtener Entidades Activas
 *
 * Recupera la lista de entidades públicas activas del sistema.
 */
class GetEntidadesActivasUseCase(
    private val entidadPublicaRepository: EntidadPublicaRepository
) {
    operator fun invoke(): Flow<List<EntidadPublica>> {
        return entidadPublicaRepository.getEntidadesActivas()
    }
}
