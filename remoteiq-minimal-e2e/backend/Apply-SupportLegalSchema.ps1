<# 
  Apply-SupportLegalSchema.ps1
  --------------------------------------------------------------------
  Usage:
    .\Apply-SupportLegalSchema.ps1 `
      -ContainerName "backend-postgres-1" `
      -Database "remoteiq" `
      -DbUser "remoteiq"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ContainerName,

    [Parameter(Mandatory = $true)]
    [string]$Database,

    [Parameter(Mandatory = $true)]
    [string]$DbUser
)

function Get-PlainTextFromSecureString {
    param([Parameter(Mandatory = $true)][securestring]$Secure)
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

# --- Prompt for password securely ---
$secure = Read-Host -AsSecureString -Prompt "Postgres password for user '$DbUser'"
$Password = Get-PlainTextFromSecureString -Secure $secure  # (plain for env var to docker exec)

# --- Compose SQL in a temp file ---
$localSqlPath = Join-Path $env:TEMP "support_legal_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
$sql = @"
-- Support & Legal single-row settings table
CREATE TABLE IF NOT EXISTS support_legal_settings (
  id                integer PRIMARY KEY,
  support_email     text,
  support_phone     text,
  support_url       text,
  status_page_url   text,
  kb_url            text,
  terms_url         text,
  privacy_url       text,
  gdpr_contact      text,
  dmca_contact      text,
  show_chat_widget  boolean DEFAULT false,
  chat_widget_code  text,
  updated_at        timestamptz DEFAULT now()
);

-- Seed a single row if absent (id = 1)
INSERT INTO support_legal_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM support_legal_settings WHERE id = 1);
"@

Set-Content -LiteralPath $localSqlPath -Value $sql -Encoding UTF8 -NoNewline

Write-Host "Applying Support & Legal schema to container '$ContainerName', database '$Database'..."

# --- Copy SQL into container ---
$inContainer = "/tmp/support_legal.sql"
$dest = ("{0}:{1}" -f $ContainerName, $inContainer)

docker cp $localSqlPath $dest
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $localSqlPath -ErrorAction SilentlyContinue
    Write-Error "Failed to apply Support & Legal schema: docker cp failed with code $LASTEXITCODE"
    exit 1
}

# --- Exec psql to apply file ---
# Note: the official postgres image includes psql. We pass PGPASSWORD via env var.
docker exec -e "PGPASSWORD=$Password" $ContainerName `
    psql -U "$DbUser" -d "$Database" -f "$inContainer"

if ($LASTEXITCODE -ne 0) {
    # Attempt cleanup in container anyway
    docker exec $ContainerName sh -lc "rm -f '$inContainer'" | Out-Null
    Remove-Item -LiteralPath $localSqlPath -ErrorAction SilentlyContinue
    Write-Error "Failed to apply Support & Legal schema: psql exited with code $LASTEXITCODE"
    exit 1
}

# --- Cleanup temp SQL (container + local) ---
docker exec $ContainerName sh -lc "rm -f '$inContainer'" | Out-Null
Remove-Item -LiteralPath $localSqlPath -ErrorAction SilentlyContinue

Write-Host "Support & Legal schema applied successfully." -ForegroundColor Green
