<#
.SYNOPSIS
  RemoteIQ Security Tools (menu-driven)

.DESCRIPTION
  Covers login, 2FA (enable/regen/disable), overview, sessions (list/remove),
  password change, and personal tokens (list/create/remove).

.USAGE
  .\security-tools.ps1 -API "http://localhost:3001"
#>

#requires -Version 5.1

param(
    [string]$API = "http://localhost:3001",
    [string]$OutDir = (Get-Location).Path
)

Set-StrictMode -Version Latest

# ----------------------------- Helpers -----------------------------
$global:Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$global:UserEmail = $null

function Read-PasswordPlain([string]$Prompt = "Password") {
    $s = Read-Host $Prompt -AsSecureString
    [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    )
}

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PATCH', 'DELETE')]
        [string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        $Body
    )
    $uri = "$API$Path"
    try {
        if ($PSBoundParameters.ContainsKey('Body') -and $null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 8
            return Invoke-RestMethod -Method $Method -Uri $uri -ContentType "application/json" -Body $json -WebSession $Session
        }
        else {
            return Invoke-RestMethod -Method $Method -Uri $uri -WebSession $Session
        }
    }
    catch {
        $msg = $_.ErrorDetails.Message
        if (-not $msg) { $msg = $_.Exception.Message }
        throw "API error $Method $Path -> $msg"
    }
}

function Start-Login {
    Write-Host "`n== Login ==" -ForegroundColor Cyan
    $email = Read-Host "Email"
    $pw = Read-PasswordPlain "Password"
    $body = @{ email = $email; password = $pw }

    $resp = Invoke-Api -Method POST -Path "/api/auth/login" -Body $body
    if (-not $resp.user) { throw "Login failed (no user in response)" }
    $global:UserEmail = $resp.user.email
    Write-Host "Logged in as $($resp.user.email)" -ForegroundColor Green
}

function Confirm-LoginSession {
    if (-not $global:UserEmail) {
        Start-Login
    }
}

function Save-QR([string]$DataUrl) {
    $path = Join-Path $OutDir "remoteiq-2fa.png"
    $b64 = $DataUrl -replace '^data:image/png;base64,', ''
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($b64))
    try { Start-Process $path | Out-Null } catch {}
    Write-Host "Saved QR to: $path" -ForegroundColor DarkGray
}

function Save-RecoveryCodes([string[]]$Codes) {
    if (-not $Codes -or $Codes.Count -eq 0) { return }
    $path = Join-Path $OutDir "remoteiq-2fa-recovery-codes.txt"
    "# RemoteIQ recovery codes (store safely!)" | Out-File -FilePath $path -Encoding utf8
    $Codes | Out-File -FilePath $path -Append -Encoding utf8
    Write-Host "Recovery codes saved to: $path" -ForegroundColor Green
}

function Read-Totp {
    $raw = Read-Host "Enter 6-digit TOTP"
    $clean = ($raw -replace '\D', '')
    if ($clean.Length -lt 6) { throw "TOTP must be 6 digits" }
    return $clean.Substring($clean.Length - 6, 6)
}

# ----------------------------- Actions -----------------------------
function Show-SecurityOverview {
    Confirm-LoginSession
    $ov = Invoke-Api -Method GET -Path "/api/users/me/security"
    Write-Host "`n== Security Overview ==" -ForegroundColor Cyan
    "twoFactorEnabled : $($ov.twoFactorEnabled)"

    if ($ov.events) {
        Write-Host "`nRecent Events:" -ForegroundColor DarkCyan
        $ov.events | Select-Object type, at, ip, userAgent | Format-Table -AutoSize
    }
    if ($ov.sessions) {
        Write-Host "`nSessions:" -ForegroundColor DarkCyan
        $ov.sessions |
        Select-Object @{n = 'id'; e = { $_.id } },
        @{n = 'ip'; e = { $_.ip } },
        @{n = 'userAgent'; e = { $_.userAgent } },
        @{n = 'createdAt'; e = { $_.createdAt } },
        @{n = 'lastSeen'; e = { $_.lastSeenAt } },
        @{n = 'current'; e = { $_.current } } |
        Format-Table -AutoSize
    }
}

