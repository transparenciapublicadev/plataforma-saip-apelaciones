package com.gestion.misaip.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.presentation.viewmodel.SAIPFormEvent
import com.gestion.misaip.presentation.viewmodel.SAIPFormUiState
import com.gestion.misaip.presentation.viewmodel.SAIPFormViewModel
import com.gestion.misaip.core.domain.model.CanalNotificacion
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun SAIPFormScreen(
    onNavigateBack: () -> Unit,
    onSolicitudCreada: (String) -> Unit,
    viewModel: SAIPFormViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Limpiar formulario al entrar (el ViewModel se reutiliza por Koin)
    LaunchedEffect(Unit) {
        viewModel.limpiarFormulario()
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is SAIPFormEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is SAIPFormEvent.SolicitudCreada -> onSolicitudCreada(event.expediente)
                is SAIPFormEvent.NavigateBack -> onNavigateBack()
            }
        }
    }

    SAIPFormContent(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        onNavigateBack = onNavigateBack,
        onSeleccionarEntidad = viewModel::seleccionarEntidad,
        onActualizarAsunto = viewModel::actualizarAsunto,
        onActualizarDescripcion = viewModel::actualizarDescripcion,
        onActualizarConsentimiento = viewModel::actualizarConsentimiento,
        onSeleccionarCanalNotificacion = viewModel::seleccionarCanalNotificacion,
        onEnviar = viewModel::validarYEnviar
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SAIPFormContent(
    uiState: SAIPFormUiState,
    snackbarHostState: SnackbarHostState,
    onNavigateBack: () -> Unit,
    onSeleccionarEntidad: (String) -> Unit,
    onActualizarAsunto: (String) -> Unit,
    onActualizarDescripcion: (String) -> Unit,
    onActualizarConsentimiento: (Boolean) -> Unit,
    onSeleccionarCanalNotificacion: (CanalNotificacion) -> Unit,
    onEnviar: () -> Unit
) {
    var entidadExpanded by remember { mutableStateOf(false) }
    var canalExpanded by remember { mutableStateOf(false) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Nueva Solicitud SAIP", fontWeight = FontWeight.Bold) },
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
            // Tipo de solicitud (fijo)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Tipo de Solicitud", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Acceso a la Información Pública (Ley N° 27806)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                }
            }

            // Selector de entidad
            ExposedDropdownMenuBox(
                expanded = entidadExpanded,
                onExpandedChange = { entidadExpanded = it }
            ) {
                OutlinedTextField(
                    value = uiState.entidadNombre,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Entidad Pública *") },
                    supportingText = uiState.errorEntidad?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    isError = uiState.errorEntidad != null,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(entidadExpanded) },
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(
                    expanded = entidadExpanded,
                    onDismissRequest = { entidadExpanded = false }
                ) {
                    uiState.entidades.forEach { entidad ->
                        DropdownMenuItem(
                            text = { Text(entidad.nombre) },
                            onClick = {
                                onSeleccionarEntidad(entidad.id)
                                entidadExpanded = false
                            }
                        )
                    }
                    if (uiState.entidades.isEmpty()) {
                        DropdownMenuItem(
                            text = { Text("Cargando entidades...", color = MaterialTheme.colorScheme.onSurfaceVariant) },
                            onClick = {}
                        )
                    }
                }
            }

            // Asunto
            OutlinedTextField(
                value = uiState.asunto,
                onValueChange = onActualizarAsunto,
                label = { Text("Asunto *") },
                supportingText = {
                    Text(
                        text = uiState.errorAsunto ?: "Mínimo 10 caracteres (${uiState.asunto.length}/10)",
                        color = if (uiState.errorAsunto != null) MaterialTheme.colorScheme.error
                               else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                isError = uiState.errorAsunto != null,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            // Descripción
            OutlinedTextField(
                value = uiState.descripcion,
                onValueChange = onActualizarDescripcion,
                label = { Text("Descripción detallada *") },
                supportingText = {
                    Text(
                        text = uiState.errorDescripcion ?: "Mínimo 20 caracteres (${uiState.descripcion.length}/20)",
                        color = if (uiState.errorDescripcion != null) MaterialTheme.colorScheme.error
                               else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                isError = uiState.errorDescripcion != null,
                minLines = 4,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            // Canal formal de notificación
            ExposedDropdownMenuBox(
                expanded = canalExpanded,
                onExpandedChange = { canalExpanded = it }
            ) {
                OutlinedTextField(
                    value = uiState.canalNotificacion?.toDisplayString() ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Canal formal de notificación *") },
                    placeholder = { Text("Seleccione cómo desea recibir notificaciones") },
                    supportingText = uiState.errorCanalNotificacion?.let {
                        { Text(it, color = MaterialTheme.colorScheme.error) }
                    },
                    isError = uiState.errorCanalNotificacion != null,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(canalExpanded) },
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(
                    expanded = canalExpanded,
                    onDismissRequest = { canalExpanded = false }
                ) {
                    CanalNotificacion.entries.forEach { canal ->
                        DropdownMenuItem(
                            text = { Text(canal.toDisplayString()) },
                            onClick = {
                                onSeleccionarCanalNotificacion(canal)
                                canalExpanded = false
                            }
                        )
                    }
                }
            }

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = uiState.consentimientoDatosPersonales,
                        onCheckedChange = onActualizarConsentimiento
                    )
                    Text(
                        text = "Acepto el tratamiento de mis datos personales para gestionar esta solicitud. *",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                }
                val consentimientoHelper = uiState.errorConsentimiento
                    ?: "Debe aceptar el consentimiento antes de presentar la SAIP."
                Text(
                    text = consentimientoHelper,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (uiState.errorConsentimiento != null) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.padding(start = 48.dp)
                )
            }

            // Info card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Información Importante", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "La entidad tiene un plazo de 10 días hábiles para responder su solicitud.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            // Botón enviar
            Button(
                onClick = onEnviar,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = MaterialTheme.shapes.medium,
                enabled = !uiState.isLoading && uiState.consentimientoDatosPersonales
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Presentar Solicitud")
            }
        }
    }
}
