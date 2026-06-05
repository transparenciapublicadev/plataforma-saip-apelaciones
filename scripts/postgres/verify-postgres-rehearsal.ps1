[CmdletBinding()]
param(
    [string] $HostName = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" }),
    [int] $Port = $(if ($env:PGPORT) { [int] $env:PGPORT } else { 5432 }),
    [string] $Database = $env:PGDATABASE,
    [string] $User = $env:PGUSER,
    [string] $Password = $env:PGPASSWORD,
    [switch] $AllowRemote,
    [switch] $ConfirmRemoteReadOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$expectedTablesPath = Join-Path $repoRoot "database/postgres/expected_rehearsal_tables.txt"
$verificationSqlPath = Join-Path $repoRoot "database/postgres/verify_postgres_rehearsal.sql"

if ([string]::IsNullOrWhiteSpace($Database) -or $Database -notmatch '^[A-Za-z0-9_]+$') {
    throw "PGDATABASE is required and must contain only letters, numbers or underscores."
}
if ([string]::IsNullOrWhiteSpace($User) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "PGUSER and PGPASSWORD are required through environment variables or explicit parameters."
}
$isLocalHost = $HostName -in @("localhost", "127.0.0.1", "::1")
if (-not $isLocalHost -and (-not $AllowRemote -or -not $ConfirmRemoteReadOnly)) {
    throw "Remote PostgreSQL verification requires both -AllowRemote and -ConfirmRemoteReadOnly."
}
if ($Database -match '(?i)(prod|production)') {
    throw "Refusing to verify a production-like database name. Use an approved staging rehearsal database."
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    throw "psql was not found in PATH."
}
$psqlArgs = @(
    "-v", "ON_ERROR_STOP=1",
    "-h", $HostName,
    "-p", $Port,
    "-U", $User,
    "-d", $Database,
    "-A", "-t", "-F", "`t"
)

$expectedTables = Get-Content -LiteralPath $expectedTablesPath |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$expectedValues = ($expectedTables | ForEach-Object { "('$_')" }) -join ","
$missingQuery = @"
WITH expected(table_name) AS (VALUES $expectedValues)
SELECT expected.table_name
FROM expected
LEFT JOIN information_schema.tables actual
  ON actual.table_schema = 'public'
 AND actual.table_name = expected.table_name
WHERE actual.table_name IS NULL
ORDER BY expected.table_name
"@

$missingTables = @(& $psql.Source @psqlArgs "-c" $missingQuery)
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL expected-table validation failed."
}
if ($missingTables.Count -gt 0) {
    Write-Host "Missing expected PostgreSQL tables:"
    $missingTables | ForEach-Object { Write-Host " - $_" }
    throw "PostgreSQL rehearsal verification stopped because expected tables are missing."
}

Write-Host "Running read-only PostgreSQL rehearsal verification against ${HostName}:$Port/$Database"
$rows = @(& $psql.Source @psqlArgs "-f" $verificationSqlPath)
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL rehearsal verification query failed."
}

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
    throw "PostgreSQL rehearsal verification found $blockingIssues violation(s)."
}
Write-Host "PostgreSQL rehearsal verification passed with zero referential violations."