function Enable-TwoFactorAuth {
    Confirm-LoginSession
    Write-Host "`n== Enable 2FA ==" -ForegroundColor Cyan
    $start = Invoke-Api -Method POST -Path "/api/users/me/2fa/start"
    Write-Host "Secret  : $($start.secret)"
    Write-Host "otpauth : $($start.otpauthUrl)"
    Save-QR $start.qrPngDataUrl

    $max = 5
    for ($i = 1; $i -le $max; $i++) {
        try {
            $code = Read-Totp
            $confirm = Invoke-Api -Method POST -Path "/api/users/me/2fa/confirm" -Body @{ code = $code }
            Write-Host "✅ 2FA enabled!" -ForegroundColor Green
            Save-RecoveryCodes $confirm.recoveryCodes
            Show-SecurityOverview
            return
        }
        catch {
            Write-Host "Attempt $i failed: $($_)" -ForegroundColor Yellow
            if ($i -lt $max) { Write-Host "Wait for the next 30s tick and try again..." -ForegroundColor DarkYellow }
        }
    }
    Write-Host "Failed to confirm 2FA after $max attempts." -ForegroundColor Red
}

function New-RecoveryCodes {
    Confirm-LoginSession
    Write-Host "`n== Regenerate Recovery Codes ==" -ForegroundColor Cyan
    $resp = Invoke-Api -Method POST -Path "/api/users/me/2fa/recovery/regen"
    Save-RecoveryCodes $resp.recoveryCodes
}

function Disable-TwoFactorAuth {
    Confirm-LoginSession
    Write-Host "`n== Disable 2FA ==" -ForegroundColor Cyan
    $choice = Read-Host "Disable with (1) TOTP or (2) Recovery code?"
    if ($choice -eq "1") {
        $code = Read-Totp
        Invoke-Api -Method POST -Path "/api/users/me/2fa/disable" -Body @{ code = $code } | Out-Null
    }
    else {
        $rc = Read-Host "Enter recovery code"
        Invoke-Api -Method POST -Path "/api/users/me/2fa/disable" -Body @{ recoveryCode = $rc } | Out-Null
    }
    Write-Host "2FA disabled." -ForegroundColor Yellow
    Show-SecurityOverview
}

function Get-UserSessions {
    Confirm-LoginSession
    $s = Invoke-Api -Method GET -Path "/api/users/me/sessions"
    Write-Host "`n== Sessions ==" -ForegroundColor Cyan
    $s.items | ForEach-Object {
        # Safely read revokedAt if present
        $revProp = $_.PSObject.Properties['revokedAt']
        $rev = if ($revProp) { $revProp.Value } else { $null }

        [pscustomobject]@{
            id        = $_.id
            ip        = $_.ip
            userAgent = $_.userAgent
            createdAt = $_.createdAt
            lastSeen  = $_.lastSeenAt
            current   = $_.current
            revokedAt = $rev
        }
    } | Format-Table -AutoSize
}

function Remove-Session {
    Confirm-LoginSession
    $s = Invoke-Api -Method GET -Path "/api/users/me/sessions"
    $target = ($s.items | Where-Object { -not $_.current } | Select-Object -First 1)
    if (-not $target) { Write-Host "No non-current session to remove." -ForegroundColor Yellow; return }
    Write-Host "Removing: $($target.id) ($($target.ip))" -ForegroundColor Yellow
    Invoke-Api -Method POST -Path "/api/users/me/sessions/revoke" -Body @{ sessionId = $target.id } | Out-Null
    Write-Host "Removed." -ForegroundColor Green
    Get-UserSessions
}

function Remove-OtherSessions {
    Confirm-LoginSession
    Write-Host "Removing all other sessions..." -ForegroundColor Yellow
    Invoke-Api -Method POST -Path "/api/users/me/sessions/revoke-all" | Out-Null
    Write-Host "Done." -ForegroundColor Green
    Get-UserSessions
}

