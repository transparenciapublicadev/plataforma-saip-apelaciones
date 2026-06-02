package com.gestion.misaip.core.data.repository

import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToList
import app.cash.sqldelight.coroutines.mapToOneOrNull
import com.gestion.misaip.core.data.mapper.UsuarioMapper
import com.gestion.misaip.core.database.SaipDatabase
import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.repository.AuthException
import com.gestion.misaip.core.domain.repository.UsuarioRepository
import com.gestion.misaip.core.network.datasource.UsuarioRemoteDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import java.util.UUID

/**
 * Implementación del repositorio de Usuarios con fallback offline.
 *
 * Autenticación: Primero intenta con el backend REST (Spring Boot).
 * Si falla por red, intenta autenticación local con hash de contraseña (SQLDelight).
 * Los datos de usuario se almacenan localmente para acceso offline.
 */
class UsuarioRepositoryImpl(
    private val database: SaipDatabase,
    private val remoteDataSource: UsuarioRemoteDataSource
) : UsuarioRepository {

    private val queries = database.usuarioQueries
    private val solicitudQueries = database.solicitudQueries
    private val apelacionQueries = database.apelacionQueries

    override fun getUsuarioActual(): Flow<Usuario?> {
        return queries.getUsuarioActual()
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { entity -> entity?.let { UsuarioMapper.toDomain(it) } }
    }

    override fun getUsuarioPorId(id: String): Flow<Usuario?> {
        return queries.getUsuarioById(id)
            .asFlow()
            .mapToOneOrNull(Dispatchers.IO)
            .map { entity -> entity?.let { UsuarioMapper.toDomain(it) } }
    }

    override suspend fun autenticarCiudadano(dni: String, password: String): Usuario = withContext(Dispatchers.IO) {
        // 1. Intentar autenticación remota (REST backend)
        try {
            val usuario = remoteDataSource.autenticar(dni, password)
            limpiarCacheSiCambioContexto(usuario)
            // Éxito remoto → cachear datos localmente
            val entity = UsuarioMapper.toEntity(usuario, hashPassword(password))
            insertarUsuarioLocal(entity)
            crearSesionLocal(usuario.id)
            return@withContext usuario
        } catch (e: AuthException) {
            // Rechazo explícito del backend (credenciales inválidas, usuario no encontrado)
            // NO intentar fallback local — el backend ya validó y rechazó
            throw e
        } catch (e: Exception) {
            // Error de red (IOException, timeout, etc.) → intentar fallback local
            android.util.Log.w("MiSAIP", "Red no disponible (${e.javaClass.simpleName}), intentando login local ciudadano")
        }

        // 2. Fallback local (solo cuando la red no está disponible)
        val localUser = queries.getUsuarioByDni(dni).executeAsOneOrNull()
            ?: throw AuthException(
                "No se pudo conectar al servidor backend (http://10.0.2.2:8080). " +
                "Verifique que: 1) El backend esté corriendo (cd backend && ./mvnw spring-boot:run), " +
                "2) Si usa dispositivo físico, configure REST_BASE_URL en local.properties con la IP de su PC. " +
                "No hay cuenta local guardada para este DNI."
            )

        val hash = hashPassword(password)
        if (localUser.passwordHash != hash) {
            throw AuthException(
                "Sin conexión al servidor. Se encontró una cuenta local pero la contraseña no coincide " +
                "(la contraseña local usa hash SHA-256, diferente al BCrypt del backend)."
            )
        }

        crearSesionLocal(localUser.id)
        UsuarioMapper.toDomain(localUser)
    }

    override suspend fun autenticarFuncionario(usuario: String, password: String): Usuario = withContext(Dispatchers.IO) {
        // 1. Intentar autenticación remota (REST backend)
        try {
            val remoteUser = remoteDataSource.autenticar(usuario, password)
            limpiarCacheSiCambioContexto(remoteUser)
            // Éxito remoto → cachear datos localmente
            val entity = UsuarioMapper.toEntity(remoteUser, hashPassword(password))
            insertarUsuarioLocal(entity)
            crearSesionLocal(remoteUser.id)
            return@withContext remoteUser
        } catch (e: AuthException) {
            // Rechazo explícito del backend (credenciales inválidas, usuario no encontrado)
            // NO intentar fallback local — el backend ya validó y rechazó
            throw e
        } catch (e: Exception) {
            // Error de red (IOException, timeout, etc.) → intentar fallback local
            android.util.Log.w("MiSAIP", "Red no disponible (${e.javaClass.simpleName}), intentando login local interno")
        }

        // 2. Fallback local (solo cuando la red no está disponible)
        val localUser = queries.getUsuarioByUsuario(usuario).executeAsOneOrNull()
            ?: throw AuthException(
                "No se pudo conectar al servidor backend (http://10.0.2.2:8080). " +
                "Verifique que: 1) El backend esté corriendo, " +
                "2) Si usa dispositivo físico, configure REST_BASE_URL en local.properties con la IP de su PC. " +
                "No hay cuenta local guardada para este usuario."
            )

        val hash = hashPassword(password)
        if (localUser.passwordHash != hash) {
            throw AuthException(
                "Sin conexión al servidor. Se encontró cuenta local pero la contraseña no coincide " +
                "(la contraseña local usa hash SHA-256, diferente al BCrypt del backend)."
            )
        }

        crearSesionLocal(localUser.id)
        UsuarioMapper.toDomain(localUser)
    }

    override suspend fun registrarCiudadano(usuario: Usuario, password: String): Usuario = withContext(Dispatchers.IO) {
        // Registrar en el backend REST
        val email = usuario.email ?: throw AuthException("El correo electrónico es obligatorio para el registro.")
        val usuarioRegistrado = remoteDataSource.registrarConEmail(email, password, usuario)

        val usuarioCompleto = usuarioRegistrado.copy(
            tipo = TipoUsuario.CIUDADANO,
            fechaRegistro = System.currentTimeMillis()
        )

        // Guardar localmente con hash de contraseña
        val entity = UsuarioMapper.toEntity(usuarioCompleto, hashPassword(password))
        insertarUsuarioLocal(entity)

        crearSesionLocal(usuarioCompleto.id)
        usuarioCompleto
    }

    override suspend fun cerrarSesion() = withContext(Dispatchers.IO) {
        queries.cerrarSesion()
        try { remoteDataSource.cerrarSesion() } catch (_: Exception) {}
    }

    override suspend fun haySesionActiva(): Boolean = withContext(Dispatchers.IO) {
        queries.getSesionActiva().executeAsOneOrNull() != null
    }

    override fun getTodosLosUsuarios(): Flow<List<Usuario>> {
        return queries.getAllUsuarios()
            .asFlow()
            .mapToList(Dispatchers.IO)
            .map { entities -> entities.map { UsuarioMapper.toDomain(it) } }
    }

    private fun crearSesionLocal(usuarioId: String) {
        queries.eliminarSesion()
        queries.insertSesion(
            usuarioId = usuarioId,
            token = UUID.randomUUID().toString(),
            fechaInicio = System.currentTimeMillis(),
            fechaExpiracion = System.currentTimeMillis() + (7 * 24 * 60 * 60 * 1000) // 7 días
        )
    }

    private fun limpiarCacheSiCambioContexto(usuarioRemoto: Usuario) {
        val sesionActiva = queries.getSesionActiva().executeAsOneOrNull() ?: return
        val usuarioPrevio = queries.getUsuarioById(sesionActiva.usuarioId).executeAsOneOrNull() ?: return

        val cambioUsuario = usuarioPrevio.id != usuarioRemoto.id
        val cambioRol = !usuarioPrevio.tipo.equals(usuarioRemoto.tipo.name, ignoreCase = true)

        if (!cambioUsuario && !cambioRol) {
            return
        }

        // Evita mezcla de datasets entre cuentas/roles y fuerza una resincronizacion completa.
        solicitudQueries.limpiarSolicitudes()
        apelacionQueries.limpiarApelaciones()
        apelacionQueries.limpiarSyncLogs()
    }

    private fun insertarUsuarioLocal(entity: com.gestion.misaip.core.database.Usuario) {
        queries.insertUsuario(
            id = entity.id, tipo = entity.tipo, nombre = entity.nombre,
            dni = entity.dni, usuario = entity.usuario, email = entity.email,
            telefono = entity.telefono, direccion = entity.direccion,
            entidad = entity.entidad, entidadId = entity.entidadId,
            cargo = entity.cargo, fechaRegistro = entity.fechaRegistro,
            passwordHash = entity.passwordHash,
            estaActivo = true, sincronizado = false,
            ultimaModificacion = System.currentTimeMillis()
        )
    }

    private fun hashPassword(password: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(password.toByteArray())
        return hash.joinToString("") { "%02x".format(it) }
    }
}
