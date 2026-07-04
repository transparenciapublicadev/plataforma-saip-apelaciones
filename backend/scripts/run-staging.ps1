# ==============================================================================
# Script de automatizacion para arrancar el Backend Spring Boot en Staging
# ==============================================================================
# Este script lee las variables de entorno del archivo '.env' y las carga en el
# proceso actual de PowerShell antes de iniciar la aplicacion con Maven Wrapper.
# ==============================================================================

# Forzar codificacion UTF-8 para consola
$OutputEncoding = [System.Text.Encoding]::UTF8

# Ruta absoluta al archivo .env basada en la ubicacion de este script
$envFilePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.env"))
$backendRootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

Write-Host "--- Inicializando Entorno Staging ---" -ForegroundColor Cyan

# 1. Verificar existencia del archivo .env
if (-not (Test-Path $envFilePath)) {
    Write-Host "[ERROR] No se encontro el archivo de variables de entorno '.env' en: $backendRootDir" -ForegroundColor Red
    Write-Host "Por favor, realiza lo siguiente:" -ForegroundColor Yellow
    Write-Host "  1. Copia el archivo '.env.example' como '.env' en la carpeta 'backend/'" -ForegroundColor Yellow
    Write-Host "  2. Llena las credenciales y configuraciones en el archivo '.env'" -ForegroundColor Yellow
    Write-Host "  3. Vuelve a ejecutar este script." -ForegroundColor Yellow
    Exit 1
}

Write-Host "Cargando variables desde: $envFilePath" -ForegroundColor Gray

# 2. Leer y cargar variables de entorno del proceso
$loadedCount = 0
Get-Content $envFilePath | ForEach-Object {
    $line = $_.Trim()
    
    # Ignorar lineas vacias y comentarios
    if ($line -eq "" -or $line.StartsWith("#")) {
        return
    }
    
    # Separar KEY=VALUE usando expresion regular
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        
        # Eliminar comillas simples o dobles envolventes en el valor
        if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
            $value = $Matches[1]
        }
        
        # Establecer variable a nivel de proceso
        [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
        
        # Confirmar unicamente el nombre cargado, nunca el valor secreto
        Write-Host "  [OK] Variable cargada: $key" -ForegroundColor Green
        $loadedCount++
    }
}

Write-Host "Se cargaron $loadedCount variables de entorno de proceso con exito." -ForegroundColor Cyan

# 3. Moverse al directorio del backend e iniciar la aplicacion
Write-Host "Iniciando aplicacion con Maven Wrapper en: $backendRootDir..." -ForegroundColor Cyan
Set-Location $backendRootDir

# Ejecutar Spring Boot
.\mvnw.cmd spring-boot:run
