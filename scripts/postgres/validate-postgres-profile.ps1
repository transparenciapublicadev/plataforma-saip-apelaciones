[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$hostName = $env:PGHOST
$port = if ($env:PGPORT) { [int] $env:PGPORT } else { 5432 }
$database = $env:PGDATABASE
$user = $env:PGUSER
$password = $env:PGPASSWORD

if ([string]::IsNullOrWhiteSpace($hostName)) {
    $hostName = "localhost"
}

if ($hostName -notin @("localhost", "127.0.0.1", "::1")) {
    throw "PostgreSQL profile validation only accepts a local or CI-mapped host."
}

if ([string]::IsNullOrWhiteSpace($database) -or $database -match "(?i)(prod|production)") {
    throw "PGDATABASE is required and must identify a non-production database."
}

if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($password)) {
    throw "PGUSER and PGPASSWORD are required through environment variables."
}

Push-Location $repoRoot
try {
    & "$PSScriptRoot/run-postgres-schema.ps1" `
        -HostName $hostName `
        -Port $port `
        -Database $database `
        -User $user `
        -RunTwice

    $env:DB_URL = "jdbc:postgresql://${hostName}:$port/$database"
    $env:DB_USERNAME = $user
    $env:DB_PASSWORD = $password
    $env:RUN_POSTGRES_INTEGRATION_TESTS = "true"

    Push-Location "backend"
    try {
        & ".\mvnw.cmd" -B test
        if ($LASTEXITCODE -ne 0) {
            throw "Backend tests failed against the default PostgreSQL runtime."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
