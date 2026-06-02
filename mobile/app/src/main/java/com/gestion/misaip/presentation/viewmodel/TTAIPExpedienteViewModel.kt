package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.*
import com.gestion.misaip.core.domain.usecase.apelacion.GestionarExpedienteTtaipUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetExpedienteTtaipUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class TtaipAction {
    ADMITIR_EXCEPCIONALMENTE,
    REQUERIR_DESCARGO,
    INFORME_ORAL,
    INFORMACION_COMPLEMENTARIA,
    CANCELAR_SUSPENSION,
    ENVIAR_NOTIFICACION,
    REGISTRAR_CONSTANCIA,
    REGISTRAR_ACUSE,
    VALIDAR_NOTIFICACION,
    REPROCESAR_NOTIFICACION,
    CREAR_CUMPLIMIENTO,
    OBSERVAR_CUMPLIMIENTO,
    CERRAR_CUMPLIMIENTO,
    RESOLVER
}

@Immutable
data class TtaipActionContext(
    val action: TtaipAction,
    val id: String = "",
    val numeroCedula: String = "",
    val destinatario: String = "",
    val decision: DecisionResolucionTtaip? = null
)

@Immutable
data class TTAIPExpedienteUiState(
    val apelacion: Apelacion? = null,
    val expediente: ExpedienteTtaip? = null,
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val actionContext: TtaipActionContext? = null,
    val intentosPorNotificacion: Map<String, List<IntentoNotificacionTtaip>> = emptyMap(),
    val errorMessage: String? = null,
    val successMessage: String? = null
) {
    val puedeAdmitirExcepcionalmente: Boolean
        get() = apelacion?.elevacion?.estado in setOf(
            EstadoElevacionApelacion.COMUNICADA_POR_CIUDADANO,
            EstadoElevacionApelacion.VENCIDA_NO_ELEVADA
        )
}

