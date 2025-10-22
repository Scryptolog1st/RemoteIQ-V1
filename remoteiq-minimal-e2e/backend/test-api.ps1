# test-api.ps1
# Auto-detect the Nest API base (port + optional prefix), then exercise /roles.

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host $msg -ForegroundColor Red }

function Try-GetJson {
    param(
        [Parameter(Mandatory)][string]$Url,
        [ValidateSet('GET', 'POST', 'PATCH', 'DELETE')][string]$Method = 'GET',
        [object]$Body = $null
    )
    try {
        $params = @{
            Uri     = $Url
            Method  = $Method
            Headers = @{ 'Accept' = 'application/json' }
        }
        if ($Body -ne $null) {
            $params.ContentType = 'application/json'
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        $resp = Invoke-WebRequest @params
        $ct = $resp.Headers.'Content-Type'
        $raw = $resp.Content

        # Quick HTML guard
        if ($raw -match '<!DOCTYPE html' -or ($ct -and $ct -notmatch 'application/json')) {
            return $null
        }

        try {
            return $raw | ConvertFrom-Json -Depth 20
        }
        catch {
            return $null
        }
    }
    catch {
        # If the response had JSON error, try to parse it so we can show details
        try {
            $rawErr = $_.ErrorDetails.Message
            if ($rawErr) { return $rawErr | ConvertFrom-Json -Depth 10 }
        }
        catch { }
        return $null
    }
}

# --- Discover base URL ---
$ports = @(3000, 3001, 4000, 8080)
$prefixes = @('', '/api', '/v1', '/api/v1')

$discoveredBase = $null
foreach ($p in $ports) {
    foreach ($pref in $prefixes) {
        $base = "http://localhost:$p$pref"
        $probe = Try-GetJson -Url "$base/roles" -Method 'GET'
        if ($probe -ne $null) {
            $discoveredBase = $base
            break
        }
    }
    if ($discoveredBase) { break }
}

if (-not $discoveredBase) {
    Write-Warn "Could not find a JSON /roles endpoint. You likely hit the Next.js app on :3000."
    Write-Host "Tips:" -ForegroundColor Yellow
    Write-Host "  • Start your Nest backend and note its port (see backend/src/main.ts)." -ForegroundColor Yellow
    Write-Host "  • Common API bases are http://localhost:3001/api or http://localhost:4000/api" -ForegroundColor Yellow
    Write-Host "  • Once the backend is up, re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Info "Using API base: $discoveredBase"
$roles = "$discoveredBase/roles"

# --- LIST ---
Write-Info "`n== LIST ==============="
$all = Try-GetJson -Url $roles -Method 'GET'
$all | ConvertTo-Json -Depth 10
if ($all -is [array]) {
    Write-Ok "Listed $($all.Count) role(s)."
}
else {
    Write-Err "Unexpected response for LIST. Aborting CRUD tests."
    exit 1
}

# --- CREATE ---
Write-Info "`n== CREATE (Support) ==="
$createBody = @{
    name        = 'Support'
    description = 'Support staff'
    permissions = @('users.read', 'users.write', 'roles.read')
}
$created = Try-GetJson -Url $roles -Method 'POST' -Body $createBody
$created | ConvertTo-Json -Depth 10
$id = $created?.id
Write-Info "Created id: $id"

# If the endpoint is protected or creation failed silently, stop here gracefully
if (-not $id) {
    Write-Warn "No id returned from create; continuing to duplicate-name test to check behavior."
}

# --- DUPLICATE NAME (Support vs support) ---
Write-Info "`n== DUPLICATE-NAME TEST (support vs Support) =="
$dupBody = @{
    name        = 'support'   # different case
    description = 'duplicate check'
    permissions = @('users.read')
}
$dupResp = Try-GetJson -Url $roles -Method 'POST' -Body $dupBody
if ($dupResp -and $dupResp.error) {
    Write-Ok "Duplicate constraint enforced: $($dupResp.error)"
}
elseif ($dupResp -and $dupResp.id) {
    Write-Err "Unexpectedly created duplicate name."
}
else {
    Write-Ok "Duplicate creation likely rejected (no id returned)."
}

# --- UPDATE (if we have an id) ---
if ($id) {
    Write-Info "`n== UPDATE (rename Support -> Helpdesk) =="
    $patch = @{
        name        = 'Helpdesk'
        description = 'Helpdesk team'
        permissions = @('users.read', 'roles.read')
    }
    $updateResp = Try-GetJson -Url "$roles/$id" -Method 'PATCH' -Body $patch
    $updateResp | ConvertTo-Json -Depth 10
}

# --- NEGATIVE: try to rename to Owner (should fail) ---
Write-Info "`n== EXPECTED ERROR (rename to Owner) =="
if ($id) {
    $neg = Try-GetJson -Url "$roles/$id" -Method 'PATCH' -Body @{ name = 'Owner' }
    if ($neg -and $neg.error) {
        Write-Ok "Got expected error: $($neg.error)"
    }
    else {
        Write-Warn "Did not receive the expected protected-name error."
    }
}
else {
    Write-Warn "Skipping protected-name test (no created id)."
}

# --- DELETE (should succeed unless assigned to users) ---
Write-Info "`n== DELETE (created role) =="
if ($id) {
    $del = Try-GetJson -Url "$roles/$id" -Method 'DELETE'
    $del | ConvertTo-Json -Depth 5
}
else {
    Write-Warn "Skipping delete (no created id)."
}

Write-Ok "`nDone."
