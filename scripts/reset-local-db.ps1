[CmdletBinding()]
param(
    [switch]$ConfirmReset,
    [string]$Database = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { "saip_db" }),
    [string]$DatabaseHost = $(if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }),
    [int]$Port = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
    [string]$User = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" })
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmReset) {
    throw "Reset cancelado. Ejecute nuevamente con -ConfirmReset para recrear una base local."
}
if ($DatabaseHost -notin @("127.0.0.1", "localhost", "::1")) {
    throw "Reset bloqueado: DatabaseHost debe ser localhost, 127.0.0.1 o ::1."
}
if ($Database -notmatch "^[A-Za-z0-9_]+$" -or $Database -match "(?i)(prod|production)") {
    throw "Reset bloqueado: use un nombre valido de base local no productiva."
}
if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
    throw "PGPASSWORD debe definirse externamente."
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    throw "No se encontro el cliente psql en PATH."
}

Write-Host "Recreando schema PostgreSQL local en '$Database' (${DatabaseHost}:$Port)..."
& $psql.Source -v ON_ERROR_STOP=1 -h $DatabaseHost -p $Port -U $User -d $Database `
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
if ($LASTEXITCODE -ne 0) {
    throw "psql finalizo con codigo $LASTEXITCODE durante el reset."
}

$env:PGHOST = $DatabaseHost
$env:PGPORT = $Port.ToString()
$env:PGDATABASE = $Database
$env:PGUSER = $User

& "$PSScriptRoot/postgres/run-postgres-schema.ps1" -RunTwice
Write-Host "Base local recreada con el schema oficial PostgreSQL."
