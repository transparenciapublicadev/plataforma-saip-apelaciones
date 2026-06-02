package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.DispositivoPush
import com.gestion.misaip.core.domain.model.EstadoProveedorPush
import com.gestion.misaip.core.domain.model.RegistrarDispositivoPush
import com.gestion.misaip.core.domain.model.RevocarDispositivoPushActual

interface DispositivoPushRepository {

    suspend fun registrar(request: RegistrarDispositivoPush): DispositivoPush

    suspend fun revocarActual(request: RevocarDispositivoPushActual)

    suspend fun listarMios(): List<DispositivoPush>

    suspend fun obtenerEstadoSeguro(): EstadoProveedorPush
}
