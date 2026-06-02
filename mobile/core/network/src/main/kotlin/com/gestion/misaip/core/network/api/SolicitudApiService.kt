package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.CrearSolicitudRestRequest
import com.gestion.misaip.core.network.dto.rest.SolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.PaginaRestDto
import com.gestion.misaip.core.network.dto.rest.SolicitudResumenRestDto
import com.gestion.misaip.core.network.dto.rest.AmpliacionPlazoSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.EncauzamientoSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.LiquidacionCostoSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.ObservacionSolicitudRestDto
import com.gestion.misaip.core.network.dto.rest.ObservarSolicitudRestRequest
import com.gestion.misaip.core.network.dto.rest.RegistrarAmpliacionPlazoRestRequest
import com.gestion.misaip.core.network.dto.rest.RegistrarEncauzamientoSolicitudRestRequest
import com.gestion.misaip.core.network.dto.rest.RegistrarLiquidacionCostoRestRequest
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

    @GET("api/solicitudes/paginadas")
    suspend fun listarPaginadas(
        @Query("pagina") pagina: Int = 0,
        @Query("tamano") tamano: Int = 20
    ): PaginaRestDto<SolicitudResumenRestDto>

    @GET("api/solicitudes/ciudadano/{ciudadanoId}/paginadas")
    suspend fun getByCiudadanoPaginadas(
        @Path("ciudadanoId") ciudadanoId: Long,
        @Query("pagina") pagina: Int = 0,
        @Query("tamano") tamano: Int = 20
    ): PaginaRestDto<SolicitudResumenRestDto>

    @GET("api/solicitudes/entidad/{entidadId}/paginadas")
    suspend fun getByEntidadPaginadas(
        @Path("entidadId") entidadId: Long,
        @Query("pagina") pagina: Int = 0,
        @Query("tamano") tamano: Int = 20
    ): PaginaRestDto<SolicitudResumenRestDto>

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

    @GET("api/solicitudes/{id}/observaciones")
    suspend fun listarObservaciones(@Path("id") id: Long): List<ObservacionSolicitudRestDto>

    @POST("api/solicitudes/{id}/observaciones")
    suspend fun observar(
        @Path("id") id: Long,
        @Body request: ObservarSolicitudRestRequest
    ): ObservacionSolicitudRestDto

    @GET("api/solicitudes/{id}/ampliaciones")
    suspend fun listarAmpliaciones(@Path("id") id: Long): List<AmpliacionPlazoSolicitudRestDto>

    @POST("api/solicitudes/{id}/ampliaciones")
    suspend fun registrarAmpliacion(
        @Path("id") id: Long,
        @Body request: RegistrarAmpliacionPlazoRestRequest
    ): AmpliacionPlazoSolicitudRestDto

    @GET("api/solicitudes/{id}/encauzamientos")
    suspend fun listarEncauzamientos(@Path("id") id: Long): List<EncauzamientoSolicitudRestDto>

    @POST("api/solicitudes/{id}/encauzamientos")
    suspend fun registrarEncauzamiento(
        @Path("id") id: Long,
        @Body request: RegistrarEncauzamientoSolicitudRestRequest
    ): EncauzamientoSolicitudRestDto

    @GET("api/solicitudes/{id}/liquidaciones")
    suspend fun listarLiquidaciones(@Path("id") id: Long): List<LiquidacionCostoSolicitudRestDto>

    @POST("api/solicitudes/{id}/liquidaciones")
    suspend fun emitirLiquidacion(
        @Path("id") id: Long,
        @Body request: RegistrarLiquidacionCostoRestRequest
    ): LiquidacionCostoSolicitudRestDto
}
