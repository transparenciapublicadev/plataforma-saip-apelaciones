package com.gestion.misaip.core.network.api

import com.gestion.misaip.core.network.dto.rest.DocumentoMetadataRestDto
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

interface DocumentoApiService {

    @Multipart
    @POST("api/documentos/upload")
    suspend fun upload(
        @Part file: MultipartBody.Part,
        @Query("tipoDocumento") tipoDocumento: String,
        @Query("solicitudId") solicitudId: Long? = null,
        @Query("apelacionId") apelacionId: Long? = null,
        @Query("expedienteTtaipId") expedienteTtaipId: Long? = null,
        @Query("resolucionId") resolucionId: Long? = null,
        @Query("cedulaNotificacionId") cedulaNotificacionId: Long? = null
    ): DocumentoMetadataRestDto

    @GET("api/documentos/{documentoId}/metadata")
    suspend fun getMetadata(
        @Path("documentoId") documentoId: Long
    ): DocumentoMetadataRestDto

    @Streaming
    @GET("api/documentos/{documentoId}/download")
    suspend fun download(
        @Path("documentoId") documentoId: Long
    ): Response<ResponseBody>

    @DELETE("api/documentos/{documentoId}")
    suspend fun delete(
        @Path("documentoId") documentoId: Long
    ): Response<Unit>
}

