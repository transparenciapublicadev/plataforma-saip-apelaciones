package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Usuario

/**
 * Interfaz para la fuente de datos remota de Usuarios.
 * Abstrae la autenticación remota (REST backend o Firebase Auth).
 */
interface UsuarioRemoteDataSource {

    suspend fun autenticar(identificador: String, password: String): Usuario

    suspend fun registrarConEmail(email: String, password: String, usuario: Usuario): Usuario

    suspend fun cerrarSesion()

    suspend fun getUsuarioPorId(id: String): Usuario?

    suspend fun actualizarUsuario(usuario: Usuario)

    suspend fun haySesionActiva(): Boolean
}
