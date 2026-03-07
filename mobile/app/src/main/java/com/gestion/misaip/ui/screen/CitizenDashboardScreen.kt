package com.gestion.misaip.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.derivedStateOf
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
import com.gestion.misaip.presentation.viewmodel.CitizenDashboardUiState
import com.gestion.misaip.presentation.viewmodel.CitizenDashboardViewModel
import com.gestion.misaip.presentation.viewmodel.ExpedienteItem
import com.gestion.misaip.presentation.viewmodel.NotificationsViewModel
import com.gestion.misaip.presentation.viewmodel.ProfileEvent
import com.gestion.misaip.presentation.viewmodel.ProfileViewModel
import com.gestion.misaip.ui.components.AnimatedStatCard
import com.gestion.misaip.ui.components.EmptyContent
import com.gestion.misaip.ui.components.LoadingContent
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
fun CitizenDashboardScreen(
    onNavigateToDetail: (String, String) -> Unit,
    onNavigateToSAIPForm: () -> Unit,
    onNavigateToLogin: () -> Unit,
    welcomeMessage: String? = null,
    onWelcomeShown: () -> Unit = {},
    viewModel: CitizenDashboardViewModel = koinViewModel(),
    notificationsViewModel: NotificationsViewModel = koinViewModel(),
    profileViewModel: ProfileViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val notifState by notificationsViewModel.uiState.collectAsStateWithLifecycle()
    val profileState by profileViewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }
    val snackbarHostState = remember { SnackbarHostState() }

    // Recargar datos cada vez que esta screen entra en composición
    // (por ejemplo, al volver del formulario SAIP con una solicitud nueva)
    LaunchedEffect(Unit) {
        viewModel.cargarDatos()
        profileViewModel.cargarPerfil()
        notificationsViewModel.cargarNotificaciones()
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

    val listState = rememberLazyListState()
    // Google Messages pattern: FAB expanded when user scrolls up or is at top
    val fabExpanded by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex == 0 ||
                listState.lastScrolledBackward
        }
    }
    val coroutineScope = rememberCoroutineScope()

    CitizenDashboardContent(
        uiState = uiState,
        selectedTab = selectedTab,
        snackbarHostState = snackbarHostState,
        listState = listState,
        fabExpanded = fabExpanded,
        onTabSelected = {
            selectedTab = it
        },
        onBuscar = viewModel::buscar,
        onFiltrar = { filtro ->
            viewModel.aplicarFiltro(filtro)
            // Scroll al inicio al cambiar filtro
            coroutineScope.launch { listState.animateScrollToItem(0) }
        },
        onRefresh = viewModel::cargarDatos,
        onExpedienteClick = { exp -> onNavigateToDetail(exp.expediente, exp.tipo) },
        onNuevaSolicitud = onNavigateToSAIPForm,
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
private fun CitizenDashboardContent(
    uiState: CitizenDashboardUiState,
    selectedTab: Int,
    snackbarHostState: SnackbarHostState,
    listState: LazyListState,
    fabExpanded: Boolean,
    onTabSelected: (Int) -> Unit,
    onBuscar: (String) -> Unit,
    onFiltrar: (String) -> Unit,
    onRefresh: () -> Unit,
    onExpedienteClick: (ExpedienteItem) -> Unit,
    onNuevaSolicitud: () -> Unit,
    onNotificacionClick: (com.gestion.misaip.presentation.viewmodel.NotificacionItem) -> Unit,
    notificaciones: List<com.gestion.misaip.presentation.viewmodel.NotificacionItem>,
    notifLoading: Boolean,
    profileUiState: com.gestion.misaip.presentation.viewmodel.ProfileUiState,
    onCerrarSesion: () -> Unit
) {
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Mis Trámites", fontWeight = FontWeight.Bold)
                        if (uiState.nombreUsuario.isNotEmpty()) {
                            Text(
                                text = "Hola, ${uiState.nombreUsuario}",
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
        floatingActionButton = {
            AnimatedVisibility(
                visible = selectedTab == 0,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                ExtendedFloatingActionButton(
                    onClick = onNuevaSolicitud,
                    expanded = fabExpanded,
                    containerColor = MaterialTheme.colorScheme.primary,
                    shape = MaterialTheme.shapes.large,
                    icon = { Icon(Icons.Default.Add, contentDescription = "Nueva Solicitud") },
                    text = { Text("Crear Solicitud") }
                )
            }
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
            ) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { onTabSelected(0) },
                    icon = { Icon(Icons.Default.Home, contentDescription = null) },
                    label = { Text("Inicio") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onNuevaSolicitud,
                    icon = { Icon(Icons.Default.Description, contentDescription = null) },
                    label = { Text("Crear SAIP") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { onTabSelected(1) },
                    icon = { Icon(Icons.Default.Notifications, contentDescription = null) },
                    label = { Text("Alertas") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { onTabSelected(2) },
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
                                titulo = "Total",
                                valor = uiState.estadisticas.total,
                                icon = Icons.Default.Assessment,
                                modifier = Modifier.weight(1f)
                            )
                            AnimatedStatCard(
                                titulo = "En Proceso",
                                valor = uiState.estadisticas.enProceso,
                                icon = Icons.Default.HourglassEmpty,
                                color = MaterialTheme.colorScheme.tertiary,
                                modifier = Modifier.weight(1f)
                            )
                            AnimatedStatCard(
                                titulo = "Respondidas",
                                valor = uiState.estadisticas.respondidas,
                                icon = Icons.Default.TaskAlt,
                                color = MaterialTheme.colorScheme.secondary,
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
                            placeholder = { Text("Buscar por expediente o asunto...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                        )

                        // Filtros
                        val filtros = remember { listOf("todas", "SAIP", "Apelación", "En Proceso", "Respondida", "Denegada") }
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

                        // Lista de expedientes con animación staggered
                        if (uiState.expedientesFiltrados.isEmpty()) {
                            EmptyContent(
                                "No se encontraron trámites",
                                icon = Icons.Default.Description,
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
                                    items = uiState.expedientesFiltrados,
                                    key = { _, it -> it.expediente }
                                ) { index, expediente ->
                                    StaggeredAnimatedItem(index = index) {
                                        ExpedienteCard(
                                            item = expediente,
                                            onClick = { onExpedienteClick(expediente) }
                                        )
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
private fun ExpedienteCard(
    item: ExpedienteItem,
    onClick: () -> Unit
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
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${item.entidad} · ${item.fecha}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Apelación vinculada: solo mostrar expediente (sin segundo StatusBadge)
            if (item.apelacionVinculada != null) {
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 8.dp),
                    color = MaterialTheme.colorScheme.outlineVariant
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Gavel,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.tertiary
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Apelación: ${item.apelacionVinculada.expediente}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
            }

            // Días restantes con indicador visual
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
        }
    }
}
