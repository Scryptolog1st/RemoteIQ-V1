<# 
.SYNOPSIS
  Generate a secure random JWT secret.

.EXAMPLE
  ./generate-jwt-secret.ps1
  # Prints secrets in Base64 / URL-safe Base64 / Hex

.EXAMPLE
  ./generate-jwt-secret.ps1 -Write
  # Updates or appends JWT_SECRET=... in .env

.PARAMETER Bytes
  Number of random bytes (default 32 => 256-bit secret).

.PARAMETER EnvPath
  Path to .env file (default: .env in current dir).

.PARAMETER Write
  If provided, writes/updates JWT_SECRET in the .env file.

.PARAMETER UrlSafe
  If provided with -Write, uses URL-safe Base64 for JWT_SECRET.
#>

[CmdletBinding()]
param(
    [int]$Bytes = 32,
    [string]$EnvPath = ".env",
    [switch]$Write,
    [switch]$UrlSafe
)

# --- Generate secure random bytes
$buf = New-Object byte[] $Bytes
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($buf)
$rng.Dispose()

# --- Encodings
$Base64 = [Convert]::ToBase64String($buf)
$Base64Url = $Base64.TrimEnd('=') -replace '\+', '-' -replace '/', '_'
$Hex = -join ($buf | ForEach-Object { $_.ToString("x2") })

Write-Host "JWT secrets (same entropy, different encodings):`n"
Write-Host (" Base64:       {0}" -f $Base64)
Write-Host (" URL-safe B64: {0}" -f $Base64Url)
Write-Host (" Hex:          {0}`n" -f $Hex)

if ($Write) {
    if (-not (Test-Path $EnvPath)) {
        New-Item -ItemType File -Path $EnvPath -Force | Out-Null
    }
    $envText = Get-Content -Path $EnvPath -Raw -ErrorAction SilentlyContinue
    if (-not $envText) { $envText = "" }

    # Choose which encoding to write
    $chosen = if ($UrlSafe) { $Base64Url } else { $Base64 }

    if ($envText -match '^\s*JWT_SECRET\s*=.*$' ) {
        $envText = [System.Text.RegularExpressions.Regex]::Replace(
            $envText,
            '^\s*JWT_SECRET\s*=.*$',
            "JWT_SECRET=$chosen",
            [System.Text.RegularExpressions.RegexOptions]::Multiline
        )
    }
    else {
        if ($envText.Length -gt 0 -and -not $envText.EndsWith("`n")) { $envText += "`r`n" }
        $envText += "JWT_SECRET=$chosen`r`n"
    }

    Set-Content -Path $EnvPath -Value $envText -Encoding UTF8
    Write-Host "✅ Wrote JWT_SECRET to $EnvPath" -ForegroundColor Green
    if ($UrlSafe) {
        Write-Host "   (URL-safe Base64 used; set JWT_EXPIRES too, e.g. '7d')" -ForegroundColor Yellow
    }
}
