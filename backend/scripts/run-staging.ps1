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
        
        # Una clave vacia no debe pisar el fallback de application.properties.
        if ($key -eq "JWT_SECRET" -and [string]::IsNullOrWhiteSpace($value)) {
            [System.Environment]::SetEnvironmentVariable($key, $null, [System.EnvironmentVariableTarget]::Process)
            Write-Host "  [OK] JWT_SECRET vacio: staging local usa la clave de desarrollo." -ForegroundColor Green
            return
        }

        # Establecer variable a nivel de proceso
        [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
        
        # Confirmar unicamente el nombre cargado, nunca el valor secreto
        Write-Host "  [OK] Variable cargada: $key" -ForegroundColor Green
        $loadedCount++
    }
}

Write-Host "Se cargaron $loadedCount variables de entorno de proceso con exito." -ForegroundColor Cyan

# 3. Compilar fuera de target/classes, que también puede escribir el editor.
# Arrancar el JAR empaquetado evita recargas mientras se recompila el proyecto.
$tempRoot = (Get-Item -LiteralPath ([System.IO.Path]::GetTempPath())).FullName.TrimEnd('\')
$buildDir = New-Item -Path (Join-Path $tempRoot ("yaiku-staging-" + [guid]::NewGuid().ToString("N"))) -ItemType Directory -ErrorAction Stop
$exitCode = 1
Push-Location $backendRootDir
try {
    Write-Host "Compilando el backend de staging..." -ForegroundColor Cyan
    & .\mvnw.cmd "-Dsaip.build.directory=$($buildDir.FullName)" "-Dmaven.test.skip=true" package
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        $jars = @(Get-ChildItem -LiteralPath $buildDir.FullName -File -Filter "*.jar")
        if ($jars.Count -ne 1) {
            throw "Se esperaba un único JAR ejecutable de staging."
        }
        $java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { "java.exe" }
        Write-Host "Iniciando el backend de staging..." -ForegroundColor Cyan
        & $java -jar $jars[0].FullName
        $exitCode = $LASTEXITCODE
    }
} finally {
    Pop-Location
    $buildDir.Refresh()
    if ($buildDir.Exists -and $buildDir.Parent.FullName.TrimEnd('\') -eq $tempRoot -and
        $buildDir.Name -like "yaiku-staging-*" -and
        -not ($buildDir.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        Remove-Item -LiteralPath $buildDir.FullName -Recurse
    }
}
exit $exitCode
