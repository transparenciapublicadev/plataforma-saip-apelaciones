package com.gestion.misaip.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.core.domain.model.TipoDenegatoria
import com.gestion.misaip.presentation.viewmodel.AppealFormEvent
import com.gestion.misaip.presentation.viewmodel.AppealFormUiState
import com.gestion.misaip.presentation.viewmodel.AppealFormViewModel
import com.gestion.misaip.presentation.viewmodel.TipoRegistroApelacionMobile
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
                is AppealFormEvent.ApelacionCreada -> Unit
                is AppealFormEvent.NavigateBack -> onNavigateBack()
            }
        }
    }

    AppealFormContent(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        expedientePreCargado = !expedienteSAIP.isNullOrBlank(),
        onNavigateBack = onNavigateBack,
        onTipoRegistroChange = viewModel::setTipoRegistro,
        onExpedienteChange = viewModel::setExpedienteSAIP,
        onBuscarExpediente = viewModel::buscarExpediente,
        onCampoExternoChange = viewModel::actualizarCampoExterno,
        onTipoDenegatoriaChange = viewModel::setTipoDenegatoria,
        onFundamentoChange = viewModel::actualizarFundamentoLegal,
        onHechosChange = viewModel::actualizarExposicionHechos,
        onPretensionChange = viewModel::actualizarPretension,
        onToggleDeclaracion = viewModel::toggleDeclaracionJurada,
        onEnviar = viewModel::validarYEnviar
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun AppealFormContent(
    uiState: AppealFormUiState,
    snackbarHostState: SnackbarHostState,
    expedientePreCargado: Boolean,
    onNavigateBack: () -> Unit,
    onTipoRegistroChange: (TipoRegistroApelacionMobile) -> Unit,
    onExpedienteChange: (String) -> Unit,
    onBuscarExpediente: () -> Unit,
    onCampoExternoChange: (String, String) -> Unit,
    onTipoDenegatoriaChange: (TipoDenegatoria) -> Unit,
    onFundamentoChange: (String) -> Unit,
    onHechosChange: (String) -> Unit,
    onPretensionChange: (String) -> Unit,
    onToggleDeclaracion: () -> Unit,
    onEnviar: () -> Unit
) {
    val usaSaipLocal = uiState.tipoRegistro != TipoRegistroApelacionMobile.EXTERNA
    val puedeMostrarFormulario = !usaSaipLocal || uiState.solicitudEncontrada != null

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Recurso de Apelación", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
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
            Text("Tipo de presentación", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RegistroChip(uiState.tipoRegistro, TipoRegistroApelacionMobile.DIRECTA_TTAIP, "Directa TTAIP", onTipoRegistroChange)
                RegistroChip(uiState.tipoRegistro, TipoRegistroApelacionMobile.EXTERNA, "Solicitud externa", onTipoRegistroChange)
                RegistroChip(uiState.tipoRegistro, TipoRegistroApelacionMobile.ANTE_ENTIDAD, "Ante entidad", onTipoRegistroChange)
            }

            if (usaSaipLocal) {
                Text("Paso 1: Buscar Solicitud SAIP", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = uiState.expedienteSAIP,
                        onValueChange = onExpedienteChange,
                        label = { Text("N° Expediente SAIP") },
                        supportingText = uiState.errorExpediente?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                        isError = uiState.errorExpediente != null,
                        singleLine = true,
                        readOnly = expedientePreCargado,
                        enabled = !expedientePreCargado,
                        modifier = Modifier.weight(1f)
                    )
                    if (!expedientePreCargado) {
                        FilledIconButton(onClick = onBuscarExpediente, modifier = Modifier.padding(top = 8.dp)) {
                            Icon(Icons.Default.Search, contentDescription = "Buscar")
                        }
                    }
                }
            } else {
                DatosApelacionExterna(
                    uiState = uiState,
                    onCampoChange = onCampoExternoChange,
                    onTipoDenegatoriaChange = onTipoDenegatoriaChange
                )
            }

            AnimatedVisibility(visible = uiState.solicitudEncontrada != null) {
                uiState.solicitudEncontrada?.let { solicitud ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Solicitud encontrada", style = MaterialTheme.typography.labelMedium)
                                StatusBadge(estado = solicitud.estado.toDisplayString())
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(solicitud.expediente, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text("Entidad: ${solicitud.entidad}", style = MaterialTheme.typography.bodySmall)
                            Text("Asunto: ${solicitud.asunto}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            AnimatedVisibility(visible = puedeMostrarFormulario) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HorizontalDivider()
                    Text("Datos de la apelación", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

                    if (uiState.tipoRegistro == TipoRegistroApelacionMobile.ANTE_ENTIDAD) {
                        Campo(uiState.fechaPresentacionAnteEntidad, { onCampoExternoChange("fechaAnteEntidad", it) }, "Fecha de presentación ante entidad *")
                        Campo(uiState.referenciaCargoPresentacion, { onCampoExternoChange("cargoPresentacion", it) }, "Referencia del cargo *")
                    }

                    Campo(uiState.fundamentoLegal, onFundamentoChange, "Fundamentos *", uiState.errorFundamentoLegal, minLines = 3)
                    if (uiState.tipoRegistro == TipoRegistroApelacionMobile.DIRECTA_TTAIP) {
                        Campo(uiState.exposicionHechos, onHechosChange, "Exposición de hechos *", uiState.errorHechos, minLines = 3)
                        Campo(uiState.pretension, onPretensionChange, "Pretensión *", uiState.errorPretension, minLines = 2)
                    }
                    Campo(uiState.observacion, { onCampoExternoChange("observacion", it) }, "Observación", minLines = 2)

                    Row(modifier = Modifier.fillMaxWidth()) {
                        Checkbox(checked = uiState.aceptaDeclaracion, onCheckedChange = { onToggleDeclaracion() })
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "Declaro bajo juramento que la información proporcionada es verídica.",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                    }

                    Button(
                        onClick = onEnviar,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        enabled = !uiState.isLoading && puedeMostrarFormulario
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text("Presentar Apelación")
                    }
                }
            }
        }
    }
}

@Composable
private fun RegistroChip(
    actual: TipoRegistroApelacionMobile,
    opcion: TipoRegistroApelacionMobile,
    label: String,
    onChange: (TipoRegistroApelacionMobile) -> Unit
) {
    FilterChip(selected = actual == opcion, onClick = { onChange(opcion) }, label = { Text(label) })
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DatosApelacionExterna(
    uiState: AppealFormUiState,
    onCampoChange: (String, String) -> Unit,
    onTipoDenegatoriaChange: (TipoDenegatoria) -> Unit
) {
    Text("Datos de la solicitud externa", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
    Text("Entidad pública *", style = MaterialTheme.typography.labelMedium)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        uiState.entidades.forEach { entidad ->
            FilterChip(
                selected = uiState.entidadExternaId == entidad.id,
                onClick = { onCampoChange("entidadId", entidad.id) },
                label = { Text(entidad.nombre) }
            )
        }
    }
    Campo(uiState.numeroSolicitudExterna, { onCampoChange("numeroSolicitud", it) }, "Número de solicitud externa *")
    Campo(uiState.fechaPresentacionSolicitudExterna, { onCampoChange("fechaSolicitud", it) }, "Fecha de presentación (AAAA-MM-DD) *")
    Campo(uiState.resumenSolicitudOriginal, { onCampoChange("resumenSolicitud", it) }, "Resumen de la solicitud original *", minLines = 2)
    Campo(uiState.referenciaDocumentoSolicitud, { onCampoChange("documentoSolicitud", it) }, "Referencia del documento de solicitud *")
    Campo(uiState.referenciaCargoRecepcion, { onCampoChange("cargoRecepcion", it) }, "Referencia del cargo de recepción")

    Text("Tipo de denegatoria", style = MaterialTheme.typography.labelMedium)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TipoDenegatoria.entries.forEach { tipo ->
            FilterChip(
                selected = uiState.tipoDenegatoria == tipo,
                onClick = { onTipoDenegatoriaChange(tipo) },
                label = { Text(if (tipo == TipoDenegatoria.EXPRESA) "Expresa" else "Tácita") }
            )
        }
    }
    if (uiState.tipoDenegatoria == TipoDenegatoria.EXPRESA) {
        Campo(uiState.fechaRespuestaEntidad, { onCampoChange("fechaRespuesta", it) }, "Fecha de respuesta (AAAA-MM-DD)")
        Campo(uiState.resumenRespuestaEntidad, { onCampoChange("resumenRespuesta", it) }, "Resumen de respuesta")
        Campo(uiState.referenciaRespuestaEntidad, { onCampoChange("respuestaEntidad", it) }, "Referencia de respuesta")
    } else {
        Campo(uiState.evidenciaSilencioAdministrativo, { onCampoChange("silencio", it) }, "Evidencia o declaración de silencio *", minLines = 2)
    }
}

@Composable
private fun Campo(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    error: String? = null,
    minLines: Int = 1
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        supportingText = error?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
        isError = error != null,
        minLines = minLines,
        modifier = Modifier.fillMaxWidth()
    )
}
