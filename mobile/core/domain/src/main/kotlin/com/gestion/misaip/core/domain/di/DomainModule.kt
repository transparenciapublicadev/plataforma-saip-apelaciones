package com.gestion.misaip.core.domain.di

import com.gestion.misaip.core.domain.usecase.apelacion.*
import com.gestion.misaip.core.domain.usecase.auth.*
import com.gestion.misaip.core.domain.usecase.entidad.*
import com.gestion.misaip.core.domain.usecase.notificacion.*
import com.gestion.misaip.core.domain.usecase.solicitud.*
import com.gestion.misaip.core.domain.usecase.sync.*
import org.koin.dsl.module

/**
 * Módulo Koin para el Dominio.
 *
 * Define los casos de uso (Use Cases / Interactors).
 * Los repositorios se inyectan desde el módulo de datos.
 */
val domainModule = module {

    // ===========================================
    // CASOS DE USO - AUTENTICACIÓN
    // ===========================================

    factory { AutenticarUsuarioUseCase(get()) }
    factory { GetUsuarioActualUseCase(get()) }
    factory { CerrarSesionUseCase(get()) }
    factory { RegistrarCiudadanoUseCase(get()) }
    factory { GetTodosLosUsuariosUseCase(get()) }

    // ===========================================
    // CASOS DE USO - SOLICITUDES SAIP
    // ===========================================

    factory { GetSolicitudesUsuarioUseCase(get()) }
    factory { GetSolicitudPorExpedienteUseCase(get()) }
    factory { GetEstadisticasSolicitudesUseCase(get()) }
    factory { GetSolicitudesEntidadUseCase(get()) }
    factory { IniciarRevisionUseCase(get()) }
    factory { CrearSolicitudUseCase(get()) }
    factory { ResponderSolicitudUseCase(get()) }
    factory { GetTodasLasSolicitudesUseCase(get()) }
    factory { CargarSolicitudesUsuarioPaginaUseCase(get()) }
    factory { CargarSolicitudesEntidadPaginaUseCase(get()) }
    factory { CargarSolicitudesPaginaUseCase(get()) }

    // ===========================================
    // CASOS DE USO - ENTIDADES PÚBLICAS
    // ===========================================

    factory { GetEntidadesActivasUseCase(get()) }

    // ===========================================
    // CASOS DE USO - APELACIONES TTAIP
    // ===========================================

    factory { GetApelacionesUsuarioUseCase(get()) }
    factory { GetTodasLasApelacionesUseCase(get()) }
    factory { GetApelacionPorExpedienteUseCase(get()) }
    factory { GetApelacionPorSAIPUseCase(get()) }
    factory { IniciarCalificacionUseCase(get()) }
    factory { CrearApelacionUseCase(get(), get()) }
    factory { CalificarApelacionUseCase(get()) }
    factory { PresentarSubsanacionUseCase(get()) }
    factory { CargarApelacionesUsuarioPaginaUseCase(get()) }
    factory { CargarApelacionesPaginaUseCase(get()) }

    // ===========================================
    // CASOS DE USO - NOTIFICACIONES
    // ===========================================

    factory { GetNotificacionesUseCase(get()) }
    factory { MarcarNotificacionLeidaUseCase(get()) }
    factory { GenerarNotificacionesDinamicasUseCase(get()) }

    // ===========================================
    // CASOS DE USO - SINCRONIZACIÓN
    // ===========================================

    factory { SincronizarDatosUseCase(get(), get(), get()) }
}
