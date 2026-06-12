package com.gestion.misaip.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.gestion.misaip.core.domain.model.ArchivoDocumento
import com.gestion.misaip.core.domain.model.DestinoDescargaDocumento

class DocumentoContentResolver(
    context: Context
) {
    private val contentResolver = context.applicationContext.contentResolver

    fun resolveUpload(uri: Uri): ArchivoDocumento {
        val metadata = contentResolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            ResolvedMetadata(
                name = nameIndex.takeIf { it >= 0 }?.let(cursor::getString).orEmpty(),
                size = sizeIndex.takeIf { it >= 0 }?.let(cursor::getLong) ?: -1L
            )
        }

        val nombre = metadata?.name.orEmpty().ifBlank { "documento" }
        val size = metadata?.size?.takeIf { it >= 0 }
            ?: contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length }
            ?: -1L
        val contentType = contentResolver.getType(uri)
            ?.takeUnless { it == "application/octet-stream" }
            ?: inferContentType(nombre)

        return ArchivoDocumento(
            nombre = nombre,
            contentType = contentType,
            sizeBytes = size,
            abrirContenido = {
                contentResolver.openInputStream(uri)
                    ?: throw IllegalStateException("No se pudo abrir el archivo seleccionado.")
            }
        )
    }

    fun resolveDownload(uri: Uri): DestinoDescargaDocumento {
        return DestinoDescargaDocumento(
            abrirDestino = {
                contentResolver.openOutputStream(uri, "w")
                    ?: throw IllegalStateException("No se pudo abrir el destino de descarga.")
            }
        )
    }

    private fun inferContentType(name: String): String {
        return when (name.substringAfterLast('.', "").lowercase()) {
            "pdf" -> "application/pdf"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "txt" -> "text/plain"
            else -> "application/octet-stream"
        }
    }

    private data class ResolvedMetadata(
        val name: String,
        val size: Long
    )
}

