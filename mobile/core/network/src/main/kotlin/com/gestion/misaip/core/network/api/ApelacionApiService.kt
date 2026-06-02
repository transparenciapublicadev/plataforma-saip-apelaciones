package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.ApelacionRestDto
import com.gestion.misaip.core.network.dto.rest.CrearApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.CrearApelacionExternaRestRequest
import com.gestion.misaip.core.network.dto.rest.CrearApelacionAnteEntidadRestRequest
import com.gestion.misaip.core.network.dto.rest.ComunicarOmisionElevacionRestRequest
import com.gestion.misaip.core.network.dto.rest.ElevarApelacionRestRequest
import com.gestion.misaip.core.network.dto.rest.ElevacionApelacionRestDto
import com.gestion.misaip.core.network.dto.rest.PaginaRestDto
import com.gestion.misaip.core.network.dto.rest.ApelacionResumenRestDto
import com.gestion.misaip.core.network.dto.rest.SubsanacionRestRequest
import com.gestion.misaip.core.network.dto.rest.AdmitirElevacionExcepcionalRestRequest
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

    @POST("api/apelaciones/externa")
    suspend fun crearExterna(@Body request: CrearApelacionExternaRestRequest): ApelacionRestDto

    @POST("api/apelaciones/ante-entidad")
    suspend fun crearAnteEntidad(@Body request: CrearApelacionAnteEntidadRestRequest): ApelacionRestDto

    @GET("api/apelaciones/{id}/elevacion")
    suspend fun getElevacion(@Path("id") id: Long): ElevacionApelacionRestDto

    @GET("api/apelaciones/entidad/{entidadId}/pendientes-elevacion")
    suspend fun getPendientesElevacionEntidad(
        @Path("entidadId") entidadId: Long
    ): List<ElevacionApelacionRestDto>

    @POST("api/apelaciones/{id}/elevacion/elevar")
    suspend fun elevar(
        @Path("id") id: Long,
        @Body request: ElevarApelacionRestRequest
    ): ApelacionRestDto

    @POST("api/apelaciones/{id}/elevacion/comunicacion-ciudadana")
    suspend fun comunicarOmision(
        @Path("id") id: Long,
        @Body request: ComunicarOmisionElevacionRestRequest
    ): ElevacionApelacionRestDto

    @POST("api/apelaciones/{id}/elevacion/admitir-excepcionalmente")
    suspend fun admitirExcepcionalmente(
        @Path("id") id: Long,
        @Body request: AdmitirElevacionExcepcionalRestRequest
    ): ApelacionRestDto

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
