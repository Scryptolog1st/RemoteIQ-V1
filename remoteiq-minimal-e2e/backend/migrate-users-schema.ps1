# migrate-users-schema.ps1
# Usage:
# .\migrate-users-schema.ps1 -DbHost "localhost" -Port 5432 -Database "remoteiq" -User "postgres" -Password (Read-Host "DB Password" -AsSecureString)

param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$Database = "remoteiq",
    [string]$User = "postgres",
    [SecureString]$Password
)

function Fail($msg) {
    Write-Error $msg
    exit 1
}

# Ensure psql exists
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Fail "psql not found. Install PostgreSQL client tools and ensure 'psql' is on PATH."
}

# Prompt for password if not supplied
if (-not $Password) {
    $Password = Read-Host -AsSecureString "Enter password for user '$User'"
}

# Helper: convert SecureString -> plain text (minimize lifetime)
function ConvertTo-PlainText([SecureString]$sec) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# --- SQL to apply (single-quoted here-string, no variable expansion) ---
$sql = @'
-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ROLES table (id, name)
CREATE TABLE IF NOT EXISTS roles (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- USERS table expected by the NestJS service
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  email                 TEXT        NOT NULL UNIQUE,
  role                  TEXT        NOT NULL DEFAULT 'User',
  status                TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','invited')),
  two_factor_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  last_seen             TIMESTAMPTZ NULL,
  password_hash         TEXT        NULL,
  password_updated_at   TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at'
  ) THEN
    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;

-- Seed roles
INSERT INTO roles (name) VALUES ('Owner'), ('Admin'), ('User')
ON CONFLICT (name) DO NOTHING;

-- Seed an example user
INSERT INTO users (name, email, role, status, two_factor_enabled)
VALUES ('Super Admin', 'admin@example.com', 'Owner', 'active', false)
ON CONFLICT (email) DO NOTHING;
'@

# --- Execute ---------------------------------------------------------------
$plain = ConvertTo-PlainText $Password
$env:PGPASSWORD = $plain

$commonArgs = @(
    "-h", $DbHost,
    "-p", $Port,
    "-U", $User,
    "-d", $Database,
    "-v", "ON_ERROR_STOP=1",
    "-X"  # do not read .psqlrc
)

try {
    # FIX: use -f formatting to avoid $DbHost:$Port scope-parsing issue
    Write-Host ("Applying migration to {0}@{1}:{2} as {3}..." -f $Database, $DbHost, $Port, $User)
    $sql | & psql @commonArgs --quiet
    if ($LASTEXITCODE -ne 0) { Fail "psql exited with code $LASTEXITCODE" }
    Write-Host "✅ Migration complete."
}
catch {
    Fail "Migration failed: $($_.Exception.Message)"
}
finally {
    # scrub password from env
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue | Out-Null
}
