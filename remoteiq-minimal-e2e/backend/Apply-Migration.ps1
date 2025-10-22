<# 
.SYNOPSIS
  Apply a SQL migration to the Postgres container defined in docker-compose.
  Uses SecureString for password; inside the container we pass it to psql via PGPASSWORD.

.DESCRIPTION
  - Auto-detects compose file (includes docker-compose.db.yml) unless -ComposeFile is supplied.
  - Verifies the service exists and is running.
  - Pipes the SQL into psql inside the container (PowerShell-safe; no < redirection).
  - Forces TCP connection (psql -h localhost) to avoid peer-auth (root).

.PARAMETER File
  Path to the SQL file to apply.

.PARAMETER ServiceName
  Docker Compose service name hosting Postgres. Defaults to 'postgres'.

.PARAMETER Database
  Database name. Defaults to 'remoteiq'.

.PARAMETER User
  Database user. Defaults to 'remoteiq'.

.PARAMETER PasswordSecure
  Database user password as a SecureString. If omitted, the script falls back to a built-in
  default of 'remoteiqpass' (converted to SecureString in memory). Pass your own for production.

.PARAMETER ComposeFile
  Optional path to a specific docker compose file.

.EXAMPLE
  .\Apply-Migration.ps1 -File .\migrations\20251019_keep_current_model.sql

.EXAMPLE
  $sec = Read-Host "DB Password" -AsSecureString
  .\Apply-Migration.ps1 -File .\migrations\file.sql -PasswordSecure $sec -ComposeFile .\docker-compose.db.yml

#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$File,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ServiceName = "postgres",

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Database = "remoteiq",

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$User = "remoteiq",

    [Parameter()]
    [System.Security.SecureString]$PasswordSecure,

    [Parameter()]
    [string]$ComposeFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stop-Fatal {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Error -Message $Message -ErrorAction Stop
}

# Resolve SQL file path
$fullPath = Resolve-Path -LiteralPath $File -ErrorAction Stop | Select-Object -ExpandProperty Path
if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    Stop-Fatal "SQL file not found: $fullPath"
}

# Detect or validate compose file
if ([string]::IsNullOrWhiteSpace($ComposeFile)) {
    $candidates = @(
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
        "docker-compose.db.yml"
    )
    $found = $null
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c -PathType Leaf) { $found = (Resolve-Path $c).Path; break }
    }
    if (-not $found) {
        Stop-Fatal "No docker compose file found. Provide one with -ComposeFile or place a compose file in the current directory."
    }
    $ComposeFile = $found
}
else {
    $ComposeFile = (Resolve-Path -LiteralPath $ComposeFile -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath $ComposeFile -PathType Leaf)) {
        Stop-Fatal "Compose file not found: $ComposeFile"
    }
}

# Ensure Docker CLI is available
try { docker --version | Out-Null } catch {
    Stop-Fatal "Docker CLI not found. Please install Docker Desktop / CLI and try again."
}

Write-Host "Using compose file: $ComposeFile" -ForegroundColor DarkCyan

function Invoke-Compose {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string[]]$Args,
        [string]$StdinText
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = ("compose -f ""{0}"" " -f $ComposeFile) + ($Args -join ' ')
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    [void]$p.Start()

    if ($PSBoundParameters.ContainsKey('StdinText') -and $null -ne $StdinText) {
        $p.StandardInput.Write($StdinText)
    }
    $p.StandardInput.Close()

    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()

    [pscustomobject]@{
        ExitCode = $p.ExitCode
        StdOut   = $stdout
        StdErr   = $stderr
    }
}

# Verify the service is up
$psResult = Invoke-Compose -Args @("ps", $ServiceName, "--format", "json")
if ($psResult.ExitCode -ne 0) {
    Stop-Fatal ("Failed to run 'docker compose ps {0}': {1}" -f $ServiceName, ($psResult.StdErr.Trim()))
}
if ([string]::IsNullOrWhiteSpace($psResult.StdOut)) {
    Stop-Fatal ("Service '{0}' not found or not running. Start it with 'docker compose -f ""{1}"" up -d' and try again." -f $ServiceName, $ComposeFile)
}

# Read SQL text
$sqlText = Get-Content -LiteralPath $fullPath -Raw
if ([string]::IsNullOrWhiteSpace($sqlText)) {
    Stop-Fatal "SQL file is empty: $fullPath"
}

# Resolve password (SecureString -> plain in-memory)
# If not provided, fallback to your compose default 'remoteiqpass'
if ($null -eq $PasswordSecure) {
    $PasswordSecure = ConvertTo-SecureString -String "remoteiqpass" -AsPlainText -Force
}
$pwdPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PasswordSecure)
try {
    $pwdPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pwdPtr)
}
finally {
    if ($pwdPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pwdPtr) }
}

Write-Host "Applying migration to service '$ServiceName' (DB: $Database, User: $User)..." -ForegroundColor Cyan
Write-Host "File: $fullPath" -ForegroundColor DarkCyan

# Force TCP (-h localhost) and provide PGPASSWORD for md5/scram auth
# Note: PGPASSWORD must be plain for psql inside container. We only keep it in-memory here.
$psqlCmd = "PGPASSWORD=""$pwdPlain"" psql -h localhost -U $User -d $Database -v ON_ERROR_STOP=1 -f /dev/stdin"

$execArgs = @(
    "exec", "-T", $ServiceName,
    "bash", "-lc",
    $psqlCmd
)
$execResult = Invoke-Compose -Args $execArgs -StdinText $sqlText

if ($execResult.ExitCode -ne 0) {
    $err = $execResult.StdErr.Trim()
    if (-not [string]::IsNullOrWhiteSpace($err)) {
        Write-Host $err -ForegroundColor Red
    }
    Stop-Fatal "Migration failed with exit code $($execResult.ExitCode). See errors above."
}

$minOut = $execResult.StdOut.Trim()
if (-not [string]::IsNullOrWhiteSpace($minOut)) {
    Write-Host $minOut
}

Write-Host "Migration applied successfully." -ForegroundColor Green
