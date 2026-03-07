package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.AuthResponse
import com.gestion.misaip.core.network.dto.rest.CiudadanoResponse
import com.gestion.misaip.core.network.dto.rest.LoginRequest
import com.gestion.misaip.core.network.dto.rest.RegistroRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Servicio Retrofit para autenticacion y gestion de usuarios.
 * Endpoints: /api/auth
 */
interface AuthApiService {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("api/auth/registro")
    suspend fun registro(@Body request: RegistroRequest): AuthResponse

    @GET("api/auth/me/{usuarioId}")
    suspend fun me(@Path("usuarioId") usuarioId: Long): CiudadanoResponse
}
