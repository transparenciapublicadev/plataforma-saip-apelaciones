package com.gestion.misaip.ui.screen

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gestion.misaip.config.AppRolePolicy
import com.gestion.misaip.core.domain.usecase.auth.CerrarSesionUseCase
import com.gestion.misaip.core.domain.usecase.auth.GetUsuarioActualUseCase
import com.gestion.misaip.messaging.FCMHelper
import com.gestion.misaip.messaging.NotificationPushHelper
import com.gestion.misaip.ui.theme.BrandRed
import com.gestion.misaip.ui.theme.GradientRedEnd
import com.gestion.misaip.ui.theme.GradientRedStart
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import org.koin.compose.koinInject
import timber.log.Timber

@Composable
fun SplashScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToOnboarding: () -> Unit,
    onNavigateToDashboard: (com.gestion.misaip.core.domain.model.TipoUsuario) -> Unit,
    getUsuarioActualUseCase: GetUsuarioActualUseCase = koinInject(),
    cerrarSesionUseCase: CerrarSesionUseCase = koinInject()
) {
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(Unit) {
        delay(2500)
        try {
            val usuario = getUsuarioActualUseCase().first()
            if (usuario != null) {
                if (!AppRolePolicy.isRoleAllowed(usuario.tipo)) {
                    Timber.w("Sesion ${usuario.tipo} bloqueada en APK ${AppRolePolicy.roleLabel}")
                    runCatching { FCMHelper.unregisterTokenFromBackend() }
                    runCatching { FCMHelper.unsubscribeAll(usuario.tipo.name, usuario.entidadId) }
                    cerrarSesionUseCase()
                    onNavigateToLogin()
                    return@LaunchedEffect
                }
                Timber.d("Sesión activa encontrada: ${usuario.nombre} (${usuario.tipo})")
                FCMHelper.getToken(
                    onTokenReceived = { token ->
                        FCMHelper.registerTokenWithBackend(token)
                    },
                    onError = { e ->
                        Timber.e(e, "Error obteniendo token FCM")
                    }
                )
                FCMHelper.subscribeUserByType(usuario.tipo.name)
                NotificationPushHelper.iniciarEscuchaNotificaciones(
                    usuarioId = usuario.id,
                    tipoUsuario = usuario.tipo.name,
                    entidadId = usuario.entidadId
                )
                onNavigateToDashboard(usuario.tipo)
            } else {
                // Verificar si el onboarding fue completado
                if (!isOnboardingCompleted(context)) {
                    onNavigateToOnboarding()
                } else {
                    onNavigateToLogin()
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error verificando sesión")
            onNavigateToLogin()
        }
    }

    SplashContent()
}

@Composable
private fun SplashContent() {
    var animationStarted by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(100)
        animationStarted = true
    }

    val logoScale by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0.3f,
        animationSpec = tween(800, easing = FastOutSlowInEasing),
        label = "logoScale"
    )
    val logoAlpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(600),
        label = "logoAlpha"
    )
    val textAlpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(600, delayMillis = 400),
        label = "textAlpha"
    )
    val subtitleAlpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(600, delayMillis = 700),
        label = "subtitleAlpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(GradientRedStart, GradientRedEnd)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Logo circular animado
            Surface(
                modifier = Modifier
                    .size(130.dp)
                    .scale(logoScale)
                    .graphicsLayer { alpha = logoAlpha },
                shape = CircleShape,
                color = Color.White,
                shadowElevation = 12.dp
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "SAIP",
                        color = BrandRed,
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 2.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            Text(
                text = "SAIP Perú",
                color = Color.White,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier.graphicsLayer { alpha = textAlpha }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Sistema de Acceso a la Información Pública",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 0.5.sp,
                modifier = Modifier.graphicsLayer { alpha = subtitleAlpha }
            )
        }
    }
}
