package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.DispositivoPushRestDto
import com.gestion.misaip.core.network.dto.rest.EstadoProveedorPushRestDto
import com.gestion.misaip.core.network.dto.rest.RegistrarDispositivoPushRestRequest
import com.gestion.misaip.core.network.dto.rest.RevocarDispositivoPushActualRestRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface DispositivoPushApiService {

    @POST("api/notificaciones/push/tokens")
    suspend fun registrar(@Body request: RegistrarDispositivoPushRestRequest): DispositivoPushRestDto

    @POST("api/notificaciones/push/tokens/revocar-actual")
    suspend fun revocarActual(@Body request: RevocarDispositivoPushActualRestRequest)

    @GET("api/notificaciones/push/tokens/mios")
    suspend fun listarMios(): List<DispositivoPushRestDto>

    @GET("api/notificaciones/push/estado")
    suspend fun obtenerEstadoSeguro(): EstadoProveedorPushRestDto
}
