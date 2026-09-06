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

$tempSpec = $null
try {
    $tempSpec = Join-Path ([System.IO.Path]::GetTempPath()) "saip-openapi-$([System.Guid]::NewGuid()).json"
    Invoke-WebRequest -Uri $Url -Method Get -OutFile $tempSpec -ErrorAction Stop
    Get-Content -Raw -Encoding utf8 $tempSpec | ConvertFrom-Json | Out-Null
} catch {
    if ($tempSpec -and (Test-Path $tempSpec)) {
        Remove-Item -LiteralPath $tempSpec -Force
    }
    Write-Host "ERROR: No se pudo descargar o validar el contrato OpenAPI desde $Url" -ForegroundColor Red
    Write-Host "Asegurate de que el backend esta corriendo: cd backend; .\mvnw.cmd spring-boot:run"
    exit 1
}

# Guardar en frontend
$frontendSpec = Join-Path $RootDir "frontend\openapi.json"
Copy-Item -Path $tempSpec -Destination $frontendSpec -Force
Write-Host "Frontend: $frontendSpec actualizado" -ForegroundColor Green

# Guardar copia de referencia en mobile
$mobileSpec = Join-Path $RootDir "mobile\openapi.json"
Copy-Item -Path $tempSpec -Destination $mobileSpec -Force
Write-Host "Mobile:   $mobileSpec actualizado (referencia)" -ForegroundColor Green
Remove-Item -LiteralPath $tempSpec -Force

# Regenerar tipos TypeScript
$frontendDir = Join-Path $RootDir "frontend"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    Write-Host ""
    Write-Host "Regenerando tipos TypeScript..."
    Push-Location $frontendDir
    try {
        pnpm run generate:api 2>$null
        Write-Host "Tipos TypeScript regenerados" -ForegroundColor Green
    } catch {
        Write-Host "WARN: No se pudieron regenerar los tipos" -ForegroundColor Yellow
    }
    Pop-Location
}

Write-Host ""
Write-Host "Sincronizacion completa." -ForegroundColor Cyan
