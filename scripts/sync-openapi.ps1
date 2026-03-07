# ============================================================
# sync-openapi.ps1 — Sincroniza el OpenAPI spec desde el backend
# ============================================================
# Uso:
#   .\scripts\sync-openapi.ps1                              # Desde localhost:8080
#   .\scripts\sync-openapi.ps1 -Url "http://host:port/v3/api-docs"
#
# El spec se copia a:
#   frontend\openapi.json
#   mobile\openapi.json (referencia)
# ============================================================

param(
    [string]$Url = "http://localhost:8080/v3/api-docs"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "$RootDir\frontend")) {
    $RootDir = Split-Path -Parent $PSScriptRoot
}

Write-Host "Descargando OpenAPI spec desde: $Url"

try {
    $response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop
} catch {
    Write-Host "ERROR: No se pudo conectar al backend en $Url" -ForegroundColor Red
    Write-Host "Asegurate de que el backend esta corriendo: cd backend; .\mvnw.cmd spring-boot:run"
    exit 1
}

$json = $response | ConvertTo-Json -Depth 100

# Guardar en frontend
$frontendSpec = Join-Path $RootDir "frontend\openapi.json"
$json | Out-File -FilePath $frontendSpec -Encoding utf8
Write-Host "Frontend: $frontendSpec actualizado" -ForegroundColor Green

# Guardar copia de referencia en mobile
$mobileSpec = Join-Path $RootDir "mobile\openapi.json"
$json | Out-File -FilePath $mobileSpec -Encoding utf8
Write-Host "Mobile:   $mobileSpec actualizado (referencia)" -ForegroundColor Green

# Regenerar tipos TypeScript
$frontendDir = Join-Path $RootDir "frontend"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    Write-Host ""
    Write-Host "Regenerando tipos TypeScript..."
    Push-Location $frontendDir
    try {
        npm run generate:api 2>$null
        Write-Host "Tipos TypeScript regenerados" -ForegroundColor Green
    } catch {
        Write-Host "WARN: No se pudieron regenerar los tipos" -ForegroundColor Yellow
    }
    Pop-Location
}

Write-Host ""
Write-Host "Sincronizacion completa." -ForegroundColor Cyan
