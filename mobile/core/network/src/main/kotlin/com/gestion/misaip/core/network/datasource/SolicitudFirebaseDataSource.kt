package com.gestion.misaip.core.network.datasource

import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.network.dto.SolicitudDto
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

/**
 * Implementación de SolicitudRemoteDataSource usando Firebase Firestore.
 *
 * Esta clase encapsula toda la lógica de Firebase, permitiendo que el resto
 * de la aplicación sea agnóstico al backend utilizado.
 *
 * @param firestore Instancia de Firebase Firestore
 */
class SolicitudFirebaseDataSource(
    private val firestore: FirebaseFirestore
) : SolicitudRemoteDataSource {

    companion object {
        private const val COLLECTION_SOLICITUDES = "solicitudes"
    }

    private val solicitudesCollection = firestore.collection(COLLECTION_SOLICITUDES)

    /**
     * Crea una nueva solicitud en Firestore.
     */
    override suspend fun crearSolicitud(solicitud: Solicitud) {
        try {
            val dto = SolicitudDto.fromDomain(solicitud)
            solicitudesCollection
                .document(solicitud.id)
                .set(dto.toMap())
                .await()
        } catch (e: Exception) {
            throw NetworkException("Error al crear solicitud en Firebase", e)
        }
    }

    /**
     * Actualiza una solicitud existente en Firestore.
     */
    override suspend fun actualizarSolicitud(solicitud: Solicitud) {
        try {
            val dto = SolicitudDto.fromDomain(solicitud)
            solicitudesCollection
                .document(solicitud.id)
                .set(dto.toMap())
                .await()
        } catch (e: Exception) {
            throw NetworkException("Error al actualizar solicitud en Firebase", e)
        }
    }

    /**
     * Obtiene las solicitudes de un usuario desde Firestore.
     */
    override suspend fun getSolicitudesUsuario(usuarioId: String): List<Solicitud> {
        return try {
            val snapshot = solicitudesCollection
                .whereEqualTo("usuarioId", usuarioId)
                .orderBy("fechaCreacion", Query.Direction.DESCENDING)
                .get()
                .await()

            snapshot.documents.mapNotNull { doc ->
                try {
                    SolicitudDto.fromMap(doc.data ?: emptyMap()).toDomain()
                } catch (e: Exception) {
                    null // Ignorar documentos mal formados
                }
            }
        } catch (e: Exception) {
            throw NetworkException("Error al obtener solicitudes de Firebase", e)
        }
    }

    /**
     * Obtiene una solicitud por su expediente.
     */
    override suspend fun getSolicitudPorExpediente(expediente: String): Solicitud? {
        return try {
            val snapshot = solicitudesCollection
                .whereEqualTo("expediente", expediente)
                .limit(1)
                .get()
                .await()

            snapshot.documents.firstOrNull()?.let { doc ->
                SolicitudDto.fromMap(doc.data ?: emptyMap()).toDomain()
            }
        } catch (e: Exception) {
            throw NetworkException("Error al obtener solicitud de Firebase", e)
        }
    }

    /**
     * Obtiene solicitudes modificadas después de una fecha.
     */
    override suspend fun getSolicitudesModificadasDesde(desde: Long): List<Solicitud> {
        return try {
            val snapshot = solicitudesCollection
                .whereGreaterThan("ultimaModificacion", desde)
                .orderBy("ultimaModificacion", Query.Direction.ASCENDING)
                .get()
                .await()

            snapshot.documents.mapNotNull { doc ->
                try {
                    SolicitudDto.fromMap(doc.data ?: emptyMap()).toDomain()
                } catch (e: Exception) {
                    null
                }
            }
        } catch (e: Exception) {
            throw NetworkException("Error al sincronizar desde Firebase", e)
        }
    }
}

