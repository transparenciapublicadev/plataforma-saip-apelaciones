package com.gestion.misaip.core.network.di

import com.gestion.misaip.core.network.api.ApelacionApiService
import com.gestion.misaip.core.network.api.AuthApiService
import com.gestion.misaip.core.network.api.EntidadApiService
import com.gestion.misaip.core.network.api.SolicitudApiService
import com.gestion.misaip.core.network.api.TTAIPApiService
import com.gestion.misaip.core.network.datasource.ApelacionRemoteDataSource
import com.gestion.misaip.core.network.datasource.ApelacionRestDataSource
import com.gestion.misaip.core.network.datasource.EntidadPublicaRemoteDataSource
import com.gestion.misaip.core.network.datasource.EntidadPublicaRestDataSource
import com.gestion.misaip.core.network.datasource.SolicitudRemoteDataSource
import com.gestion.misaip.core.network.datasource.SolicitudRestDataSource
import com.gestion.misaip.core.network.datasource.TokenStorage
import com.gestion.misaip.core.network.datasource.UsuarioRemoteDataSource
import com.gestion.misaip.core.network.datasource.UsuarioRestDataSource
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.koin.dsl.module
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Módulo Koin para la Capa de Red (REST API — Spring Boot Backend).
 *
 * Provee Retrofit, OkHttp y los DataSources que consumen el backend REST.
 * Reemplaza los DataSources de Firebase cuando se usa el backend como fuente de datos.
 *
 * @param baseUrl URL base del backend REST. Configurable via gradle.properties / local.properties.
 *   - Emulador: http://10.0.2.2:8080/ (default)
 *   - Dispositivo físico con adb reverse: http://127.0.0.1:8080/
 *   - LAN: http://<host-ip>:8080/
 */
fun restNetworkModule(baseUrl: String) = module {

    // ===========================================
    // JSON Serialization
    // ===========================================

    single {
        Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = true
        }
    }

    // ===========================================
    // OkHttp
    // ===========================================

    single {
        val tokenStorage: TokenStorage = get()
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val path = original.url.encodedPath
                // No enviar JWT en endpoints de autenticación
                val isAuthEndpoint = path.startsWith("/api/auth/")
                val token = if (!isAuthEndpoint) tokenStorage.getToken() else null
                val request = if (token != null) {
                    original.newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                } else {
                    original
                }
                chain.proceed(request)
            }
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                }
            )
            .build()
    }

    // ===========================================
    // Retrofit
    // ===========================================

    single {
        val json: Json = get()
        val client: OkHttpClient = get()
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    // ===========================================
    // API Services (Retrofit)
    // ===========================================

    single<AuthApiService> { get<Retrofit>().create(AuthApiService::class.java) }
    single<SolicitudApiService> { get<Retrofit>().create(SolicitudApiService::class.java) }
    single<ApelacionApiService> { get<Retrofit>().create(ApelacionApiService::class.java) }
    single<EntidadApiService> { get<Retrofit>().create(EntidadApiService::class.java) }
    single<TTAIPApiService> { get<Retrofit>().create(TTAIPApiService::class.java) }

    // ===========================================
    // DATA SOURCES REMOTOS (REST)
    // ===========================================

    single<UsuarioRemoteDataSource> {
        UsuarioRestDataSource(authApi = get(), tokenStorage = get())
    }

    single<SolicitudRemoteDataSource> {
        SolicitudRestDataSource(solicitudApi = get(), tokenStorage = get())
    }

    single<ApelacionRemoteDataSource> {
        ApelacionRestDataSource(apelacionApi = get(), tokenStorage = get())
    }

    single<EntidadPublicaRemoteDataSource> {
        EntidadPublicaRestDataSource(entidadApi = get())
    }
}
