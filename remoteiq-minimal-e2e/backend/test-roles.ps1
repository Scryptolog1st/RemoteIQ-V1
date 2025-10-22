# backend\test-roles.ps1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Base = "http://localhost:3001/api"
$Roles = "$Base/roles"
Write-Host "Using base: $Base  ->  $Roles"

function Show($title, $obj) {
    "`n== $title ==`n"
    if ($obj -is [string]) { $obj } else { $obj | ConvertTo-Json -Depth 10 }
}

function TryCall([string]$Title, [hashtable]$Params) {
    try {
        $resp = Invoke-RestMethod @Params
        Show $Title $resp
        return $resp
    }
    catch {
        $msg = $_.ErrorDetails?.Message
        if ([string]::IsNullOrWhiteSpace($msg)) { $msg = $_ | Out-String }
        Show "$Title (error)" $msg
        return $null
    }
}

# 1) LIST
$all = TryCall "LIST" @{ Uri = $Roles; Method = "GET" }
if (-not $all) { return }

# 2) CREATE
$createBody = @{
    name        = "Support"
    description = "Support staff"
    permissions = @("users.read", "roles.read")
} | ConvertTo-Json -Depth 10

$createResp = TryCall "CREATE" @{
    Uri = $Roles; Method = "POST"; ContentType = "application/json"; Body = $createBody
}

$id = $null
if ($createResp) {
    $id = $createResp.id
    if ($id) { "Created id: $id" }
}

# 3) UPDATE (if created)
if ($id) {
    $patchBody = @{
        description = "Updated description"
        permissions = @("users.read", "users.write", "roles.read")
    } | ConvertTo-Json -Depth 10

    TryCall "UPDATE" @{
        Uri = "$Roles/$id"; Method = "PATCH"; ContentType = "application/json"; Body = $patchBody
    } | Out-Null
}

# 4) DUPLICATE NAME TEST (Support vs support) — expect 409
$dupBody = @{ name = "support" } | ConvertTo-Json -Depth 10
TryCall "DUPLICATE (expected error)" @{
    Uri = $Roles; Method = "POST"; ContentType = "application/json"; Body = $dupBody
} | Out-Null

# 5) DELETE (if created)
if ($id) {
    TryCall "DELETE" @{ Uri = "$Roles/$id"; Method = "DELETE" } | Out-Null
}
