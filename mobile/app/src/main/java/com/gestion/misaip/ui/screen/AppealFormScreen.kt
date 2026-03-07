package com.gestion.misaip.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.presentation.viewmodel.AppealFormEvent
import com.gestion.misaip.presentation.viewmodel.AppealFormUiState
import com.gestion.misaip.presentation.viewmodel.AppealFormViewModel
import com.gestion.misaip.ui.components.StatusBadge
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun AppealFormScreen(
    expedienteSAIP: String?,
    onNavigateBack: () -> Unit,
    viewModel: AppealFormViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Pre-cargar expediente si viene de la pantalla de detalle
    LaunchedEffect(expedienteSAIP) {
        if (!expedienteSAIP.isNullOrBlank()) {
            viewModel.setExpedienteSAIP(expedienteSAIP)
            viewModel.buscarExpediente()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is AppealFormEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is AppealFormEvent.ApelacionCreada -> { /* Se maneja en NavigateBack */ }
                is AppealFormEvent.NavigateBack -> onNavigateBack()
            }
        }
    }

    AppealFormContent(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        expedientePreCargado = !expedienteSAIP.isNullOrBlank(),
        onNavigateBack = onNavigateBack,
        onExpedienteChange = viewModel::setExpedienteSAIP,
        onBuscarExpediente = viewModel::buscarExpediente,
        onFundamentoChange = viewModel::actualizarFundamentoLegal,
        onHechosChange = viewModel::actualizarExposicionHechos,
        onPretensionChange = viewModel::actualizarPretension,
        onToggleDeclaracion = viewModel::toggleDeclaracionJurada,
        onEnviar = viewModel::validarYEnviar
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppealFormContent(
    uiState: AppealFormUiState,
    snackbarHostState: SnackbarHostState,
    expedientePreCargado: Boolean,
    onNavigateBack: () -> Unit,
    onExpedienteChange: (String) -> Unit,
    onBuscarExpediente: () -> Unit,
    onFundamentoChange: (String) -> Unit,
    onHechosChange: (String) -> Unit,
    onPretensionChange: (String) -> Unit,
    onToggleDeclaracion: () -> Unit,
    onEnviar: () -> Unit
) {
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Recurso de Apelación", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Búsqueda de expediente SAIP
            Text("Paso 1: Buscar Solicitud SAIP", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = uiState.expedienteSAIP,
                    onValueChange = onExpedienteChange,
                    label = { Text("N° Expediente SAIP") },
                    supportingText = uiState.errorExpediente?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    isError = uiState.errorExpediente != null,
                    singleLine = true,
                    readOnly = expedientePreCargado,
                    enabled = !expedientePreCargado,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.weight(1f)
                )
                if (!expedientePreCargado) {
                    FilledIconButton(
                        onClick = onBuscarExpediente,
                        modifier = Modifier.padding(top = 8.dp)
                    ) {
                        Icon(Icons.Default.Search, contentDescription = "Buscar")
                    }
                }
            }

            // Info de solicitud encontrada
            AnimatedVisibility(visible = uiState.solicitudEncontrada != null) {
                uiState.solicitudEncontrada?.let { sol ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Solicitud encontrada", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
                                StatusBadge(estado = sol.estado.toDisplayString())
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(sol.expediente, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text("Entidad: ${sol.entidad}", style = MaterialTheme.typography.bodySmall)
                            Text("Asunto: ${sol.asunto}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            // Formulario de apelación (solo si hay solicitud encontrada)
            AnimatedVisibility(visible = uiState.solicitudEncontrada != null) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HorizontalDivider()
                    Text("Paso 2: Datos de la Apelación", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

                    OutlinedTextField(
                        value = uiState.fundamentoLegal,
                        onValueChange = onFundamentoChange,
                        label = { Text("Fundamento Legal *") },
                        supportingText = uiState.errorFundamentoLegal?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                        isError = uiState.errorFundamentoLegal != null,
                        minLines = 3,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = uiState.exposicionHechos,
                        onValueChange = onHechosChange,
                        label = { Text("Exposición de Hechos *") },
                        supportingText = uiState.errorHechos?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                        isError = uiState.errorHechos != null,
                        minLines = 3,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = uiState.pretension,
                        onValueChange = onPretensionChange,
                        label = { Text("Pretensión *") },
                        supportingText = uiState.errorPretension?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                        isError = uiState.errorPretension != null,
                        minLines = 2,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Declaración jurada
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Checkbox(
                            checked = uiState.aceptaDeclaracion,
                            onCheckedChange = { onToggleDeclaracion() }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "Declaro bajo juramento que la información proporcionada es verídica y que no he interpuesto idéntica pretensión ante el Poder Judicial.",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                    }

                    // Botón enviar
                    Button(
                        onClick = onEnviar,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = MaterialTheme.shapes.medium,
                        enabled = !uiState.isLoading && uiState.solicitudEncontrada != null
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text("Presentar Apelación")
                    }
                }
            }
        }
    }
}
