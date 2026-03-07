package com.gestion.misaip.core.domain.repository

import com.gestion.misaip.core.domain.model.Usuario
import kotlinx.coroutines.flow.Flow

/**
 * Interfaz del Repositorio de Usuarios.
 *
 * Define el contrato para el acceso a datos de usuarios y autenticación.
 *
 * IMPORTANTE: Esta interfaz está en el módulo de DOMINIO,
 * por lo tanto NO debe tener dependencias de Android ni Firebase.
 */
interface UsuarioRepository {

    /**
     * Obtiene el usuario actualmente autenticado.
     *
     * @return Flow del usuario actual o null si no hay sesión
     */
    fun getUsuarioActual(): Flow<Usuario?>

    /**
     * Obtiene un usuario por su ID.
     *
     * @param id ID del usuario
     * @return Flow del usuario o null
     */
    fun getUsuarioPorId(id: String): Flow<Usuario?>

    /**
     * Autentica un ciudadano con DNI y contraseña.
     *
     * @param dni DNI del ciudadano
     * @param password Contraseña
     * @return Usuario autenticado
     * @throws AuthException si las credenciales son inválidas
     */
    suspend fun autenticarCiudadano(dni: String, password: String): Usuario

    /**
     * Autentica un funcionario con usuario y contraseña.
     *
     * @param usuario Nombre de usuario
     * @param password Contraseña
     * @return Usuario autenticado
     * @throws AuthException si las credenciales son inválidas
     */
    suspend fun autenticarFuncionario(usuario: String, password: String): Usuario

    /**
     * Registra un nuevo ciudadano.
     *
     * @param usuario Datos del nuevo usuario (debe incluir email)
     * @param password Contraseña en texto plano
     * @return Usuario creado
     */
    suspend fun registrarCiudadano(usuario: Usuario, password: String): Usuario

    /**
     * Cierra la sesión actual.
     */
    suspend fun cerrarSesion()

    /**
     * Verifica si hay una sesión activa.
     */
    suspend fun haySesionActiva(): Boolean

    /**
     * Obtiene todos los usuarios del sistema (para administrador).
     *
     * @return Flow de lista de todos los usuarios
     */
    fun getTodosLosUsuarios(): Flow<List<Usuario>>
}

/**
 * Excepción de autenticación.
 */
class AuthException(message: String) : Exception(message)

