package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.ApelacionRestDto
import com.gestion.misaip.core.network.dto.rest.CalificacionRestRequest
import com.gestion.misaip.core.network.dto.rest.ResolucionRestRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Servicio Retrofit para operaciones del TTAIP.
 * Endpoints: /api/ttaip
 * Calificación y resolución de apelaciones por el Tribunal de Transparencia.
 */
interface TTAIPApiService {

    // ===========================================
    // CONSULTAS (GET)
    // ===========================================

    @GET("api/ttaip/estadisticas")
    suspend fun obtenerEstadisticas(): Map<String, Any>

    @GET("api/ttaip/pendientes")
    suspend fun listarPendientes(): List<ApelacionRestDto>

    @GET("api/ttaip/en-calificacion")
    suspend fun listarEnCalificacion(): List<ApelacionRestDto>

    @GET("api/ttaip/subsanacion")
    suspend fun listarSubsanacion(): List<ApelacionRestDto>

    @GET("api/ttaip/segunda-calificacion")
    suspend fun listarSegundaCalificacion(): List<ApelacionRestDto>

    @GET("api/ttaip/en-resolucion")
    suspend fun listarEnResolucion(): List<ApelacionRestDto>

    @GET("api/ttaip/resueltas")
    suspend fun listarResueltas(): List<ApelacionRestDto>

    // ===========================================
    // CALIFICACIÓN (POST)
    // ===========================================

    @POST("api/ttaip/calificacion/{apelacionId}/admitir")
    suspend fun admitirApelacion(
        @Path("apelacionId") apelacionId: Long,
        @Body request: CalificacionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/calificacion/{apelacionId}/subsanar")
    suspend fun requerirSubsanacion(
        @Path("apelacionId") apelacionId: Long,
        @Body request: CalificacionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/calificacion/{apelacionId}/inadmitir")
    suspend fun inadmitirApelacion(
        @Path("apelacionId") apelacionId: Long,
        @Body request: CalificacionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/calificacion/{apelacionId}/no-presentado")
    suspend fun declararNoPresentado(
        @Path("apelacionId") apelacionId: Long,
        @Body request: CalificacionRestRequest
    ): ApelacionRestDto

    // ===========================================
    // RESOLUCIÓN FINAL (POST)
    // ===========================================

    @POST("api/ttaip/resolucion/{apelacionId}/fundado")
    suspend fun declararFundado(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/infundado")
    suspend fun declararInfundado(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/fundado-en-parte")
    suspend fun declararFundadoEnParte(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/infundado-en-parte")
    suspend fun declararInfundadoEnParte(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/improcedente")
    suspend fun declararImprocedente(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/sustraccion-materia")
    suspend fun declararSustraccionMateria(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/desistimiento")
    suspend fun declararDesistimiento(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    // ===========================================
    // NOTIFICACIÓN (POST)
    // ===========================================

    @POST("api/ttaip/{apelacionId}/notificar-segunda-calificacion")
    suspend fun notificarSegundaCalificacion(
        @Path("apelacionId") apelacionId: Long
    ): ApelacionRestDto
}
