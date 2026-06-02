package com.gestion.misaip.core.domain.usecase.notificacion

import com.gestion.misaip.core.domain.model.RegistrarDispositivoPush
import com.gestion.misaip.core.domain.model.RevocarDispositivoPushActual
import com.gestion.misaip.core.domain.repository.DispositivoPushRepository

class RegistrarDispositivoPushUseCase(
    private val repository: DispositivoPushRepository
) {
    suspend operator fun invoke(request: RegistrarDispositivoPush) = repository.registrar(request)
}

class RevocarDispositivoPushActualUseCase(
    private val repository: DispositivoPushRepository
) {
    suspend operator fun invoke(request: RevocarDispositivoPushActual) = repository.revocarActual(request)
}

class ListarDispositivosPushMiosUseCase(
    private val repository: DispositivoPushRepository
) {
    suspend operator fun invoke() = repository.listarMios()
}

class ObtenerEstadoProveedorPushUseCase(
    private val repository: DispositivoPushRepository
) {
    suspend operator fun invoke() = repository.obtenerEstadoSeguro()
}