function Set-UserPassword {
    Confirm-LoginSession
    Write-Host "`n== Change Password ==" -ForegroundColor Cyan
    $current = Read-PasswordPlain "Current password"
    $next = Read-PasswordPlain "New password"
    $confirm = Read-PasswordPlain "Confirm new password"
    if ($next -ne $confirm) { Write-Host "New passwords do not match." -ForegroundColor Red; return }
    Invoke-Api -Method POST -Path "/api/users/me/password" -Body @{ current = $current; next = $next } | Out-Null
    Write-Host "Password changed." -ForegroundColor Green
}

function Get-PersonalTokens {
    Confirm-LoginSession
    $resp = Invoke-Api -Method GET -Path "/api/users/me/tokens"
    Write-Host "`n== Personal Tokens ==" -ForegroundColor Cyan
    if (-not $resp.items -or $resp.items.Count -eq 0) { Write-Host "(none)"; return }
    $resp.items | ForEach-Object {
        [pscustomobject]@{
            id        = $_.id
            name      = $_.name
            createdAt = $_.createdAt
            lastUsed  = $_.lastUsedAt
            revokedAt = $_.revokedAt
        }
    } | Format-Table -AutoSize
}

function New-PersonalToken {
    Confirm-LoginSession
    $name = Read-Host "Token name"
    if ([string]::IsNullOrWhiteSpace($name)) { Write-Host "Name required." -ForegroundColor Red; return }
    $resp = Invoke-Api -Method POST -Path "/api/users/me/tokens" -Body @{ name = $name }
    Write-Host "`nToken created. COPY THIS NOW (shown once):" -ForegroundColor Green
    Write-Host $resp.token -ForegroundColor Yellow
    Write-Host "Id: $($resp.id)" -ForegroundColor DarkGray
}

function Remove-PersonalToken {
    Confirm-LoginSession
    $id = Read-Host "Token id to remove"
    if ([string]::IsNullOrWhiteSpace($id)) { Write-Host "Id required." -ForegroundColor Red; return }
    Invoke-Api -Method POST -Path "/api/users/me/tokens/revoke" -Body @{ id = $id } | Out-Null
    Write-Host "Token removed." -ForegroundColor Green
}

# ----------------------------- Menu -----------------------------
function Show-Menu {
    Write-Host ""
    Write-Host "RemoteIQ Security Tools" -ForegroundColor Cyan
    if ($global:UserEmail) { Write-Host "Logged in as: $global:UserEmail" -ForegroundColor DarkGray }
    Write-Host "1) Login / Re-login"
    Write-Host "2) Show Security Overview"
    Write-Host "3) Enable Two-Factor Auth"
    Write-Host "4) New Recovery Codes"
    Write-Host "5) Disable Two-Factor Auth"
    Write-Host "6) Get User Sessions"
    Write-Host "7) Remove One Session (not current)"
    Write-Host "8) Remove Other Sessions"
    Write-Host "9) Set User Password"
    Write-Host "10) Get Personal Tokens"
    Write-Host "11) New Personal Token"
    Write-Host "12) Remove Personal Token"
    Write-Host "0) Exit"
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Choose"
    try {
        switch ($choice) {
            "1" { Start-Login }
            "2" { Show-SecurityOverview }
            "3" { Enable-TwoFactorAuth }
            "4" { New-RecoveryCodes }
            "5" { Disable-TwoFactorAuth }
            "6" { Get-UserSessions }
            "7" { Remove-Session }
            "8" { Remove-OtherSessions }
            "9" { Set-UserPassword }
            "10" { Get-PersonalTokens }
            "11" { New-PersonalToken }
            "12" { Remove-PersonalToken }
            "0" { break }
            default { Write-Host "Invalid choice." -ForegroundColor Yellow }
        }
    }
    catch {
        Write-Host "Error: $($_)" -ForegroundColor Red
    }
}
