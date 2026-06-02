package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.EntidadPublica
import com.gestion.misaip.core.domain.model.RegistrarApelacionAnteEntidad
import com.gestion.misaip.core.domain.model.RegistrarApelacionExterna
import com.gestion.misaip.core.domain.model.TipoDenegatoria
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudPorExpedienteUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionPorSAIPUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CrearApelacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CrearApelacionAnteEntidadUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CrearApelacionExternaUseCase
import com.gestion.misaip.core.domain.usecase.entidad.GetEntidadesActivasUseCase
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class AppealFormUiState(
    val tipoRegistro: TipoRegistroApelacionMobile = TipoRegistroApelacionMobile.DIRECTA_TTAIP,
    val expedienteSAIP: String = "",
    val solicitudEncontrada: Solicitud? = null,
    val entidades: List<EntidadPublica> = emptyList(),
    val entidadExternaId: String = "",
    val numeroSolicitudExterna: String = "",
    val fechaPresentacionSolicitudExterna: String = "",
    val tipoDenegatoria: TipoDenegatoria = TipoDenegatoria.EXPRESA,
    val fechaRespuestaEntidad: String = "",
    val resumenSolicitudOriginal: String = "",
    val resumenRespuestaEntidad: String = "",
    val referenciaDocumentoSolicitud: String = "",
    val referenciaCargoRecepcion: String = "",
    val referenciaRespuestaEntidad: String = "",
    val evidenciaSilencioAdministrativo: String = "",
    val fechaPresentacionAnteEntidad: String = "",
    val referenciaCargoPresentacion: String = "",
    val observacion: String = "",
    val fundamentoLegal: String = "",
    val exposicionHechos: String = "",
    val pretension: String = "",
    val aceptaDeclaracion: Boolean = false,
    val isLoading: Boolean = false,
    val errorExpediente: String? = null,
    val errorFundamentoLegal: String? = null,
    val errorHechos: String? = null,
    val errorPretension: String? = null
)

enum class TipoRegistroApelacionMobile {
    DIRECTA_TTAIP,
    EXTERNA,
    ANTE_ENTIDAD
}

sealed class AppealFormEvent {
    data class ShowMessage(val message: String) : AppealFormEvent()
    data class ApelacionCreada(val expediente: String) : AppealFormEvent()
    object NavigateBack : AppealFormEvent()
}

class AppealFormViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudPorExpedienteUseCase: GetSolicitudPorExpedienteUseCase,
    private val getApelacionPorSAIPUseCase: GetApelacionPorSAIPUseCase,
    private val crearApelacionUseCase: CrearApelacionUseCase,
    private val crearApelacionExternaUseCase: CrearApelacionExternaUseCase,
    private val crearApelacionAnteEntidadUseCase: CrearApelacionAnteEntidadUseCase,
    private val getEntidadesActivasUseCase: GetEntidadesActivasUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(AppealFormUiState())
    val uiState: StateFlow<AppealFormUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<AppealFormEvent>()
    val events: SharedFlow<AppealFormEvent> = _events

    init {
        viewModelScope.launch {
            getEntidadesActivasUseCase().collect { entidades ->
                _uiState.value = _uiState.value.copy(entidades = entidades)
            }
        }
    }

    fun setTipoRegistro(tipo: TipoRegistroApelacionMobile) {
        _uiState.value = _uiState.value.copy(tipoRegistro = tipo)
    }

    fun actualizarCampoExterno(campo: String, valor: String) {
        _uiState.value = when (campo) {
            "entidadId" -> _uiState.value.copy(entidadExternaId = valor)
            "numeroSolicitud" -> _uiState.value.copy(numeroSolicitudExterna = valor)
            "fechaSolicitud" -> _uiState.value.copy(fechaPresentacionSolicitudExterna = valor)
            "fechaRespuesta" -> _uiState.value.copy(fechaRespuestaEntidad = valor)
            "resumenSolicitud" -> _uiState.value.copy(resumenSolicitudOriginal = valor)
            "resumenRespuesta" -> _uiState.value.copy(resumenRespuestaEntidad = valor)
            "documentoSolicitud" -> _uiState.value.copy(referenciaDocumentoSolicitud = valor)
            "cargoRecepcion" -> _uiState.value.copy(referenciaCargoRecepcion = valor)
            "respuestaEntidad" -> _uiState.value.copy(referenciaRespuestaEntidad = valor)
            "silencio" -> _uiState.value.copy(evidenciaSilencioAdministrativo = valor)
            "fechaAnteEntidad" -> _uiState.value.copy(fechaPresentacionAnteEntidad = valor)
            "cargoPresentacion" -> _uiState.value.copy(referenciaCargoPresentacion = valor)
            "observacion" -> _uiState.value.copy(observacion = valor)
            else -> _uiState.value
        }
    }

    fun setTipoDenegatoria(tipo: TipoDenegatoria) {
        _uiState.value = _uiState.value.copy(tipoDenegatoria = tipo)
    }

    fun setExpedienteSAIP(expediente: String) {
        _uiState.value = _uiState.value.copy(
            expedienteSAIP = expediente,
            errorExpediente = null
        )
    }

    fun buscarExpediente() {
        viewModelScope.launch {
            val expediente = _uiState.value.expedienteSAIP

            if (expediente.isBlank()) {
                _events.emit(AppealFormEvent.ShowMessage("Ingrese un número de expediente"))
                return@launch
            }

            val solicitud = getSolicitudPorExpedienteUseCase(expediente).first()

            if (solicitud == null) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Solicitud SAIP no encontrada",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Solicitud SAIP no encontrada"))
                return@launch
            }

            // Verificar que pertenece al usuario actual
            val usuarioActual = getUsuarioActualUseCase().first()
            if (usuarioActual != null && solicitud.usuarioId != usuarioActual.id) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Este expediente no le pertenece",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Este expediente no le pertenece"))
                return@launch
            }

            // Verificar que puede ser apelada
            if (!solicitud.puedeSerApelada) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Solo puede apelar solicitudes denegadas o vencidas",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Solo puede apelar solicitudes denegadas o vencidas"))
                return@launch
            }

            // Verificar si ya tiene apelación
            val apelacionExistente = getApelacionPorSAIPUseCase(expediente).first()
            if (apelacionExistente != null) {
                _uiState.value = _uiState.value.copy(
                    errorExpediente = "Ya existe una apelación: ${apelacionExistente.expediente}",
                    solicitudEncontrada = null
                )
                _events.emit(AppealFormEvent.ShowMessage("Ya existe una apelación para este expediente"))
                return@launch
            }

            _uiState.value = _uiState.value.copy(
                solicitudEncontrada = solicitud,
                errorExpediente = null
            )
            _events.emit(AppealFormEvent.ShowMessage("Expediente encontrado"))
        }
    }

    fun actualizarFundamentoLegal(texto: String) {
        _uiState.value = _uiState.value.copy(
            fundamentoLegal = texto,
            errorFundamentoLegal = null
        )
    }

    fun actualizarExposicionHechos(texto: String) {
        _uiState.value = _uiState.value.copy(
            exposicionHechos = texto,
            errorHechos = null
        )
    }

    fun actualizarPretension(texto: String) {
        _uiState.value = _uiState.value.copy(
            pretension = texto,
            errorPretension = null
        )
    }

    fun toggleDeclaracionJurada() {
        _uiState.value = _uiState.value.copy(
            aceptaDeclaracion = !_uiState.value.aceptaDeclaracion
        )
    }

    fun validarYEnviar() {
        viewModelScope.launch {
            val state = _uiState.value
            var hasError = false

            if (state.tipoRegistro != TipoRegistroApelacionMobile.EXTERNA && state.solicitudEncontrada == null) {
                _events.emit(AppealFormEvent.ShowMessage("Primero busque un expediente válido"))
                return@launch
            }

            if (state.fundamentoLegal.isBlank()) {
                _uiState.value = _uiState.value.copy(errorFundamentoLegal = "El fundamento legal es obligatorio")
                hasError = true
            }

            if (state.tipoRegistro == TipoRegistroApelacionMobile.DIRECTA_TTAIP && state.exposicionHechos.isBlank()) {
                _uiState.value = _uiState.value.copy(errorHechos = "La exposición de hechos es obligatoria")
                hasError = true
            }

            if (state.tipoRegistro == TipoRegistroApelacionMobile.DIRECTA_TTAIP && state.pretension.isBlank()) {
                _uiState.value = _uiState.value.copy(errorPretension = "La pretensión es obligatoria")
                hasError = true
            }

            if (!state.aceptaDeclaracion) {
                _events.emit(AppealFormEvent.ShowMessage("Debe aceptar la declaración jurada"))
                hasError = true
            }

            if (hasError) {
                _events.emit(AppealFormEvent.ShowMessage("Por favor complete todos los campos obligatorios"))
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val usuario = getUsuarioActualUseCase().first()
                if (usuario == null) {
                    _events.emit(AppealFormEvent.ShowMessage("Error: usuario no encontrado"))
                    return@launch
                }

                val apelacion = when (state.tipoRegistro) {
                    TipoRegistroApelacionMobile.DIRECTA_TTAIP -> {
                        val result = crearApelacionUseCase(
                            CrearApelacionUseCase.Params(
                                expedienteSAIP = state.expedienteSAIP,
                                usuarioId = usuario.id,
                                apelante = com.gestion.misaip.core.domain.model.Apelante(
                                    nombre = usuario.nombre,
                                    dni = usuario.dni ?: "",
                                    email = usuario.email ?: ""
                                ),
                                fundamentoLegal = state.fundamentoLegal,
                                exposicionHechos = state.exposicionHechos,
                                pretension = state.pretension
                            )
                        )
                        if (result is CrearApelacionUseCase.Result.Error) {
                            _events.emit(AppealFormEvent.ShowMessage(result.mensaje))
                            return@launch
                        }
                        (result as CrearApelacionUseCase.Result.Success).apelacion
                    }

                    TipoRegistroApelacionMobile.EXTERNA -> crearApelacionExternaUseCase(
                        RegistrarApelacionExterna(
                            ciudadanoId = usuario.id,
                            entidadId = state.entidadExternaId,
                            numeroSolicitudExterna = state.numeroSolicitudExterna,
                            fechaPresentacionSolicitudExterna = state.fechaPresentacionSolicitudExterna,
                            tipoDenegatoria = state.tipoDenegatoria,
                            fechaRespuestaEntidad = state.fechaRespuestaEntidad.ifBlank { null },
                            resumenSolicitudOriginal = state.resumenSolicitudOriginal,
                            resumenRespuestaEntidad = state.resumenRespuestaEntidad.ifBlank { null },
                            referenciaDocumentoSolicitud = state.referenciaDocumentoSolicitud,
                            referenciaCargoRecepcion = state.referenciaCargoRecepcion.ifBlank { null },
                            referenciaRespuestaEntidad = state.referenciaRespuestaEntidad.ifBlank { null },
                            evidenciaSilencioAdministrativo = state.evidenciaSilencioAdministrativo.ifBlank { null },
                            fundamentos = state.fundamentoLegal,
                            observacion = state.observacion.ifBlank { null }
                        )
                    )

                    TipoRegistroApelacionMobile.ANTE_ENTIDAD -> crearApelacionAnteEntidadUseCase(
                        RegistrarApelacionAnteEntidad(
                            solicitudId = state.solicitudEncontrada?.id.orEmpty(),
                            ciudadanoId = usuario.id,
                            fundamentos = state.fundamentoLegal,
                            fechaPresentacionAnteEntidad = state.fechaPresentacionAnteEntidad,
                            referenciaCargoPresentacion = state.referenciaCargoPresentacion,
                            observacion = state.observacion.ifBlank { null }
                        )
                    )
                }

                        _events.emit(AppealFormEvent.ApelacionCreada(apelacion.expediente))
                        _events.emit(AppealFormEvent.ShowMessage("Apelación ${apelacion.expediente} presentada exitosamente"))

                        // Notificar al TTAIP sobre la nueva apelación
                        NotificationPushHelper.notificarNuevaApelacion(
                            expedienteApelacion = apelacion.expediente,
                            saipOrigen = apelacion.referenciaSolicitudOrigen,
                            recurrente = usuario.nombre,
                            entidadNombre = apelacion.entidad
                        )

                        kotlinx.coroutines.delay(1500)
                        _events.emit(AppealFormEvent.NavigateBack)

            } catch (e: Exception) {
                _events.emit(AppealFormEvent.ShowMessage("Error al crear la apelación: ${e.message}"))
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
}
