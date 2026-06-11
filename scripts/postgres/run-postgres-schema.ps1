[CmdletBinding()]
param(
    [string] $HostName = $env:PGHOST,
    [int] $Port = $(if ($env:PGPORT) { [int] $env:PGPORT } else { 5432 }),
    [string] $Database = $env:PGDATABASE,
    [string] $User = $env:PGUSER,
    [string] $ScriptPath = "database/postgres/script_saip_db_postgres.sql",
    [switch] $RunTwice,
    [switch] $AllowRemote
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($HostName)) {
    $HostName = "localhost"
}

if ([string]::IsNullOrWhiteSpace($Database)) {
    throw "PGDATABASE or -Database is required. Use a local/staging database, never production."
}

if ([string]::IsNullOrWhiteSpace($User)) {
    throw "PGUSER or -User is required."
}

$isLocalHost = $HostName -in @("localhost", "127.0.0.1", "::1")
if (-not $isLocalHost -and -not $AllowRemote) {
    throw "Remote host '$HostName' requires -AllowRemote. Use this only for an approved staging database."
}

if ($Database -match "(?i)(prod|production)") {
    throw "Refusing to run against database name '$Database'. This script is only for local/staging schema preparation."
}

$resolvedScript = Resolve-Path $ScriptPath
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    throw "psql was not found in PATH. Install PostgreSQL client tools or add psql to PATH."
}

function Invoke-SchemaRun {
    param([int] $RunNumber)

    Write-Host "Running PostgreSQL schema script (run $RunNumber) against ${HostName}:$Port/$Database as $User"
    & $psql.Source `
        -v ON_ERROR_STOP=1 `
        -h $HostName `
        -p $Port `
        -U $User `
        -d $Database `
        -f $resolvedScript

    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL schema script failed during run $RunNumber."
    }
}

Invoke-SchemaRun -RunNumber 1

if ($RunTwice) {
    Invoke-SchemaRun -RunNumber 2
}

Write-Host "PostgreSQL table count:"
& $psql.Source `
    -v ON_ERROR_STOP=1 `
    -h $HostName `
    -p $Port `
    -U $User `
    -d $Database `
    -c "select count(*) as table_count from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';"

if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL table count validation failed."
}

Write-Host "PostgreSQL seed smoke counts:"
& $psql.Source `
    -v ON_ERROR_STOP=1 `
    -h $HostName `
    -p $Port `
    -U $User `
    -d $Database `
    -c "select 'usuarios' tabla, count(*) total from usuarios union all select 'entidades', count(*) from entidades union all select 'salas_ttaip', count(*) from salas_ttaip union all select 'miembros_ttaip', count(*) from miembros_ttaip union all select 'expedientes_ttaip', count(*) from expedientes_ttaip union all select 'cedulas_notificacion', count(*) from cedulas_notificacion union all select 'dispositivos_notificacion_push', count(*) from dispositivos_notificacion_push;"

if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL seed smoke count validation failed."
}
