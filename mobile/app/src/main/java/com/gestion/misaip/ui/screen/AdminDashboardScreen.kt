package com.gestion.misaip.ui.screen

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.presentation.viewmodel.ActividadItem
import com.gestion.misaip.presentation.viewmodel.AdminDashboardEvent
import com.gestion.misaip.presentation.viewmodel.AdminDashboardUiState
import com.gestion.misaip.presentation.viewmodel.AdminDashboardViewModel
import com.gestion.misaip.presentation.viewmodel.EntidadStatsItem
import com.gestion.misaip.presentation.viewmodel.NotificationsViewModel
import com.gestion.misaip.presentation.viewmodel.ProfileEvent
import com.gestion.misaip.presentation.viewmodel.ProfileViewModel
import com.gestion.misaip.ui.components.AnimatedStatCard
import com.gestion.misaip.ui.components.NotificationsTabContent
import com.gestion.misaip.ui.components.ProfileTabContent
import com.gestion.misaip.ui.components.SectionHeader
import com.gestion.misaip.ui.components.ShimmerListPlaceholder
import com.gestion.misaip.ui.components.StaggeredAnimatedItem
import com.gestion.misaip.util.ReportExportHelper
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun AdminDashboardScreen(
    onNavigateToLogin: () -> Unit,
    welcomeMessage: String? = null,
    onWelcomeShown: () -> Unit = {},
    viewModel: AdminDashboardViewModel = koinViewModel(),
    notificationsViewModel: NotificationsViewModel = koinViewModel(),
    profileViewModel: ProfileViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val notifState by notificationsViewModel.uiState.collectAsStateWithLifecycle()
    val profileState by profileViewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        profileViewModel.cargarPerfil()
        notificationsViewModel.cargarNotificaciones()
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is AdminDashboardEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is AdminDashboardEvent.ExportReady -> snackbarHostState.showSnackbar("Archivo exportado: ${event.filePath}")
                is AdminDashboardEvent.ExportError -> snackbarHostState.showSnackbar("Error: ${event.message}")
            }
        }
    }

    LaunchedEffect(Unit) {
        profileViewModel.events.collect { event ->
            when (event) {
                is ProfileEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is ProfileEvent.NavigateToLogin -> onNavigateToLogin()
            }
        }
    }

    // Mostrar mensaje de bienvenida del login
    LaunchedEffect(welcomeMessage) {
        welcomeMessage?.let {
            snackbarHostState.showSnackbar(it)
            onWelcomeShown()
        }
    }

    AdminDashboardContent(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        context = context,
        onRefresh = viewModel::cargarDatos,
        onExportPDF = {
            val path = ReportExportHelper.exportarReporteGeneralPDF(context, uiState)
            viewModel.notificarExportacion(path, "application/pdf")
        },
        onExportExcel = {
            val path = ReportExportHelper.exportarReporteGeneralCSV(context, uiState)
            viewModel.notificarExportacion(path, "text/csv")
        },
        onNotificacionClick = { notif ->
            notificationsViewModel.marcarComoLeida(notif.id)
        },
        notificaciones = notifState.notificaciones,
        notifLoading = notifState.isLoading,
        profileUiState = profileState,
        onCerrarSesion = profileViewModel::cerrarSesion
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdminDashboardContent(
    uiState: AdminDashboardUiState,
    snackbarHostState: SnackbarHostState,
    context: Context,
    onRefresh: () -> Unit,
    onExportPDF: () -> Unit,
    onExportExcel: () -> Unit,
    onNotificacionClick: (com.gestion.misaip.presentation.viewmodel.NotificacionItem) -> Unit,
    notificaciones: List<com.gestion.misaip.presentation.viewmodel.NotificacionItem>,
    notifLoading: Boolean,
    profileUiState: com.gestion.misaip.presentation.viewmodel.ProfileUiState,
    onCerrarSesion: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Panel de Administración", fontWeight = FontWeight.Bold)
                        Text(
                            text = "Actualizado: ${uiState.ultimaActualizacion}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                actions = {
                    if (selectedTab == 0) {
                        IconButton(onClick = onExportPDF) {
                            Icon(Icons.Default.PictureAsPdf, contentDescription = "Exportar PDF")
                        }
                        IconButton(onClick = onExportExcel) {
                            Icon(Icons.Default.TableChart, contentDescription = "Exportar Excel")
                        }
                        IconButton(onClick = onRefresh) {
                            Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                        }
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
            ) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = null) },
                    label = { Text("Dashboard") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Notifications, contentDescription = null) },
                    label = { Text("Alertas") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Person, contentDescription = null) },
                    label = { Text("Perfil") }
                )
            }
        }
    ) { innerPadding ->
        when (selectedTab) {
            0 -> {
                if (uiState.isLoading) {
                    ShimmerListPlaceholder(
                        modifier = Modifier
                            .padding(innerPadding)
                            .padding(top = 16.dp)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .padding(innerPadding)
                            .fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item(key = "stats_main") {
                            SectionHeader(
                                title = "Resumen General",
                                icon = Icons.Default.Assessment
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AnimatedStatCard(
                                    titulo = "Solicitudes",
                                    valor = uiState.totalSolicitudes,
                                    icon = Icons.Default.Description,
                                    modifier = Modifier.weight(1f)
                                )
                                AnimatedStatCard(
                                    titulo = "Usuarios",
                                    valor = uiState.totalUsuarios,
                                    icon = Icons.Default.Group,
                                    color = MaterialTheme.colorScheme.secondary,
                                    modifier = Modifier.weight(1f)
                                )
                                AnimatedStatCard(
                                    titulo = "Apelaciones",
                                    valor = uiState.totalApelaciones,
                                    icon = Icons.Default.Gavel,
                                    color = MaterialTheme.colorScheme.tertiary,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        item(key = "stats_sol") {
                            SectionHeader(title = "Solicitudes por Estado")
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                AnimatedStatCard(
                                    titulo = "Pendientes",
                                    valor = uiState.solicitudesPendientes,
                                    icon = Icons.Default.Assessment,
                                    modifier = Modifier.weight(1f)
                                )
                                AnimatedStatCard(
                                    titulo = "Respondidas",
                                    valor = uiState.solicitudesRespondidas,
                                    icon = Icons.Default.Description,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                AnimatedStatCard(
                                    titulo = "Denegadas",
                                    valor = uiState.solicitudesDenegadas,
                                    icon = Icons.Default.Refresh,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.weight(1f)
                                )
                                AnimatedStatCard(
                                    titulo = "Vencidas",
                                    valor = uiState.solicitudesVencidas,
                                    icon = Icons.Default.Notifications,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        item(key = "stats_users") {
                            SectionHeader(title = "Usuarios por Tipo")
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AnimatedStatCard(
                                    titulo = "Ciudadanos",
                                    valor = uiState.ciudadanos,
                                    icon = Icons.Default.Person,
                                    modifier = Modifier.weight(1f)
                                )
                                AnimatedStatCard(
                                    titulo = "Funcionarios",
                                    valor = uiState.funcionarios,
                                    icon = Icons.Default.TableChart,
                                    modifier = Modifier.weight(1f)
                                )
                                AnimatedStatCard(
                                    titulo = "TTAIP",
                                    valor = uiState.vocalesTTAIP,
                                    icon = Icons.Default.Gavel,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        if (uiState.actividadReciente.isNotEmpty()) {
                            item(key = "actividad_header") {
                                SectionHeader(title = "Actividad Reciente")
                            }
                            itemsIndexed(
                                items = uiState.actividadReciente,
                                key = { _, it -> "${it.tipo}_${it.timestamp}" }
                            ) { index, actividad ->
                                StaggeredAnimatedItem(index = index) {
                                    ActividadCard(actividad)
                                }
                            }
                        }

                        if (uiState.entidadesConStats.isNotEmpty()) {
                            item(key = "entidades_header") {
                                SectionHeader(title = "Entidades")
                            }
                            itemsIndexed(
                                items = uiState.entidadesConStats,
                                key = { _, it -> it.nombre }
                            ) { index, entidad ->
                                StaggeredAnimatedItem(index = index) {
                                    EntidadStatsCard(entidad)
                                }
                            }
                        }
                    }
                }
            }
            1 -> {
                NotificationsTabContent(
                    notificaciones = notificaciones,
                    isLoading = notifLoading,
                    onNotificacionClick = onNotificacionClick,
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize()
                )
            }
            2 -> {
                ProfileTabContent(
                    uiState = profileUiState,
                    onCerrarSesion = onCerrarSesion,
                    modifier = Modifier.padding(innerPadding)
                )
            }
        }
    }
}

@Composable
private fun ActividadCard(item: ActividadItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = if (item.tipo == "solicitud") Icons.Default.Description else Icons.Default.Gavel,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier
                        .padding(8.dp)
                        .size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.descripcion,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "${item.usuario} · ${item.fecha}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun EntidadStatsCard(item: EntidadStatsItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = item.nombre,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Barra de progreso visual
            val total = item.solicitudes.coerceAtLeast(1)
            val respondidoPct = item.respondidas.toFloat() / total
            LinearProgressIndicator(
                progress = { respondidoPct },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Total: ${item.solicitudes}", style = MaterialTheme.typography.bodySmall)
                Text("Pendientes: ${item.pendientes}", style = MaterialTheme.typography.bodySmall)
                Text("Respondidas: ${item.respondidas}", style = MaterialTheme.typography.bodySmall)
                if (item.vencidas > 0) {
                    Text(
                        "Vencidas: ${item.vencidas}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}
