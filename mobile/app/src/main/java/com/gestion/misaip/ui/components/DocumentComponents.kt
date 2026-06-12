package com.gestion.misaip.ui.components

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.gestion.misaip.core.domain.model.Documento
import com.gestion.misaip.presentation.viewmodel.DocumentoSeleccionadoUi

private val allowedMimeTypes = arrayOf(
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain"
)

@Composable
fun DocumentUploadSection(
    selected: DocumentoSeleccionadoUi?,
    uploading: Boolean,
    error: String?,
    onFileSelected: (Uri) -> Unit,
    onClear: () -> Unit,
    onUpload: () -> Unit,
    modifier: Modifier = Modifier
) {
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let(onFileSelected)
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Upload, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Subir documento", fontWeight = FontWeight.SemiBold)
            }
            Text(
                "PDF, JPEG, PNG o TXT. Tamaño máximo: 10 MB.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(
                onClick = { launcher.launch(allowedMimeTypes) },
                enabled = !uploading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.AttachFile, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Seleccionar archivo")
            }
            selected?.let { archivo ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(archivo.nombre, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "${archivo.contentType} · ${formatFileSize(archivo.sizeBytes)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onClear, enabled = !uploading) {
                        Icon(Icons.Default.Close, contentDescription = "Quitar archivo")
                    }
                }
                Button(
                    onClick = onUpload,
                    enabled = !uploading,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (uploading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(if (uploading) "Subiendo..." else "Subir archivo")
                }
            }
            error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
fun DocumentListSection(
    documentos: List<Documento>,
    downloadingId: String?,
    onDownload: (Documento) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Documentos", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            if (documentos.isEmpty()) {
                Text(
                    "No hay documentos adjuntos.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                documentos.forEachIndexed { index, documento ->
                    DocumentItem(
                        documento = documento,
                        downloading = downloadingId == documento.id,
                        onDownload = { onDownload(documento) }
                    )
                    if (index != documentos.lastIndex) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun DocumentItem(
    documento: Documento,
    downloading: Boolean,
    onDownload: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.Default.AttachFile, contentDescription = null)
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(documento.nombreOriginal, style = MaterialTheme.typography.bodyMedium)
            Text(
                "${documento.tipoDocumento.name.replace('_', ' ')} · ${formatFileSize(documento.sizeBytes)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        DocumentDownloadAction(downloading = downloading, onClick = onDownload)
    }
}

@Composable
fun DocumentDownloadAction(
    downloading: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilledTonalButton(
        onClick = onClick,
        enabled = !downloading,
        modifier = modifier
    ) {
        if (downloading) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
        } else {
            Icon(Icons.Default.Download, contentDescription = null)
        }
        Spacer(Modifier.width(6.dp))
        Text(if (downloading) "Guardando" else "Descargar")
    }
}

private fun formatFileSize(sizeBytes: Long): String {
    if (sizeBytes < 0) return "Tamaño desconocido"
    if (sizeBytes < 1024) return "$sizeBytes B"
    val kilobytes = sizeBytes / 1024.0
    if (kilobytes < 1024) return "%.1f KB".format(kilobytes)
    return "%.1f MB".format(kilobytes / 1024.0)
}

