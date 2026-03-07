package com.gestion.misaip.navigation

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object Splash : NavKey

@Serializable
data object Onboarding : NavKey

@Serializable
data object Login : NavKey

@Serializable
data object Register : NavKey

@Serializable
data object CitizenDashboard : NavKey

@Serializable
data object EntityDashboard : NavKey

@Serializable
data object TTAIPDashboard : NavKey

@Serializable
data object AdminDashboard : NavKey

@Serializable
data class RequestDetail(val expediente: String, val tipo: String = "SAIP") : NavKey

@Serializable
data class SAIPForm(val entidadId: String? = null) : NavKey

@Serializable
data class AppealForm(val expedienteSAIP: String = "") : NavKey

@Serializable
data object Notifications : NavKey

@Serializable
data object Profile : NavKey
