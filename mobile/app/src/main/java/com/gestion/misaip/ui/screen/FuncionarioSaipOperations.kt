package com.gestion.misaip.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.gestion.misaip.core.domain.model.AlcanceEncauzamiento
import com.gestion.misaip.core.domain.model.CanalNotificacion
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.model.OperacionesSolicitudFuncionario
import com.gestion.misaip.presentation.viewmodel.FormularioOperacionFuncionario
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
internal fun FuncionarioSaipOperationsCard(
    operaciones: OperacionesSolicitudFuncionario,
    disponibleOnline: Boolean,
    puedeGestionar: Boolean,
    onRecargar: () -> Unit,
    onAbrirFormulario: (FormularioOperacionFuncionario) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Gestión SAIP de entidad", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(
                if (disponibleOnline) "Actos administrativos sincronizados con backend."
                else "La trazabilidad detallada requiere conexión. La bandeja local sigue disponible.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (!disponibleOnline) {
                OutlinedButton(onClick = onRecargar, modifier = Modifier.fillMaxWidth()) {
                    Text("Actualizar con conexión")
                }
                return@Column
            }
            if (
                operaciones.observaciones.isEmpty() &&
                operaciones.ampliaciones.isEmpty() &&
                operaciones.encauzamientos.isEmpty() &&
                operaciones.liquidaciones.isEmpty()
            ) {
                Text(
                    "Aún no existen actuaciones administrativas para esta SAIP.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            operaciones.observaciones.firstOrNull()?.let {
                OperationSummary("Última observación", it.estado, it.motivoObservacion, it.fechaLimiteSubsanacion)
            }
            operaciones.ampliaciones.firstOrNull()?.let {
                OperationSummary("Ampliación", it.estadoAmpliacion, it.motivoAmpliacion, it.fechaLimiteAmpliada)
            }
            operaciones.encauzamientos.firstOrNull()?.let {
                OperationSummary(
                    "Encauzamiento ${it.alcance}",
                    it.estadoEncauzamiento,
                    it.entidadDestinoNombre ?: it.motivoEncauzamiento,
                    it.fechaLimiteEncauzamiento
                )
            }
            operaciones.liquidaciones.firstOrNull()?.let {
                OperationSummary("Liquidación ${it.codigoLiquidacion.orEmpty()}", it.estadoLiquidacion, it.concepto, it.fechaLimiteRecojo)
            }
            if (puedeGestionar) {
                HorizontalDivider()
                ActionButton("Registrar observación") { onAbrirFormulario(FormularioOperacionFuncionario.OBSERVACION) }
                ActionButton("Registrar ampliación") { onAbrirFormulario(FormularioOperacionFuncionario.AMPLIACION) }
                ActionButton("Registrar encauzamiento") { onAbrirFormulario(FormularioOperacionFuncionario.ENCAUZAMIENTO) }
                ActionButton("Emitir liquidación o cupón") { onAbrirFormulario(FormularioOperacionFuncionario.LIQUIDACION) }
            }
        }
    }
}

