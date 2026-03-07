package com.gestion.misaip.ui.screen

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.gestion.misaip.ui.theme.BrandRed
import com.gestion.misaip.ui.theme.GradientRedEnd
import com.gestion.misaip.ui.theme.GradientRedStart
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val ONBOARDING_PREFS = "misaip_onboarding"
private const val KEY_COMPLETED = "onboarding_completed"

fun isOnboardingCompleted(context: Context): Boolean {
    return context.getSharedPreferences(ONBOARDING_PREFS, Context.MODE_PRIVATE)
        .getBoolean(KEY_COMPLETED, false)
}

private fun markOnboardingCompleted(context: Context) {
    context.getSharedPreferences(ONBOARDING_PREFS, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_COMPLETED, true)
        .apply()
}

private data class OnboardingPage(
    val icon: ImageVector,
    val title: String,
    val description: String,
    val isNotificationPage: Boolean = false
)

private val pages = listOf(
    OnboardingPage(
        icon = Icons.Filled.Description,
        title = "Tu derecho a la\ninformación pública",
        description = "Presenta solicitudes de acceso a la información pública (SAIP) " +
                "ante cualquier entidad del Estado peruano, de forma rápida y digital."
    ),
    OnboardingPage(
        icon = Icons.Filled.TrackChanges,
        title = "Seguimiento\nen tiempo real",
        description = "Consulta el estado de tus solicitudes, recibe respuestas de las entidades " +
                "y, si es necesario, presenta apelaciones ante el TTAIP."
    ),
    OnboardingPage(
        icon = Icons.Filled.Notifications,
        title = "No te pierdas\nninguna actualización",
        description = "Activa las notificaciones para recibir alertas cuando una entidad " +
                "responda tu solicitud o el TTAIP resuelva tu apelación.",
        isNotificationPage = true
    )
)

@Composable
fun OnboardingScreen(
    onOnboardingComplete: () -> Unit
) {
    val context = LocalContext.current
    val pagerState = rememberPagerState(pageCount = { pages.size })
    val coroutineScope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(GradientRedStart, GradientRedEnd)
                )
            )
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Botón Omitir (arriba derecha)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 48.dp, end = 16.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                if (pagerState.currentPage < pages.lastIndex) {
                    TextButton(
                        onClick = {
                            markOnboardingCompleted(context)
                            onOnboardingComplete()
                        }
                    ) {
                        Text(
                            "Omitir",
                            color = Color.White.copy(alpha = 0.7f),
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            }

            // Pager
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f)
            ) { pageIndex ->
                OnboardingPageContent(
                    page = pages[pageIndex],
                    isCurrentPage = pagerState.currentPage == pageIndex,
                    onPermissionGranted = { /* Permiso concedido */ }
                )
            }

            // Indicadores + Botón
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp, vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Indicadores de página (dots)
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(pages.size) { index ->
                        val isSelected = pagerState.currentPage == index
                        val width by animateDpAsState(
                            targetValue = if (isSelected) 28.dp else 8.dp,
                            animationSpec = tween(300),
                            label = "dotWidth"
                        )
                        Box(
                            modifier = Modifier
                                .padding(horizontal = 4.dp)
                                .height(8.dp)
                                .width(width)
                                .clip(CircleShape)
                                .background(
                                    if (isSelected) Color.White
                                    else Color.White.copy(alpha = 0.35f)
                                )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Botón principal
                val isLastPage = pagerState.currentPage == pages.lastIndex
                Button(
                    onClick = {
                        if (isLastPage) {
                            markOnboardingCompleted(context)
                            onOnboardingComplete()
                        } else {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(pagerState.currentPage + 1)
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(26.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = BrandRed
                    )
                ) {
                    Text(
                        text = if (isLastPage) "Comenzar" else "Siguiente",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    if (!isLastPage) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OnboardingPageContent(
    page: OnboardingPage,
    isCurrentPage: Boolean,
    onPermissionGranted: () -> Unit
) {
    var animationStarted by remember { mutableStateOf(false) }

    LaunchedEffect(isCurrentPage) {
        if (isCurrentPage) {
            animationStarted = false
            delay(100)
            animationStarted = true
        }
    }

    val iconScale by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0.5f,
        animationSpec = tween(500, easing = FastOutSlowInEasing),
        label = "iconScale"
    )
    val iconAlpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(400),
        label = "iconAlpha"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 40.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Ícono animado
        Surface(
            modifier = Modifier
                .size(120.dp)
                .graphicsLayer {
                    scaleX = iconScale
                    scaleY = iconScale
                    alpha = iconAlpha
                },
            shape = CircleShape,
            color = Color.White.copy(alpha = 0.15f)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = page.icon,
                    contentDescription = null,
                    modifier = Modifier.size(56.dp),
                    tint = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(40.dp))

        // Título
        AnimatedVisibility(
            visible = animationStarted,
            enter = fadeIn(tween(400, delayMillis = 200)) +
                    slideInVertically(tween(400, delayMillis = 200)) { it / 3 }
        ) {
            Text(
                text = page.title,
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                lineHeight = 34.sp
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Descripción
        AnimatedVisibility(
            visible = animationStarted,
            enter = fadeIn(tween(400, delayMillis = 400)) +
                    slideInVertically(tween(400, delayMillis = 400)) { it / 3 }
        ) {
            Text(
                text = page.description,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp
            )
        }

        // Botón de permiso de notificaciones (solo en la página correspondiente)
        if (page.isNotificationPage) {
            Spacer(modifier = Modifier.height(28.dp))
            AnimatedVisibility(
                visible = animationStarted,
                enter = fadeIn(tween(400, delayMillis = 600)) +
                        slideInVertically(tween(400, delayMillis = 600)) { it / 3 }
            ) {
                NotificationPermissionButton(onPermissionGranted = onPermissionGranted)
            }
        }
    }
}

@Composable
private fun NotificationPermissionButton(
    onPermissionGranted: () -> Unit
) {
    val context = LocalContext.current
    var permissionGranted by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context, Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else true
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        permissionGranted = granted
        if (granted) onPermissionGranted()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !permissionGranted) {
        Button(
            onClick = {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            },
            shape = RoundedCornerShape(20.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White.copy(alpha = 0.2f),
                contentColor = Color.White
            ),
            modifier = Modifier.height(44.dp)
        ) {
            Icon(
                Icons.Filled.Notifications,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Activar notificaciones", fontWeight = FontWeight.Medium)
        }
    } else {
        // Permiso ya concedido o no necesario
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.2f),
                modifier = Modifier.size(28.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("✓", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                "Notificaciones activadas",
                color = Color.White.copy(alpha = 0.8f),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
