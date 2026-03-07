package com.gestion.misaip.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val MiSAIPLightColors = lightColorScheme(
    primary = BrandRed,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDAD5),
    onPrimaryContainer = Color(0xFF3B0008),
    secondary = Color(0xFF984061),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFFD9E2),
    onSecondaryContainer = Color(0xFF3E001D),
    tertiary = Color(0xFF7B5733),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFDDB6),
    onTertiaryContainer = Color(0xFF2C1600),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = Color(0xFFFCF8F7),
    onBackground = Color(0xFF1C1B1B),
    surface = Color(0xFFFCF8F7),
    onSurface = Color(0xFF1C1B1B),
    surfaceVariant = Color(0xFFF5DDDA),
    onSurfaceVariant = Color(0xFF534341),
    outline = Color(0xFF857371),
    outlineVariant = Color(0xFFD8C2BF),
    inverseSurface = Color(0xFF322F2E),
    inverseOnSurface = Color(0xFFF5F0EE),
    surfaceTint = BrandRed,
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFFFF0EE),
    surfaceContainer = Color(0xFFF3EDEB),
    surfaceContainerHigh = Color(0xFFEDE7E6),
    surfaceContainerHighest = Color(0xFFE7E2E0)
)

private val MiSAIPDarkColors = darkColorScheme(
    primary = BrandRedLight,
    onPrimary = Color(0xFF680009),
    primaryContainer = BrandRedDark,
    onPrimaryContainer = Color(0xFFFFDAD5),
    secondary = Color(0xFFFFB1C6),
    onSecondary = Color(0xFF5E1133),
    secondaryContainer = Color(0xFF7B2949),
    onSecondaryContainer = Color(0xFFFFD9E2),
    tertiary = Color(0xFFE5C18D),
    onTertiary = Color(0xFF422C05),
    tertiaryContainer = Color(0xFF5C431D),
    onTertiaryContainer = Color(0xFFFFDDB6),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF141212),
    onBackground = Color(0xFFE7E2E0),
    surface = Color(0xFF141212),
    onSurface = Color(0xFFE7E2E0),
    surfaceVariant = Color(0xFF534341),
    onSurfaceVariant = Color(0xFFD8C2BF),
    outline = Color(0xFFA08C8A),
    outlineVariant = Color(0xFF534341),
    inverseSurface = Color(0xFFE7E2E0),
    inverseOnSurface = Color(0xFF322F2E),
    surfaceTint = BrandRedLight,
    surfaceContainerLowest = Color(0xFF0E0D0D),
    surfaceContainerLow = Color(0xFF1C1B1B),
    surfaceContainer = Color(0xFF201F1F),
    surfaceContainerHigh = Color(0xFF2B2929),
    surfaceContainerHighest = Color(0xFF363434)
)

@Composable
fun MiSAIPTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) MiSAIPDarkColors else MiSAIPLightColors

    // Sincronizar barra de estado con tema
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MiSAIPTypography,
        shapes = MiSAIPShapes,
        content = content
    )
}
