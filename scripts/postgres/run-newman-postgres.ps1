[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$hostName = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$port = if ($env:PGPORT) { [int] $env:PGPORT } else { 5432 }
$database = $env:PGDATABASE
$user = $env:PGUSER
$password = $env:PGPASSWORD
$backendProcess = $null
$backendPortProcessId = $null
$tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "saip-postgres-newman-$PID"

if ($hostName -notin @("localhost", "127.0.0.1", "::1")) {
    throw "The Newman PostgreSQL runner only accepts a local database. Use a separately deployed staging backend for remote staging."
}
if ([string]::IsNullOrWhiteSpace($database) -or $database -match '(?i)(prod|production)') {
    throw "PGDATABASE is required and must identify a non-production rehearsal database."
}
if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($password)) {
    throw "PGUSER and PGPASSWORD are required."
}
if (Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    throw "Port 8080 is already in use. Stop the existing backend before running the PostgreSQL Newman rehearsal."
}

function Stop-ProcessTree {
    param([int] $RootProcessId)

    if (-not (Get-Process -Id $RootProcessId -ErrorAction SilentlyContinue)) {
        return
    }
    $children = Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $RootProcessId }
    foreach ($child in $children) {
        Stop-ProcessTree -RootProcessId $child.ProcessId
    }
    Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $RootProcessId -Timeout 10 -ErrorAction SilentlyContinue
}

function Stop-RehearsalBackend {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-ProcessTree -RootProcessId $backendProcess.Id
    }

    if ($backendPortProcessId) {
        Stop-ProcessTree -RootProcessId $backendPortProcessId
    }
}

function Remove-RehearsalTempDirectory {
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        Remove-Item -LiteralPath $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path -LiteralPath $tempDirectory)) {
            return
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Warning "Could not remove temporary Newman backend logs at $tempDirectory"
}

New-Item -ItemType Directory -Path $tempDirectory | Out-Null
try {
    & "$PSScriptRoot/verify-postgres-rehearsal.ps1"

    $env:DB_URL = "jdbc:postgresql://${hostName}:$port/$database"
    $env:DB_USERNAME = $user
    $env:DB_PASSWORD = $password
    $env:APP_NOTIFICATIONS_MODE = "MOCK"
    $env:APP_NOTIFICATIONS_PUSH_ENABLED = "false"

    $stdoutPath = Join-Path $tempDirectory "backend.out.log"
    $stderrPath = Join-Path $tempDirectory "backend.err.log"
    $backendProcess = Start-Process `
        -FilePath (Join-Path $repoRoot "backend/mvnw.cmd") `
        -ArgumentList @("-B", "spring-boot:run", "-Dspring-boot.run.profiles=postgres") `
        -WorkingDirectory (Join-Path $repoRoot "backend") `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru

    $ready = $false
    for ($attempt = 1; $attempt -le 90; $attempt++) {
        if ($backendProcess.HasExited) {
            break
        }
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080/v3/api-docs" -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $backendPortProcessId = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
                    Select-Object -First 1 -ExpandProperty OwningProcess
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $ready) {
        Write-Host "Backend startup log tail:"
        Get-Content -LiteralPath $stdoutPath -Tail 40 -ErrorAction SilentlyContinue
        Get-Content -LiteralPath $stderrPath -Tail 40 -ErrorAction SilentlyContinue
        throw "Backend did not become ready with the PostgreSQL profile."
    }

    Push-Location (Join-Path $repoRoot "postman")
    try {
        & npm run test:api:diagnostic
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Backend log tail after Newman failure:"
            Get-Content -LiteralPath $stdoutPath -Tail 80 -ErrorAction SilentlyContinue
            Get-Content -LiteralPath $stderrPath -Tail 80 -ErrorAction SilentlyContinue
            throw "Newman diagnostic failed against the PostgreSQL backend."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Stop-RehearsalBackend
    Remove-RehearsalTempDirectory
}
