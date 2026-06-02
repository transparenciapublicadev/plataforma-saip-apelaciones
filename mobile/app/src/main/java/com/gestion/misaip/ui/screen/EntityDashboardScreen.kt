package com.gestion.misaip.ui.screen

import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentLate
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.presentation.viewmodel.EntityDashboardEvent
import com.gestion.misaip.presentation.viewmodel.EntityDashboardUiState
import com.gestion.misaip.presentation.viewmodel.EntityDashboardViewModel
import com.gestion.misaip.presentation.viewmodel.NotificationsViewModel
import com.gestion.misaip.presentation.viewmodel.ProfileEvent
import com.gestion.misaip.presentation.viewmodel.ProfileViewModel
import com.gestion.misaip.presentation.viewmodel.SolicitudEntidadItem
import com.gestion.misaip.ui.components.AnimatedStatCard
import com.gestion.misaip.ui.components.EmptyContent
import com.gestion.misaip.ui.components.NotificationsTabContent
import com.gestion.misaip.ui.components.PulsingDot
import com.gestion.misaip.ui.components.ProfileTabContent
import com.gestion.misaip.ui.components.SemaphoreIndicator
import com.gestion.misaip.ui.components.ShimmerListPlaceholder
import com.gestion.misaip.ui.components.StaggeredAnimatedItem
import com.gestion.misaip.ui.components.StatusBadge
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun EntityDashboardScreen(
    onNavigateToDetail: (String, String) -> Unit,
    onNavigateToLogin: () -> Unit,
    welcomeMessage: String? = null,
    onWelcomeShown: () -> Unit = {},
    viewModel: EntityDashboardViewModel = koinViewModel(),
    notificationsViewModel: NotificationsViewModel = koinViewModel(),
    profileViewModel: ProfileViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val notifState by notificationsViewModel.uiState.collectAsStateWithLifecycle()
    val profileState by profileViewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        viewModel.cargarDatos()
        profileViewModel.cargarPerfil()
        notificationsViewModel.cargarNotificaciones()
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is EntityDashboardEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is EntityDashboardEvent.NavigateToDetail -> onNavigateToDetail(event.expediente, "SAIP")
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

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    }

    EntityDashboardContent(
        uiState = uiState,
        listState = listState,
        snackbarHostState = snackbarHostState,
        onBuscar = viewModel::buscar,
        onFiltrar = { filtro ->
            viewModel.aplicarFiltro(filtro)
            coroutineScope.launch { listState.animateScrollToItem(0) }
        },
        onRefresh = viewModel::cargarDatos,
        onLoadMore = viewModel::cargarSiguientePagina,
        onSolicitudClick = { sol -> onNavigateToDetail(sol.expediente, "SAIP") },
        onIniciarRevision = viewModel::iniciarRevision,
        onNotificacionClick = { notif ->
            notificationsViewModel.marcarComoLeida(notif.id)
            notif.expediente?.let { exp ->
                val tipo = if (notif.tipo in listOf("subsanacion", "resolucion", "nueva")) "APELACION" else "SAIP"
                onNavigateToDetail(exp, tipo)
            }
        },
        notificaciones = notifState.notificaciones,
        notifLoading = notifState.isLoading,
        profileUiState = profileState,
        onCerrarSesion = profileViewModel::cerrarSesion
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EntityDashboardContent(
    uiState: EntityDashboardUiState,
    listState: LazyListState,
    snackbarHostState: SnackbarHostState,
    onBuscar: (String) -> Unit,
    onFiltrar: (String) -> Unit,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onSolicitudClick: (SolicitudEntidadItem) -> Unit,
    onIniciarRevision: (String) -> Unit,
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
                        Text("Bandeja de Solicitudes", fontWeight = FontWeight.Bold)
                        if (uiState.entidad.isNotEmpty()) {
                            Text(
                                text = uiState.entidad,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                actions = {
                    if (selectedTab == 0) {
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
                    icon = { Icon(Icons.Default.Home, contentDescription = null) },
                    label = { Text("Inicio") }
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
                    Column(
                        modifier = Modifier
                            .padding(innerPadding)
                            .fillMaxSize()
                    ) {
                        // Estadísticas animadas
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            AnimatedStatCard(
                                titulo = "Pendientes",
                                valor = uiState.estadisticas.pendientes,
                                icon = Icons.Default.HourglassEmpty,
                                modifier = Modifier.weight(1f)
                            )
                            AnimatedStatCard(
                                titulo = "Respondidas",
                                valor = uiState.estadisticas.respondidas,
                                icon = Icons.Default.CheckCircle,
                                color = MaterialTheme.colorScheme.secondary,
                                modifier = Modifier.weight(1f)
                            )
                            AnimatedStatCard(
                                titulo = "Vencidas",
                                valor = uiState.estadisticas.vencidas,
                                icon = Icons.Default.AssignmentLate,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        // Búsqueda
                        var searchQuery by remember { mutableStateOf(uiState.busqueda) }
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = {
                                searchQuery = it
                                onBuscar(it)
                            },
                            placeholder = { Text("Buscar por expediente o solicitante...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                        )

                        // Filtros
                        val filtros = remember { listOf("todas", "Pendiente", "En Revisión", "Respondida", "Vencida") }
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(filtros, key = { it }) { filtro ->
                                FilterChip(
                                    selected = uiState.filtroActual == filtro,
                                    onClick = { onFiltrar(filtro) },
                                    label = { Text(if (filtro == "todas") "Todas" else filtro) }
                                )
                            }
                        }

                        // Lista de solicitudes con animación staggered
                        if (uiState.solicitudesFiltradas.isEmpty()) {
                            EmptyContent(
                                "No se encontraron solicitudes",
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            LazyColumn(
                                state = listState,
                                modifier = Modifier.weight(1f),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                itemsIndexed(
                                    items = uiState.solicitudesFiltradas,
                                    key = { _, it -> it.expediente }
                                ) { index, solicitud ->
                                    StaggeredAnimatedItem(index = index) {
                                        SolicitudEntidadCard(
                                            item = solicitud,
                                            onClick = { onSolicitudClick(solicitud) },
                                            onIniciarRevision = { onIniciarRevision(solicitud.expediente) }
                                        )
                                    }
                                }
                                if (uiState.puedeCargarMas) {
                                    item(key = "load-more") {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.Center
                                        ) {
                                            FilledTonalButton(
                                                onClick = onLoadMore,
                                                enabled = !uiState.isLoadingMore
                                            ) {
                                                if (uiState.isLoadingMore) {
                                                    CircularProgressIndicator(
                                                        modifier = Modifier.size(18.dp),
                                                        strokeWidth = 2.dp
                                                    )
                                                } else {
                                                    Text("Cargar más")
                                                }
                                            }
                                        }
                                    }
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
private fun SolicitudEntidadCard(
    item: SolicitudEntidadItem,
    onClick: () -> Unit,
    onIniciarRevision: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    SemaphoreIndicator(diasRestantes = item.diasRestantes)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = item.expediente,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(estado = item.estado)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = item.asunto,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Solicitante: ${item.solicitante} · ${item.fecha}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            item.diasRestantes?.let { dias ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 6.dp)
                ) {
                    if (dias <= 2 && dias > 0) {
                        PulsingDot(
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(end = 6.dp)
                        )
                    }
                    Text(
                        text = if (dias > 0) "$dias días restantes" else "Plazo vencido",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (dias <= 2) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (dias <= 0) MaterialTheme.colorScheme.error
                               else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Botón iniciar revisión si está recepcionada
            if (item.estado == "Recepcionada") {
                Spacer(modifier = Modifier.height(10.dp))
                FilledTonalButton(
                    onClick = onIniciarRevision,
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Icon(
                        Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.padding(end = 6.dp)
                    )
                    Text("Iniciar Revisión")
                }
            }
        }
    }
}
