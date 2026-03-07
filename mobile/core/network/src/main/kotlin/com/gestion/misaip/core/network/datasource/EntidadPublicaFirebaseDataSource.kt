package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.network.dto.EntidadPublicaDto
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/**
 * Implementación de EntidadPublicaRemoteDataSource usando Firebase Firestore.
 */
class EntidadPublicaFirebaseDataSource(
    private val firestore: FirebaseFirestore
) : EntidadPublicaRemoteDataSource {

    companion object {
        private const val COLLECTION = "entidades"
    }

    private val collection = firestore.collection(COLLECTION)

    override suspend fun getEntidadesActivas(): List<EntidadPublica> {
        return try {
            val snapshot = collection
                .whereEqualTo("activa", true)
                .get().await()
            snapshot.documents.mapNotNull { doc ->
                try { EntidadPublicaDto.fromMap(doc.data ?: emptyMap()).toDomain() } catch (_: Exception) { null }
            }
        } catch (e: Exception) {
            throw NetworkException("Error al obtener entidades públicas", e)
        }
    }

    override suspend fun getEntidadPorId(id: String): EntidadPublica? {
        return try {
            val doc = collection.document(id).get().await()
            if (doc.exists()) {
                EntidadPublicaDto.fromMap(doc.data ?: emptyMap()).toDomain()
            } else null
        } catch (e: Exception) {
            throw NetworkException("Error al obtener entidad pública", e)
        }
    }

    override suspend fun sincronizar(): List<EntidadPublica> {
        return getEntidadesActivas()
    }
}
