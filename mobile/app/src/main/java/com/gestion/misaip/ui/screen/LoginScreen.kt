package com.gestion.misaip.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.gestion.misaip.presentation.viewmodel.LoginEvent
import com.gestion.misaip.presentation.viewmodel.LoginViewModel
import com.gestion.misaip.ui.theme.BrandRed
import com.gestion.misaip.ui.theme.GradientRedEnd
import com.gestion.misaip.ui.theme.GradientRedStart
import kotlinx.coroutines.delay
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun LoginScreen(
    onLoginSuccess: (tipoUsuario: String, usuarioId: String, entidadId: String?, nombreUsuario: String) -> Unit,
    onNavigateToRegister: () -> Unit,
    viewModel: LoginViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Limpiar formulario al llegar a la pantalla (ej: después de logout)
    LaunchedEffect(Unit) {
        viewModel.resetFormulario()
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is LoginEvent.ShowMessage -> snackbarHostState.showSnackbar(event.message)
                is LoginEvent.NavigateToDashboard -> onLoginSuccess(
                    event.tipoUsuario, event.usuarioId, event.entidadId, event.nombreUsuario
                )
                is LoginEvent.NavigateToRegister -> onNavigateToRegister()
            }
        }
    }

    LoginContent(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        onCambiarTipoLogin = viewModel::cambiarTipoLogin,
        onDniChanged = viewModel::actualizarDni,
        onUsuarioChanged = viewModel::actualizarUsuario,
        onContrasenaChanged = viewModel::actualizarContrasena,
        onToggleContrasena = viewModel::toggleContrasenaVisible,
        onToggleRecordarAcceso = viewModel::toggleRecordarAcceso,
        onIniciarSesion = viewModel::iniciarSesion,
        onRegistro = viewModel::navegarARegistro
    )
}

@Composable
private fun LoginContent(
    uiState: com.gestion.misaip.presentation.viewmodel.LoginUiState,
    snackbarHostState: SnackbarHostState,
    onCambiarTipoLogin: (Boolean) -> Unit,
    onDniChanged: (String) -> Unit,
    onUsuarioChanged: (String) -> Unit,
    onContrasenaChanged: (String) -> Unit,
    onToggleContrasena: () -> Unit,
    onToggleRecordarAcceso: () -> Unit,
    onIniciarSesion: () -> Unit,
    onRegistro: () -> Unit
) {
    val focusManager = LocalFocusManager.current

    // Animación de entrada
    var animationStarted by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(100); animationStarted = true }

    val headerAlpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(500, easing = FastOutSlowInEasing),
        label = "headerAlpha"
    )
    val formAlpha by animateFloatAsState(
        targetValue = if (animationStarted) 1f else 0f,
        animationSpec = tween(500, delayMillis = 200),
        label = "formAlpha"
    )

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .imePadding(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header con gradiente profesional
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .graphicsLayer { alpha = headerAlpha }
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(GradientRedStart, GradientRedEnd)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        modifier = Modifier
                            .size(80.dp)
                            .scale(if (animationStarted) 1f else 0.5f),
                        shape = CircleShape,
                        color = Color.White,
                        shadowElevation = 8.dp
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = "SAIP",
                                color = BrandRed,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = "SAIP Perú",
                        color = Color.White,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Acceso a la Información Pública",
                        color = Color.White.copy(alpha = 0.8f),
                        style = MaterialTheme.typography.bodySmall,
                        letterSpacing = 0.5.sp
                    )
                }
            }

            // Contenido del formulario
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .graphicsLayer { alpha = formAlpha }
                    .padding(horizontal = 24.dp)
                    .padding(top = 28.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Selector tipo usuario con FilterChip profesional
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)
                ) {
                    FilterChip(
                        selected = uiState.esCiudadano,
                        onClick = { onCambiarTipoLogin(true) },
                        label = { Text("Ciudadano", fontWeight = FontWeight.Medium) },
                        leadingIcon = if (uiState.esCiudadano) {
                            { Icon(Icons.Default.Person, null, Modifier.size(18.dp)) }
                        } else null,
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                        ),
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = !uiState.esCiudadano,
                        onClick = { onCambiarTipoLogin(false) },
                        label = { Text("Funcionario", fontWeight = FontWeight.Medium) },
                        leadingIcon = if (!uiState.esCiudadano) {
                            { Icon(Icons.Default.Person, null, Modifier.size(18.dp)) }
                        } else null,
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                        ),
                        modifier = Modifier.weight(1f)
                    )
                }

                // Campo DNI o Usuario
                AnimatedVisibility(
                    visible = uiState.esCiudadano,
                    enter = slideInVertically(tween(300)) { -it / 2 } + fadeIn(tween(300)),
                    exit = slideOutVertically(tween(200)) { -it / 2 } + fadeOut(tween(200))
                ) {
                    OutlinedTextField(
                        value = uiState.dni,
                        onValueChange = onDniChanged,
                        label = { Text("DNI") },
                        placeholder = { Text("Ingrese su DNI") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        isError = uiState.errorDni != null,
                        supportingText = uiState.errorDni?.let { { Text(it) } },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                AnimatedVisibility(
                    visible = !uiState.esCiudadano,
                    enter = slideInVertically(tween(300)) { -it / 2 } + fadeIn(tween(300)),
                    exit = slideOutVertically(tween(200)) { -it / 2 } + fadeOut(tween(200))
                ) {
                    OutlinedTextField(
                        value = uiState.usuario,
                        onValueChange = onUsuarioChanged,
                        label = { Text("Correo electrónico") },
                        placeholder = { Text("ejemplo@entidad.test") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        isError = uiState.errorUsuario != null,
                        supportingText = uiState.errorUsuario?.let { { Text(it) } },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Campo Contraseña
                OutlinedTextField(
                    value = uiState.contrasena,
                    onValueChange = onContrasenaChanged,
                    label = { Text("Contraseña") },
                    placeholder = { Text("Ingrese su contraseña") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    isError = uiState.errorContrasena != null,
                    supportingText = uiState.errorContrasena?.let { { Text(it) } },
                    visualTransformation = if (uiState.contrasenaVisible) VisualTransformation.None
                                           else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = onToggleContrasena) {
                            Icon(
                                imageVector = if (uiState.contrasenaVisible) Icons.Default.VisibilityOff
                                             else Icons.Default.Visibility,
                                contentDescription = if (uiState.contrasenaVisible) "Ocultar contraseña"
                                                    else "Mostrar contraseña"
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            onIniciarSesion()
                        }
                    ),
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                )

                // Checkbox recordar acceso
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = uiState.recordarAcceso,
                        onCheckedChange = { onToggleRecordarAcceso() }
                    )
                    Text(
                        text = "Recordar acceso",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 4.dp)
                    )
                }

                // Botón Iniciar Sesión
                Button(
                    onClick = onIniciarSesion,
                    enabled = !uiState.isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    ),
                    elevation = ButtonDefaults.buttonElevation(
                        defaultElevation = 2.dp,
                        pressedElevation = 0.dp
                    )
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Ingresando...")
                    } else {
                        Text(
                            text = "Iniciar Sesión",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp
                        )
                    }
                }

                // Registro solo para ciudadanos
                AnimatedVisibility(visible = uiState.esCiudadano) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        TextButton(onClick = onRegistro) {
                            Text(
                                "¿No tienes cuenta? Regístrate aquí",
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}
