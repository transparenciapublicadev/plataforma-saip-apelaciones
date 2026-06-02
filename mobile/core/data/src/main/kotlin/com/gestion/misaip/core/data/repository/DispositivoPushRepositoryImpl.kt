package com.gestion.misaip.core.data.repository

import com.gestion.misaip.core.domain.model.AppFlavorPush
import com.gestion.misaip.core.domain.model.DispositivoPush
import com.gestion.misaip.core.domain.model.EstadoDispositivoPush
import com.gestion.misaip.core.domain.model.EstadoProveedorPush
import com.gestion.misaip.core.domain.model.PlataformaPush
import com.gestion.misaip.core.domain.model.RegistrarDispositivoPush
import com.gestion.misaip.core.domain.model.RevocarDispositivoPushActual
import com.gestion.misaip.core.domain.repository.DispositivoPushRepository
import com.gestion.misaip.core.network.datasource.DispositivoPushRemoteDataSource
import com.gestion.misaip.core.network.dto.rest.DispositivoPushRestDto
import com.gestion.misaip.core.network.dto.rest.RegistrarDispositivoPushRestRequest
import com.gestion.misaip.core.network.dto.rest.RevocarDispositivoPushActualRestRequest

class DispositivoPushRepositoryImpl(
    private val remoteDataSource: DispositivoPushRemoteDataSource
) : DispositivoPushRepository {

    override suspend fun registrar(request: RegistrarDispositivoPush): DispositivoPush {
        return remoteDataSource.registrar(
            RegistrarDispositivoPushRestRequest(
                token = request.token,
                appFlavor = request.appFlavor.name,
                plataforma = request.plataforma.name,
                deviceIdHash = request.deviceIdHash,
                appVersion = request.appVersion,
                buildType = request.buildType
            )
        ).toDomain()
    }

    override suspend fun revocarActual(request: RevocarDispositivoPushActual) {
        remoteDataSource.revocarActual(RevocarDispositivoPushActualRestRequest(request.deviceIdHash))
    }

    override suspend fun listarMios(): List<DispositivoPush> {
        return remoteDataSource.listarMios().map { it.toDomain() }
    }

    override suspend fun obtenerEstadoSeguro(): EstadoProveedorPush {
        val dto = remoteDataSource.obtenerEstadoSeguro()
        return EstadoProveedorPush(
            proveedor = dto.proveedor,
            estado = dto.estado,
            configurable = dto.configurable,
            credencialesExternasConfiguradas = dto.credencialesExternasConfiguradas,
            cifradoTokenConfigurado = dto.cifradoTokenConfigurado,
            nota = dto.nota
        )
    }

    private fun DispositivoPushRestDto.toDomain() = DispositivoPush(
        id = id,
        tipoUsuario = tipoUsuario,
        appFlavor = AppFlavorPush.valueOf(appFlavor),
        plataforma = PlataformaPush.valueOf(plataforma),
        tokenFingerprint = tokenFingerprint,
        deviceFingerprint = deviceFingerprint,
        estado = EstadoDispositivoPush.valueOf(estado),
        appVersion = appVersion,
        buildType = buildType
    )
}
