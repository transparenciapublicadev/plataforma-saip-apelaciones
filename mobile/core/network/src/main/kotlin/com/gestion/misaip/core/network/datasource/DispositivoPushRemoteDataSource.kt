package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.network.api.DispositivoPushApiService
import com.gestion.misaip.core.network.dto.rest.DispositivoPushRestDto
import com.gestion.misaip.core.network.dto.rest.EstadoProveedorPushRestDto
import com.gestion.misaip.core.network.dto.rest.RegistrarDispositivoPushRestRequest
import com.gestion.misaip.core.network.dto.rest.RevocarDispositivoPushActualRestRequest
import com.gestion.misaip.core.network.dto.rest.extraerMensajeProblemDetails
import kotlinx.serialization.json.Json
import retrofit2.HttpException

interface DispositivoPushRemoteDataSource {

    suspend fun registrar(request: RegistrarDispositivoPushRestRequest): DispositivoPushRestDto

    suspend fun revocarActual(request: RevocarDispositivoPushActualRestRequest)

    suspend fun listarMios(): List<DispositivoPushRestDto>

    suspend fun obtenerEstadoSeguro(): EstadoProveedorPushRestDto
}

class DispositivoPushRestDataSource(
    private val api: DispositivoPushApiService,
    private val json: Json
) : DispositivoPushRemoteDataSource {

    override suspend fun registrar(request: RegistrarDispositivoPushRestRequest) = traducirProblemDetails {
        api.registrar(request)
    }

    override suspend fun revocarActual(request: RevocarDispositivoPushActualRestRequest) = traducirProblemDetails {
        api.revocarActual(request)
    }

    override suspend fun listarMios() = traducirProblemDetails {
        api.listarMios()
    }

    override suspend fun obtenerEstadoSeguro() = traducirProblemDetails {
        api.obtenerEstadoSeguro()
    }

    private suspend fun <T> traducirProblemDetails(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: HttpException) {
            val mensaje = json.extraerMensajeProblemDetails(error.response()?.errorBody()?.string())
                ?: "El backend rechazó la operación push (${error.code()})"
            throw IllegalStateException(mensaje, error)
        }
    }
}
