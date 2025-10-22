<# 
.SYNOPSIS
  Concatenate selected RemoteIQ BACKEND (NestJS, raw SQL) files into one labeled text file.

.PARAMETER RepoRoot
  Path to the backend repo root (folder that contains src/, migrations/, etc.). Defaults to current dir.

.PARAMETER Output
  Path to the output text file. Defaults to ./2fa-backend-bundle.txt

.PARAMETER Strict
  When set, ONLY bundle the exact paths listed. No fallbacks.

.NOTES
  Preserves file contents verbatim using -Raw. Each file section is delimited with BEGIN/END banners.
#>

param(
    [string]$RepoRoot = ".",
    [string]$Output = "2fa-backend-bundle.txt",
    [switch]$Strict
)

$ErrorActionPreference = "Stop"

function Add-Section {
    param(
        [string]$Path,
        [string]$Content
    )
    $bannerTop = "########## BEGIN FILE: $Path ##########"
    $bannerBot = "########## END FILE:   $Path ##########"
    $section = @(
        $bannerTop
        $Content
        $bannerBot
        ""
    ) -join [Environment]::NewLine
    $section | Out-File -FilePath $Output -Append -Encoding utf8
}

function Add-MissingSection {
    param([string]$Path)
    $bannerTop = "########## BEGIN FILE: $Path ##########"
    $bannerBot = "########## END FILE:   $Path ##########"
    $msg = "!! Missing file: $Path !!"
    $section = @(
        $bannerTop
        $msg
        $bannerBot
        ""
    ) -join [Environment]::NewLine
    $section | Out-File -FilePath $Output -Append -Encoding utf8
}

# BACKEND target files (relative to $RepoRoot)
$files = @(
    # Auth core
    "src\auth\auth.module.ts",
    "src\auth\auth.controller.ts",
    "src\auth\auth.service.ts",
    "src\auth\dto\login.dto.ts",
    "src\auth\auth-cookie.middleware.ts",
    "src\auth\auth-cookie.guard.ts",

    # Users / 2FA surfaces
    "src\users\security.controller.ts",
    "src\users\security.service.ts",
    "src\users\me.controller.ts",
    "src\users\me.service.ts",
    "src\users\users.service.ts",
    "src\users\users.controller.ts",

    # Common + storage + app
    "src\storage\pg-pool.service.ts",
    "src\storage\storage.module.ts",
    "src\common\guards\admin-api.guard.ts",
    "src\app.module.ts",
    "src\main.ts",

    # Config & env names (safe)
    ".env.example",

    # DB schema (raw SQL)
    "users-schema.sql",
    "users_schema_fix.sql",
    "migrations\001_users_passwords.sql",
    "migrations\XXXX_users_harden_ids.sql",
    "migrations\20251019_keep_current_model.sql",
    "migrations\20251019_roles_companion_meta.sql",
    "migrations\XXXX_add_users_roles.sql"
) | Sort-Object -Unique

# Reset output
"" | Out-File -FilePath $Output -Encoding utf8

$missing = @()

foreach ($rel in $files) {
    $full = Join-Path -Path $RepoRoot -ChildPath $rel
    if (Test-Path -LiteralPath $full) {
        $content = Get-Content -LiteralPath $full -Raw -ErrorAction Stop
        Add-Section -Path $rel -Content $content
    }
    else {
        $missing += $rel
        Add-MissingSection -Path $rel
    }
}

# Fallback sweep: only if NOT Strict
if (-not $Strict) {
    try {
        $migDir = Join-Path $RepoRoot "migrations"
        if (Test-Path $migDir) {
            $candidates = Get-ChildItem -Path $migDir -Filter "*.sql" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "(user|auth|two|2fa|trust|session|cookie)" }
            foreach ($f in $candidates) {
                $relPath = $f.FullName.Substring((Resolve-Path $RepoRoot).Path.Length).TrimStart('\', '/')
                $content = Get-Content -LiteralPath $f.FullName -Raw
                Add-Section -Path $relPath -Content $content
            }
        }
    }
    catch { }
}

# Summary footer
$summary = @()
$summary += "========== SUMMARY =========="
$summary += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$summary += "RepoRoot : $(Resolve-Path $RepoRoot)"
$summary += "Mode     : " + ($(if ($Strict) { "STRICT (no fallbacks)" } else { "Flexible (fallbacks allowed)" }))
if ($missing.Count -gt 0) {
    $summary += ""
    $summary += "Missing files (also noted inline above):"
    $missing | ForEach-Object { $summary += "  - $_" }
}
else {
    $summary += ""
    $summary += "All listed files were included."
}
($summary -join [Environment]::NewLine) | Out-File -FilePath $Output -Append -Encoding utf8

Write-Host "Backend bundle written to: $((Resolve-Path $Output).Path)"
if ($missing.Count -gt 0) {
    Write-Warning "Some files were missing. See inline markers and summary."
}
