package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.network.dto.UsuarioDto
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/**
 * Implementación de UsuarioRemoteDataSource usando Firebase Auth + Firestore.
 */
class UsuarioFirebaseDataSource(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : UsuarioRemoteDataSource {

    companion object {
        private const val COLLECTION = "usuarios"
    }

    private val collection = firestore.collection(COLLECTION)

    override suspend fun autenticar(identificador: String, password: String): Usuario {
        return try {
            // Construir email para Firebase Auth a partir del identificador genérico
            val email = when {
                identificador.contains("@") -> identificador
                identificador.matches(Regex("\\d{8}")) -> "$identificador@misaip.gob.pe"
                else -> "$identificador@misaip.gob.pe"
            }
            val result = auth.signInWithEmailAndPassword(email, password).await()
            val uid = result.user?.uid ?: throw NetworkException("No se pudo obtener el UID")
            getUsuarioPorId(uid) ?: throw NetworkException("Usuario no encontrado en Firestore")
        } catch (e: NetworkException) {
            throw e
        } catch (e: Exception) {
            throw NetworkException("Error de autenticación: ${e.message}", e)
        }
    }

    override suspend fun registrarConEmail(email: String, password: String, usuario: Usuario): Usuario {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, password).await()
            val uid = result.user?.uid ?: throw NetworkException("No se pudo crear el usuario")
            val usuarioConId = usuario.copy(id = uid)
            val dto = UsuarioDto.fromDomain(usuarioConId)
            collection.document(uid).set(dto.toMap()).await()
            usuarioConId
        } catch (e: NetworkException) {
            throw e
        } catch (e: Exception) {
            throw NetworkException("Error al registrar usuario: ${e.message}", e)
        }
    }

    override suspend fun cerrarSesion() {
        auth.signOut()
    }

    override suspend fun getUsuarioPorId(id: String): Usuario? {
        return try {
            val doc = collection.document(id).get().await()
            if (doc.exists()) {
                UsuarioDto.fromMap(doc.data ?: emptyMap()).toDomain()
            } else null
        } catch (e: Exception) {
            throw NetworkException("Error al obtener usuario: ${e.message}", e)
        }
    }

    override suspend fun actualizarUsuario(usuario: Usuario) {
        try {
            val dto = UsuarioDto.fromDomain(usuario)
            collection.document(usuario.id).set(dto.toMap()).await()
        } catch (e: Exception) {
            throw NetworkException("Error al actualizar usuario: ${e.message}", e)
        }
    }

    override suspend fun haySesionActiva(): Boolean {
        return auth.currentUser != null
    }
}
