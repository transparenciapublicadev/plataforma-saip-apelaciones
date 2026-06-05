[CmdletBinding()]
param(
    [string] $HostName = $(if ($env:MYSQL_HOST) { $env:MYSQL_HOST } else { "localhost" }),
    [int] $Port = $(if ($env:MYSQL_PORT) { [int] $env:MYSQL_PORT } else { 3306 }),
    [string] $Database = $env:MYSQL_DATABASE,
    [string] $User = $env:MYSQL_USER,
    [string] $Password = $env:MYSQL_PASSWORD,
    [string] $MySqlPath,
    [switch] $AllowRemote,
    [switch] $ConfirmRemoteReadOnly,
    [switch] $AllowProductionReadOnly,
    [switch] $ConfirmProductionReadOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$expectedTablesPath = Join-Path $repoRoot "database/postgres/expected_rehearsal_tables.txt"
$preflightSqlPath = Join-Path $repoRoot "database/postgres/preflight_mysql_to_postgres.sql"

if ($HostName -notmatch '^[A-Za-z0-9_.:-]+$') {
    throw "MYSQL_HOST contains unsupported characters."
}
if ([string]::IsNullOrWhiteSpace($Database) -or $Database -notmatch '^[A-Za-z0-9_]+$') {
    throw "MYSQL_DATABASE is required and must contain only letters, numbers or underscores."
}
if ([string]::IsNullOrWhiteSpace($User) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "MYSQL_USER and MYSQL_PASSWORD are required through environment variables or explicit parameters."
}

$isLocalHost = $HostName -in @("localhost", "127.0.0.1", "::1")
if (-not $isLocalHost -and (-not $AllowRemote -or -not $ConfirmRemoteReadOnly)) {
    throw "Remote MySQL preflight requires both -AllowRemote and -ConfirmRemoteReadOnly."
}
if ($Database -match '(?i)(prod|production)' -and (-not $AllowProductionReadOnly -or -not $ConfirmProductionReadOnly)) {
    throw "A production-like database name requires both -AllowProductionReadOnly and -ConfirmProductionReadOnly."
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
        $MySqlPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
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

function Invoke-MySqlQuery {
    param(
        [string] $Query,
        [string] $SqlPath
    )

    if ($Query) {
        $output = & $MySqlPath @mysqlArgs "--execute=$Query"
    }
    else {
        $sql = Get-Content -LiteralPath $SqlPath -Raw
        $output = $sql | & $MySqlPath @mysqlArgs
    }
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL read-only preflight query failed."
    }
    return @($output)
}

$previousMysqlPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    $expectedTables = Get-Content -LiteralPath $expectedTablesPath |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $expectedUnion = ($expectedTables | ForEach-Object { "SELECT '$_' AS table_name" }) -join " UNION ALL "
    $missingQuery = @"
SELECT expected.table_name
FROM ($expectedUnion) expected
LEFT JOIN information_schema.tables actual
  ON actual.table_schema = DATABASE()
 AND actual.table_name = expected.table_name
WHERE actual.table_name IS NULL
ORDER BY expected.table_name
"@
    $missingTables = Invoke-MySqlQuery -Query $missingQuery
    if ($missingTables.Count -gt 0) {
        Write-Host "Missing expected MySQL tables:"
        $missingTables | ForEach-Object { Write-Host " - $_" }
        throw "MySQL preflight stopped because expected tables are missing."
    }

    Write-Host "Running read-only MySQL to PostgreSQL preflight against ${HostName}:$Port/$Database"
    $rows = Invoke-MySqlQuery -SqlPath $preflightSqlPath
    $blockingIssues = 0
    foreach ($row in $rows) {
        $parts = $row -split "`t", 3
        if ($parts.Count -ne 3) {
            continue
        }
        "{0,-18} {1,-58} {2,8}" -f $parts[0], $parts[1], $parts[2]
        if ($parts[0] -ne "TABLE_COUNT") {
            $blockingIssues += [int64]$parts[2]
        }
    }

    if ($blockingIssues -gt 0) {
        throw "MySQL preflight found $blockingIssues blocking violation(s). No data was modified."
    }
    Write-Host "MySQL preflight passed with zero blocking violations. No data was modified."
}
finally {
    $env:MYSQL_PWD = $previousMysqlPassword
}
