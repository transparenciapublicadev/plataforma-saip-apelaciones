$base = "http://localhost:8080"
$results = @()

function Test-Endpoint {
    param([string]$Name, [string]$Method, [string]$Url, [string]$Body, [hashtable]$Headers)
    
    $h = @{ "Accept" = "application/json"; "Content-Type" = "application/json" }
    if ($Headers) { foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] } }
    
    try {
        if ($Body) {
            $r = Invoke-WebRequest -Uri $Url -Method $Method -Headers $h -Body $Body -UseBasicParsing -ErrorAction Stop
        } else {
            $r = Invoke-WebRequest -Uri $Url -Method $Method -Headers $h -UseBasicParsing -ErrorAction Stop
        }
        return @{ Name=$Name; Status=$r.StatusCode; ContentType=($r.Headers["Content-Type"]); Body=$r.Content }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $status = [int]$resp.StatusCode
            $ct = $resp.Headers["Content-Type"]
            # Read response body
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            # Try to get Content-Type from response
            if (-not $ct) {
                try { $ct = $resp.ContentType } catch { $ct = "N/A" }
            }
            
            return @{ Name=$Name; Status=$status; ContentType=$ct; Body=$body }
        }
        return @{ Name=$Name; Status="ERROR"; ContentType="N/A"; Body=$_.Exception.Message }
    }
}

Write-Host "`n========================================"
Write-Host "  RFC 9457 Content-Type Validation"
Write-Host "========================================`n"

# TEST 1: 404 - Endpoint inexistente
$r1 = Test-Endpoint -Name "404 Endpoint inexistente" -Method "GET" -Url "$base/api/ruta-inexistente-xyz"
$results += $r1

# TEST 2: 401 - Sin token (recurso protegido)
$r2 = Test-Endpoint -Name "401 Sin token" -Method "GET" -Url "$base/api/solicitudes"
$results += $r2

# TEST 3: 401 - Login con credenciales invalidas
$r3 = Test-Endpoint -Name "401 Login fallido" -Method "POST" -Url "$base/api/auth/login" -Body '{"identificador":"noexiste@test.com","password":"wrong"}'
$results += $r3

# TEST 4: 400 - Body JSON invalido
$r4 = Test-Endpoint -Name "400 JSON invalido" -Method "POST" -Url "$base/api/auth/login" -Body 'esto-no-es-json'
$results += $r4

# TEST 5: 400 - Validacion @Valid
$r5 = Test-Endpoint -Name "400 Validacion @Valid" -Method "POST" -Url "$base/api/auth/login" -Body '{}'
$results += $r5

# Login para obtener token
$loginBody = '{"identificador":"admin@saip.gob.pe","password":"admin123"}'
$loginR = Test-Endpoint -Name "Login admin" -Method "POST" -Url "$base/api/auth/login" -Body $loginBody
$token = ""
if ($loginR.Status -eq 200) {
    $token = ($loginR.Body | ConvertFrom-Json).token
    Write-Host "[OK] Login exitoso, token obtenido`n"
} else {
    Write-Host "[WARN] Login fallido (status $($loginR.Status)), tests con token se saltan`n"
}

if ($token) {
    $authHeaders = @{ "Authorization" = "Bearer $token" }
    
    # TEST 6: 404 - Recurso no encontrado con auth
    $r6 = Test-Endpoint -Name "404 Recurso no encontrado" -Method "GET" -Url "$base/api/solicitudes/999999" -Headers $authHeaders
    $results += $r6
    
    # TEST 7: 403 - Acceso denegado (ciudadano intentando admin)
    # Login como ciudadano
    $ciudLogin = '{"identificador":"maria@email.com","password":"maria123"}'
    $ciudR = Test-Endpoint -Name "Login ciudadano" -Method "POST" -Url "$base/api/auth/login" -Body $ciudLogin
    if ($ciudR.Status -eq 200) {
        $ciudToken = ($ciudR.Body | ConvertFrom-Json).token
        $ciudHeaders = @{ "Authorization" = "Bearer $ciudToken" }
        $r7 = Test-Endpoint -Name "403 Acceso denegado" -Method "GET" -Url "$base/api/usuarios" -Headers $ciudHeaders
        $results += $r7
    }
    
    # TEST 8: 404 - GET /api/auth/me/{id} con ID inexistente
    $r8 = Test-Endpoint -Name "404 auth/me inexistente" -Method "GET" -Url "$base/api/auth/me/999999" -Headers $authHeaders
    $results += $r8
}

# Print results table
Write-Host "`n========================================"
Write-Host "  RESULTADOS"
Write-Host "========================================`n"
Write-Host ("{0,-30} {1,-8} {2,-40}" -f "TEST", "STATUS", "CONTENT-TYPE")
Write-Host ("{0,-30} {1,-8} {2,-40}" -f "----", "------", "------------")

foreach ($r in $results) {
    $ct = if ($r.ContentType) { $r.ContentType } else { "N/A" }
    $pass = if ($ct -match "problem\+json") { "[OK]" } else { "[!!]" }
    Write-Host ("{0,-30} {1,-8} {2} {3}" -f $r.Name, $r.Status, $ct, $pass)
}

Write-Host "`n========================================"
Write-Host "  EJEMPLO DE RESPUESTA PROBLEM DETAILS"
Write-Host "========================================`n"

# Show first error response body formatted
foreach ($r in $results) {
    if ($r.Status -ge 400 -and $r.Body) {
        Write-Host "--- $($r.Name) (HTTP $($r.Status)) ---"
        try {
            $r.Body | ConvertFrom-Json | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $r.Body
        }
        Write-Host ""
        break
    }
}
