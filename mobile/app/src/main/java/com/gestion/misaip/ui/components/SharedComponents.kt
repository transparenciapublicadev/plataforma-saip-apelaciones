package com.gestion.misaip.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.FiberNew
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.presentation.viewmodel.NotificacionItem
import com.gestion.misaip.presentation.viewmodel.ProfileUiState
import com.gestion.misaip.ui.theme.*

// ══════════════════════════════════════════════════════════════════
// ██ StatusBadge — Badge profesional con tema adaptivo
// ══════════════════════════════════════════════════════════════════

@Composable
fun StatusBadge(
    estado: String,
    modifier: Modifier = Modifier
) {
    val isDark = isSystemInDarkTheme()
    val (bgColor, textColor) = remember(estado, isDark) {
        when {
            estado.contains("Recepcionada", true) || estado.contains("Pendiente", true) ->
                if (isDark) StatusPendingBgDark to StatusPendingTextDark
                else StatusPendingBg to StatusPendingText
            estado.contains("Revisión", true) || estado.contains("Calificación", true) ||
            estado.contains("Resolución", true) || estado.contains("Notificación", true) ->
                if (isDark) StatusReviewBgDark to StatusReviewTextDark
                else StatusReviewBg to StatusReviewText
            estado.contains("Respondida", true) || estado.contains("Fundado", true) ||
            estado.contains("Concluida", true) ->
                if (isDark) StatusRespondedBgDark to StatusRespondedTextDark
                else StatusRespondedBg to StatusRespondedText
            estado.contains("Denegada", true) || estado.contains("Infundado", true) ||
            estado.contains("Improcedente", true) || estado.contains("No Presentado", true) ->
                if (isDark) StatusDeniedBgDark to StatusDeniedTextDark
                else StatusDeniedBg to StatusDeniedText
            estado.contains("Vencida", true) || estado.contains("Silencio", true) ->
                if (isDark) StatusExpiredBgDark to StatusExpiredTextDark
                else StatusExpiredBg to StatusExpiredText
            estado.contains("Subsanación", true) ->
                if (isDark) StatusSubsanacionBgDark to StatusSubsanacionTextDark
                else StatusSubsanacionBg to StatusSubsanacionText
            estado.contains("Conclusión", true) || estado.contains("Desistimiento", true) ||
            estado.contains("Sustracción", true) || estado.contains("Resuelto", true) ->
                if (isDark) StatusResolvedBgDark to StatusResolvedTextDark
                else StatusResolvedBg to StatusResolvedText
            else ->
                if (isDark) StatusPendingBgDark to StatusPendingTextDark
                else StatusPendingBg to StatusPendingText
        }
    }

    val animatedBg by animateColorAsState(
        targetValue = bgColor,
        animationSpec = spring(stiffness = Spring.StiffnessLow),
        label = "badgeBg"
    )

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = animatedBg,
        modifier = modifier.semantics { contentDescription = "Estado: $estado" }
    ) {
        Text(
            text = estado,
            color = textColor,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
        )
    }
}

// ══════════════════════════════════════════════════════════════════
// ██ SemaphoreIndicator — Indicador visual de plazo
// ══════════════════════════════════════════════════════════════════

@Composable
fun SemaphoreIndicator(
    diasRestantes: Int?,
    modifier: Modifier = Modifier
) {
    val targetColor = remember(diasRestantes) {
        when {
            diasRestantes == null -> SemaphoreBlack
            diasRestantes < 0 -> SemaphoreBlack
            diasRestantes <= 1 -> SemaphoreRed
            diasRestantes <= 4 -> SemaphoreAmber
            else -> SemaphoreGreen
        }
    }

    val animatedColor by animateColorAsState(
        targetValue = targetColor,
        animationSpec = spring(stiffness = Spring.StiffnessLow),
        label = "semaphoreColor"
    )

    Box(
        modifier = modifier
            .size(10.dp)
            .clip(CircleShape)
            .background(animatedColor)
    )
}

// ══════════════════════════════════════════════════════════════════
// ██ Loading / Error / Empty — Estados profesionales
// ══════════════════════════════════════════════════════════════════

@Composable
fun LoadingContent(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(40.dp),
                strokeWidth = 3.dp,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "Cargando...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun ErrorContent(
    mensaje: String,
    onReintentar: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.errorContainer,
            modifier = Modifier.size(72.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.ErrorOutline,
                    contentDescription = null,
                    modifier = Modifier.size(36.dp),
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Ha ocurrido un error",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = mensaje,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        FilledTonalButton(onClick = onReintentar) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Reintentar")
        }
    }
}

