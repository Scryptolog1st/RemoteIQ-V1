<# 
.SYNOPSIS
  Concatenate selected RemoteIQ FRONTEND files into one labeled text file.

.PARAMETER RepoRoot
  Path to the frontend repo root (folder that contains app/, components/, lib/, etc.). Defaults to current dir.

.PARAMETER Output
  Path to the output text file. Defaults to ./2fa-frontend-bundle.txt

.PARAMETER Strict
  When set, ONLY bundle the exact paths listed. No fallbacks.

.NOTES
  Preserves file contents verbatim using -Raw. Each file section is delimited with BEGIN/END banners.
#>

param(
    [string]$RepoRoot = ".",
    [string]$Output = "2fa-frontend-bundle.txt",
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
        ""  # blank line between sections
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

# FRONTEND target files (relative to $RepoRoot)
$files = @(
    # Auth flow + routing
    "app\(auth)\login\page.tsx",
    "middleware.ts",
    "app\hooks\useRequireAuth.ts",

    # API + session helpers
    "lib\api.ts",
    "lib\auth.ts",
    "lib\toast.tsx",

    # 2FA UI + sessions
    "app\account\tabs\SecurityTab.tsx",
    "app\account\tabs\SessionsTab.tsx",

    # Optional OTP input (if present)
    "components\otp-input.tsx",

    # Providers that may affect login/session
    "app\providers\BrandingProvider.tsx"
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

# Fallbacks only if NOT Strict
if (-not $Strict) {
    # Try to include any OTP component variants if the canonical path was missing
    if ($missing -contains "components\otp-input.tsx") {
        $otpDir = Join-Path $RepoRoot "components"
        $fallbacks = Get-ChildItem -Path $otpDir -Filter "*otp*.tsx" -Recurse -ErrorAction SilentlyContinue
        foreach ($f in $fallbacks) {
            $relPath = $f.FullName.Substring((Resolve-Path $RepoRoot).Path.Length).TrimStart('\', '/')
            $content = Get-Content -LiteralPath $f.FullName -Raw
            Add-Section -Path $relPath -Content $content
        }
    }
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

Write-Host "Frontend bundle written to: $((Resolve-Path $Output).Path)"
if ($missing.Count -gt 0) {
    Write-Warning "Some files were missing. See inline markers and summary."
}
