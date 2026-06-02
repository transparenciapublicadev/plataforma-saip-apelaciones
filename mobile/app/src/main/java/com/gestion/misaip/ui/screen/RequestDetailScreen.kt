package com.gestion.misaip.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.core.domain.model.TimelineItem
import com.gestion.misaip.presentation.viewmodel.RequestDetailEvent
import com.gestion.misaip.presentation.viewmodel.RequestDetailUiState
import com.gestion.misaip.presentation.viewmodel.RequestDetailViewModel
import com.gestion.misaip.presentation.viewmodel.FormularioOperacionFuncionario
import com.gestion.misaip.ui.components.LoadingContent
import com.gestion.misaip.ui.components.PulsingDot
import com.gestion.misaip.ui.components.SemaphoreIndicator
import com.gestion.misaip.ui.components.StatusBadge
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun RequestDetailScreen(
    expediente: String,
    tipo: String,
    onNavigateBack: () -> Unit,
    onNavigateToAppeal: (String) -> Unit,
    viewModel: RequestDetailViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(expediente) {
        viewModel.cargarDetalle(expediente)
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is RequestDetailEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is RequestDetailEvent.NavigateBack -> onNavigateBack()
                is RequestDetailEvent.NavigateToAppeal -> onNavigateToAppeal(event.expedienteSAIP)
            }
        }
    }

    RequestDetailContent(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        onNavigateBack = onNavigateBack,
        onIniciarRevision = viewModel::iniciarRevision,
        onMostrarFormRespuesta = viewModel::mostrarFormularioRespuesta,
        onOcultarFormRespuesta = viewModel::ocultarFormularioRespuesta,
        onResponder = viewModel::responderSolicitud,
        onRecargarOperaciones = viewModel::recargarOperacionesFuncionario,
        onMostrarOperacion = viewModel::mostrarFormularioOperacion,
        onOcultarOperacion = viewModel::ocultarFormularioOperacion,
        onRegistrarObservacion = viewModel::registrarObservacion,
        onRegistrarAmpliacion = viewModel::registrarAmpliacion,
        onRegistrarEncauzamiento = viewModel::registrarEncauzamiento,
        onEmitirLiquidacion = viewModel::emitirLiquidacion,
        onMostrarFormCalificacion = viewModel::mostrarFormularioCalificacion,
        onOcultarFormCalificacion = viewModel::ocultarFormularioCalificacion,
        onCalificar = viewModel::calificarApelacion,
        onIniciarCalificacion = viewModel::iniciarCalificacion,
        onMostrarFormSubsanacion = viewModel::mostrarFormularioSubsanacion,
        onOcultarFormSubsanacion = viewModel::ocultarFormularioSubsanacion,
        onSubsanar = viewModel::presentarSubsanacion,
        onMostrarFormOmisionElevacion = viewModel::mostrarFormularioOmisionElevacion,
        onOcultarFormOmisionElevacion = viewModel::ocultarFormularioOmisionElevacion,
        onComunicarOmisionElevacion = viewModel::comunicarOmisionElevacion,
        onApelar = viewModel::navegarAApelar
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RequestDetailContent(
    uiState: RequestDetailUiState,
    snackbarHostState: SnackbarHostState,
    onNavigateBack: () -> Unit,
    onIniciarRevision: () -> Unit,
    onMostrarFormRespuesta: () -> Unit,
    onOcultarFormRespuesta: () -> Unit,
    onResponder: (String, String) -> Unit,
    onRecargarOperaciones: () -> Unit,
    onMostrarOperacion: (FormularioOperacionFuncionario) -> Unit,
    onOcultarOperacion: () -> Unit,
    onRegistrarObservacion: (String) -> Unit,
    onRegistrarAmpliacion: (String, String, String, String, String) -> Unit,
    onRegistrarEncauzamiento: (String, String, com.gestion.misaip.core.domain.model.AlcanceEncauzamiento, String) -> Unit,
    onEmitirLiquidacion: (String, String, String, String, com.gestion.misaip.core.domain.model.CanalNotificacion) -> Unit,
    onMostrarFormCalificacion: () -> Unit,
    onOcultarFormCalificacion: () -> Unit,
    onCalificar: (String, String, String) -> Unit,
    onIniciarCalificacion: () -> Unit,
    onMostrarFormSubsanacion: () -> Unit,
    onOcultarFormSubsanacion: () -> Unit,
    onSubsanar: (String, String) -> Unit,
    onMostrarFormOmisionElevacion: () -> Unit,
    onOcultarFormOmisionElevacion: () -> Unit,
    onComunicarOmisionElevacion: (String, String) -> Unit,
    onApelar: () -> Unit
) {
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = uiState.expediente,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                },
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
        if (uiState.isLoading) {
            LoadingContent(modifier = Modifier.padding(innerPadding))
        } else {
            LazyColumn(
                modifier = Modifier.padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Header info
                item(key = "header") {
                    DetailSectionCard(
                        icon = if (uiState.esApelacion) Icons.Default.Gavel else Icons.Default.Description,
                        title = if (uiState.esApelacion) "Apelación TTAIP" else "Solicitud SAIP",
                        iconTint = MaterialTheme.colorScheme.primary
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = uiState.asunto,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            StatusBadge(estado = uiState.estado)
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        DetailRow("Entidad", uiState.entidad)
                        DetailRow("Fecha", uiState.fecha)
                        uiState.diasRestantes?.let { dias ->
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                SemaphoreIndicator(diasRestantes = dias)
                                Spacer(modifier = Modifier.width(8.dp))
                                if (dias <= 2 && dias > 0) {
                                    PulsingDot(
                                        color = MaterialTheme.colorScheme.error,
                                        modifier = Modifier.padding(end = 6.dp)
                                    )
                                }
                                Text(
                                    text = if (dias > 0) "$dias días restantes" else "Plazo vencido",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (dias <= 0) MaterialTheme.colorScheme.error
                                           else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                // Detalle solicitud
                if (uiState.esSolicitud && uiState.solicitud != null) {
                    item(key = "solicitud_detail") {
                        DetailSectionCard(
                            icon = Icons.Default.Description,
                            title = "Detalle de la Solicitud",
                            iconTint = MaterialTheme.colorScheme.primary
                        ) {
                            DetailRow("Solicitante", uiState.solicitud.solicitante.nombre)
                            DetailRow("DNI", uiState.solicitud.solicitante.dni)
                            DetailRow("Email", uiState.solicitud.solicitante.email)
                            if (uiState.telefonoRecurrente.isNotEmpty()) {
                                DetailRow("Teléfono", uiState.telefonoRecurrente)
                            }
                            DetailRow("Descripción", uiState.solicitud.descripcion)
                            uiState.solicitud.canalNotificacion?.let { canal ->
                                DetailRow("Canal de notificación", canal.toDisplayString())
                            }
                        }
                    }

                    // Respuesta de la entidad
                    val respuesta = uiState.solicitud.respuestaEntidad
                    if (respuesta != null) {
                        item(key = "respuesta") {
                            DetailSectionCard(
                                icon = Icons.AutoMirrored.Filled.Reply,
                                title = "Respuesta de la Entidad",
                                iconTint = MaterialTheme.colorScheme.tertiary
                            ) {
                                DetailRow("Funcionario", respuesta.funcionario)
                                DetailRow("Tipo", respuesta.tipo.name)
                                DetailRow("Fundamentación", respuesta.fundamentacion)
                            }
                        }
                    }
                }

                // Detalle apelación
                if (uiState.esApelacion && uiState.apelacion != null) {
                    item(key = "apelacion_detail") {
                        DetailSectionCard(
                            icon = Icons.Default.Gavel,
                            title = "Detalle de la Apelación",
                            iconTint = MaterialTheme.colorScheme.primary
                        ) {
                            DetailRow("Recurrente", uiState.apelacion.apelante.nombre)
                            DetailRow("SAIP Origen", uiState.apelacion.referenciaSolicitudOrigen)
                            DetailRow("Fundamento Legal", uiState.apelacion.fundamentoLegal)
                            DetailRow("Exposición de Hechos", uiState.apelacion.exposicionHechos)
                            DetailRow("Pretensión", uiState.apelacion.pretension)

                            uiState.apelacion.primeraCalificacion?.let { cal ->
                                HorizontalDivider(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    color = MaterialTheme.colorScheme.outlineVariant
                                )
                                Text(
                                    "Primera Calificación",
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                DetailRow("Resultado", cal.resultado.name)
                                DetailRow("Fundamentación", cal.fundamentacion)
                            }
                            uiState.apelacion.segundaCalificacion?.let { cal ->
                                HorizontalDivider(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    color = MaterialTheme.colorScheme.outlineVariant
                                )
                                Text(
                                    "Segunda Calificación",
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                DetailRow("Resultado", cal.resultado.name)
                                DetailRow("Fundamentación", cal.fundamentacion)
                            }
                            uiState.apelacion.subsanacion?.let { sub ->
                                HorizontalDivider(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    color = MaterialTheme.colorScheme.outlineVariant
                                )
                                Text(
                                    "Subsanación Presentada",
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                DetailRow("Texto Corregido", sub.textoCorregido)
                                DetailRow("Fundamento Legal", sub.fundamentoLegalCorregido ?: "")
                            }
                        }
                    }
                    if (uiState.tipoUsuario == com.gestion.misaip.core.domain.model.TipoUsuario.TTAIP) {
                        item(key = "ttaip_agregado") {
                            TTAIPExpedientePanel(numeroExpediente = uiState.apelacion.expediente)
                        }
                    }
                }

                // Apelación relacionada (desde vista SAIP)
                if (uiState.apelacionRelacionada != null) {
                    item(key = "apelacion_relacionada") {
                        DetailSectionCard(
                            icon = Icons.Default.Gavel,
                            title = "Apelación Vinculada",
                            iconTint = MaterialTheme.colorScheme.tertiary
                        ) {
                            DetailRow("Expediente", uiState.apelacionRelacionada.expediente)
                            DetailRow("Estado", uiState.apelacionRelacionada.estado.toDisplayString())
                        }
                    }
                }

                uiState.elevacion?.let { elevacion ->
                    item(key = "elevacion") {
                        DetailSectionCard(
                            icon = Icons.Default.Gavel,
                            title = "Elevación al TTAIP",
                            iconTint = MaterialTheme.colorScheme.tertiary
                        ) {
                            DetailRow("Estado", elevacion.estado.name.replace("_", " "))
                            DetailRow("Entidad origen", elevacion.entidadOrigenNombre)
                            DetailRow("Fecha límite", elevacion.fechaLimiteElevacion)
                            DetailRow("Cargo", elevacion.referenciaCargoPresentacion)
                            elevacion.referenciaExpedienteElevado?.let { DetailRow("Remisión", it) }
                            elevacion.referenciaPruebaOmision?.let { DetailRow("Prueba de omisión", it) }
                        }
                    }
                }

                if (
                    uiState.esSolicitud &&
                    uiState.tipoUsuario == com.gestion.misaip.core.domain.model.TipoUsuario.FUNCIONARIO
                ) {
                    item(key = "funcionario_saip_operations") {
                        FuncionarioSaipOperationsCard(
                            operaciones = uiState.operacionesFuncionario,
                            disponibleOnline = uiState.operacionesDisponiblesOnline,
                            puedeGestionar = uiState.puedeGestionarSaip,
                            onRecargar = onRecargarOperaciones,
                            onAbrirFormulario = onMostrarOperacion
                        )
                    }
                }

                // Timeline
                if (uiState.timeline.isNotEmpty()) {
                    item(key = "timeline") {
                        Card(
                            shape = MaterialTheme.shapes.medium,
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                            )
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        shape = CircleShape,
                                        color = MaterialTheme.colorScheme.primaryContainer,
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Timeline,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                            modifier = Modifier
                                                .padding(6.dp)
                                                .size(20.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        "Línea de Tiempo",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                                uiState.timeline.forEachIndexed { index, timelineItem ->
                                    AnimatedVisibility(
                                        visible = true,
                                        enter = expandVertically() + fadeIn()
                                    ) {
                                        TimelineEntry(
                                            item = timelineItem,
                                            isLast = index == uiState.timeline.lastIndex
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Botones de acción
                item(key = "actions") {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (uiState.puedeIniciarRevision) {
                            FilledTonalButton(
                                onClick = onIniciarRevision,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium,
                                colors = ButtonDefaults.filledTonalButtonColors(
                                    containerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Iniciar Revisión")
                            }
                        }
                        if (uiState.puedeResponder) {
                            Button(
                                onClick = onMostrarFormRespuesta,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Reply, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Responder Solicitud")
                            }
                        } else if (uiState.silencioAdministrativoAutomatico && uiState.tipoUsuario == com.gestion.misaip.core.domain.model.TipoUsuario.FUNCIONARIO) {
                            Card(
                                shape = MaterialTheme.shapes.medium,
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                                )
                            ) {
                                Text(
                                    text = "Silencio administrativo aplicado automáticamente por vencimiento de plazo.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                        if (uiState.puedeCalificar) {
                            Button(
                                onClick = onMostrarFormCalificacion,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium
                            ) {
                                Icon(Icons.Default.Gavel, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Calificar Apelación")
                            }
                        }
                        if (uiState.puedeSubsanar) {
                            OutlinedButton(
                                onClick = onMostrarFormSubsanacion,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Presentar Subsanación")
                            }
                        }
                        if (uiState.puedeApelar) {
                            Button(
                                onClick = onApelar,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.tertiary
                                )
                            ) {
                                Icon(Icons.Default.Gavel, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Apelar ante TTAIP")
                            }
                        }
                        if (uiState.puedeComunicarOmisionElevacion) {
                            OutlinedButton(
                                onClick = onMostrarFormOmisionElevacion,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium
                            ) {
                                Icon(Icons.Default.Gavel, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Comunicar omisión de elevación")
                            }
                        }
                    }
                }
            }
        }

        // Bottom sheets
        if (uiState.showResponseForm) {
            ResponseBottomSheet(
                onDismiss = onOcultarFormRespuesta,
                onSubmit = onResponder
            )
        }
        if (uiState.showCalificacionForm) {
            CalificacionBottomSheet(
                apelacion = uiState.apelacion,
                onDismiss = onOcultarFormCalificacion,
                onSubmit = onCalificar
            )
        }
        if (uiState.showSubsanacionForm) {
            SubsanacionBottomSheet(
                onDismiss = onOcultarFormSubsanacion,
                onSubmit = onSubsanar
            )
        }
        if (uiState.showOmisionElevacionForm) {
            OmisionElevacionBottomSheet(
                onDismiss = onOcultarFormOmisionElevacion,
                onSubmit = onComunicarOmisionElevacion
            )
        }
        FuncionarioSaipOperationSheet(
            tipo = uiState.formularioOperacion,
            entidadesDestino = uiState.entidadesDestino,
            enviando = uiState.isSubmittingOperation,
            onDismiss = onOcultarOperacion,
            onObservacion = onRegistrarObservacion,
            onAmpliacion = onRegistrarAmpliacion,
            onEncauzamiento = onRegistrarEncauzamiento,
            onLiquidacion = onEmitirLiquidacion
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OmisionElevacionBottomSheet(
    onDismiss: () -> Unit,
    onSubmit: (String, String) -> Unit
) {
    var referenciaPrueba by remember { mutableStateOf("") }
    var observacion by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Comunicar omisión de elevación", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Adjunte una referencia verificable. Esta operación requiere conexión.", style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(
                value = referenciaPrueba,
                onValueChange = { referenciaPrueba = it },
                label = { Text("Prueba o referencia de omisión *") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = observacion,
                onValueChange = { observacion = it },
                label = { Text("Observación") },
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = { onSubmit(referenciaPrueba, observacion) },
                enabled = referenciaPrueba.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Comunicar al TTAIP")
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

// Reusable section card with icon header
@Composable
private fun DetailSectionCard(
    icon: ImageVector,
    title: String,
    iconTint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = CircleShape,
                    color = iconTint.copy(alpha = 0.12f),
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        icon,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier
                            .padding(6.dp)
                            .size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 10.dp),
                color = MaterialTheme.colorScheme.outlineVariant
            )
            content()
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.width(120.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun TimelineEntry(item: TimelineItem, isLast: Boolean) {
    // Formatear fecha/hora del evento
    val fechaFormateada = remember(item.fecha) {
        if (item.fecha > 0L) {
            val sdf = java.text.SimpleDateFormat("dd MMM yyyy, HH:mm", java.util.Locale.forLanguageTag("es-PE"))
            sdf.format(java.util.Date(item.fecha))
        } else null
    }

    Row(modifier = Modifier.fillMaxWidth()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(32.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = if (item.completado) MaterialTheme.colorScheme.primary
                       else MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = if (item.completado) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (item.completado) MaterialTheme.colorScheme.onPrimary
                          else MaterialTheme.colorScheme.outline,
                    modifier = Modifier
                        .padding(2.dp)
                        .size(20.dp)
                )
            }
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(32.dp)
                        .background(
                            if (item.completado) MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                            else MaterialTheme.colorScheme.outlineVariant
                        )
                )
            }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(bottom = if (!isLast) 8.dp else 0.dp)
        ) {
            Text(
                text = item.evento,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (item.completado) FontWeight.SemiBold else FontWeight.Normal,
                color = if (item.completado) MaterialTheme.colorScheme.onSurface
                       else MaterialTheme.colorScheme.onSurfaceVariant
            )
            fechaFormateada?.let { fecha ->
                Text(
                    text = fecha,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
            item.detalle?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ResponseBottomSheet(
    onDismiss: () -> Unit,
    onSubmit: (tipoRespuesta: String, fundamentacion: String) -> Unit
) {
    var tipoSeleccionado by remember { mutableStateOf("") }
    var fundamentacion by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    val tipos = remember { listOf("Entrega Total", "Entrega Parcial", "Denegación Total") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = MaterialTheme.shapes.large
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            Text(
                "Responder Solicitud",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(16.dp))

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = tipoSeleccionado,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Tipo de Respuesta") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    tipos.forEach { tipo ->
                        DropdownMenuItem(
                            text = { Text(tipo) },
                            onClick = {
                                tipoSeleccionado = tipo
                                expanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = fundamentacion,
                onValueChange = { fundamentacion = it },
                label = { Text("Fundamentación") },
                minLines = 3,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    if (tipoSeleccionado.isNotEmpty() && fundamentacion.isNotBlank()) {
                        onSubmit(tipoSeleccionado, fundamentacion)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = MaterialTheme.shapes.medium,
                enabled = tipoSeleccionado.isNotEmpty() && fundamentacion.isNotBlank()
            ) {
                Text("Enviar Respuesta")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CalificacionBottomSheet(
    apelacion: com.gestion.misaip.core.domain.model.Apelacion?,
    onDismiss: () -> Unit,
    onSubmit: (tipoCalificacion: String, resultado: String, fundamentacion: String) -> Unit
) {
    var resultado by remember { mutableStateOf("") }
    var fundamentacion by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }

    val tipoCalificacion = if (apelacion?.primeraCalificacion != null) "SEGUNDA" else "PRIMERA"
    val resultados = remember(tipoCalificacion) {
        if (tipoCalificacion == "PRIMERA") {
            listOf("ADMISIBLE", "INADMISIBLE", "IMPROCEDENTE")
        } else {
            // La resolución final es una actuación posterior del expediente agregado.
            listOf("ADMITIDO", "IMPROCEDENTE")
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = MaterialTheme.shapes.large
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            Text(
                "Calificación $tipoCalificacion",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(16.dp))

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = resultado,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Resultado") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    resultados.forEach { res ->
                        DropdownMenuItem(
                            text = { Text(res) },
                            onClick = {
                                resultado = res
                                expanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = fundamentacion,
                onValueChange = { fundamentacion = it },
                label = { Text("Fundamentación") },
                minLines = 3,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    if (resultado.isNotEmpty() && fundamentacion.isNotBlank()) {
                        onSubmit(tipoCalificacion, resultado, fundamentacion)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = MaterialTheme.shapes.medium,
                enabled = resultado.isNotEmpty() && fundamentacion.isNotBlank()
            ) {
                Text("Registrar Calificación")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SubsanacionBottomSheet(
    onDismiss: () -> Unit,
    onSubmit: (textoCorregido: String, fundamentoLegal: String) -> Unit
) {
    var textoCorregido by remember { mutableStateOf("") }
    var fundamentoLegal by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = MaterialTheme.shapes.large
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            Text(
                "Presentar Subsanación",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = textoCorregido,
                onValueChange = { textoCorregido = it },
                label = { Text("Texto Corregido") },
                minLines = 3,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = fundamentoLegal,
                onValueChange = { fundamentoLegal = it },
                label = { Text("Fundamento Legal Corregido") },
                minLines = 3,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    if (textoCorregido.isNotBlank() && fundamentoLegal.isNotBlank()) {
                        onSubmit(textoCorregido, fundamentoLegal)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = MaterialTheme.shapes.medium,
                enabled = textoCorregido.isNotBlank() && fundamentoLegal.isNotBlank()
            ) {
                Text("Enviar Subsanación")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
