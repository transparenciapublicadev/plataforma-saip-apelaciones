package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.*
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
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

    @POST("api/ttaip/resolucion/{apelacionId}/estese-a-lo-resuelto")
    suspend fun declararEsteseALoResuelto(
        @Path("apelacionId") apelacionId: Long,
        @Body request: ResolucionRestRequest
    ): ApelacionRestDto

    @POST("api/ttaip/resolucion/{apelacionId}/nulidad-acto")
    suspend fun declararNulidadDelActo(
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

    @POST("api/ttaip/notificaciones/reprocesar")
    suspend fun reprocesarNotificacion(@Body request: ReprocesarNotificacionTtaipRestRequest): ReprocesoNotificacionTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/descargos/requerir")
    suspend fun requerirDescargo(
        @Path("expedienteId") expedienteId: Long,
        @Body request: RequerirDescargoTtaipRestRequest
    ): DescargoEntidadTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/suspensiones/informe-oral")
    suspend fun registrarInformeOral(
        @Path("expedienteId") expedienteId: Long,
        @Body request: RegistrarSuspensionTtaipRestRequest
    ): SuspensionPlazoTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/suspensiones/informacion-complementaria")
    suspend fun registrarInformacionComplementaria(
        @Path("expedienteId") expedienteId: Long,
        @Body request: RegistrarSuspensionTtaipRestRequest
    ): SuspensionPlazoTtaipRestDto

    @PATCH("api/ttaip/expedientes/{expedienteId}/suspensiones/{suspensionId}/cancelar")
    suspend fun cancelarSuspension(
        @Path("expedienteId") expedienteId: Long,
        @Path("suspensionId") suspensionId: Long,
        @Body request: CancelarSuspensionTtaipRestRequest
    ): SuspensionPlazoTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/notificaciones/{notificacionId}/enviar")
    suspend fun enviarNotificacion(
        @Path("expedienteId") expedienteId: Long,
        @Path("notificacionId") notificacionId: Long,
        @Body request: EnviarNotificacionTtaipRestRequest
    ): IntentoNotificacionTtaipRestDto

    @GET("api/ttaip/expedientes/{expedienteId}/notificaciones/{notificacionId}/intentos")
    suspend fun listarIntentosNotificacion(
        @Path("expedienteId") expedienteId: Long,
        @Path("notificacionId") notificacionId: Long
    ): List<IntentoNotificacionTtaipRestDto>

    @POST("api/ttaip/expedientes/{expedienteId}/notificaciones/{notificacionId}/constancia-envio")
    suspend fun registrarConstancia(
        @Path("expedienteId") expedienteId: Long,
        @Path("notificacionId") notificacionId: Long,
        @Body request: RegistrarConstanciaTtaipRestRequest
    ): NotificacionTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/notificaciones/{notificacionId}/acuse-automatico")
    suspend fun registrarAcuse(
        @Path("expedienteId") expedienteId: Long,
        @Path("notificacionId") notificacionId: Long,
        @Body request: RegistrarAcuseTtaipRestRequest
    ): NotificacionTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/notificaciones/{notificacionId}/validacion-manual")
    suspend fun validarNotificacion(
        @Path("expedienteId") expedienteId: Long,
        @Path("notificacionId") notificacionId: Long,
        @Body request: ValidarNotificacionTtaipRestRequest
    ): NotificacionTtaipRestDto

    @POST("api/ttaip/expedientes/{expedienteId}/resoluciones/{resolucionId}/cumplimientos")
    suspend fun crearSeguimientoCumplimiento(
        @Path("expedienteId") expedienteId: Long,
        @Path("resolucionId") resolucionId: Long,
        @Body request: CrearSeguimientoCumplimientoTtaipRestRequest
    ): CumplimientoResolucionTtaipRestDto

    @PATCH("api/ttaip/expedientes/{expedienteId}/cumplimientos/{cumplimientoId}/observar")
    suspend fun observarCumplimiento(
        @Path("expedienteId") expedienteId: Long,
        @Path("cumplimientoId") cumplimientoId: Long,
        @Body request: ObservarCumplimientoTtaipRestRequest
    ): CumplimientoResolucionTtaipRestDto

    @PATCH("api/ttaip/expedientes/{expedienteId}/cumplimientos/{cumplimientoId}/cerrar")
    suspend fun cerrarCumplimiento(
        @Path("expedienteId") expedienteId: Long,
        @Path("cumplimientoId") cumplimientoId: Long,
        @Body request: CerrarCumplimientoTtaipRestRequest
    ): CumplimientoResolucionTtaipRestDto
}
