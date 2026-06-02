package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.ApelacionRestDto
import com.gestion.misaip.core.network.dto.rest.CrearApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.PaginaRestDto
import com.gestion.misaip.core.network.dto.rest.ApelacionResumenRestDto
import com.gestion.misaip.core.network.dto.rest.SubsanacionRestRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Servicio Retrofit para apelaciones TTAIP.
 * Endpoints: /api/apelaciones
 */
interface ApelacionApiService {

    @GET("api/apelaciones/paginadas")
    suspend fun listarPaginadas(
        @Query("pagina") pagina: Int = 0,
        @Query("tamano") tamano: Int = 20
    ): PaginaRestDto<ApelacionResumenRestDto>

    @GET("api/apelaciones/ciudadano/{ciudadanoId}/paginadas")
    suspend fun getByCiudadanoPaginadas(
        @Path("ciudadanoId") ciudadanoId: Long,
        @Query("pagina") pagina: Int = 0,
        @Query("tamano") tamano: Int = 20
    ): PaginaRestDto<ApelacionResumenRestDto>

    @GET("api/apelaciones")
    suspend fun listar(): List<ApelacionRestDto>

    @GET("api/apelaciones/{id}")
    suspend fun getById(@Path("id") id: Long): ApelacionRestDto

    @GET("api/apelaciones/expediente/{expediente}")
    suspend fun getByExpediente(@Path("expediente") expediente: String): ApelacionRestDto

    @GET("api/apelaciones/ciudadano/{ciudadanoId}")
    suspend fun getByCiudadano(@Path("ciudadanoId") ciudadanoId: Long): List<ApelacionRestDto>

    @GET("api/apelaciones/estado/{estado}")
    suspend fun getByEstado(@Path("estado") estado: String): List<ApelacionRestDto>

    @POST("api/apelaciones")
    suspend fun crear(@Body request: CrearApelacionRestRequest): ApelacionRestDto

    @PATCH("api/apelaciones/{id}/estado")
    suspend fun actualizarEstado(
        @Path("id") id: Long,
        @Body body: Map<String, String>
    ): ApelacionRestDto

    @POST("api/apelaciones/{id}/subsanacion")
    suspend fun presentarSubsanacion(
        @Path("id") id: Long,
        @Body request: SubsanacionRestRequest
    ): ApelacionRestDto
}
