<# 
  RemoteIQ sanity checker
  - Enrolls a throwaway agent
  - Connects to ws://.../ws/agent?token=...
  - Sends hello + heartbeats
  - Verifies lastHeartbeatAt advanced via admin API

  Usage:
    ./remoteiq-sanity.ps1 -BaseUrl "http://localhost:3001" `
      -EnrollmentSecret $env:ENROLLMENT_SECRET `
      -AdminKey "your-admin-key"
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$BaseUrl,

  [Parameter(Mandatory=$true)]
  [string]$EnrollmentSecret,

  [Parameter(Mandatory=$true)]
  [string]$AdminKey
)

# -------------------------
# Helpers
# -------------------------
function Write-Ok   ($m) { Write-Host "[OK]  " $m -ForegroundColor Green }
function Write-Fail ($m) { Write-Host "[FAIL]" $m -ForegroundColor Red }
function Assert-True($cond, $msg) {
  if (-not $cond) { Write-Fail $msg; throw $msg } else { Write-Ok $msg }
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )
  $args = @{
    Method      = $Method
    Uri         = $Url
    Headers     = $Headers
    ErrorAction = 'Stop'
  }
  if ($Body -ne $null) {
    $args.ContentType = 'application/json'
    $args.Body        = ($Body | ConvertTo-Json -Depth 6)
  }
  return Invoke-RestMethod @args
}

# -------------------------
# Pre-flight checks
# -------------------------
Write-Host "== RemoteIQ Sanity Checks =="

Assert-True ([string]::IsNullOrWhiteSpace($EnrollmentSecret) -eq $false) "Enrollment secret is present"
Assert-True ([string]::IsNullOrWhiteSpace($AdminKey) -eq $false)         "Admin API key is present"

# Normalize/parse base URL
try { $uri = [uri]$BaseUrl } catch { throw "BaseUrl '$BaseUrl' is not a valid URI." }
$apiBase = "$($uri.Scheme)://$($uri.Authority)"

# -------------------------
# 1) Enroll agent
# -------------------------
$rand       = -join ((97..122 + 48..57) | Get-Random -Count 6 | ForEach-Object {[char]$_})
$deviceId   = "dev-$rand"
$enrollBody = @{
  enrollmentSecret = $EnrollmentSecret
  deviceId         = $deviceId
  hostname         = "sanity-$rand"
  os               = "windows"
  arch             = "x64"
  version          = "0.0.0-sanity"
}

Write-Host "Enrolling agent (deviceId=$deviceId)..."
$enrollResp = Invoke-Json -Method Post -Url "$apiBase/api/agent/enroll" -Body $enrollBody
$AgentId    = $enrollResp.agentId
$AgentToken = $enrollResp.agentToken
Assert-True ($AgentId -and $AgentToken) "Enroll returned agentId and agentToken"
Write-Host "AgentId: $AgentId"

# Negative test – bad secret must 401
try {
  $bad = $enrollBody.Clone()
  $bad.enrollmentSecret = "BAD-$($EnrollmentSecret)"
  Invoke-Json -Method Post -Url "$apiBase/api/agent/enroll" -Body $bad | Out-Null
  Write-Fail "Bad enrollment secret is rejected with 401"
  throw "Bad secret unexpectedly accepted"
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode.Value__ -eq 401) {
    Write-Ok "Bad enrollment secret is rejected with 401"
  } else {
    # If we threw ourselves, bubble up
    if ($_.Exception.Message -match "unexpectedly accepted") { throw }
    # Otherwise still fail clearly
    Write-Fail "Bad enrollment secret did not return 401"
    throw
  }
}

# -------------------------
# 2) WS connect (token in query) + hello + heartbeats
# -------------------------
# Decide ws/wss
$wsScheme = if ($uri.Scheme -eq 'https') { 'wss' } else { 'ws' }
$tokenParam = [uri]::EscapeDataString($AgentToken)
$wsUrl = "${wsScheme}://$($uri.Authority)/ws/agent?token=$tokenParam"

Write-Host "Connecting WS: $wsUrl"

Add-Type -AssemblyName System.Net.WebSockets
$ws = New-Object System.Net.WebSockets.ClientWebSocket

# Optional: also send Authorization header (not required since we use query param)
# $headersProp = $ws.Options.GetType().GetProperty('RequestHeaders', [Reflection.BindingFlags]'NonPublic,Instance')
# $headers     = $headersProp.GetValue($ws.Options, $null)
# $headers.Add('Authorization', "Bearer $AgentToken")

$ws.ConnectAsync([uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
Assert-True ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) "WebSocket connected"

# Helper to send a small JSON text frame
function Send-WsJson([System.Net.WebSockets.ClientWebSocket]$Sock, [object]$Obj) {
  $json = ($Obj | ConvertTo-Json -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] (,$bytes)
  $Sock.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
}

# Send hello to be extra-safe (server already authenticates via ?token=)
Send-WsJson -Sock $ws -Obj @{ type = 'agent.hello'; agentId = $AgentId }
Start-Sleep -Milliseconds 100

# Send two heartbeats
for ($n = 1; $n -le 2; $n++) {
  Send-WsJson -Sock $ws -Obj @{ event = 'heartbeat' }
  Write-Host "Sent heartbeat #$n"
  Start-Sleep -Milliseconds 200
}

# -------------------------
# 3) Verify admin API sees the agent and lastHeartbeatAt advances
# -------------------------
$adminHeaders = @{ 'x-admin-api-key' = $AdminKey }

# Your admin endpoint (POST) returns a list; mirror your workflow
$adminsResp = Invoke-Json -Method Post -Url "$apiBase/api/admin/agents" -Headers $adminHeaders
$items      = $adminsResp.items
$me         = $items | Where-Object { $_.id -eq $AgentId }
Assert-True ($me -ne $null) "Agent is visible in admin list"

$initial = $me.lastHeartbeatAt
if ($initial) {
  $initialStr = try { [DateTime]::Parse($initial).ToString() } catch { "$initial" }
  Write-Host "Initial lastHeartbeatAt=$initialStr"
} else {
  Write-Host "Initial lastHeartbeatAt=<null>"
}

# Poll for an update for up to ~8 seconds
$advanced = $false
for ($i = 1; $i -le 8; $i++) {
  Start-Sleep -Seconds 1
  $adminsResp = Invoke-Json -Method Post -Url "$apiBase/api/admin/agents" -Headers $adminHeaders
  $items      = $adminsResp.items
  $me         = $items | Where-Object { $_.id -eq $AgentId }
  $now        = $me.lastHeartbeatAt
  $nowStr     = if ($now) { try { [DateTime]::Parse($now).ToString() } catch { "$now" } } else { "<null>" }
  Write-Host "Poll #${i}: lastHeartbeatAt=${nowStr}"
  if ($now -and ($now -ne $initial)) { $advanced = $true; break }
}

Assert-True $advanced "Heartbeat advanced lastHeartbeatAt via admin API"

# -------------------------
# Cleanup socket
# -------------------------
try {
  if ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  }
} catch { }

Write-Ok "Sanity run complete"
