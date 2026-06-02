param(
    [switch]$ConfirmReset,
    [string]$Database = "saip_db",
    [string]$DatabaseHost = "127.0.0.1",
    [int]$Port = 3306,
    [string]$User = "root"
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmReset) {
    throw "Reset cancelado. Ejecute nuevamente con -ConfirmReset para recrear una base local."
}

if ($DatabaseHost -notin @("127.0.0.1", "localhost", "::1")) {
    throw "Reset bloqueado: DatabaseHost debe ser localhost, 127.0.0.1 o ::1."
}

if ($Database -notmatch "^[A-Za-z0-9_]+$") {
    throw "Reset bloqueado: el nombre de base de datos contiene caracteres no permitidos."
}

if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
    throw "No se encontro el cliente mysql en PATH."
}

$sql = "DROP DATABASE IF EXISTS ``$Database``; CREATE DATABASE ``$Database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "Recreando base MySQL local '$Database' en ${DatabaseHost}:$Port..."
& mysql "--host=$DatabaseHost" "--port=$Port" "--user=$User" "--password" "--execute=$sql"

if ($LASTEXITCODE -ne 0) {
    throw "mysql finalizo con codigo $LASTEXITCODE."
}

Write-Host ""
Write-Host "Base local recreada. Siguiente paso:"
Write-Host "1. Inicie una vez el backend local para que Hibernate cree el esquema."
Write-Host "2. Detenga el backend."
Write-Host "3. Cargue database/script_saip_db.sql."
Write-Host "4. Inicie backend con APP_NOTIFICATIONS_MODE=MOCK y ejecute Newman."