class TTAIPExpedienteViewModel(
    private val getExpedienteTtaipUseCase: GetExpedienteTtaipUseCase,
    private val gestionarExpedienteTtaipUseCase: GestionarExpedienteTtaipUseCase
) : ViewModel() {
    private val _uiState = MutableStateFlow(TTAIPExpedienteUiState())
    val uiState: StateFlow<TTAIPExpedienteUiState> = _uiState.asStateFlow()
    private var numeroExpediente: String = ""

    fun cargar(numero: String) {
        numeroExpediente = numero
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { getExpedienteTtaipUseCase(numero) }
                .onSuccess { (apelacion, expediente) ->
                    _uiState.value = _uiState.value.copy(
                        apelacion = apelacion,
                        expediente = expediente,
                        isLoading = false
                    )
                }
                .onFailure {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = it.message ?: "No se pudo consultar el expediente agregado TTAIP"
                    )
                }
        }
    }

    fun abrir(context: TtaipActionContext) {
        _uiState.value = _uiState.value.copy(actionContext = context, errorMessage = null, successMessage = null)
    }

    fun consultarIntentos(notificacionId: String) {
        val expedienteId = _uiState.value.expediente?.id ?: return
        viewModelScope.launch {
            runCatching {
                gestionarExpedienteTtaipUseCase.listarIntentosNotificacion(expedienteId, notificacionId)
            }.onSuccess { intentos ->
                _uiState.value = _uiState.value.copy(
                    intentosPorNotificacion = _uiState.value.intentosPorNotificacion + (notificacionId to intentos)
                )
            }.onFailure {
                _uiState.value = _uiState.value.copy(
                    errorMessage = it.message ?: "No se pudieron consultar los intentos de notificación"
                )
            }
        }
    }

    fun cerrarFormulario() {
        _uiState.value = _uiState.value.copy(actionContext = null)
    }

    fun ejecutar(valor1: String, valor2: String, valor3: String) {
        val context = _uiState.value.actionContext ?: return
        val expediente = _uiState.value.expediente ?: return
        val apelacion = _uiState.value.apelacion ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, errorMessage = null)
            runCatching {
                when (context.action) {
                    TtaipAction.ADMITIR_EXCEPCIONALMENTE ->
                        gestionarExpedienteTtaipUseCase.admitirExcepcionalmente(apelacion.id, valor1, valor2)
                    TtaipAction.REQUERIR_DESCARGO ->
                        gestionarExpedienteTtaipUseCase.requerirDescargo(expediente.id, valor1, valor2.nullIfBlank())
                    TtaipAction.INFORME_ORAL ->
                        gestionarExpedienteTtaipUseCase.registrarSuspension(expediente.id, TipoSuspensionTtaip.INFORME_ORAL, valor1, valor2, valor3)
                    TtaipAction.INFORMACION_COMPLEMENTARIA ->
                        gestionarExpedienteTtaipUseCase.registrarSuspension(expediente.id, TipoSuspensionTtaip.INFORMACION_COMPLEMENTARIA, valor1, valor2, valor3)
                    TtaipAction.CANCELAR_SUSPENSION ->
                        gestionarExpedienteTtaipUseCase.cancelarSuspension(expediente.id, context.id, valor1, valor2.nullIfBlank())
                    TtaipAction.ENVIAR_NOTIFICACION ->
                        gestionarExpedienteTtaipUseCase.enviarNotificacion(expediente.id, context.id, valor1, valor2, valor3.nullIfBlank())
                    TtaipAction.REGISTRAR_CONSTANCIA ->
                        gestionarExpedienteTtaipUseCase.registrarConstancia(expediente.id, context.id, valor1, valor2, valor3)
                    TtaipAction.REGISTRAR_ACUSE ->
                        gestionarExpedienteTtaipUseCase.registrarAcuse(expediente.id, context.id, valor1, valor2, valor3.nullIfBlank())
                    TtaipAction.VALIDAR_NOTIFICACION ->
                        gestionarExpedienteTtaipUseCase.validarNotificacion(expediente.id, context.id, valor1, valor2)
                    TtaipAction.REPROCESAR_NOTIFICACION ->
                        gestionarExpedienteTtaipUseCase.reprocesarNotificacion(context.numeroCedula, context.destinatario, valor1, valor2.nullIfBlank())
                    TtaipAction.CREAR_CUMPLIMIENTO ->
                        gestionarExpedienteTtaipUseCase.crearSeguimiento(expediente.id, context.id, valor1.nullIfBlank(), valor2.nullIfBlank())
                    TtaipAction.OBSERVAR_CUMPLIMIENTO ->
                        gestionarExpedienteTtaipUseCase.observarCumplimiento(expediente.id, context.id, valor1.nullIfBlank(), valor2)
                    TtaipAction.CERRAR_CUMPLIMIENTO ->
                        gestionarExpedienteTtaipUseCase.cerrarCumplimiento(expediente.id, context.id, valor1.nullIfBlank(), valor2.nullIfBlank())
                    TtaipAction.RESOLVER ->
                        gestionarExpedienteTtaipUseCase.resolver(apelacion.id, requireNotNull(context.decision), valor1, valor2.nullIfBlank(), valor3.nullIfBlank())
                }
            }.onSuccess {
                _uiState.value = _uiState.value.copy(
                    isSubmitting = false,
                    actionContext = null,
                    successMessage = "Operación TTAIP registrada correctamente"
                )
                cargar(numeroExpediente)
            }.onFailure {
                _uiState.value = _uiState.value.copy(
                    isSubmitting = false,
                    errorMessage = it.message ?: "La operación requiere conexión y confirmación del backend"
                )
            }
        }
    }

    fun limpiarMensaje() {
        _uiState.value = _uiState.value.copy(errorMessage = null, successMessage = null)
    }
}

private fun String.nullIfBlank(): String? = takeIf { it.isNotBlank() }
