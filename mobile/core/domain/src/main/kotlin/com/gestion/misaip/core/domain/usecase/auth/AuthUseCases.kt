package com.gestion.misaip.core.domain.usecase.auth

import com.gestion.misaip.core.domain.model.Usuario
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.core.domain.repository.UsuarioRepository
import kotlinx.coroutines.flow.Flow

/**
 * Caso de Uso: Autenticar Usuario
 *
 * Maneja la autenticación de usuarios (ciudadanos y funcionarios).
 *
 * @param usuarioRepository Repositorio de usuarios (inyectado por Koin)
 */
class AutenticarUsuarioUseCase(
    private val usuarioRepository: UsuarioRepository
) {

    /**
     * Resultado de la autenticación.
     */
    sealed class AuthResult {
        data class Success(val usuario: Usuario) : AuthResult()
        data class Error(val mensaje: String) : AuthResult()
    }

    /**
     * Autentica un ciudadano con DNI y contraseña.
     *
     * @param dni DNI del ciudadano (8 dígitos)
     * @param password Contraseña
     * @return Resultado de la autenticación
     */
    suspend fun autenticarCiudadano(dni: String, password: String): AuthResult {
        // Validaciones
        if (dni.isBlank()) {
            return AuthResult.Error("El DNI es obligatorio")
        }
        if (!dni.matches(Regex("^[0-9]{8}$"))) {
            return AuthResult.Error("El DNI debe tener 8 dígitos")
        }
        if (password.isBlank()) {
            return AuthResult.Error("La contraseña es obligatoria")
        }

        return try {
            val usuario = usuarioRepository.autenticarCiudadano(dni, password)
            AuthResult.Success(usuario)
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Error de autenticación")
        }
    }

    /**
     * Autentica un funcionario con usuario y contraseña.
     *
     * @param usuario Nombre de usuario
     * @param password Contraseña
     * @return Resultado de la autenticación
     */
    suspend fun autenticarFuncionario(usuario: String, password: String): AuthResult {
        if (usuario.isBlank()) {
            return AuthResult.Error("El usuario es obligatorio")
        }
        if (password.isBlank()) {
            return AuthResult.Error("La contraseña es obligatoria")
        }

        return try {
            val user = usuarioRepository.autenticarFuncionario(usuario, password)
            AuthResult.Success(user)
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Error de autenticación")
        }
    }
}

/**
 * Caso de Uso: Obtener Usuario Actual
 *
 * Obtiene el usuario actualmente autenticado.
 *
 * @param usuarioRepository Repositorio de usuarios (inyectado por Koin)
 */
class GetUsuarioActualUseCase(
    private val usuarioRepository: UsuarioRepository
) {

    /**
     * Ejecuta el caso de uso.
     *
     * @return Flow del usuario actual o null si no hay sesión
     */
    operator fun invoke(): Flow<Usuario?> = usuarioRepository.getUsuarioActual()
}

/**
 * Caso de Uso: Cerrar Sesión
 *
 * Cierra la sesión del usuario actual.
 *
 * @param usuarioRepository Repositorio de usuarios (inyectado por Koin)
 */
class CerrarSesionUseCase(
    private val usuarioRepository: UsuarioRepository
) {

    /**
     * Ejecuta el caso de uso.
     */
    suspend operator fun invoke() = usuarioRepository.cerrarSesion()
}

/**
 * Caso de Uso: Registrar Ciudadano
 *
 * Registra un nuevo ciudadano en el sistema.
 *
 * @param usuarioRepository Repositorio de usuarios (inyectado por Koin)
 */
class RegistrarCiudadanoUseCase(
    private val usuarioRepository: UsuarioRepository
) {

    /**
     * Parámetros para el registro.
     */
    data class Params(
        val nombre: String,
        val dni: String,
        val email: String,
        val telefono: String,
        val direccion: String,
        val password: String,
        val confirmarPassword: String
    )

    /**
     * Resultado del registro.
     */
    sealed class RegisterResult {
        data class Success(val usuario: Usuario) : RegisterResult()
        data class Error(val mensaje: String) : RegisterResult()
    }

    /**
     * Ejecuta el caso de uso.
     *
     * @param params Parámetros del registro
     * @return Resultado del registro
     */
    suspend operator fun invoke(params: Params): RegisterResult {
        // Validaciones
        if (params.nombre.isBlank()) {
            return RegisterResult.Error("El nombre es obligatorio")
        }
        if (!params.dni.matches(Regex("^[0-9]{8}$"))) {
            return RegisterResult.Error("El DNI debe tener 8 dígitos")
        }
        if (!params.email.matches(Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"))) {
            return RegisterResult.Error("El email no es válido")
        }
        if (params.password.length < 8) {
            return RegisterResult.Error("La contraseña debe tener al menos 8 caracteres")
        }
        if (params.password != params.confirmarPassword) {
            return RegisterResult.Error("Las contraseñas no coinciden")
        }

        val usuario = Usuario(
            id = "", // Se generará en el repositorio
            tipo = TipoUsuario.CIUDADANO,
            nombre = params.nombre,
            dni = params.dni,
            email = params.email,
            telefono = params.telefono,
            direccion = params.direccion,
            fechaRegistro = System.currentTimeMillis()
        )

        return try {
            val nuevoUsuario = usuarioRepository.registrarCiudadano(usuario, params.password)
            RegisterResult.Success(nuevoUsuario)
        } catch (e: Exception) {
            RegisterResult.Error(e.message ?: "Error al registrar usuario")
        }
    }
}

/**
 * Caso de Uso: Obtener Todos los Usuarios (Administrador)
 *
 * Recupera todos los usuarios registrados en el sistema.
 *
 * @param usuarioRepository Repositorio de usuarios (inyectado por Koin)
 */
class GetTodosLosUsuariosUseCase(
    private val usuarioRepository: UsuarioRepository
) {

    /**
     * Ejecuta el caso de uso.
     *
     * @return Flow de lista de todos los usuarios
     */
    operator fun invoke(): Flow<List<Usuario>> {
        return usuarioRepository.getTodosLosUsuarios()
    }
}

