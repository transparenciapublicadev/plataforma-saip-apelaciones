[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$requiredVariables = @(
    "APP_STORAGE_PROVIDER",
    "APP_STORAGE_S3_ENDPOINT",
    "APP_STORAGE_S3_REGION",
    "APP_STORAGE_S3_BUCKET",
    "APP_STORAGE_S3_ACCESS_KEY",
    "APP_STORAGE_S3_SECRET_KEY",
    "APP_STORAGE_S3_FORCE_PATH_STYLE"
)

if ($env:RUN_S3_STORAGE_INTEGRATION_TESTS -notmatch "^(?i:true)$") {
    throw "Set RUN_S3_STORAGE_INTEGRATION_TESTS=true to confirm the staging S3 validation."
}

$missingVariables = @(
    foreach ($variable in $requiredVariables) {
        $value = [Environment]::GetEnvironmentVariable($variable)
        if ([string]::IsNullOrWhiteSpace($value)) {
            $variable
        }
    }
)

if ($missingVariables.Count -gt 0) {
    throw "Missing required environment variables: $($missingVariables -join ', ')"
}

if ($env:APP_STORAGE_PROVIDER.Trim() -ine "s3") {
    throw "APP_STORAGE_PROVIDER must be s3 for this validation."
}

if ($env:APP_STORAGE_S3_FORCE_PATH_STYLE.Trim() -notmatch "^(?i:true|false)$") {
    throw "APP_STORAGE_S3_FORCE_PATH_STYLE must be true or false."
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendPath = Join-Path $repositoryRoot "backend"

Write-Host "Running the opt-in S3-compatible storage integration test."
Write-Host "The target bucket must already exist and is never created or reconfigured by this script."
Write-Host "Credential values, bucket details and endpoint values will not be printed."

Push-Location $backendPath
try {
    & ".\mvnw.cmd" "-Dtest=S3CompatibleStorageProviderIntegrationTest" "test"
    if ($LASTEXITCODE -ne 0) {
        throw "The opt-in S3-compatible storage integration test failed."
    }
} finally {
    Pop-Location
}
