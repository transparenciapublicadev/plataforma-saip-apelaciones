package com.gestion.misaip.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.presentation.viewmodel.*
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun TTAIPExpedientePanel(
    numeroExpediente: String,
    modifier: Modifier = Modifier,
    viewModel: TTAIPExpedienteViewModel = koinViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(numeroExpediente) { viewModel.cargar(numeroExpediente) }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Expediente TTAIP agregado", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(
            "Consulta en línea. Las actuaciones institucionales no se simulan ni se encolan offline.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (state.isLoading) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        state.errorMessage?.let { FeedbackCard(it, true, viewModel::limpiarMensaje) }
        state.successMessage?.let { FeedbackCard(it, false, viewModel::limpiarMensaje) }
        state.expediente?.let { expediente ->
            AggregateCard("Resumen") {
                AggregateRow("Expediente", expediente.numeroExpediente)
                AggregateRow("Estado global", expediente.estado)
                expediente.fechaApertura?.let { AggregateRow("Apertura", it) }
                expediente.fechaLimiteResolucion?.let { AggregateRow("Límite resolución", it) }
            }
            expediente.sala?.let { sala ->
                AggregateCard("Sala y miembros") {
                    AggregateRow("Sala", sala.nombre)
                    expediente.miembros.forEach { Text("${it.cargo}: ${it.nombre}", style = MaterialTheme.typography.bodySmall) }
                }
            }
            if (state.puedeAdmitirExcepcionalmente) {
                AggregateCard("Elevación omitida") {
                    Text("Existe evidencia ciudadana de omisión. El TTAIP puede evaluar admisión excepcional.", style = MaterialTheme.typography.bodySmall)
                    OnlineButton("Admitir excepcionalmente") { viewModel.abrir(TtaipActionContext(TtaipAction.ADMITIR_EXCEPCIONALMENTE)) }
                }
            }
            ResolutionsCard(expediente, state.apelacion, viewModel)
            DescargosCard(expediente, viewModel)
            SuspensionesCard(expediente, viewModel)
            NotificacionesCard(expediente, state.intentosPorNotificacion, viewModel)
            ReprocesosCard(expediente)
            CumplimientosCard(expediente, viewModel)
            HistorialCard(expediente)
        }
    }
    state.actionContext?.let {
        TtaipActionSheet(it, state.isSubmitting, viewModel::cerrarFormulario, viewModel::ejecutar)
    }
}

@Composable
private fun ResolutionsCard(expediente: ExpedienteTtaip, apelacion: Apelacion?, viewModel: TTAIPExpedienteViewModel) {
    AggregateCard("Resoluciones y cédulas") {
        if (expediente.resoluciones.isEmpty()) Text("Sin resoluciones emitidas", style = MaterialTheme.typography.bodySmall)
        expediente.resoluciones.forEach { resolucion ->
            Text(resolucion.numeroResolucion.ifBlank { resolucion.tipoResolucion }, fontWeight = FontWeight.SemiBold)
            Text(resolucion.decision.replace("_", " "), style = MaterialTheme.typography.bodySmall)
            resolucion.cedulas.forEach { Text("Cédula ${it.numeroCedula} · ${it.destinatario}", style = MaterialTheme.typography.labelSmall) }
            if (resolucion.decision in setOf("FUNDADO", "FUNDADO_EN_PARTE") &&
                expediente.cumplimientos.none { it.resolucionId == resolucion.id }) {
                OnlineButton("Abrir seguimiento de cumplimiento") {
                    viewModel.abrir(TtaipActionContext(TtaipAction.CREAR_CUMPLIMIENTO, id = resolucion.id))
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
        }
        if (apelacion?.estado == EstadoApelacion.EN_RESOLUCION) {
            Text("Emitir resolución final", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            DecisionResolucionTtaip.entries.forEach { decision ->
                OutlinedButton(
                    onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.RESOLVER, decision = decision)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(decision.etiqueta) }
            }
        }
    }
}

@Composable
private fun DescargosCard(expediente: ExpedienteTtaip, viewModel: TTAIPExpedienteViewModel) {
    AggregateCard("Descargos") {
        expediente.descargos.forEach {
            Text("${it.entidadNombre.orEmpty()} · ${it.estado.orEmpty()}", fontWeight = FontWeight.SemiBold)
            it.fechaLimiteDescargo?.let { fecha -> Text("Límite: $fecha", style = MaterialTheme.typography.bodySmall) }
        }
        if (expediente.descargos.isEmpty()) Text("Sin requerimientos registrados", style = MaterialTheme.typography.bodySmall)
        OnlineButton("Requerir descargo") { viewModel.abrir(TtaipActionContext(TtaipAction.REQUERIR_DESCARGO)) }
    }
}

@Composable
private fun SuspensionesCard(expediente: ExpedienteTtaip, viewModel: TTAIPExpedienteViewModel) {
    AggregateCard("Suspensiones de plazo") {
        expediente.suspensiones.forEach {
            Text("${it.motivo.replace("_", " ")} · ${it.estado.orEmpty()}", fontWeight = FontWeight.SemiBold)
            Text("${it.diasSuspendidos ?: 0} días suspendidos", style = MaterialTheme.typography.bodySmall)
            if (it.estado == "ACTIVA" && it.motivo != "DESCARGOS_ENTIDAD") {
                OutlinedButton(onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.CANCELAR_SUSPENSION, id = it.id)) }) { Text("Cancelar suspensión") }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OnlineButton("Informe oral", Modifier.weight(1f)) { viewModel.abrir(TtaipActionContext(TtaipAction.INFORME_ORAL)) }
            OnlineButton("Info. complementaria", Modifier.weight(1f)) { viewModel.abrir(TtaipActionContext(TtaipAction.INFORMACION_COMPLEMENTARIA)) }
        }
    }
}

