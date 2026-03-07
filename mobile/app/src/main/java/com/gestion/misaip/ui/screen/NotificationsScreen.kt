package com.gestion.misaip.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.presentation.viewmodel.NotificacionItem
import com.gestion.misaip.presentation.viewmodel.NotificationsUiState
import com.gestion.misaip.presentation.viewmodel.NotificationsViewModel
import com.gestion.misaip.ui.components.EmptyContent
import com.gestion.misaip.ui.components.LoadingContent
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun NotificationsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToDetail: (String, String) -> Unit,
    viewModel: NotificationsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    NotificationsContent(
        uiState = uiState,
        onNavigateBack = onNavigateBack,
        onNotificacionClick = { notif ->
            viewModel.marcarComoLeida(notif.id)
            notif.expediente?.let { exp ->
                val tipo = if (notif.tipo in listOf("subsanacion", "resolucion", "nueva")) "APELACION" else "SAIP"
                onNavigateToDetail(exp, tipo)
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationsContent(
    uiState: NotificationsUiState,
    onNavigateBack: () -> Unit,
    onNotificacionClick: (NotificacionItem) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notificaciones", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { innerPadding ->
        when {
            uiState.isLoading -> LoadingContent(modifier = Modifier.padding(innerPadding))
            uiState.notificaciones.isEmpty() -> {
                EmptyContent(
                    mensaje = "No hay notificaciones",
                    modifier = Modifier.padding(innerPadding)
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.padding(innerPadding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(
                        items = uiState.notificaciones,
                        key = { it.id }
                    ) { notificacion ->
                        NotificacionCard(
                            notificacion = notificacion,
                            onClick = { onNotificacionClick(notificacion) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificacionCard(
    notificacion: NotificacionItem,
    onClick: () -> Unit
) {
    val containerColor = if (notificacion.leida) {
        MaterialTheme.colorScheme.surface
    } else {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    }

    val iconColor = when (notificacion.tipo) {
        "urgente", "vencida" -> MaterialTheme.colorScheme.error
        "nueva" -> MaterialTheme.colorScheme.primary
        "respuesta" -> MaterialTheme.colorScheme.tertiary
        "subsanacion" -> MaterialTheme.colorScheme.secondary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    val icon = when (notificacion.tipo) {
        "urgente" -> Icons.Default.Warning
        "vencida" -> Icons.Default.Error
        "nueva" -> Icons.Default.FiberNew
        "respuesta" -> Icons.AutoMirrored.Filled.Reply
        "denegada" -> Icons.Default.Block
        "subsanacion" -> Icons.Default.Edit
        "resolucion" -> Icons.Default.Gavel
        else -> Icons.Default.Notifications
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = containerColor)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notificacion.titulo,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (notificacion.leida) FontWeight.Normal else FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    if (!notificacion.leida) {
                        Surface(
                            shape = MaterialTheme.shapes.small,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(8.dp)
                        ) {}
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notificacion.mensaje,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notificacion.fecha,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
        }
    }
}
