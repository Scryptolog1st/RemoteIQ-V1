<# 
.SYNOPSIS
  Inspect a Postgres DB running in Docker (no local psql required).
  Writes a full report to a text file and prints a brief summary.

.PARAMETER Output
  Output file path (UTF-8). Default: db-inspect.txt

.PARAMETER Container
  Optional explicit container name (e.g. "remoteiq-minimal-e2e-postgres-1" or just "postgres").
  If omitted, the script tries to auto-detect a running Postgres container.

.PARAMETER DbUser
  Database user. Default: remoteiq

.PARAMETER DbPass
  Database password. Default: remoteiqpass

.PARAMETER DbName
  Database name. Default: remoteiq
#>

[CmdletBinding()]
param(
    [string]$Output = "db-inspect.txt",
    [string]$Container = "",
    [string]$DbUser = "remoteiq",
    [string]$DbPass = "remoteiqpass",
    [string]$DbName = "remoteiq"
)

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Name)
    try { Get-Command -Name $Name -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

if (-not (Test-CommandExists -Name "docker")) {
    throw "Docker CLI not found. Please install/start Docker Desktop."
}

# Auto-detect a running Postgres container if not specified
if ([string]::IsNullOrWhiteSpace($Container)) {
    $candidates = docker ps --format '{{.Names}}|{{.Image}}' |
    Where-Object { $_ -match 'postgres' } |
    ForEach-Object {
        $parts = $_.Split('|', 2)
        [PSCustomObject]@{ Name = $parts[0]; Image = $parts[1] }
    }

    if (-not $candidates -or $candidates.Count -eq 0) {
        throw "No running Postgres containers found. Start docker-compose first."
    }

    # Prefer images that start with "postgres:"; otherwise take the first 'postgres' match.
    $preferred = $candidates | Where-Object { $_.Image -match '^postgres:(\d+|\w+)' }
    $pick = if ($preferred) { $preferred[0] } else { $candidates[0] }

    $Container = $pick.Name
    Write-Host "Auto-detected Postgres container: $Container (image: $($pick.Image))" -ForegroundColor Cyan
}

# ---------- The SQL to run (pure SQL; no psql meta commands) ----------
$Sql = @'
-- ==== OVERVIEW: TABLES ====
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type='BASE TABLE'
  AND table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name;

-- ==== COLUMNS ====
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY c.table_schema, c.table_name, c.ordinal_position;

-- ==== INDEXES ====
SELECT schemaname AS schema, tablename AS table, indexname AS index, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, indexname;

-- ==== CONSTRAINTS ====
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
 AND kcu.constraint_schema = tc.constraint_schema
WHERE tc.table_schema NOT IN ('pg_catalog','information_schema')
GROUP BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;

-- ==== FOREIGN KEYS ====
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name       AS fk_column,
  ccu.table_schema      AS ref_schema,
  ccu.table_name        AS ref_table,
  ccu.column_name       AS ref_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- ==== TARGETED CHECKS (roles/users) ====

-- Does roles table exist?
SELECT to_regclass('public.roles') AS roles_regclass;

-- If roles exists, show columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='roles'
ORDER BY ordinal_position;

-- Indexes on roles (expect a CI unique on lower(name))
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='roles'
ORDER BY indexname;

-- Does users table exist?
SELECT to_regclass('public.users') AS users_regclass;

-- If users exists, show users.role_id presence
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='users' AND column_name='role_id';

-- Count of users per role (only if users.role_id exists)
WITH chk AS (
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='users' AND column_name='role_id'
  ) AS ok
)
SELECT r.id, r.name, COALESCE(u.c,0) AS users_count
FROM roles r
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS c FROM users u WHERE u.role_id = r.id
) u ON TRUE
WHERE (SELECT ok FROM chk)
ORDER BY r.name;

-- Detect a many-to-many join table user_roles (optional)
SELECT to_regclass('public.user_roles') AS user_roles_regclass;

-- If user_roles exists, show columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='user_roles'
ORDER BY ordinal_position;

-- If user_roles exists, count users per role via join
WITH chk AS (
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname='user_roles' AND relnamespace = 'public'::regnamespace) AS ok
)
SELECT r.id, r.name, COALESCE(ur.c,0) AS users_count_via_join
FROM roles r
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS c FROM user_roles ur WHERE ur.role_id = r.id
) ur ON TRUE
WHERE (SELECT ok FROM chk)
ORDER BY r.name;
'@

# ---------- Run psql inside the container ----------
Write-Host "Running schema inspection in container '$Container'..." -ForegroundColor Cyan

# We set PGPASSWORD to avoid prompt; connect via localhost inside container.
try {
    $result = Get-Content -LiteralPath ([System.IO.Path]::GetTempFileName()) -ErrorAction SilentlyContinue | Out-Null
    $tmp = New-TemporaryFile
    Set-Content -LiteralPath $tmp -Value $Sql -Encoding UTF8

    $result = Get-Content -LiteralPath $tmp -Raw |
    docker exec -i `
        -e "PGPASSWORD=$DbPass" `
        $Container `
        psql -U $DbUser -d $DbName -h localhost -f - 2>&1

}
finally {
    if ($tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

# Normalize to array for piping
if ($result -isnot [System.Array]) { $result = @($result) }

# Write full report
$result | Out-File -FilePath $Output -Encoding utf8

# Brief summary to console
Write-Host "`n==== Summary (key checks) ====" -ForegroundColor Green
($result | Select-String -SimpleMatch "roles_regclass" -Context 0, 1) | ForEach-Object { $_.ToString() } | Write-Host
($result | Select-String -SimpleMatch "users_regclass" -Context 0, 1) | ForEach-Object { $_.ToString() } | Write-Host
($result | Select-String -SimpleMatch "public | roles" ) | ForEach-Object { $_.ToString() } | Write-Host

$fullPath = (Resolve-Path -LiteralPath $Output).Path
Write-Host "`nFull report written to: $fullPath" -ForegroundColor Yellow
Write-Host "Done."
