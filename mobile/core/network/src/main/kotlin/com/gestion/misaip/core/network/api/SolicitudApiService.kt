package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.CrearSolicitudRestRequest
import com.gestion.misaip.core.network.dto.rest.SolicitudRestDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Servicio Retrofit para solicitudes SAIP.
 * Endpoints: /api/solicitudes
 */
interface SolicitudApiService {

    @GET("api/solicitudes")
    suspend fun listar(
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 20
    ): List<SolicitudRestDto>

    @GET("api/solicitudes/{id}")
    suspend fun getById(@Path("id") id: Long): SolicitudRestDto

    @GET("api/solicitudes/expediente/{expediente}")
    suspend fun getByExpediente(@Path("expediente") expediente: String): SolicitudRestDto

    @GET("api/solicitudes/ciudadano/{ciudadanoId}")
    suspend fun getByCiudadano(@Path("ciudadanoId") ciudadanoId: Long): List<SolicitudRestDto>

    @GET("api/solicitudes/entidad/{entidadId}")
    suspend fun getByEntidad(@Path("entidadId") entidadId: Long): List<SolicitudRestDto>

    @GET("api/solicitudes/estado/{estado}")
    suspend fun getByEstado(@Path("estado") estado: String): List<SolicitudRestDto>

    @POST("api/solicitudes")
    suspend fun crear(@Body request: CrearSolicitudRestRequest): SolicitudRestDto

    @PATCH("api/solicitudes/{id}/estado")
    suspend fun actualizarEstado(
        @Path("id") id: Long,
        @Body body: Map<String, String>
    ): SolicitudRestDto
}