@Composable
fun EmptyContent(
    mensaje: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Default.Inbox
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier.size(72.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(36.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                )
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = mensaje,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ══════════════════════════════════════════════════════════════════
// ██ StatCard — Tarjeta de estadística original (compatibilidad)
// ══════════════════════════════════════════════════════════════════

@Composable
fun StatCard(
    titulo: String,
    valor: String,
    color: Color = MaterialTheme.colorScheme.primary,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        shape = MaterialTheme.shapes.medium
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = valor,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = titulo,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ══════════════════════════════════════════════════════════════════
// ██ NotificationsTabContent — Pestaña de notificaciones embebida
// ══════════════════════════════════════════════════════════════════

@Composable
fun NotificationsTabContent(
    notificaciones: List<NotificacionItem>,
    isLoading: Boolean,
    onNotificacionClick: (NotificacionItem) -> Unit,
    modifier: Modifier = Modifier
) {
    when {
        isLoading -> LoadingContent(modifier = modifier)
        notificaciones.isEmpty() -> EmptyContent(
            "No tienes notificaciones",
            modifier = modifier,
            icon = Icons.Default.NotificationsNone
        )
        else -> LazyColumn(
            modifier = modifier,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            itemsIndexed(notificaciones, key = { _, it -> it.id }) { index, notif ->
                StaggeredAnimatedItem(index = index) {
                    InlineNotificationCard(notif, onClick = { onNotificacionClick(notif) })
                }
            }
        }
    }
}

@Composable
private fun InlineNotificationCard(
    notificacion: NotificacionItem,
    onClick: () -> Unit
) {
    val containerColor = if (notificacion.leida) {
        MaterialTheme.colorScheme.surfaceContainerLow
    } else {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Icono con fondo circular
            Surface(
                shape = CircleShape,
                color = when (notificacion.tipo) {
                    "urgente", "vencida" -> MaterialTheme.colorScheme.errorContainer
                    "nueva" -> MaterialTheme.colorScheme.primaryContainer
                    "respuesta" -> MaterialTheme.colorScheme.tertiaryContainer
                    "subsanacion" -> MaterialTheme.colorScheme.secondaryContainer
                    else -> MaterialTheme.colorScheme.surfaceContainerHigh
                },
                modifier = Modifier.size(40.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = when (notificacion.tipo) {
                            "urgente" -> Icons.Default.Warning
                            "vencida" -> Icons.Default.ErrorOutline
                            "nueva" -> Icons.Default.FiberNew
                            "respuesta" -> Icons.AutoMirrored.Filled.Reply
                            "denegada" -> Icons.Default.Block
                            "subsanacion" -> Icons.Default.Edit
                            "resolucion" -> Icons.Default.Gavel
                            else -> Icons.Default.Notifications
                        },
                        contentDescription = null,
                        tint = when (notificacion.tipo) {
                            "urgente", "vencida" -> MaterialTheme.colorScheme.onErrorContainer
                            "nueva" -> MaterialTheme.colorScheme.onPrimaryContainer
                            "respuesta" -> MaterialTheme.colorScheme.onTertiaryContainer
                            "subsanacion" -> MaterialTheme.colorScheme.onSecondaryContainer
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notificacion.titulo,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (notificacion.leida) FontWeight.Normal else FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notificacion.mensaje,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = notificacion.fecha,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
            if (!notificacion.leida) {
                PulsingDot(
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════
// ██ ProfileTabContent — Perfil embebido profesional
// ══════════════════════════════════════════════════════════════════

@Composable
fun ProfileTabContent(
    uiState: ProfileUiState,
    onCerrarSesion: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showLogoutDialog by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Avatar y nombre — diseño profesional
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
            ),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.size(88.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = uiState.nombre.take(2).uppercase(),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = uiState.nombre,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                val rolText = when (uiState.tipoUsuario) {
                    TipoUsuario.CIUDADANO -> "Ciudadano"
                    TipoUsuario.FUNCIONARIO -> "Funcionario"
                    TipoUsuario.TTAIP -> "Vocal TTAIP"
                    TipoUsuario.ADMIN -> "Administrador"
                }
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.secondaryContainer
                ) {
                    Text(
                        text = rolText,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                    )
                }
            }
        }

        // Datos personales
        ProfileSectionCard(title = "Datos Personales") {
            uiState.dni?.let { ProfileInfoItem(Icons.Default.Badge, "DNI", it) }
            uiState.email?.let { ProfileInfoItem(Icons.Default.Email, "Email", it) }
            uiState.telefono?.let { ProfileInfoItem(Icons.Default.Phone, "Teléfono", it) }
            if (uiState.fechaRegistro.isNotEmpty()) {
                ProfileInfoItem(Icons.Default.CalendarToday, "Registrado", uiState.fechaRegistro)
            }
        }

        // Datos de entidad
        if (uiState.entidad != null || uiState.cargo != null) {
            ProfileSectionCard(title = "Información Institucional") {
                uiState.entidad?.let { ProfileInfoItem(Icons.Default.Business, "Entidad", it) }
                uiState.cargo?.let { ProfileInfoItem(Icons.Default.Work, "Cargo", it) }
            }
        }

        // Estadísticas
        if (uiState.tipoUsuario != TipoUsuario.ADMIN) {
            ProfileSectionCard(title = "Estadísticas") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    if (uiState.tipoUsuario in listOf(TipoUsuario.CIUDADANO, TipoUsuario.FUNCIONARIO)) {
                        ProfileStatItem("Solicitudes", uiState.totalSolicitudes)
                    }
                    ProfileStatItem("Respondidas", uiState.respondidas)
                    if (uiState.tipoUsuario in listOf(TipoUsuario.CIUDADANO, TipoUsuario.TTAIP)) {
                        ProfileStatItem("Apelaciones", uiState.totalApelaciones)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Botón cerrar sesión
        OutlinedButton(
            onClick = { showLogoutDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
        ) {
            Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Cerrar Sesión", fontWeight = FontWeight.Medium)
        }

        Spacer(modifier = Modifier.height(16.dp))
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Cerrar Sesión", fontWeight = FontWeight.SemiBold) },
            text = { Text("¿Está seguro que desea cerrar sesión?") },
            shape = MaterialTheme.shapes.large,
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        onCerrarSesion()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Cerrar Sesión")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@Composable
private fun ProfileSectionCard(
    title: String,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        shape = MaterialTheme.shapes.medium
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun ProfileInfoItem(
    icon: ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier.size(36.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun ProfileStatItem(label: String, value: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value.toString(),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
