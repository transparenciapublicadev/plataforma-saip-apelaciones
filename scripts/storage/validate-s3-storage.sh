#!/usr/bin/env bash
set -Eeuo pipefail

run_integration_tests="${RUN_S3_STORAGE_INTEGRATION_TESTS:-}"
if [[ "${run_integration_tests,,}" != "true" ]]; then
    printf '%s\n' \
        'ERROR: Set RUN_S3_STORAGE_INTEGRATION_TESTS=true to confirm the staging S3 validation.' \
        >&2
    exit 1
fi

required_variables=(
    APP_STORAGE_PROVIDER
    APP_STORAGE_S3_ENDPOINT
    APP_STORAGE_S3_REGION
    APP_STORAGE_S3_BUCKET
    APP_STORAGE_S3_ACCESS_KEY
    APP_STORAGE_S3_SECRET_KEY
    APP_STORAGE_S3_FORCE_PATH_STYLE
)

missing_variables=()
for variable in "${required_variables[@]}"; do
    value="${!variable:-}"
    value_without_whitespace="${value//[[:space:]]/}"
    if [[ -z "$value_without_whitespace" ]]; then
        missing_variables+=("$variable")
    fi
done

if (( ${#missing_variables[@]} > 0 )); then
    printf 'ERROR: Missing required environment variables: %s\n' \
        "${missing_variables[*]}" >&2
    exit 1
fi

provider="${APP_STORAGE_PROVIDER,,}"
if [[ "$provider" != "s3" ]]; then
    printf '%s\n' 'ERROR: APP_STORAGE_PROVIDER must be s3 for this validation.' >&2
    exit 1
fi

force_path_style="${APP_STORAGE_S3_FORCE_PATH_STYLE,,}"
if [[ "$force_path_style" != "true" && "$force_path_style" != "false" ]]; then
    printf '%s\n' 'ERROR: APP_STORAGE_S3_FORCE_PATH_STYLE must be true or false.' >&2
    exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repository_root="$(cd -- "$script_dir/../.." && pwd -P)"

printf '%s\n' \
    'Running the opt-in S3-compatible storage integration test.' \
    'The target bucket must already exist and is never created or reconfigured by this script.' \
    'Credential values, bucket details and endpoint values will not be printed.'

(
    cd -- "$repository_root/backend"
    ./mvnw -Dtest=S3CompatibleStorageProviderIntegrationTest test
)
