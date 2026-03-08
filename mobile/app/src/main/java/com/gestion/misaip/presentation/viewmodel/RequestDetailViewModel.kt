package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.TimelineItem
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.core.domain.model.EstadoApelacion
import com.gestion.misaip.core.domain.model.ResultadoCalificacion
import com.gestion.misaip.core.domain.model.TipoRespuesta
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudPorExpedienteUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.CrearSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.ResponderSolicitudUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.IniciarRevisionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionPorExpedienteUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionPorSAIPUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CalificarApelacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.IniciarCalificacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.PresentarSubsanacionUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class RequestDetailUiState(
    val expediente: String = "",
    val esApelacion: Boolean = false,
    val esSolicitud: Boolean = true,
    val solicitud: Solicitud? = null,
    val apelacion: Apelacion? = null,
    val apelacionRelacionada: Apelacion? = null,
    val estado: String = "",
    val diasRestantes: Int? = null,
    val asunto: String = "",
    val entidad: String = "",
    val fecha: String = "",
    val telefonoRecurrente: String = "",
    val timeline: List<TimelineItem> = emptyList(),
    val tipoUsuario: TipoUsuario = TipoUsuario.CIUDADANO,
    val puedeApelar: Boolean = false,
    val puedeIniciarRevision: Boolean = false,
    val puedeResponder: Boolean = false,
    val puedeCalificar: Boolean = false,
    val puedeSubsanar: Boolean = false,
    val isLoading: Boolean = false,
    val showResponseForm: Boolean = false,
    val showCalificacionForm: Boolean = false,
    val showSubsanacionForm: Boolean = false
)

sealed class RequestDetailEvent {
    data class ShowMessage(val message: String) : RequestDetailEvent()
    object NavigateBack : RequestDetailEvent()
    data class NavigateToAppeal(val expedienteSAIP: String) : RequestDetailEvent()
}

class RequestDetailViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudPorExpedienteUseCase: GetSolicitudPorExpedienteUseCase,
    private val getApelacionPorExpedienteUseCase: GetApelacionPorExpedienteUseCase,
    private val getApelacionPorSAIPUseCase: GetApelacionPorSAIPUseCase,
    private val responderSolicitudUseCase: ResponderSolicitudUseCase,
    private val iniciarRevisionUseCase: IniciarRevisionUseCase,
    private val calificarApelacionUseCase: CalificarApelacionUseCase,
    private val iniciarCalificacionUseCase: IniciarCalificacionUseCase,
    private val presentarSubsanacionUseCase: PresentarSubsanacionUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(RequestDetailUiState())
    val uiState: StateFlow<RequestDetailUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<RequestDetailEvent>()
    val events: SharedFlow<RequestDetailEvent> = _events

    // Expediente actual para refrescar cuando llega una notificación push en tiempo real
    private var expedienteActual: String? = null

    init {
        // Escuchar señal de refresh cuando llegan notificaciones push mientras
        // el usuario ya está viendo la página de detalle
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { _ ->
                expedienteActual?.let { exp ->
                    try {
                        sincronizarDatosUseCase()
                    } catch (_: Exception) { }
                    cargarDetalleSinSync(exp)
                }
            }
        }
    }

    fun cargarDetalle(expediente: String) {
        expedienteActual = expediente
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            // Sincronizar datos desde Firestore antes de buscar localmente.
            // Esto asegura que los datos estén disponibles cuando se abre
            // desde una notificación push en otro dispositivo.
            try {
                sincronizarDatosUseCase()
            } catch (_: Exception) {
                // Si falla la sincronización, intentar con datos locales
            }

            cargarDesdeLocal(expediente)
        }
    }

    /**
     * Recarga el detalle desde la BD local SIN sincronizar Firestore primero.
     * Usado por el listener de refreshSignal que ya sincronizó antes de llamar aquí.
     */
    private fun cargarDetalleSinSync(expediente: String) {
        viewModelScope.launch {
            cargarDesdeLocal(expediente)
        }
    }

    /**
     * Carga los datos del expediente desde SQLDelight y actualiza el UI state.
     * Método compartido entre cargarDetalle() y cargarDetalleSinSync().
     */
    private suspend fun cargarDesdeLocal(expediente: String) {
            val usuario = getUsuarioActualUseCase().first()
            val tipoUsuario = usuario?.tipo ?: TipoUsuario.CIUDADANO

            // Buscar como solicitud SAIP
            val solicitud = getSolicitudPorExpedienteUseCase(expediente).first()

            // Buscar como apelación TTAIP
            val apelacion = if (solicitud == null) {
                getApelacionPorExpedienteUseCase(expediente).first()
            } else null

            // Si es solicitud, buscar si tiene apelación relacionada
            val apelacionRelacionada = if (solicitud != null) {
                getApelacionPorSAIPUseCase(solicitud.expediente).first()
            } else null

            if (solicitud != null) {
                // Verificar permisos según rol
                val puedeApelar = tipoUsuario == TipoUsuario.CIUDADANO &&
                    solicitud.puedeSerApelada &&
                    apelacionRelacionada == null

                val esFuncionarioEntidad = tipoUsuario == TipoUsuario.FUNCIONARIO &&
                    usuario?.entidadId == solicitud.entidadId

                // Solo mostrar "Iniciar Revisión" cuando está RECEPCIONADA
                val puedeIniciarRevision = esFuncionarioEntidad &&
                    solicitud.estado == com.gestion.misaip.core.domain.model.EstadoSolicitud.RECEPCIONADA

                // Mostrar "Responder" cuando está pendiente (incluye RECEPCIONADA y EN_REVISION)
                val puedeResponder = esFuncionarioEntidad && solicitud.estaPendiente

                // Ciudadano: permitir subsanar desde la vista SAIP si la apelación lo requiere
                val puedeSubsanar = tipoUsuario == TipoUsuario.CIUDADANO &&
                    apelacionRelacionada?.requiereSubsanacion == true &&
                    usuario?.id == apelacionRelacionada.usuarioId

                // Estado actual: si hay apelación activa, mostrar el estado del flujo completo
                // para que el ciudadano vea el estado real, no el estado estático de la SAIP
                val estadoActual = if (apelacionRelacionada != null) {
                    if (apelacionRelacionada.estaResuelta) {
                        apelacionRelacionada.estado.toDisplayString()
                    } else {
                        when (apelacionRelacionada.estado) {
                            EstadoApelacion.PENDIENTE_ELEVACION -> "Pendiente de Elevación"
                            EstadoApelacion.EN_CALIFICACION_1 -> "En Primera Calificación"
                            EstadoApelacion.EN_SUBSANACION -> "Requiere Subsanación"
                            EstadoApelacion.EN_CALIFICACION_2 -> "En Segunda Calificación"
                            EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION -> "Notificación Segunda Calificación"
                            EstadoApelacion.EN_RESOLUCION -> "En Resolución"
                            else -> apelacionRelacionada.estado.toDisplayString()
                        }
                    }
                } else {
                    solicitud.estado.toDisplayString()
                }

                _uiState.value = RequestDetailUiState(
                    expediente = solicitud.expediente,
                    esSolicitud = true,
                    esApelacion = false,
                    solicitud = solicitud,
                    apelacionRelacionada = apelacionRelacionada,
                    estado = estadoActual,
                    diasRestantes = solicitud.diasRestantes,
                    asunto = solicitud.asunto,
                    entidad = solicitud.entidad,
                    fecha = formatearFecha(solicitud.fechaCreacion),
                    telefonoRecurrente = solicitud.solicitante.telefono.ifEmpty { usuario?.telefono ?: "" },
                    timeline = solicitud.timeline,
                    tipoUsuario = tipoUsuario,
                    puedeApelar = puedeApelar,
                    puedeIniciarRevision = puedeIniciarRevision,
                    puedeResponder = puedeResponder,
                    puedeSubsanar = puedeSubsanar,
                    isLoading = false
                )
            } else if (apelacion != null) {
                val puedeCalificar = tipoUsuario == TipoUsuario.TTAIP &&
                    apelacion.estado in listOf(
                        EstadoApelacion.EN_CALIFICACION_1,
                        EstadoApelacion.EN_CALIFICACION_2
                    )

                val puedeSubsanar = tipoUsuario == TipoUsuario.CIUDADANO &&
                    apelacion.requiereSubsanacion &&
                    usuario?.id == apelacion.usuarioId

                // Obtener teléfono del ciudadano desde la solicitud SAIP vinculada
                val solicitudVinculada = getSolicitudPorExpedienteUseCase(apelacion.expedienteSAIP).first()
                val telefonoCiudadano = solicitudVinculada?.solicitante?.telefono ?: ""

                _uiState.value = RequestDetailUiState(
                    expediente = apelacion.expediente,
                    esSolicitud = false,
                    esApelacion = true,
                    apelacion = apelacion,
                    estado = apelacion.estado.toDisplayString(),
                    diasRestantes = apelacion.diasRestantes,
                    asunto = apelacion.asunto,
                    entidad = apelacion.entidad,
                    fecha = formatearFecha(apelacion.fechaPresentacion),
                    telefonoRecurrente = telefonoCiudadano,
                    timeline = apelacion.timeline,
                    tipoUsuario = tipoUsuario,
                    puedeCalificar = puedeCalificar,
                    puedeSubsanar = puedeSubsanar,
                    isLoading = false
                )
            } else {
                _uiState.value = _uiState.value.copy(isLoading = false)
                _events.emit(RequestDetailEvent.ShowMessage("Trámite no encontrado"))
            }
    }

    fun mostrarFormularioRespuesta() {
        _uiState.value = _uiState.value.copy(showResponseForm = true)
    }

    fun ocultarFormularioRespuesta() {
        _uiState.value = _uiState.value.copy(showResponseForm = false)
    }

    fun responderSolicitud(tipoRespuesta: String, fundamentacion: String) {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            val usuario = getUsuarioActualUseCase().first()

            try {
                // Usar fromString() que maneja acentos correctamente
                // (ej: "Denegación Total" → DENEGACION_TOTAL)
                val tipoRespuestaEnum = TipoRespuesta.fromString(tipoRespuesta)

                responderSolicitudUseCase(
                    ResponderSolicitudUseCase.Params(
                        expediente = solicitud.expediente,
                        funcionario = usuario?.nombre ?: "Funcionario",
                        tipoRespuesta = tipoRespuestaEnum,
                        fundamentacion = fundamentacion
                    )
                )

                _uiState.value = _uiState.value.copy(showResponseForm = false)
                _events.emit(RequestDetailEvent.ShowMessage("Respuesta registrada exitosamente"))

                // Notificar al ciudadano sobre la respuesta de la entidad
                NotificationPushHelper.notificarRespuestaEntidad(
                    expedienteSaip = solicitud.expediente,
                    usuarioId = solicitud.usuarioId,
                    tipoRespuesta = tipoRespuestaEnum.name,
                    entidadNombre = solicitud.entidad
                )

                cargarDetalle(solicitud.expediente)
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun iniciarRevision() {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            try {
                iniciarRevisionUseCase(solicitud.expediente)
                _events.emit(RequestDetailEvent.ShowMessage("Solicitud marcada como En Revisión"))
                cargarDetalle(solicitud.expediente)
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun mostrarFormularioCalificacion() {
        _uiState.value = _uiState.value.copy(showCalificacionForm = true)
    }

    fun ocultarFormularioCalificacion() {
        _uiState.value = _uiState.value.copy(showCalificacionForm = false)
    }

    fun calificarApelacion(tipoCalificacion: String, resultado: String, fundamentacion: String) {
        viewModelScope.launch {
            val apelacion = _uiState.value.apelacion ?: return@launch

            try {
                val resultadoCal = try {
                    ResultadoCalificacion.valueOf(resultado.uppercase().replace(" ", "_"))
                } catch (e: Exception) {
                    ResultadoCalificacion.INADMISIBLE
                }

                val result = calificarApelacionUseCase(
                    CalificarApelacionUseCase.Params(
                        expediente = apelacion.expediente,
                        tipoCalificacion = tipoCalificacion,
                        resultado = resultadoCal,
                        fundamentacion = fundamentacion
                    )
                )

                when (result) {
                    is CalificarApelacionUseCase.Result.Success -> {
                        _uiState.value = _uiState.value.copy(showCalificacionForm = false)
                        _events.emit(RequestDetailEvent.ShowMessage("Calificación $tipoCalificacion registrada: $resultado"))

                        // Notificar al ciudadano sobre la calificación del TTAIP
                        NotificationPushHelper.notificarCalificacionTTAIP(
                            expediente = apelacion.expediente,
                            usuarioId = apelacion.usuarioId,
                            resultado = resultado,
                            tipoCalificacion = tipoCalificacion
                        )

                        cargarDetalle(apelacion.expediente)
                    }
                    is CalificarApelacionUseCase.Result.Error -> {
                        _events.emit(RequestDetailEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun iniciarCalificacion() {
        viewModelScope.launch {
            val apelacion = _uiState.value.apelacion ?: return@launch
            try {
                iniciarCalificacionUseCase(apelacion.expediente)
                _events.emit(RequestDetailEvent.ShowMessage("Apelación en calificación"))
                cargarDetalle(apelacion.expediente)
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun mostrarFormularioSubsanacion() {
        _uiState.value = _uiState.value.copy(showSubsanacionForm = true)
    }

    fun ocultarFormularioSubsanacion() {
        _uiState.value = _uiState.value.copy(showSubsanacionForm = false)
    }

    fun presentarSubsanacion(textoCorregido: String, fundamentoLegal: String) {
        viewModelScope.launch {
            // Soportar subsanación desde vista SAIP (apelacionRelacionada) y vista apelación (apelacion)
            val apelacion = _uiState.value.apelacion ?: _uiState.value.apelacionRelacionada ?: return@launch

            try {
                val result = presentarSubsanacionUseCase(
                    PresentarSubsanacionUseCase.Params(
                        expediente = apelacion.expediente,
                        textoCorregido = textoCorregido,
                        fundamentoLegalCorregido = fundamentoLegal
                    )
                )

                when (result) {
                    is PresentarSubsanacionUseCase.Result.Success -> {
                        _uiState.value = _uiState.value.copy(showSubsanacionForm = false)
                        _events.emit(RequestDetailEvent.ShowMessage("Subsanación presentada exitosamente"))

                        // Notificar al TTAIP que el ciudadano presentó subsanación
                        NotificationPushHelper.notificarSubsanacionPresentada(
                            expediente = apelacion.expediente,
                            recurrente = apelacion.apelante?.nombre ?: ""
                        )

                        // Recargar desde el expediente actual (SAIP o apelación)
                        cargarDetalle(_uiState.value.expediente)
                    }
                    is PresentarSubsanacionUseCase.Result.Error -> {
                        _events.emit(RequestDetailEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(RequestDetailEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun navegarAApelar() {
        viewModelScope.launch {
            val solicitud = _uiState.value.solicitud ?: return@launch
            _events.emit(RequestDetailEvent.NavigateToAppeal(solicitud.expediente))
        }
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}