@Composable
private fun NotificacionesCard(
    expediente: ExpedienteTtaip,
    intentosPorNotificacion: Map<String, List<IntentoNotificacionTtaip>>,
    viewModel: TTAIPExpedienteViewModel
) {
    AggregateCard("Notificaciones, constancias y acuses") {
        if (expediente.notificaciones.isEmpty()) Text("Sin notificaciones registradas", style = MaterialTheme.typography.bodySmall)
        expediente.notificaciones.forEach { notificacion ->
            Text("${notificacion.numeroCedula} · ${notificacion.destinatario}", fontWeight = FontWeight.SemiBold)
            Text("Estado: ${notificacion.estado.orEmpty()} · Acuse: ${notificacion.estadoAcuse.orEmpty()}", style = MaterialTheme.typography.bodySmall)
            notificacion.codigoConstancia?.let { Text("Constancia: $it", style = MaterialTheme.typography.bodySmall) }
            notificacion.referenciaEvidencia?.let { Text("Evidencia: $it", style = MaterialTheme.typography.bodySmall) }
            if (notificacion.validadaManualmente) Text("Validada manualmente por ${notificacion.responsableValidacion.orEmpty()}", style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = { viewModel.consultarIntentos(notificacion.id) }) { Text("Consultar intentos") }
            intentosPorNotificacion[notificacion.id]?.forEach { intento ->
                Text(
                    "Intento ${intento.id}: ${intento.estado.orEmpty()} · ${intento.canal.orEmpty()} · ${intento.proveedor.orEmpty()}",
                    style = MaterialTheme.typography.labelSmall
                )
            }
            OnlineButton("Enviar") { viewModel.abrir(TtaipActionContext(TtaipAction.ENVIAR_NOTIFICACION, id = notificacion.id)) }
            OutlinedButton(onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.REGISTRAR_CONSTANCIA, id = notificacion.id)) }) { Text("Registrar constancia") }
            OutlinedButton(onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.REGISTRAR_ACUSE, id = notificacion.id)) }) { Text("Registrar acuse") }
            OutlinedButton(onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.VALIDAR_NOTIFICACION, id = notificacion.id)) }) { Text("Validar manualmente") }
            if (notificacion.permiteReproceso) {
                OutlinedButton(onClick = {
                    viewModel.abrir(TtaipActionContext(TtaipAction.REPROCESAR_NOTIFICACION, numeroCedula = notificacion.numeroCedula, destinatario = notificacion.destinatario))
                }) { Text("Reprocesar: genera nueva cédula") }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
        }
    }
}

@Composable
private fun ReprocesosCard(expediente: ExpedienteTtaip) {
    AggregateCard("Reprocesos") {
        if (expediente.reprocesos.isEmpty()) Text("Sin reprocesos", style = MaterialTheme.typography.bodySmall)
        expediente.reprocesos.forEach {
            Text("${it.numeroCedulaOriginal} → ${it.numeroCedulaNueva.orEmpty()}", fontWeight = FontWeight.SemiBold)
            Text("${it.destinatario} · intento ${it.numeroIntento ?: 1} · ${it.estado.orEmpty()}", style = MaterialTheme.typography.bodySmall)
        }
        Text("La cédula original se conserva; el reproceso crea una nueva notificación.", style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun CumplimientosCard(expediente: ExpedienteTtaip, viewModel: TTAIPExpedienteViewModel) {
    AggregateCard("Cumplimiento de resolución") {
        if (expediente.cumplimientos.isEmpty()) Text("Sin seguimientos abiertos", style = MaterialTheme.typography.bodySmall)
        expediente.cumplimientos.forEach {
            Text("${it.numeroResolucion.orEmpty()} · ${it.estado.orEmpty()}", fontWeight = FontWeight.SemiBold)
            it.fechaLimiteCumplimiento?.let { fecha -> Text("Límite: $fecha", style = MaterialTheme.typography.bodySmall) }
            OutlinedButton(onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.OBSERVAR_CUMPLIMIENTO, id = it.id)) }) { Text("Observar") }
            OutlinedButton(onClick = { viewModel.abrir(TtaipActionContext(TtaipAction.CERRAR_CUMPLIMIENTO, id = it.id)) }) { Text("Cerrar seguimiento") }
        }
    }
}

