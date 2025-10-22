<#
.SYNOPSIS
  Apply UUID hardening migration to the Postgres DB running in Docker.

.DESCRIPTION
  - Securely prompts for DB credentials (or accepts -Credential).
  - Auto-detects the postgres container (or pass -ContainerName).
  - Resolves the SQL path from CWD or script directory.
  - Copies the SQL into the container and runs: psql -f /tmp/migrate.sql
  - Fails fast on errors, then prints a small verification query.
#>

[CmdletBinding()]
param(
    [string] $SqlFile = "",                # If omitted, picks newest *_users_harden_ids.sql under ./migrations next to this script
    [string] $ContainerName = "",          # e.g. "remoteiq-postgres-1"
    [string] $Database = "remoteiq",
    [string] $DbUser = "remoteiq",
    [System.Management.Automation.PSCredential] $Credential
)

function Get-PostgresContainer {
    param([string]$Hint)

    if ($Hint) {
        $exists = @(docker ps --format "{{.Names}}" | Where-Object { $_ -eq $Hint })
        if ($null -ne $exists -and $exists.Count -ge 1) { return $Hint }
    }

    $cands = @(docker ps --format "{{.Names}}" | Where-Object { $_ -match "(?i)postgres" })
    if ($cands.Count -eq 1) { return $cands[0] }

    $byImage = @(
        docker ps --format "{{.Names}}|{{.Image}}" |
        Where-Object { $_ -match '\|postgres(:|@|$)' } |
        ForEach-Object { ($_ -split '\|')[0] }
    )
    if ($byImage.Count -ge 1) { return $byImage[0] }
    if ($cands.Count -ge 1) { return $cands[0] }

    throw "Could not find a running postgres container. Is docker-compose up?"
}

# --- Determine SQL file if not provided
if (-not $SqlFile -or $SqlFile.Trim() -eq "") {
    $cand = Get-ChildItem -Path (Join-Path $PSScriptRoot "migrations") -Filter "*_users_harden_ids.sql" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
    if ($null -eq $cand) {
        throw "No '*_users_harden_ids.sql' found under '$(Join-Path $PSScriptRoot "migrations")'. Pass -SqlFile explicitly."
    }
    $SqlFile = $cand.FullName
}

# --- Resolve SQL path (CWD or script folder)
$orig = $SqlFile
if (Test-Path $orig) {
    $SqlFile = (Resolve-Path $orig).Path
}
else {
    $candidate = Join-Path $PSScriptRoot $orig
    if (Test-Path $candidate) {
        $SqlFile = (Resolve-Path $candidate).Path
    }
    else {
        throw "SQL file not found: $orig (also tried: $candidate)"
    }
}

# --- Find postgres container
$pg = Get-PostgresContainer -Hint $ContainerName
Write-Host "Using Postgres container: $pg"
Write-Host "Running SQL: $SqlFile`n"

# --- Obtain credentials (prompt if not supplied)
if (-not $Credential) {
    $Credential = Get-Credential -UserName $DbUser -Message "Enter password for database user '$DbUser'"
}
if ($Credential.UserName -and $Credential.UserName -ne $DbUser) {
    $DbUser = $Credential.UserName
}

# Convert SecureString to plain text only to set PGPASSWORD; clear immediately after
$pwBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Credential.Password)
try {
    $pwPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($pwBstr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pwBstr)
}

# --- Copy SQL into container & execute via -f (robust across CRLF/DO/\gexec issues)
$env:PGPASSWORD = $pwPlain
try {
    $dest = "/tmp/migrate.sql"
    docker cp $SqlFile "$pg`:$dest" | Out-Null
    docker exec -e PGPASSWORD=$env:PGPASSWORD $pg psql -U $DbUser -d $Database -v ON_ERROR_STOP=1 -f $dest
    $code = $LASTEXITCODE
}
finally {
    $env:PGPASSWORD = $null
    $pwPlain = $null
}

if ($code -ne 0) {
    throw "Migration failed (psql exit code $code)"
}

Write-Host "Migration applied successfully.`n"

# --- Optional quick check
docker exec $pg psql -U $DbUser -d $Database -c "SELECT id, email, role, status FROM users ORDER BY created_at DESC LIMIT 5;" | Out-Host
