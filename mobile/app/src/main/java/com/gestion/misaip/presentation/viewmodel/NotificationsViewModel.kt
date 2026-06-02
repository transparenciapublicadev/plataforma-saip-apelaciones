package com.gestion.misaip.presentation.viewmodel

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.data.NotificacionReadTracker
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudesUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.solicitud.GetSolicitudesEntidadUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetApelacionesUsuarioUseCase
import com.gestion.misaip.core.domain.usecase.apelacion.GetTodasLasApelacionesUseCase
import com.gestion.misaip.core.domain.usecase.sync.SincronizarDatosUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Immutable
data class NotificationsUiState(
    val notificaciones: List<NotificacionItem> = emptyList(),
    val tipoUsuario: TipoUsuario = TipoUsuario.CIUDADANO,
    val isLoading: Boolean = false,
    val dataCargada: Boolean = false
)

data class NotificacionItem(
    val id: Int,
    val titulo: String,
    val mensaje: String,
    val fecha: String,
    val tipo: String,
    val leida: Boolean,
    val expediente: String? = null
)

class NotificationsViewModel(
    private val getUsuarioActualUseCase: GetUsuarioActualUseCase,
    private val getSolicitudesUsuarioUseCase: GetSolicitudesUsuarioUseCase,
    private val getSolicitudesEntidadUseCase: GetSolicitudesEntidadUseCase,
    private val getApelacionesUsuarioUseCase: GetApelacionesUsuarioUseCase,
    private val getTodasLasApelacionesUseCase: GetTodasLasApelacionesUseCase,
    private val notificacionReadTracker: NotificacionReadTracker,
    private val sincronizarDatosUseCase: SincronizarDatosUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    // ID del usuario actual para persistir lecturas en SharedPreferences
    private var usuarioActualId: String = ""

    init {
        cargarNotificaciones()
    }

    fun cargarNotificaciones() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            // Cargar datos del usuario directamente (sin sincronizar para evitar demora)
            val usuario = getUsuarioActualUseCase().first()
            val tipoUsuario = usuario?.tipo ?: TipoUsuario.CIUDADANO
            usuarioActualId = usuario?.id ?: ""

            // Generar notificaciones basadas en el rol y datos actuales
            val notificaciones = when (tipoUsuario) {
                TipoUsuario.CIUDADANO -> generarNotificacionesCiudadano(usuario?.id ?: "")
                TipoUsuario.FUNCIONARIO -> generarNotificacionesFuncionario(usuario?.entidadId)
                TipoUsuario.TTAIP -> generarNotificacionesTTAIP()
                TipoUsuario.ADMIN -> generarNotificacionesAdmin()
            }

            // Restaurar estado de lectura desde SharedPreferences (persiste entre recreaciones)
            val notificacionesConEstado = notificaciones.map { notif ->
                if (notificacionReadTracker.esNotificacionLeida(usuarioActualId, notif.id)) {
                    notif.copy(leida = true)
                } else {
                    notif
                }
            }

            _uiState.value = NotificationsUiState(
                notificaciones = notificacionesConEstado,
                tipoUsuario = tipoUsuario,
                isLoading = false,
                dataCargada = true
            )
        }
    }

    fun marcarComoLeida(id: Int) {
        // Persistir en SharedPreferences para que sobreviva recreación de Activity/ViewModel
        notificacionReadTracker.marcarNotificacionLeida(usuarioActualId, id)
        val notificaciones = _uiState.value.notificaciones.map {
            if (it.id == id) it.copy(leida = true) else it
        }
        _uiState.value = _uiState.value.copy(notificaciones = notificaciones)
    }

    private suspend fun generarNotificacionesCiudadano(usuarioId: String): List<NotificacionItem> {
        if (usuarioId.isBlank()) return emptyList()
        val solicitudes = getSolicitudesUsuarioUseCase(usuarioId).first()
        val apelaciones = getApelacionesUsuarioUseCase(usuarioId).first()

        val notificaciones = mutableListOf<NotificacionItem>()
        var idCounter = 1

        // Notificaciones de solicitudes respondidas
        solicitudes.filter { it.fueRespondida }.forEach { sol ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Solicitud Respondida",
                    mensaje = "Tu solicitud ${sol.expediente} ha sido respondida por ${sol.entidad}",
                    fecha = formatearFecha(sol.fechaCreacion),
                    tipo = "respuesta",
                    leida = false,
                    expediente = sol.expediente
                )
            )
        }

        // Notificaciones de solicitudes denegadas
        solicitudes.filter { it.fueDenegada }.forEach { sol ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Solicitud Denegada",
                    mensaje = "Tu solicitud ${sol.expediente} ha sido denegada. Puedes apelar ante el TTAIP.",
                    fecha = formatearFecha(sol.fechaCreacion),
                    tipo = "denegada",
                    leida = false,
                    expediente = sol.expediente
                )
            )
        }

        // Notificaciones de apelaciones que requieren subsanación
        apelaciones.filter { it.requiereSubsanacion }.forEach { apel ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Subsanación Requerida",
                    mensaje = "Tu apelación ${apel.expediente} requiere subsanación. Plazo: 2 días hábiles.",
                    fecha = formatearFecha(apel.fechaPresentacion),
                    tipo = "subsanacion",
                    leida = false,
                    expediente = apel.expediente
                )
            )
        }

        // Notificaciones de apelaciones resueltas
        apelaciones.filter { it.estaResuelta }.forEach { apel ->
            val resultado = when {
                apel.esFundada -> "FUNDADA"
                apel.esInfundada -> "INFUNDADA"
                else -> "INADMISIBLE"
            }
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Apelación Resuelta",
                    mensaje = "Tu apelación ${apel.expediente} ha sido declarada $resultado por el TTAIP.",
                    fecha = formatearFecha(apel.fechaPresentacion),
                    tipo = "resolucion",
                    leida = false,
                    expediente = apel.expediente
                )
            )
        }

        return notificaciones
    }

    private suspend fun generarNotificacionesFuncionario(entidadId: String?): List<NotificacionItem> {
        if (entidadId.isNullOrBlank()) return emptyList()
        val solicitudes = getSolicitudesEntidadUseCase(entidadId).first()

        val notificaciones = mutableListOf<NotificacionItem>()
        var idCounter = 1

        // Notificaciones de solicitudes nuevas
        solicitudes.filter { it.estado.name == "RECEPCIONADA" }.forEach { sol ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Nueva Solicitud SAIP",
                    mensaje = "Se ha recibido la solicitud ${sol.expediente}. Plazo de respuesta: ${sol.diasRestantes ?: 10} días.",
                    fecha = formatearFecha(sol.fechaCreacion),
                    tipo = "nueva",
                    leida = false,
                    expediente = sol.expediente
                )
            )
        }

        // Alertas de solicitudes próximas a vencer
        solicitudes.filter { (it.diasRestantes ?: 0) in 1..3 && it.estaPendiente }.forEach { sol ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Solicitud por Vencer",
                    mensaje = "La solicitud ${sol.expediente} vence en ${sol.diasRestantes} días. Atienda con urgencia.",
                    fecha = formatearFecha(sol.fechaCreacion),
                    tipo = "urgente",
                    leida = false,
                    expediente = sol.expediente
                )
            )
        }

        // Alertas de solicitudes vencidas
        solicitudes.filter { it.estaVencida }.forEach { sol ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Solicitud Vencida",
                    mensaje = "La solicitud ${sol.expediente} ha vencido. Riesgo de silencio administrativo negativo.",
                    fecha = formatearFecha(sol.fechaCreacion),
                    tipo = "vencida",
                    leida = false,
                    expediente = sol.expediente
                )
            )
        }

        return notificaciones
    }

    private suspend fun generarNotificacionesTTAIP(): List<NotificacionItem> {
        val apelaciones = getTodasLasApelacionesUseCase().first()

        val notificaciones = mutableListOf<NotificacionItem>()
        var idCounter = 1

        // Apelaciones pendientes
        apelaciones.filter { it.estado.name == "PENDIENTE" }.forEach { apel ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Nueva Apelación",
                    mensaje = "Apelación ${apel.expediente} pendiente de asignación y calificación.",
                    fecha = formatearFecha(apel.fechaPresentacion),
                    tipo = "nueva",
                    leida = false,
                    expediente = apel.expediente
                )
            )
        }

        // Subsanaciones presentadas
        apelaciones.filter { it.estado.name == "SUBSANACION_PRESENTADA" }.forEach { apel ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Subsanación Recibida",
                    mensaje = "El ciudadano ha presentado subsanación para ${apel.expediente}. Proceda con segunda calificación.",
                    fecha = formatearFecha(apel.fechaPresentacion),
                    tipo = "subsanacion",
                    leida = false,
                    expediente = apel.expediente
                )
            )
        }

        // Apelaciones urgentes
        apelaciones.filter { (it.diasRestantes ?: 0) <= 3 && !it.estaResuelta }.forEach { apel ->
            notificaciones.add(
                NotificacionItem(
                    id = idCounter++,
                    titulo = "Apelación Urgente",
                    mensaje = "La apelación ${apel.expediente} debe resolverse en ${apel.diasRestantes ?: 0} días hábiles.",
                    fecha = formatearFecha(apel.fechaPresentacion),
                    tipo = "urgente",
                    leida = false,
                    expediente = apel.expediente
                )
            )
        }

        return notificaciones
    }

    private fun generarNotificacionesAdmin(): List<NotificacionItem> {
        return listOf(
            NotificacionItem(
                id = 1,
                titulo = "Panel Administrativo",
                mensaje = "Acceda al panel de administración para ver estadísticas completas del sistema.",
                fecha = formatearFecha(System.currentTimeMillis()),
                tipo = "info",
                leida = false
            ),
            NotificacionItem(
                id = 2,
                titulo = "Sistema Operativo",
                mensaje = "El sistema MiSAIP se encuentra operando con normalidad.",
                fecha = formatearFecha(System.currentTimeMillis()),
                tipo = "info",
                leida = false
            ),
            NotificacionItem(
                id = 3,
                titulo = "Monitoreo Activo",
                mensaje = "Las solicitudes y apelaciones están siendo procesadas según los plazos establecidos.",
                fecha = formatearFecha(System.currentTimeMillis()),
                tipo = "info",
                leida = false
            )
        )
    }

    private fun formatearFecha(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.forLanguageTag("es-PE"))
        return sdf.format(java.util.Date(timestamp))
    }
}
