# ============================================================
# pr-open.ps1 - Create GitHub PR quickly using gh CLI
# ============================================================
# Usage:
#   .\scripts\pr-open.ps1 -Title "🐛 fix(mobile): ..." -Base main
#   .\scripts\pr-open.ps1 -Title "..." -Base main -BodyFile .\tmp\pr.md
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [string]$Base = "main",
    [string]$BodyFile = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: GitHub CLI (gh) no esta instalado." -ForegroundColor Red
    Write-Host "Instala desde: https://cli.github.com/"
    exit 1
}

$currentBranch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    Write-Host "ERROR: No se pudo detectar la rama actual." -ForegroundColor Red
    exit 1
}

if ($currentBranch -eq $Base) {
    Write-Host "ERROR: Estas en la rama base ($Base). Crea una rama feature antes de abrir PR." -ForegroundColor Red
    exit 1
}

& git push -u origin $currentBranch
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudo hacer push de la rama actual." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($BodyFile)) {
    & gh pr create --base $Base --head $currentBranch --title $Title --fill
} else {
    & gh pr create --base $Base --head $currentBranch --title $Title --body-file $BodyFile
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudo crear el PR automaticamente." -ForegroundColor Red
    Write-Host "Sugerencia: Ejecuta 'gh auth login' y vuelve a intentar."
    exit 1
}

Write-Host "PR creado correctamente para $currentBranch -> $Base" -ForegroundColor Green
