package com.gestion.misaip

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.gestion.misaip.config.AppRolePolicy
import com.gestion.misaip.core.domain.model.TipoUsuario
import com.gestion.misaip.navigation.*
import com.gestion.misaip.ui.screen.*
import com.gestion.misaip.ui.theme.MiSAIPTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MiSAIPTheme {
                MiSAIPNavigation(
                    deepLinkExpediente = intent?.getStringExtra("EXPEDIENTE"),
                    deepLinkTipo = intent?.getStringExtra("TIPO_NOTIFICACION")
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}

@Composable
fun MiSAIPNavigation(
    deepLinkExpediente: String? = null,
    deepLinkTipo: String? = null
) {
    val backStack = rememberNavBackStack(Splash)
    var welcomeMessage by remember { mutableStateOf<String?>(null) }

    fun navigateAfterAuth(tipoUsuario: TipoUsuario) {
        if (!AppRolePolicy.isRoleAllowed(tipoUsuario)) {
            backStack.clear()
            backStack.add(Login)
            return
        }
        backStack.clear()
        backStack.add(dashboardRouteForRole(tipoUsuario))
        if (!deepLinkExpediente.isNullOrBlank()) {
            backStack.add(RequestDetail(deepLinkExpediente, deepLinkTipo ?: "SAIP"))
        }
    }

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<Splash> {
                SplashScreen(
                    onNavigateToLogin = {
                        backStack.clear()
                        backStack.add(Login)
                    },
                    onNavigateToOnboarding = {
                        backStack.clear()
                        backStack.add(Onboarding)
                    },
                    onNavigateToDashboard = { tipoUsuario ->
                        navigateAfterAuth(tipoUsuario)
                    }
                )
            }

            entry<Onboarding> {
                OnboardingScreen(
                    onOnboardingComplete = {
                        backStack.clear()
                        backStack.add(Login)
                    }
                )
            }

            entry<Login> {
                LoginScreen(
                    onLoginSuccess = { tipoUsuario, _, _, nombreUsuario ->
                        welcomeMessage = "¡Bienvenido $nombreUsuario!"
                        val role = runCatching { TipoUsuario.valueOf(tipoUsuario) }
                            .getOrDefault(TipoUsuario.CIUDADANO)
                        navigateAfterAuth(role)
                    },
                    onNavigateToRegister = {
                        backStack.add(Register)
                    }
                )
            }

            entry<Register> {
                if (AppRolePolicy.allowsPublicRegistration) {
                    RegisterScreen(
                        onNavigateBack = { backStack.removeLastOrNull() },
                        onRegisterSuccess = { _ ->
                            // Los ciudadanos registrados siempre van al CitizenDashboard
                            backStack.clear()
                            backStack.add(CitizenDashboard)
                        }
                    )
                } else {
                    androidx.compose.runtime.LaunchedEffect(Unit) {
                        backStack.clear()
                        backStack.add(Login)
                    }
                }
            }

            entry<CitizenDashboard> {
                CitizenDashboardScreen(
                    onNavigateToDetail = { expediente, tipo ->
                        backStack.add(RequestDetail(expediente, tipo))
                    },
                    onNavigateToSAIPForm = {
                        backStack.add(SAIPForm())
                    },
                    onNavigateToLogin = {
                        backStack.clear()
                        backStack.add(Login)
                    },
                    welcomeMessage = welcomeMessage,
                    onWelcomeShown = { welcomeMessage = null }
                )
            }

            entry<EntityDashboard> {
                EntityDashboardScreen(
                    onNavigateToDetail = { expediente, tipo ->
                        backStack.add(RequestDetail(expediente, tipo))
                    },
                    onNavigateToLogin = {
                        backStack.clear()
                        backStack.add(Login)
                    },
                    welcomeMessage = welcomeMessage,
                    onWelcomeShown = { welcomeMessage = null }
                )
            }

            entry<TTAIPDashboard> {
                TTAIPDashboardScreen(
                    onNavigateToDetail = { expediente, tipo ->
                        backStack.add(RequestDetail(expediente, tipo))
                    },
                    onNavigateToLogin = {
                        backStack.clear()
                        backStack.add(Login)
                    },
                    welcomeMessage = welcomeMessage,
                    onWelcomeShown = { welcomeMessage = null }
                )
            }

            entry<AdminDashboard> {
                androidx.compose.runtime.LaunchedEffect(Unit) {
                    backStack.clear()
                    backStack.add(Login)
                }
            }

            entry<RequestDetail> { key ->
                RequestDetailScreen(
                    expediente = key.expediente,
                    tipo = key.tipo,
                    onNavigateBack = { backStack.removeLastOrNull() },
                    onNavigateToAppeal = { expedienteSAIP ->
                        backStack.add(AppealForm(expedienteSAIP))
                    }
                )
            }

            entry<SAIPForm> {
                SAIPFormScreen(
                    onNavigateBack = { backStack.removeLastOrNull() },
                    onSolicitudCreada = { expediente ->
                        welcomeMessage = "Solicitud $expediente creada exitosamente"
                        backStack.removeLastOrNull()
                    }
                )
            }

            entry<AppealForm> { key ->
                AppealFormScreen(
                    expedienteSAIP = key.expedienteSAIP.ifBlank { null },
                    onNavigateBack = { backStack.removeLastOrNull() }
                )
            }

            entry<Notifications> {
                NotificationsScreen(
                    onNavigateBack = { backStack.removeLastOrNull() },
                    onNavigateToDetail = { expediente, tipo ->
                        backStack.add(RequestDetail(expediente, tipo))
                    }
                )
            }

            entry<Profile> {
                ProfileScreen(
                    onNavigateBack = { backStack.removeLastOrNull() },
                    onNavigateToLogin = {
                        backStack.clear()
                        backStack.add(Login)
                    }
                )
            }
        }
    )
}

private fun dashboardRouteForRole(tipoUsuario: TipoUsuario): NavKey = when (tipoUsuario) {
    TipoUsuario.CIUDADANO -> CitizenDashboard
    TipoUsuario.FUNCIONARIO -> EntityDashboard
    TipoUsuario.TTAIP -> TTAIPDashboard
    TipoUsuario.ADMIN -> Login
}
