package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.CrearRespuestaRestRequest
import com.gestion.misaip.core.network.dto.rest.RespuestaRestDto
import retrofit2.http.Body
import retrofit2.http.POST

interface RespuestaApiService {

    @POST("api/respuestas")
    suspend fun crear(@Body request: CrearRespuestaRestRequest): RespuestaRestDto
}
