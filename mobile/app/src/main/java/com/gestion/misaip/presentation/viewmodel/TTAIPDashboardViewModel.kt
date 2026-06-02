package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.model.ResultadoCalificacion
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CargarApelacionesPaginaUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.IniciarCalificacionUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CalificarApelacionUseCase
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
    val filtroActual: String = "En Calificación",
    val busqueda: String = "",
    val apelacionesUrgentes: List<Apelacion> = emptyList(),
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val puedeCargarMas: Boolean = false,
    val errorMessage: String? = null
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
    val funcionarioAsignado: String?,
    val usuarioId: String
)

sealed class TTAIPDashboardEvent {
    data class ShowMessage(val message: String) : TTAIPDashboardEvent()
    data class NavigateToDetail(val expediente: String) : TTAIPDashboardEvent()
}

class TTAIPDashboardViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val cargarApelacionesPaginaUseCase: CargarApelacionesPaginaUseCase,
    private val iniciarCalificacionUseCase: IniciarCalificacionUseCase,
    private val calificarApelacionUseCase: CalificarApelacionUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(TTAIPDashboardUiState())
    val uiState: StateFlow<TTAIPDashboardUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<TTAIPDashboardEvent>()
    val events: SharedFlow<TTAIPDashboardEvent> = _events
    private var apelacionesCargadas = emptyList<Apelacion>()
    private var paginaApelaciones = -1
    private var hayMasApelaciones = true
    private var totalApelaciones = 0L

    init {
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf("nueva_apelacion", "subsanacion_presentada")) {
                    cargarDatos()
                }
            }
        }
    }

    fun cargarDatos() = cargarPagina(reiniciar = true)

    fun cargarSiguientePagina() = cargarPagina(reiniciar = false)

    private fun cargarPagina(reiniciar: Boolean) {
        viewModelScope.launch {
            if (!reiniciar && (_uiState.value.isLoadingMore || !_uiState.value.puedeCargarMas)) {
                return@launch
            }
            _uiState.value = _uiState.value.copy(
                isLoading = reiniciar,
                isLoadingMore = !reiniciar,
                errorMessage = null
            )

            val usuario = getUsuarioActualUseCase().first()
            if (usuario == null) {
                _uiState.value = _uiState.value.copy(isLoading = false, isLoadingMore = false)
                return@launch
            }

            try {
                val pagina = cargarApelacionesPaginaUseCase(
                    pagina = if (reiniciar) 0 else paginaApelaciones + 1,
                    tamano = TAMANO_PAGINA
                )
                apelacionesCargadas = combinarPaginas(
                    actual = apelacionesCargadas,
                    nuevos = pagina.contenido,
                    reiniciar = reiniciar,
                    key = { it.id.ifBlank { it.expediente } }
                )
                paginaApelaciones = pagina.pagina
                hayMasApelaciones = pagina.tieneSiguiente
                totalApelaciones = pagina.totalElementos
                actualizarVista(usuario.nombre, usuario.cargo ?: "")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoadingMore = false,
                    errorMessage = e.message ?: "No se pudo actualizar la bandeja"
                )
            }
        }
    }

    private fun actualizarVista(nombreUsuario: String, cargo: String) {
            val apelaciones = apelacionesCargadas
            // Calcular estadísticas desde los datos
            val estadisticas = EstadisticasTTAIP(
                pendientesAdmision = apelaciones.count {
                    it.estado.name == "EN_CALIFICACION_1"
                },
                enProceso = apelaciones.count {
                    it.estado.name == "EN_CALIFICACION_2" ||
                        it.estado.name == "NOTIFICACION_SEGUNDA_CALIFICACION" ||
                        it.estado.name == "EN_RESOLUCION"
                },
                enSubsanacion = apelaciones.count { it.estado.name == "EN_SUBSANACION" },
                resueltas = apelaciones.count { it.estaResuelta },
                total = totalApelaciones.toInt()
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
                    funcionarioAsignado = apel.funcionarioTTAIP,
                    usuarioId = apel.usuarioId
                )
            }

            // Apelaciones urgentes (menos de 3 días)
            val urgentes = apelaciones.filter {
                !it.estaResuelta && (it.diasRestantes ?: 0) <= 3
            }

            val current = _uiState.value
            val nuevoEstado = current.copy(
                nombreUsuario = nombreUsuario,
                cargo = cargo,
                estadisticas = estadisticas,
                apelaciones = apelacionesItems,
                apelacionesUrgentes = urgentes,
                isLoading = false,
                isLoadingMore = false,
                puedeCargarMas = hayMasApelaciones
            )
            _uiState.value = nuevoEstado.copy(
                apelacionesFiltradas = filtrarApelaciones(
                    apelaciones = apelacionesItems,
                    filtro = nuevoEstado.filtroActual,
                    busqueda = nuevoEstado.busqueda
                )
            )
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
                        val apelacionNotif = _uiState.value.apelaciones.find { it.expediente == expediente }

                        if (apelacionNotif != null) {
                            NotificationPushHelper.notificarCalificacionTTAIP(
                                expediente = expediente,
                                usuarioId = apelacionNotif.usuarioId,
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

    private companion object {
        const val TAMANO_PAGINA = 20
    }
}

private fun <T> combinarPaginas(
    actual: List<T>,
    nuevos: List<T>,
    reiniciar: Boolean,
    key: (T) -> String
): List<T> {
    return (if (reiniciar) nuevos else actual + nuevos).distinctBy(key)
}

