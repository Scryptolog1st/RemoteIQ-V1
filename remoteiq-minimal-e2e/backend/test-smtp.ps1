<# 
.SYNOPSIS
  Tests RemoteIQ SMTP endpoints via REST (secure password + no $PROFILE clash).

.EXAMPLE
  $sec = Read-Host -AsSecureString "SMTP password"
  ./test-smtp.ps1 -ApiBase http://localhost:3001 -EmailProfile alerts `
    -SmtpHost smtp.mailserver.com -SmtpPort 587 -UseTLS `
    -SmtpUser alerts@your.com -SmtpPassword $sec -FromAddress alerts@your.com `
    -TestTo you@yourdomain.com -AdminApiKey "LS@dm1n!"

.NOTES
  PowerShell 7+ recommended (Windows PowerShell 5.1 also works).
#>

param(
    [string] $ApiBase = "http://localhost:3001",

    [ValidateSet("alerts", "invites", "password_resets", "reports")]
    [string] $EmailProfile = "alerts",

    # SMTP settings to save
    [Parameter(Mandatory = $true)][string] $SmtpHost,
    [int] $SmtpPort = 587,
    [Parameter(Mandatory = $true)][string] $SmtpUser,
    [Parameter(Mandatory = $true)][SecureString] $SmtpPassword,
    [Parameter(Mandatory = $true)][string] $FromAddress,
    [switch] $UseTLS,
    [switch] $UseSSL,

    # Test email
    [Parameter(Mandatory = $true)][string] $TestTo,
    [string] $Subject = "RemoteIQ SMTP test",
    [string] $Body = "This is a test from RemoteIQ.",

    # Optional admin API key header
    [string] $AdminApiKey,

    # Optional: also probe IMAP/POP reachability (no auth)
    [switch] $CheckImap,
    [switch] $CheckPop
)

function New-ApiHeaders {
    param([string]$Key)
    $h = @{ "Content-Type" = "application/json" }
    if ($Key) { $h["x-admin-api-key"] = $Key }
    return $h
}

function Invoke-Api {
    param(
        [ValidateSet("GET", "POST")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        $BodyObj
    )
    if ($null -ne $BodyObj) {
        $json = $BodyObj | ConvertTo-Json -Depth 20 -Compress
        return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -Body $json
    }
    else {
        return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
    }
}

function ConvertFrom-SecureStringToPlain {
    param([Parameter(Mandatory = $true)][SecureString]$Secure)
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

$headers = New-ApiHeaders -Key $AdminApiKey
$pwdPlain = ConvertFrom-SecureStringToPlain -Secure $SmtpPassword

Write-Host "1) GET current config (passwords should be masked/omitted)..." -ForegroundColor Cyan
try {
    $config = Invoke-Api -Method GET -Url "$ApiBase/api/admin/email" -Headers $headers -BodyObj $null
    $config | ConvertTo-Json -Depth 20
}
catch {
    Write-Error "GET /api/admin/email failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "`n2) SAVE profile '$EmailProfile' (preserves secrets on later saves if password omitted)..." -ForegroundColor Cyan
$profiles = @{}
$profiles[$EmailProfile] = @{
    enabled = $true
    smtp    = @{
        host        = $SmtpHost
        port        = $SmtpPort
        username    = $SmtpUser
        password    = $pwdPlain
        useTLS      = [bool]$UseTLS
        useSSL      = [bool]$UseSSL
        fromAddress = $FromAddress
    }
    imap    = @{
        host     = ""
        port     = 993
        username = ""
        useSSL   = $true
    }
    pop     = @{
        host     = ""
        port     = 995
        username = ""
        useSSL   = $true
    }
}
$saveBody = @{ profiles = $profiles }

try {
    $saveRes = Invoke-Api -Method POST -Url "$ApiBase/api/admin/email/save" -Headers $headers -BodyObj $saveBody
    Write-Host "Save result:" -NoNewline
    $saveRes | ConvertTo-Json -Depth 5
}
catch {
    Write-Error "POST /api/admin/email/save failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "`n3) VERIFY SMTP connectivity..." -ForegroundColor Cyan
try {
    $verify = Invoke-Api -Method POST -Url "$ApiBase/api/admin/email/test-smtp" -Headers $headers -BodyObj @{ profile = $EmailProfile }
    if ($verify.ok) { Write-Host "✔ $($verify.result)" -ForegroundColor Green } else { Write-Host "✖ $($verify.result)" -ForegroundColor Yellow }
}
catch {
    Write-Error "POST /api/admin/email/test-smtp failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "`n4) SEND TEST email to '$TestTo'..." -ForegroundColor Cyan
try {
    $send = Invoke-Api -Method POST -Url "$ApiBase/api/admin/email/send-test" -Headers $headers -BodyObj @{
        profile = $EmailProfile
        to      = $TestTo
        subject = $Subject
        body    = $Body
    }
    if ($send.ok) { Write-Host "✔ Test email sent" -ForegroundColor Green } else { Write-Host "✖ Send failed: $($send.result)" -ForegroundColor Yellow }
}
catch {
    Write-Error "POST /api/admin/email/send-test failed: $($_.Exception.Message)"
    exit 1
}

if ($CheckImap) {
    Write-Host "`n5) (Optional) IMAP reachability probe..." -ForegroundColor Cyan
    try {
        $imap = Invoke-Api -Method POST -Url "$ApiBase/api/admin/email/test-imap" -Headers $headers -BodyObj @{ profile = $EmailProfile }
        if ($imap.ok) { Write-Host "✔ IMAP: $($imap.result)" -ForegroundColor Green } else { Write-Host "✖ IMAP: $($imap.result)" -ForegroundColor Yellow }
    }
    catch {
        Write-Error "POST /api/admin/email/test-imap failed: $($_.Exception.Message)"
    }
}

if ($CheckPop) {
    Write-Host "`n6) (Optional) POP reachability probe..." -ForegroundColor Cyan
    try {
        $pop = Invoke-Api -Method POST -Url "$ApiBase/api/admin/email/test-pop" -Headers $headers -BodyObj @{ profile = $EmailProfile }
        if ($pop.ok) { Write-Host "✔ POP: $($pop.result)" -ForegroundColor Green } else { Write-Host "✖ POP: $($pop.result)" -ForegroundColor Yellow }
    }
    catch {
        Write-Error "POST /api/admin/email/test-pop failed: $($_.Exception.Message)"
    }
}

Write-Host "`nDone." -ForegroundColor Cyan
