package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.EntidadRestDto
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Servicio Retrofit para entidades publicas.
 * Endpoints: /api/entidades
 */
interface EntidadApiService {

    @GET("api/entidades")
    suspend fun listar(): List<EntidadRestDto>

    @GET("api/entidades/activas")
    suspend fun getActivas(): List<EntidadRestDto>

    @GET("api/entidades/{id}")
    suspend fun getById(@Path("id") id: Long): EntidadRestDto

    @GET("api/entidades/buscar")
    suspend fun buscar(): List<EntidadRestDto>
}