@Composable
private fun OperationSummary(title: String, status: String, detail: String, deadline: String?) {
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(title, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            Text(status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        }
        Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        deadline?.let {
            Text("Fecha límite: $it", style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun ActionButton(label: String, onClick: () -> Unit) {
    FilledTonalButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(label)
    }
}

@Composable
internal fun FuncionarioSaipOperationSheet(
    tipo: FormularioOperacionFuncionario?,
    entidadesDestino: List<EntidadPublica>,
    enviando: Boolean,
    onDismiss: () -> Unit,
    onObservacion: (String) -> Unit,
    onAmpliacion: (String, String, String, String, String) -> Unit,
    onEncauzamiento: (String, String, AlcanceEncauzamiento, String) -> Unit,
    onLiquidacion: (String, String, String, String, CanalNotificacion) -> Unit
) {
    when (tipo) {
        FormularioOperacionFuncionario.OBSERVACION -> ObservacionSheet(enviando, onDismiss, onObservacion)
        FormularioOperacionFuncionario.AMPLIACION -> AmpliacionSheet(enviando, onDismiss, onAmpliacion)
        FormularioOperacionFuncionario.ENCAUZAMIENTO -> EncauzamientoSheet(entidadesDestino, enviando, onDismiss, onEncauzamiento)
        FormularioOperacionFuncionario.LIQUIDACION -> LiquidacionSheet(enviando, onDismiss, onLiquidacion)
        null -> Unit
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ObservacionSheet(enviando: Boolean, onDismiss: () -> Unit, onSubmit: (String) -> Unit) {
    var motivo by remember { mutableStateOf("") }
    OperationSheet("Registrar observación", enviando, onDismiss, motivo.isNotBlank(), { onSubmit(motivo) }) {
        MultilineField(motivo, { motivo = it }, "Motivo y sustento")
        Text("La subsanación posterior corresponde al ciudadano.", style = MaterialTheme.typography.bodySmall)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AmpliacionSheet(
    enviando: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String, String, String, String, String) -> Unit
) {
    var motivo by remember { mutableStateOf("") }
    var informe by remember { mutableStateOf("") }
    var fechaNotificacion by remember { mutableStateOf(hoyIso()) }
    var entrega by remember { mutableStateOf("") }
    var fechaEntrega by remember { mutableStateOf(hoyIso()) }
    val valido = motivo.isNotBlank() && informe.isNotBlank() && fechaNotificacion.isNotBlank() &&
        entrega.isNotBlank() && fechaEntrega.isNotBlank()
    OperationSheet("Registrar ampliación", enviando, onDismiss, valido, {
        onSubmit(motivo, informe, fechaNotificacion, entrega, fechaEntrega)
    }) {
        MultilineField(motivo, { motivo = it }, "Motivo")
        MultilineField(informe, { informe = it }, "Informe de ampliación")
        TextField(fechaNotificacion, { fechaNotificacion = it }, "Fecha de notificación (AAAA-MM-DD)")
        MultilineField(entrega, { entrega = it }, "Primera entrega parcial")
        TextField(fechaEntrega, { fechaEntrega = it }, "Fecha programada (AAAA-MM-DD)")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EncauzamientoSheet(
    entidades: List<EntidadPublica>,
    enviando: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String, String, AlcanceEncauzamiento, String) -> Unit
) {
    var destino by remember { mutableStateOf<EntidadPublica?>(null) }
    var alcance by remember { mutableStateOf(AlcanceEncauzamiento.PARCIAL) }
    var motivo by remember { mutableStateOf("") }
    var sustento by remember { mutableStateOf("") }
    val valido = destino != null && motivo.isNotBlank()
    OperationSheet("Registrar encauzamiento", enviando, onDismiss, valido, {
        onSubmit(destino?.id.orEmpty(), motivo, alcance, sustento)
    }) {
        DropdownField("Entidad destino", destino?.nombre.orEmpty(), entidades, { it.nombre }) { destino = it }
        DropdownField("Alcance", alcance.name, AlcanceEncauzamiento.entries.toList(), { it.name }) { alcance = it }
        MultilineField(motivo, { motivo = it }, "Motivo")
        MultilineField(sustento, { sustento = it }, "Sustento complementario (opcional)")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LiquidacionSheet(
    enviando: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String, String, String, String, CanalNotificacion) -> Unit
) {
    var codigo by remember { mutableStateOf("") }
    var monto by remember { mutableStateOf("") }
    var concepto by remember { mutableStateOf("") }
    var fechaNotificacion by remember { mutableStateOf(hoyIso()) }
    var canal by remember { mutableStateOf(CanalNotificacion.CORREO_ELECTRONICO) }
    val valido = monto.replace(',', '.').toDoubleOrNull()?.let { it >= 0 } == true &&
        concepto.isNotBlank() && fechaNotificacion.isNotBlank()
    OperationSheet("Emitir liquidación o cupón", enviando, onDismiss, valido, {
        onSubmit(codigo, monto, concepto, fechaNotificacion, canal)
    }) {
        TextField(codigo, { codigo = it }, "Código externo (opcional)")
        OutlinedTextField(
            value = monto,
            onValueChange = { monto = it },
            label = { Text("Monto PEN") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth()
        )
        MultilineField(concepto, { concepto = it }, "Concepto de reproducción física")
        TextField(fechaNotificacion, { fechaNotificacion = it }, "Fecha de notificación (AAAA-MM-DD)")
        DropdownField("Medio de notificación", canal.toDisplayString(), CanalNotificacion.entries.toList(), { it.toDisplayString() }) {
            canal = it
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OperationSheet(
    title: String,
    enviando: Boolean,
    onDismiss: () -> Unit,
    enabled: Boolean,
    onSubmit: () -> Unit,
    content: @Composable () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss, shape = MaterialTheme.shapes.large) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Requiere conexión con el backend institucional.", style = MaterialTheme.typography.bodySmall)
            content()
            Spacer(Modifier.height(4.dp))
            Button(
                onClick = onSubmit,
                enabled = enabled && !enviando,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (enviando) "Registrando..." else "Confirmar")
            }
        }
    }
}

@Composable
private fun TextField(value: String, onValueChange: (String) -> Unit, label: String) {
    OutlinedTextField(value, onValueChange, label = { Text(label) }, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun MultilineField(value: String, onValueChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value,
        onValueChange,
        label = { Text(label) },
        minLines = 2,
        modifier = Modifier.fillMaxWidth()
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> DropdownField(
    label: String,
    value: String,
    items: List<T>,
    itemLabel: (T) -> String,
    onSelect: (T) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            items.forEach { item ->
                DropdownMenuItem(
                    text = { Text(itemLabel(item)) },
                    onClick = {
                        onSelect(item)
                        expanded = false
                    }
                )
            }
        }
    }
}

private fun hoyIso(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
