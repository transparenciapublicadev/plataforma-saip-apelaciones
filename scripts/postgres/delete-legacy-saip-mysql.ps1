[CmdletBinding()]
param(
    [string] $HostName = $(if ($env:MYSQL_HOST) { $env:MYSQL_HOST } else { "localhost" }),
    [int] $Port = $(if ($env:MYSQL_PORT) { [int] $env:MYSQL_PORT } else { 3306 }),
    [string] $Database = $env:MYSQL_DATABASE,
    [string] $User = $env:MYSQL_USER,
    [string] $Password = $env:MYSQL_PASSWORD,
    [string] $MySqlPath,
    [switch] $Apply,
    [int] $ExpectedRows = $(if ($env:EXPECTED_LEGACY_SAIP_ROWS) { [int] $env:EXPECTED_LEGACY_SAIP_ROWS } else { 8 }),
    [string] $Confirmation = $env:LEGACY_SAIP_DELETE_CONFIRMATION,
    [string] $Actor = $env:MIGRATION_ACTOR,
    [switch] $AllowStaging,
    [switch] $ConfirmStagingReadOnly,
    [switch] $ConfirmStagingApply
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$diagnosticSqlPath = Join-Path $repoRoot "database/postgres/diagnose_delete_legacy_saip_mysql.sql"
$deleteSqlPath = Join-Path $repoRoot "database/postgres/delete_legacy_saip_mysql.sql"

if ($HostName -notmatch '^[A-Za-z0-9_.:-]+$') {
    throw "MYSQL_HOST contains unsupported characters."
}
if ([string]::IsNullOrWhiteSpace($Database) -or $Database -notmatch '^[A-Za-z0-9_]+$') {
    throw "MYSQL_DATABASE is required and must contain only letters, numbers or underscores."
}
if ([string]::IsNullOrWhiteSpace($User) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "MYSQL_USER and MYSQL_PASSWORD are required through environment variables or explicit parameters."
}
if ($ExpectedRows -ne 8) {
    throw "EXPECTED_LEGACY_SAIP_ROWS must be exactly 8 for this controlled deletion."
}
if ($Database -match '(?i)(prod|production)') {
    throw "Production-like database names are always rejected by this deletion tool."
}

$isLocalHost = $HostName -in @("localhost", "127.0.0.1", "::1")
$isStagingName = $Database -match '(?i)(stage|staging|rehearsal|test|qa|dev)'
if (-not $isLocalHost) {
    if (-not $isStagingName) {
        throw "Remote deletion is allowed only for an explicitly named staging, rehearsal, test, QA or dev database."
    }
    if (-not $AllowStaging -or -not $ConfirmStagingReadOnly) {
        throw "Remote diagnosis requires both -AllowStaging and -ConfirmStagingReadOnly."
    }
    if ($Apply -and -not $ConfirmStagingApply) {
        throw "Remote apply additionally requires -ConfirmStagingApply."
    }
}

if ([string]::IsNullOrWhiteSpace($MySqlPath)) {
    $mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
    if ($mysqlCommand) {
        $MySqlPath = $mysqlCommand.Source
    }
    else {
        $candidates = @(
            "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
            "C:\Program Files\MySQL\MySQL Workbench 8.0\mysql.exe",
            "C:\xampp\mysql\bin\mysql.exe"
        )
        $MySqlPath = $candidates |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
    }
}
if ([string]::IsNullOrWhiteSpace($MySqlPath) -or -not (Test-Path -LiteralPath $MySqlPath)) {
    throw "mysql client was not found. Install MySQL client tools or pass -MySqlPath."
}

$mysqlArgs = @(
    "--host=$HostName",
    "--port=$Port",
    "--user=$User",
    "--database=$Database",
    "--batch",
    "--raw",
    "--skip-column-names",
    "--default-character-set=utf8mb4"
)

function Invoke-MySqlSql {
    param([string] $Sql)

    $output = $Sql | & $MySqlPath @mysqlArgs
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL command failed. Any uncommitted deletion was rolled back when the connection closed."
    }
    return @($output)
}

$previousMysqlPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    Write-Host "Legacy SAIP deletion diagnosis against ${HostName}:$Port/$Database"
    $diagnosticSql = Get-Content -LiteralPath $diagnosticSqlPath -Raw
    $diagnosticRows = Invoke-MySqlSql -Sql $diagnosticSql

    $candidateRows = $null
    $ambiguityRows = $null
    foreach ($row in $diagnosticRows) {
        $parts = $row -split "`t"
        if ($parts.Count -lt 3) {
            continue
        }

        switch ($parts[0]) {
            "CANDIDATE" {
                "{0,-12} {1,-22} id={2,-6} estado={3}" -f
                    $parts[0], $parts[1], $parts[2], $parts[3] |
                    Write-Host
            }
            "DEPENDENCY" {
                "{0,-12} {1,-48} {2,8}" -f
                    $parts[0], $parts[1], $parts[2] |
                    Write-Host
            }
            "AMBIGUITY" {
                "{0,-12} {1,-48} {2,8}" -f
                    $parts[0], $parts[1], $parts[2] |
                    Write-Host
            }
            "GUARD" {
                "{0,-12} {1,-48} {2,8}" -f
                    $parts[0], $parts[1], $parts[2] |
                    Write-Host
                if ($parts[1] -eq "candidate_rows") {
                    $candidateRows = [int64] $parts[2]
                }
                if ($parts[1] -eq "ambiguity_rows") {
                    $ambiguityRows = [int64] $parts[2]
                }
            }
        }
    }

    if ($null -eq $candidateRows -or $null -eq $ambiguityRows) {
        throw "The diagnostic did not return the required safety guards."
    }
    if ($candidateRows -ne $ExpectedRows) {
        throw "Expected exactly $ExpectedRows candidates, but found $candidateRows. No data was modified."
    }
    if ($ambiguityRows -ne 0) {
        throw "Found $ambiguityRows shared, ambiguous or unknown dependencies. No data was modified."
    }

    if (-not $Apply) {
        Write-Host "DRY RUN: the exact candidate set is safe to review. No schema or data was modified."
        return
    }

    if ($Confirmation -ne "DELETE_LEGACY_SAIP_2025_00001_00008") {
        throw "Apply requires LEGACY_SAIP_DELETE_CONFIRMATION=DELETE_LEGACY_SAIP_2025_00001_00008."
    }
    if ([string]::IsNullOrWhiteSpace($Actor) -or $Actor -notmatch '^[A-Za-z0-9_.@-]{3,120}$') {
        throw "MIGRATION_ACTOR is required and may contain only letters, numbers, dot, underscore, @ or hyphen."
    }

    Write-Host "Applying transactional deletion for exactly $ExpectedRows demo SAIP rows."
    $deleteSql = Get-Content -LiteralPath $deleteSqlPath -Raw
    $sessionSql = "SET @migration_actor = '$Actor';`nSET @expected_rows = $ExpectedRows;`n$deleteSql"
    Invoke-MySqlSql -Sql $sessionSql | ForEach-Object { Write-Host $_ }

    $postDeleteSql = @"
SELECT COUNT(*)
FROM solicitudes
WHERE expediente IN (
    'SAIP-2025-00001',
    'SAIP-2025-00002',
    'SAIP-2025-00003',
    'SAIP-2025-00004',
    'SAIP-2025-00005',
    'SAIP-2025-00006',
    'SAIP-2025-00007',
    'SAIP-2025-00008'
);
"@
    $remainingRows = [int64] (Invoke-MySqlSql -Sql $postDeleteSql | Select-Object -First 1)
    if ($remainingRows -ne 0) {
        throw "Deletion committed but $remainingRows candidate rows remain. Stop before ETL."
    }

    Write-Host "Deletion committed with migration audit. Run the full MySQL preflight before export."
}
finally {
    $env:MYSQL_PWD = $previousMysqlPassword
}
