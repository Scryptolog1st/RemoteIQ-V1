<# 
.SYNOPSIS
  Create/seed the localization_settings table inside a Postgres Docker container.

.EXAMPLE
  .\Apply-LocalizationSchema.ps1 -ContainerName "backend-postgres-1" -Database "remoteiq" -DbUser "remoteiq"
  # Prompts for password securely

.EXAMPLE
  $sec = Read-Host "Postgres password" -AsSecureString
  .\Apply-LocalizationSchema.ps1 -ContainerName "backend-postgres-1" -Database "remoteiq" -DbUser "remoteiq" -DbPasswordSecure $sec
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ContainerName = "backend-postgres-1",

    [Parameter(Mandatory = $false)]
    [string]$Database = "remoteiq",

    [Parameter(Mandatory = $false)]
    [string]$DbUser = "remoteiq",

    # Use SecureString to avoid plain-text in history
    [Parameter(Mandatory = $false)]
    [SecureString]$DbPasswordSecure
)

function Convert-SecureStringToPlainText {
    param([SecureString]$Secure)
    if (-not $Secure) { return "" }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# Prompt if password not provided
if (-not $DbPasswordSecure) {
    $DbPasswordSecure = Read-Host "Postgres password for user '$DbUser'" -AsSecureString
}

$DbPassword = Convert-SecureStringToPlainText -Secure $DbPasswordSecure

# SQL to create/seed the table
$sql = @'
-- Create table if missing
CREATE TABLE IF NOT EXISTS localization_settings (
  id                 integer PRIMARY KEY,
  language           text    NOT NULL DEFAULT 'en-US',
  date_format        text    NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format        text    NOT NULL DEFAULT 'h:mm a',   -- matches UI "12h"
  number_format      text    NOT NULL DEFAULT '1,234.56',
  time_zone          text    NOT NULL DEFAULT 'UTC',
  first_day_of_week  text    NOT NULL DEFAULT 'sunday',
  currency           text
);

-- Seed row (id = 1) if absent
INSERT INTO localization_settings (id, language, date_format, time_format, number_format, time_zone, first_day_of_week, currency)
SELECT 1, 'en-US', 'MM/DD/YYYY', 'h:mm a', '1,234.56', 'UTC', 'sunday', 'USD'
WHERE NOT EXISTS (SELECT 1 FROM localization_settings WHERE id = 1);
'@

# ---- Run via temp file & docker cp (simplest & robust) ----

# 1) Write SQL to a temp file on the host
$tempFile = [System.IO.Path]::GetTempFileName()
# ensure .sql extension for clarity
$destTemp = [System.IO.Path]::ChangeExtension($tempFile, ".sql")
Move-Item -LiteralPath $tempFile -Destination $destTemp -Force
Set-Content -LiteralPath $destTemp -Value $sql -NoNewline

# 2) Copy to container
$containerSqlPath = "/tmp/localization_schema.sql"
Write-Host "Copying SQL to container '$ContainerName'..." -ForegroundColor Cyan
& docker cp $destTemp "${ContainerName}:$containerSqlPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker cp failed (code $LASTEXITCODE)"
    Remove-Item -LiteralPath $destTemp -Force -ErrorAction SilentlyContinue
    exit 1
}

# 3) Execute with psql
Write-Host "Applying localization schema to database '$Database'..." -ForegroundColor Cyan
$execArgs = @(
    "exec",
    "-e", "PGPASSWORD=$DbPassword",
    $ContainerName,
    "psql",
    "-v", "ON_ERROR_STOP=1",
    "-U", $DbUser,
    "-d", $Database,
    "-f", $containerSqlPath
)
& docker @execArgs
$code = $LASTEXITCODE

# 4) Cleanup (container + host)
& docker exec $ContainerName rm -f $containerSqlPath | Out-Null
Remove-Item -LiteralPath $destTemp -Force -ErrorAction SilentlyContinue

if ($code -ne 0) {
    Write-Error "psql exited with code $code"
    exit $code
}

Write-Host "Localization schema applied successfully." -ForegroundColor Green

# Best-effort wipe of plain-text password variable
if ($DbPassword) { Remove-Variable DbPassword -ErrorAction SilentlyContinue }