@Composable
private fun HistorialCard(expediente: ExpedienteTtaip) {
    AggregateCard("Historial del expediente") {
        expediente.historial.forEach {
            Text(it.tipoEvento.replace("_", " "), fontWeight = FontWeight.SemiBold)
            Text(it.descripcion, style = MaterialTheme.typography.bodySmall)
            it.fechaEvento?.let { fecha -> Text(fecha, style = MaterialTheme.typography.labelSmall) }
        }
    }
}

@Composable
private fun AggregateCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row {
                Icon(Icons.Default.Gavel, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            HorizontalDivider()
            content()
        }
    }
}

@Composable
private fun AggregateRow(label: String, value: String) {
    Text("$label: $value", style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun OnlineButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    FilledTonalButton(onClick = onClick, modifier = modifier) { Text(label) }
}

@Composable
private fun FeedbackCard(message: String, error: Boolean, onDismiss: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = if (error) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            Text(message, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = onDismiss) { Text("Cerrar") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TtaipActionSheet(
    context: TtaipActionContext,
    submitting: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String, String, String) -> Unit
) {
    var valor1 by remember(context) { mutableStateOf("") }
    var valor2 by remember(context) { mutableStateOf("") }
    var valor3 by remember(context) { mutableStateOf("") }
    val spec = actionSpec(context)
    val puedeConfirmar = !submitting &&
        valor1.isNotBlank() &&
        (!spec.label2.trim().endsWith("*") || valor2.isNotBlank()) &&
        (spec.label3?.trim()?.endsWith("*") != true || valor3.isNotBlank())
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(spec.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Requiere conexión y confirmación del backend.", style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(valor1, { valor1 = it }, label = { Text(spec.label1) }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(valor2, { valor2 = it }, label = { Text(spec.label2) }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            if (spec.label3 != null) OutlinedTextField(valor3, { valor3 = it }, label = { Text(spec.label3) }, modifier = Modifier.fillMaxWidth())
            Button(onClick = { onSubmit(valor1, valor2, valor3) }, enabled = puedeConfirmar, modifier = Modifier.fillMaxWidth()) {
                Text(if (submitting) "Registrando..." else "Confirmar")
            }
        }
    }
}

private data class ActionSpec(val title: String, val label1: String, val label2: String, val label3: String? = null)

private fun actionSpec(context: TtaipActionContext): ActionSpec = when (context.action) {
    TtaipAction.ADMITIR_EXCEPCIONALMENTE -> ActionSpec("Admisión excepcional", "Responsable TTAIP *", "Sustento *")
    TtaipAction.REQUERIR_DESCARGO -> ActionSpec("Requerir descargo", "Responsable TTAIP *", "Observación")
    TtaipAction.INFORME_ORAL -> ActionSpec("Registrar informe oral", "Solicitante *", "Motivo *", "Responsable *")
    TtaipAction.INFORMACION_COMPLEMENTARIA -> ActionSpec("Registrar información complementaria", "Solicitante *", "Motivo *", "Responsable *")
    TtaipAction.CANCELAR_SUSPENSION -> ActionSpec("Cancelar suspensión", "Responsable *", "Observación")
    TtaipAction.ENVIAR_NOTIFICACION -> ActionSpec("Enviar notificación", "Asunto *", "Contenido *", "Responsable")
    TtaipAction.REGISTRAR_CONSTANCIA -> ActionSpec("Registrar constancia", "Medio *", "Constancia *", "Responsable *")
    TtaipAction.REGISTRAR_ACUSE -> ActionSpec("Registrar acuse", "Estado: ENTREGADO/FALLIDO/NO_RECIBIDO/OBSERVADO *", "Acuse *", "Responsable")
    TtaipAction.VALIDAR_NOTIFICACION -> ActionSpec("Validar manualmente", "Responsable *", "Sustento *")
    TtaipAction.REPROCESAR_NOTIFICACION -> ActionSpec("Reprocesar notificación", "Observación *", "Responsable")
    TtaipAction.CREAR_CUMPLIMIENTO -> ActionSpec("Abrir cumplimiento", "Responsable TTAIP", "Observación")
    TtaipAction.OBSERVAR_CUMPLIMIENTO -> ActionSpec("Observar cumplimiento", "Responsable TTAIP", "Observación *")
    TtaipAction.CERRAR_CUMPLIMIENTO -> ActionSpec("Cerrar cumplimiento", "Responsable TTAIP", "Observación")
    TtaipAction.RESOLVER -> ActionSpec("Resolver: ${context.decision?.etiqueta}", "Fundamentos *", "Fundamento legal", "Observaciones")
}
