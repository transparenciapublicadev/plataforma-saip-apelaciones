package com.gestion.misaip.core.domain.di

import com.gestion.misaip.core.domain.usecase.apelacion.*
import com.gestion.misaip.core.domain.usecase.auth.*
import com.gestion.misaip.core.domain.usecase.documento.*
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
    factory { RefrescarSolicitudDetalleUseCase(get()) }
    factory { GetEstadisticasSolicitudesUseCase(get()) }
    factory { GetSolicitudesEntidadUseCase(get()) }
    factory { IniciarRevisionUseCase(get()) }
    factory { CrearSolicitudUseCase(get()) }
    factory { ResponderSolicitudUseCase(get()) }
    factory { GetTodasLasSolicitudesUseCase(get()) }
    factory { CargarSolicitudesUsuarioPaginaUseCase(get()) }
    factory { CargarSolicitudesEntidadPaginaUseCase(get()) }
    factory { CargarSolicitudesPaginaUseCase(get()) }
    factory { GetOperacionesSolicitudFuncionarioUseCase(get()) }
    factory { RegistrarObservacionSolicitudUseCase(get()) }
    factory { RegistrarAmpliacionPlazoSolicitudUseCase(get()) }
    factory { RegistrarEncauzamientoSolicitudUseCase(get()) }
    factory { EmitirLiquidacionCostoSolicitudUseCase(get()) }

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
    factory { RefrescarApelacionDetalleUseCase(get()) }
    factory { GetApelacionPorSAIPUseCase(get()) }
    factory { IniciarCalificacionUseCase(get()) }
    factory { CrearApelacionUseCase(get(), get()) }
    factory { CalificarApelacionUseCase(get()) }
    factory { PresentarSubsanacionUseCase(get()) }
    factory { CargarApelacionesUsuarioPaginaUseCase(get()) }
    factory { CargarApelacionesPaginaUseCase(get()) }
    factory { CrearApelacionExternaUseCase(get()) }
    factory { CrearApelacionAnteEntidadUseCase(get()) }
    factory { GetElevacionApelacionUseCase(get()) }
    factory { GetPendientesElevacionEntidadUseCase(get()) }
    factory { ElevarApelacionUseCase(get()) }
    factory { ComunicarOmisionElevacionUseCase(get()) }
    factory { GetExpedienteTtaipUseCase(get()) }
    factory { GestionarExpedienteTtaipUseCase(get()) }

    // ===========================================
    // CASOS DE USO - NOTIFICACIONES
    // ===========================================

    factory { GetNotificacionesUseCase(get()) }
    factory { MarcarNotificacionLeidaUseCase(get()) }
    factory { GenerarNotificacionesDinamicasUseCase(get()) }
    factory { RegistrarDispositivoPushUseCase(get()) }
    factory { RevocarDispositivoPushActualUseCase(get()) }
    factory { ListarDispositivosPushMiosUseCase(get()) }
    factory { ObtenerEstadoProveedorPushUseCase(get()) }

    // ===========================================
    // CASOS DE USO - DOCUMENTOS
    // ===========================================

    factory { ValidarArchivoDocumentoUseCase() }
    factory { UploadDocumentoUseCase(get(), get()) }
    factory { GetDocumentoMetadataUseCase(get()) }
    factory { DownloadDocumentoUseCase(get()) }
    factory { DeleteDocumentoUseCase(get()) }

    // ===========================================
    // CASOS DE USO - SINCRONIZACIÓN
    // ===========================================

    factory { SincronizarDatosUseCase(get(), get(), get()) }
}
