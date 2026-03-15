package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.ResultadoCalificacion
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetTodasLasApelacionesUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.IniciarCalificacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CalificarApelacionUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import com.gestion.misaip.data.EstadisticasTTAIP
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class TTAIPDashboardUiState(
    val nombreUsuario: String = "",
    val cargo: String = "",
    val estadisticas: EstadisticasTTAIP = EstadisticasTTAIP(0, 0, 0, 0, 0),
    val apelaciones: List<ApelacionItem> = emptyList(),
    val apelacionesFiltradas: List<ApelacionItem> = emptyList(),
    val filtroActual: String = "Pendiente de Elevación",
    val busqueda: String = "",
    val apelacionesUrgentes: List<Apelacion> = emptyList(),
    val isLoading: Boolean = false
)

data class ApelacionItem(
    val expediente: String,
    val expedienteSAIP: String,
    val asunto: String,
    val recurrente: String,
    val entidad: String,
    val fecha: String,
    val estado: String,
    val diasRestantes: Int?,
    val funcionarioAsignado: String?
)

sealed class TTAIPDashboardEvent {
    data class ShowMessage(val message: String) : TTAIPDashboardEvent()
    data class NavigateToDetail(val expediente: String) : TTAIPDashboardEvent()
}

class TTAIPDashboardViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getTodasLasApelacionesUseCase: GetTodasLasApelacionesUseCase,
    private val iniciarCalificacionUseCase: IniciarCalificacionUseCase,
    private val calificarApelacionUseCase: CalificarApelacionUseCase,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(TTAIPDashboardUiState())
    val uiState: StateFlow<TTAIPDashboardUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<TTAIPDashboardEvent>()
    val events: SharedFlow<TTAIPDashboardEvent> = _events

    init {
        sincronizarYRecargar()
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf("nueva_apelacion", "subsanacion_presentada")) {
                    sincronizarYRecargar()
                }
            }
        }
    }

    fun cargarDatos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            val usuario = getUsuarioActualUseCase().first()
            if (usuario == null) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }

            val apelaciones = getTodasLasApelacionesUseCase().first()

            // Calcular estadísticas desde los datos
            val estadisticas = EstadisticasTTAIP(
                pendientesAdmision = apelaciones.count {
                    it.estado.name == "PENDIENTE_ELEVACION" || it.estado.name == "EN_CALIFICACION_1"
                },
                enProceso = apelaciones.count {
                    it.estado.name == "EN_CALIFICACION_2" ||
                        it.estado.name == "NOTIFICACION_SEGUNDA_CALIFICACION" ||
                        it.estado.name == "EN_RESOLUCION"
                },
                enSubsanacion = apelaciones.count { it.estado.name == "EN_SUBSANACION" },
                resueltas = apelaciones.count { it.estaResuelta },
                total = apelaciones.size
            )

            val apelacionesItems = apelaciones.map { apel ->
                ApelacionItem(
                    expediente = apel.expediente,
                    expedienteSAIP = apel.expedienteSAIP,
                    asunto = apel.asunto,
                    recurrente = apel.apelante.nombre,
                    entidad = apel.entidad,
                    fecha = formatearFecha(apel.fechaPresentacion),
                    estado = apel.estado.toDisplayString(),
                    diasRestantes = apel.diasRestantes,
                    funcionarioAsignado = apel.funcionarioTTAIP
                )
            }

            val filtroPorDefecto = "Pendiente de Elevación"
            val apelacionesFiltradas = filtrarApelaciones(
                apelaciones = apelacionesItems,
                filtro = filtroPorDefecto,
                busqueda = ""
            )

            // Apelaciones urgentes (menos de 3 días)
            val urgentes = apelaciones.filter {
                !it.estaResuelta && (it.diasRestantes ?: 0) <= 3
            }

            _uiState.value = TTAIPDashboardUiState(
                nombreUsuario = usuario.nombre,
                cargo = usuario.cargo ?: "",
                estadisticas = estadisticas,
                apelaciones = apelacionesItems,
                apelacionesFiltradas = apelacionesFiltradas,
                filtroActual = filtroPorDefecto,
                apelacionesUrgentes = urgentes,
                isLoading = false
            )
        }
    }

    /**
     * Sincroniza datos desde Firestore y recarga la UI.
     * Se ejecuta cuando se recibe una notificación push relevante.
     */
    private fun sincronizarYRecargar() {
        viewModelScope.launch {
            try {
                sincronizarDatosUseCase()
            } catch (_: Exception) { }
            cargarDatos()
        }
    }

    fun aplicarFiltro(filtro: String) {
        val filtradas = filtrarApelaciones(
            apelaciones = _uiState.value.apelaciones,
            filtro = filtro,
            busqueda = _uiState.value.busqueda
        )

        _uiState.value = _uiState.value.copy(
            filtroActual = filtro,
            apelacionesFiltradas = filtradas
        )
    }

    fun buscar(query: String) {
        _uiState.value = _uiState.value.copy(busqueda = query)
        aplicarFiltro(_uiState.value.filtroActual)
    }

    private fun filtrarApelaciones(
        apelaciones: List<ApelacionItem>,
        filtro: String,
        busqueda: String
    ): List<ApelacionItem> {
        val query = busqueda.lowercase()
        return apelaciones.filter { apel ->
            val matchesBusqueda = query.isEmpty() ||
                apel.expediente.lowercase().contains(query) ||
                apel.recurrente.lowercase().contains(query) ||
                apel.entidad.lowercase().contains(query)

            val matchesFiltro = when (filtro) {
                "Pendiente de Elevación" -> apel.estado == "Pendiente de Elevación"
                "En Calificación" -> apel.estado == "En Primera Calificación" || apel.estado == "En Segunda Calificación"
                "En Subsanación" -> apel.estado == "En Subsanación"
                "En Resolución" -> apel.estado == "En Resolución" || apel.estado == "Notificación Segunda Calificación"
                "Resuelto" -> apel.estado.startsWith("Resuelto") || apel.estado.startsWith("Conclusión") || apel.estado == "Tener por No Presentado"
                else -> true
            }

            matchesBusqueda && matchesFiltro
        }
    }

    fun iniciarCalificacion(expediente: String) {
        viewModelScope.launch {
            try {
                iniciarCalificacionUseCase(expediente)
                cargarDatos()
                _events.emit(TTAIPDashboardEvent.ShowMessage("Apelación en calificación"))
            } catch (e: Exception) {
                _events.emit(TTAIPDashboardEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    fun calificar(expediente: String, tipoCalificacion: String, resultado: String, fundamentacion: String) {
        viewModelScope.launch {
            try {
                val resultadoCal = try {
                    ResultadoCalificacion.valueOf(resultado.uppercase().replace(" ", "_"))
                } catch (e: Exception) {
                    ResultadoCalificacion.INADMISIBLE
                }

                val result = calificarApelacionUseCase(
                    CalificarApelacionUseCase.Params(
                        expediente = expediente,
                        tipoCalificacion = tipoCalificacion,
                        resultado = resultadoCal,
                        fundamentacion = fundamentacion
                    )
                )

                when (result) {
                    is CalificarApelacionUseCase.Result.Success -> {
                        // Buscar la apelación para obtener el usuarioId del recurrente
                        val apelacionNotif = _uiState.value.apelaciones.find { it.expediente == expediente }
                        val apelacionesCompletas = getTodasLasApelacionesUseCase().first()
                        val apelacionFull = apelacionesCompletas.find { it.expediente == expediente }

                        if (apelacionFull != null) {
                            NotificationPushHelper.notificarCalificacionTTAIP(
                                expediente = expediente,
                                usuarioId = apelacionFull.usuarioId,
                                resultado = resultado,
                                tipoCalificacion = tipoCalificacion
                            )
                        }

                        cargarDatos()
                        _events.emit(TTAIPDashboardEvent.ShowMessage("Calificación registrada: $resultado"))
                    }
                    is CalificarApelacionUseCase.Result.Error -> {
                        _events.emit(TTAIPDashboardEvent.ShowMessage(result.mensaje))
                    }
                }
            } catch (e: Exception) {
                _events.emit(TTAIPDashboardEvent.ShowMessage("Error: ${e.message}"))
            }
        }
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}

