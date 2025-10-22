param(
    [string]$Container = "",                 # leave blank to auto-detect
    [string]$User = "remoteiq",
    [SecureString]$Password,                 # SecureString to avoid plaintext warning
    [string]$Database = "remoteiq",
    [string]$Network = "remoteiq-net",
    [string]$ImageTag = "postgres:16"       # adjust if you change the image tag
)

$ErrorActionPreference = "Stop"

# If no password passed, default to 'remoteiqpass' (convert to SecureString)
if (-not $PSBoundParameters.ContainsKey('Password')) {
    $Password = ConvertTo-SecureString 'remoteiqpass' -AsPlainText -Force
}

# Helper: convert SecureString -> plain text only inside this script for docker exec/psql
function Get-PlainPassword([SecureString]$sec) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
}

$PasswordPlain = Get-PlainPassword $Password

function Get-ContainerName {
    param([string]$Network, [string]$ImageTag)

    # Prefer container in given network + image
    $name = (docker ps --filter "network=$Network" --filter "ancestor=$ImageTag" --format "{{.Names}}" | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($name)) {
        # Fallback: any running container from the image
        $name = (docker ps --filter "ancestor=$ImageTag" --format "{{.Names}}" | Select-Object -First 1)
    }
    return $name
}

function Invoke-InContainer([string]$container, [string]$cmd) {
    docker exec -i $container bash -lc $cmd
}

if (-not $Container) {
    $Container = Get-ContainerName -Network $Network -ImageTag $ImageTag
}

if (-not $Container) {
    throw "Could not auto-detect a running Postgres container. Pass -Container <name> explicitly."
}

Write-Host "Using container: $Container"
Write-Host "Target DB: $Database (user: $User)"

# 1) Verify connectivity
Invoke-InContainer $Container "PGPASSWORD='$PasswordPlain' psql -v ON_ERROR_STOP=1 -U $User -d postgres -c 'SELECT version();'"

# 2) Create DB if missing
$checkDb = "SELECT 1 FROM pg_database WHERE datname = '$Database';"
$exists = Invoke-InContainer $Container "PGPASSWORD='$PasswordPlain' psql -tA -U $User -d postgres -c ""$checkDb"""
if (-not $exists) {
    Write-Host "Creating database '$Database'..."
    Invoke-InContainer $Container "PGPASSWORD='$PasswordPlain' createdb -U $User $Database"
}
else {
    Write-Host "Database '$Database' already exists."
}

# 3) SQL to apply
$Sql = @"
CREATE TABLE IF NOT EXISTS company_profile (
  id         integer PRIMARY KEY,
  name       text    NOT NULL,
  legal_name text,
  email      text,
  phone      text,
  fax        text,
  website    text,
  vat_tin    text,
  address1   text,
  address2   text,
  city       text,
  state      text,
  postal     text,
  country    text
);

INSERT INTO company_profile (id, name)
SELECT 1, 'Your Company'
WHERE NOT EXISTS (SELECT 1 FROM company_profile WHERE id = 1);
"@

# 4) Copy SQL into container & execute
$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $Sql -NoNewline -Encoding UTF8
docker cp $tmp "${Container}:/tmp/company_profile.sql"
Invoke-InContainer $Container "PGPASSWORD='$PasswordPlain' psql -v ON_ERROR_STOP=1 -U $User -d $Database -f /tmp/company_profile.sql"
Invoke-InContainer $Container "rm -f /tmp/company_profile.sql" | Out-Null
Remove-Item $tmp -Force

# 5) Verify schema + row
Invoke-InContainer $Container "PGPASSWORD='$PasswordPlain' psql -U $User -d $Database -c '\d+ company_profile'"
Invoke-InContainer $Container "PGPASSWORD='$PasswordPlain' psql -U $User -d $Database -c 'SELECT * FROM company_profile;'"

Write-Host "✅ company_profile schema applied and verified."
