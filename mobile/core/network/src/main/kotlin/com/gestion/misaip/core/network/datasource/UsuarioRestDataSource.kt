package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Usuario
import com.gestion.misaip.core.domain.repository.AuthException
import com.gestion.misaip.core.network.api.AuthApiService
import com.gestion.misaip.core.network.dto.rest.AuthResponse
import com.gestion.misaip.core.network.dto.rest.LoginRequest
import com.gestion.misaip.core.network.dto.rest.ProblemDetailRestDto
import com.gestion.misaip.core.network.dto.rest.RegistroRequest
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

/**
 * Implementación REST del datasource de usuarios.
 * Usa el backend Spring Boot + JWT como fuente de autenticacion y perfil.
 */
class UsuarioRestDataSource(
    private val authApi: AuthApiService,
    private val tokenStorage: TokenStorage
) : UsuarioRemoteDataSource {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun autenticar(identificador: String, password: String): Usuario {
        try {
            android.util.Log.d("MiSAIP", "Intentando login REST → POST api/auth/login")
            val response = authApi.login(LoginRequest(identificador, password))
            android.util.Log.d("MiSAIP", "Login REST exitoso → usuarioId=${response.usuarioId}, tipo=${response.tipoUsuario}")
            response.token?.let { tokenStorage.saveToken(it) }
            response.usuarioId?.let { tokenStorage.saveUserId(it) }
            tokenStorage.saveTipoUsuario(response.tipoUsuario)
            tokenStorage.saveEntidadId(response.entidadId)
            return response.toDomain()
        } catch (e: HttpException) {
            android.util.Log.w("MiSAIP", "Login REST rechazado → HTTP ${e.code()}: ${e.message()}")
            val mensaje = extraerMensajeError(e) ?: "Error de autenticación (${e.code()})"
            throw AuthException(mensaje)
        } catch (e: IOException) {
            android.util.Log.e("MiSAIP", "Login REST falló → No se pudo conectar al servidor: ${e.javaClass.simpleName}: ${e.message}")
            throw e // Propagar para que el repositorio maneje el fallback local
        }
    }

    override suspend fun registrarConEmail(email: String, password: String, usuario: Usuario): Usuario {
        try {
            val response = authApi.registro(
                RegistroRequest(
                    email = email,
                    password = password,
                    dni = usuario.dni ?: "",
                    nombreCompleto = usuario.nombre,
                    telefono = usuario.telefono,
                    direccion = usuario.direccion
                )
            )
            response.token?.let { tokenStorage.saveToken(it) }
            response.usuarioId?.let { tokenStorage.saveUserId(it) }
            tokenStorage.saveTipoUsuario(response.tipoUsuario)
            tokenStorage.saveEntidadId(response.entidadId)
            return response.toDomain()
        } catch (e: HttpException) {
            val mensaje = extraerMensajeError(e) ?: "Error al registrar usuario (${e.code()})"
            throw AuthException(mensaje)
        } catch (e: IOException) {
            throw AuthException("Sin conexión al servidor. Verifique que el backend esté ejecutándose.")
        }
    }

    override suspend fun cerrarSesion() {
        tokenStorage.clearToken()
    }

    override suspend fun getUsuarioPorId(id: String): Usuario? {
        return try {
            val response = authApi.me(id.toLong())
            response.toDomain()
        } catch (_: Exception) {
            null
        }
    }

    override suspend fun actualizarUsuario(usuario: Usuario) {
        // El backend no tiene endpoint PUT para actualizar usuario
    }

    override suspend fun haySesionActiva(): Boolean {
        return tokenStorage.getToken() != null
    }

    /**
     * Extrae el mensaje de error del body de la respuesta HTTP.
     * Prioriza RFC 9457 Problem Details y conserva compatibilidad con respuestas legacy.
     */
    private fun extraerMensajeError(e: HttpException): String? {
        val errorBody = e.response()?.errorBody()?.string() ?: return null
        return try {
            json.decodeFromString<ProblemDetailRestDto>(errorBody).mensajeUsuario()
        } catch (_: Exception) {
            try {
                json.decodeFromString<AuthResponse>(errorBody).mensaje
            } catch (_: Exception) {
                null
            }
        }
    }
}

/**
 * Interfaz para almacenar el token JWT.
 */
interface TokenStorage {
    fun saveToken(token: String)
    fun getToken(): String?
    fun clearToken()
    fun saveUserId(id: Long)
    fun getUserId(): Long?
    fun saveTipoUsuario(tipoUsuario: String?)
    fun getTipoUsuario(): String?
    fun saveEntidadId(entidadId: Long?)
    fun getEntidadId(): Long?
}
