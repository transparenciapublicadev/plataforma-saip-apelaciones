package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.Solicitud
import com.gestion.misaip.core.domain.model.Apelacion
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.CargarSolicitudesUsuarioPaginaUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.CargarApelacionesUsuarioPaginaUseCase
import com.gestion.misaip.data.EstadisticasCiudadano
import com.gestion.misaip.messaging.NotificationPushHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Immutable
data class CitizenDashboardUiState(
    val nombreUsuario: String = "",
    val estadisticas: EstadisticasCiudadano = EstadisticasCiudadano(0, 0, 0, 0),
    val expedientes: List<ExpedienteItem> = emptyList(),
    val expedientesFiltrados: List<ExpedienteItem> = emptyList(),
    val filtroActual: String = "todas",
    val busqueda: String = "",
    val solicitudesApelables: List<Solicitud> = emptyList(),
    val apelacionesPendientesSubsanacion: List<Apelacion> = emptyList(),
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val puedeCargarMas: Boolean = false,
    val errorMessage: String? = null
)

data class ExpedienteItem(
    val expediente: String,
    val asunto: String,
    val entidad: String,
    val fecha: String,
    val estado: String,
    val diasRestantes: Int?,
    val tipo: String, // "SAIP" o "Apelación"
    val apelacionVinculada: ApelacionVinculada? = null // Apelación derivada de esta SAIP
)

/**
 * Información resumida de la apelación vinculada a una solicitud SAIP.
 * Se muestra como sub-sección dentro de la tarjeta SAIP.
 */
data class ApelacionVinculada(
    val expediente: String,  // Formato NNNNN-AAAA-JUS/TTAIP
    val estado: String,
    val fecha: String
)

class CitizenDashboardViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val cargarSolicitudesUsuarioPaginaUseCase: CargarSolicitudesUsuarioPaginaUseCase,
    private val cargarApelacionesUsuarioPaginaUseCase: CargarApelacionesUsuarioPaginaUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CitizenDashboardUiState())
    val uiState: StateFlow<CitizenDashboardUiState> = _uiState.asStateFlow()
    private var solicitudesCargadas = emptyList<Solicitud>()
    private var apelacionesCargadas = emptyList<Apelacion>()
    private var paginaSolicitudes = -1
    private var paginaApelaciones = -1
    private var hayMasSolicitudes = true
    private var hayMasApelaciones = true
    private var totalSolicitudes = 0L

    init {
        // Escuchar señal de refresh cuando llegan notificaciones push
        viewModelScope.launch {
            NotificationPushHelper.refreshSignal.collect { tipo ->
                if (tipo in listOf("respuesta_entidad", "calificacion_ttaip", "subsanacion_requerida", "silencio_administrativo")) {
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
                val siguientePaginaSolicitudes = if (reiniciar) 0 else paginaSolicitudes + 1
                val siguientePaginaApelaciones = if (reiniciar) 0 else paginaApelaciones + 1
                val (solicitudesPagina, apelacionesPagina) = coroutineScope {
                    val solicitudesDeferred = async {
                        if (reiniciar || hayMasSolicitudes) {
                            cargarSolicitudesUsuarioPaginaUseCase(
                                usuario.id,
                                siguientePaginaSolicitudes,
                                TAMANO_PAGINA
                            )
                        } else null
                    }
                    val apelacionesDeferred = async {
                        if (reiniciar || hayMasApelaciones) {
                            cargarApelacionesUsuarioPaginaUseCase(
                                usuario.id,
                                siguientePaginaApelaciones,
                                TAMANO_PAGINA
                            )
                        } else null
                    }
                    solicitudesDeferred.await() to apelacionesDeferred.await()
                }

                solicitudesPagina?.let { respuesta ->
                    solicitudesCargadas = combinarPaginas(
                        actual = solicitudesCargadas,
                        nuevos = respuesta.contenido,
                        reiniciar = reiniciar,
                        key = { it.id.ifBlank { it.expediente } }
                    )
                    paginaSolicitudes = respuesta.pagina
                    hayMasSolicitudes = respuesta.tieneSiguiente
                    totalSolicitudes = respuesta.totalElementos
                }
                apelacionesPagina?.let { respuesta ->
                    apelacionesCargadas = combinarPaginas(
                        actual = apelacionesCargadas,
                        nuevos = respuesta.contenido,
                        reiniciar = reiniciar,
                        key = { it.id.ifBlank { it.expediente } }
                    )
                    paginaApelaciones = respuesta.pagina
                    hayMasApelaciones = respuesta.tieneSiguiente
                }
                actualizarVista(usuario.nombre)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoadingMore = false,
                    errorMessage = e.message ?: "No se pudo actualizar la bandeja"
                )
            }
        }
    }

    private fun actualizarVista(nombreUsuario: String) {
            val solicitudes = solicitudesCargadas
            val apelaciones = apelacionesCargadas

            // Calcular estadísticas desde los datos
            val estadisticas = EstadisticasCiudadano(
                total = totalSolicitudes.toInt(),
                enProceso = solicitudes.count { it.estaPendiente },
                respondidas = solicitudes.count { it.fueRespondida },
                denegadas = solicitudes.count { it.fueDenegada }
            )

            val expedientes = mutableListOf<ExpedienteItem>()

            // Mapa de apelaciones indexadas por expedienteSAIP para búsqueda rápida
            val apelacionesPorSAIP = apelaciones
                .filter { it.expedienteSAIP.isNotBlank() }
                .associateBy { it.expedienteSAIP }

            // Agregar solicitudes (con apelación vinculada si existe)
            solicitudes.forEach { sol ->
                val apelVinculada = apelacionesPorSAIP[sol.expediente]

                // Estado estratégico del flujo: mostrar al ciudadano qué está ocurriendo
                // con su trámite de forma clara, evitando confusión entre estado SAIP y apelación
                val estadoFlujo = if (apelVinculada != null) {
                    if (apelVinculada.estaResuelta) {
                        apelVinculada.estado.toDisplayString()
                    } else {
                        when (apelVinculada.estado) {
                            com.gestion.misaip.core.domain.model.EstadoApelacion.PENDIENTE_ELEVACION ->
                                "Pendiente de Elevación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_CALIFICACION_1 ->
                                "En Primera Calificación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_SUBSANACION ->
                                "Requiere Subsanación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_CALIFICACION_2 ->
                                "En Segunda Calificación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION ->
                                "Notificación Segunda Calificación"
                            com.gestion.misaip.core.domain.model.EstadoApelacion.EN_RESOLUCION ->
                                "En Resolución"
                            else -> apelVinculada.estado.toDisplayString()
                        }
                    }
                } else {
                    sol.estado.toDisplayString()
                }

                expedientes.add(
                    ExpedienteItem(
                        expediente = sol.expediente,
                        asunto = sol.asunto,
                        entidad = sol.entidad,
                        fecha = formatearFecha(sol.fechaCreacion),
                        estado = estadoFlujo,
                        diasRestantes = sol.diasRestantes,
                        tipo = "SAIP",
                        apelacionVinculada = apelVinculada?.let {
                            ApelacionVinculada(
                                expediente = it.expediente,
                                estado = it.estado.toDisplayString(),
                                fecha = formatearFecha(it.fechaPresentacion)
                            )
                        }
                    )
                )
            }

            // Agregar solo apelaciones huérfanas (sin solicitud SAIP vinculada en local)
            val expedientesSAIP = solicitudes.map { it.expediente }.toSet()
            apelaciones.filter { it.expedienteSAIP !in expedientesSAIP }.forEach { apel ->
                expedientes.add(
                    ExpedienteItem(
                        expediente = apel.expediente,
                        asunto = apel.asunto,
                        entidad = apel.entidad,
                        fecha = formatearFecha(apel.fechaPresentacion),
                        estado = apel.estado.toDisplayString(),
                        diasRestantes = apel.diasRestantes,
                        tipo = "Apelación"
                    )
                )
            }

            // Solicitudes que pueden ser apeladas
            val apelables = solicitudes.filter {
                it.puedeSerApelada &&
                apelaciones.none { apel -> apel.expedienteSAIP == it.expediente }
            }

            // Apelaciones pendientes de subsanación
            val pendientesSubsanacion = apelaciones.filter { it.requiereSubsanacion }

            val current = _uiState.value
            val nuevoEstado = current.copy(
                nombreUsuario = nombreUsuario,
                estadisticas = estadisticas,
                expedientes = expedientes,
                solicitudesApelables = apelables,
                apelacionesPendientesSubsanacion = pendientesSubsanacion,
                isLoading = false,
                isLoadingMore = false,
                puedeCargarMas = hayMasSolicitudes || hayMasApelaciones
            )
            _uiState.value = nuevoEstado.copy(
                expedientesFiltrados = filtrarExpedientes(
                    expedientes = expedientes,
                    filtro = nuevoEstado.filtroActual,
                    busqueda = nuevoEstado.busqueda
                )
            )
    }

    fun aplicarFiltro(filtro: String) {
        val expedientes = _uiState.value.expedientes

        _uiState.value = _uiState.value.copy(
            filtroActual = filtro,
            expedientesFiltrados = filtrarExpedientes(expedientes, filtro, _uiState.value.busqueda)
        )
    }

    fun buscar(query: String) {
        _uiState.value = _uiState.value.copy(busqueda = query)
        aplicarFiltro(_uiState.value.filtroActual)
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd MMM yyyy", Locale.forLanguageTag("es-PE"))
        return sdf.format(Date(timestamp))
    }

    private fun filtrarExpedientes(
        expedientes: List<ExpedienteItem>,
        filtro: String,
        busqueda: String
    ): List<ExpedienteItem> {
        val query = busqueda.lowercase()
        return expedientes.filter { exp ->
            val matchesBusqueda = query.isEmpty() ||
                exp.expediente.lowercase().contains(query) ||
                exp.asunto.lowercase().contains(query) ||
                exp.apelacionVinculada?.expediente?.lowercase()?.contains(query) == true

            val matchesFiltro = when (filtro) {
                "SAIP" -> exp.tipo == "SAIP" && exp.apelacionVinculada == null
                "Apelación" -> exp.tipo == "Apelación" || exp.apelacionVinculada != null
                "En Proceso" -> {
                    val estadosEnProceso = listOf(
                        "En Revisión", "Recepcionada", "En Primera Calificación",
                        "En Segunda Calificación", "Pendiente", "Pendiente de Elevación", "En Subsanación"
                    )
                    exp.estado in estadosEnProceso ||
                        exp.apelacionVinculada?.estado?.let { it in estadosEnProceso } == true
                }
                "Respondida" -> exp.estado == "Respondida"
                "Denegada" -> exp.estado in listOf("Denegada", "Vencida")
                else -> true
            }
            matchesBusqueda && matchesFiltro
        }
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

