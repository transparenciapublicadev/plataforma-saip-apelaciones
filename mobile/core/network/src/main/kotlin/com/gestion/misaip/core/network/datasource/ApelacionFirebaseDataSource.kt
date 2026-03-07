package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.network.dto.ApelacionDto
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

/**
 * Implementación de ApelacionRemoteDataSource usando Firebase Firestore.
 */
class ApelacionFirebaseDataSource(
    private val firestore: FirebaseFirestore
) : ApelacionRemoteDataSource {

    companion object {
        private const val COLLECTION = "apelaciones"
    }

    private val collection = firestore.collection(COLLECTION)

    override suspend fun crearApelacion(apelacion: Apelacion) {
        try {
            val dto = ApelacionDto.fromDomain(apelacion)
            collection.document(apelacion.id).set(dto.toMap()).await()
        } catch (e: Exception) {
            throw NetworkException("Error al crear apelación en Firebase", e)
        }
    }

    override suspend fun actualizarApelacion(apelacion: Apelacion) {
        try {
            val dto = ApelacionDto.fromDomain(apelacion)
            collection.document(apelacion.id).set(dto.toMap()).await()
        } catch (e: Exception) {
            throw NetworkException("Error al actualizar apelación en Firebase", e)
        }
    }

    override suspend fun getApelacionesUsuario(usuarioId: String): List<Apelacion> {
        return try {
            val snapshot = collection
                .whereEqualTo("usuarioId", usuarioId)
                .orderBy("fechaPresentacion", Query.Direction.DESCENDING)
                .get().await()
            snapshot.documents.mapNotNull { doc ->
                try { ApelacionDto.fromMap(doc.data ?: emptyMap()).toDomain() } catch (_: Exception) { null }
            }
        } catch (e: Exception) {
            throw NetworkException("Error al obtener apelaciones de Firebase", e)
        }
    }

    override suspend fun getTodasLasApelaciones(): List<Apelacion> {
        return try {
            val snapshot = collection
                .orderBy("fechaPresentacion", Query.Direction.DESCENDING)
                .get().await()
            snapshot.documents.mapNotNull { doc ->
                try { ApelacionDto.fromMap(doc.data ?: emptyMap()).toDomain() } catch (_: Exception) { null }
            }
        } catch (e: Exception) {
            throw NetworkException("Error al obtener todas las apelaciones", e)
        }
    }

    override suspend fun getApelacionPorExpediente(expediente: String): Apelacion? {
        return try {
            val snapshot = collection.whereEqualTo("expediente", expediente).limit(1).get().await()
            snapshot.documents.firstOrNull()?.let { doc ->
                ApelacionDto.fromMap(doc.data ?: emptyMap()).toDomain()
            }
        } catch (e: Exception) {
            throw NetworkException("Error al obtener apelación de Firebase", e)
        }
    }

    override suspend fun getApelacionesModificadasDesde(desde: Long): List<Apelacion> {
        return try {
            val snapshot = collection
                .whereGreaterThan("ultimaModificacion", desde)
                .orderBy("ultimaModificacion", Query.Direction.ASCENDING)
                .get().await()
            snapshot.documents.mapNotNull { doc ->
                try { ApelacionDto.fromMap(doc.data ?: emptyMap()).toDomain() } catch (_: Exception) { null }
            }
        } catch (e: Exception) {
            throw NetworkException("Error al sincronizar apelaciones desde Firebase", e)
        }
    }
}
