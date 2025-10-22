<#
.SYNOPSIS
  Export a simple directory tree (ASCII) to a .txt file, honoring excludes.
#>

[CmdletBinding()]
param (
  [Parameter(Position=0)]
  [string]$Root = ".",
  [Parameter(Position=1)]
  [string]$Out = "project-tree.txt",
  [int]$MaxDepth = 0,        # 0 = unlimited
  [switch]$IncludeHidden,
  [string[]]$Exclude = @(
    ".git", ".github", ".gitlab", ".idea", ".vscode", ".vs",
    "node_modules", ".pnpm-store", ".cache", ".turbo", "coverage",
    "dist", "build", "out", ".next", ".nuxt", ".parcel-cache",
    "*.log", "*.tmp", "*.swp", "*.DS_Store", "Thumbs.db"
  )
)

function Resolve-NormalPath { param([string]$Path)
  try { return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path }
  catch { throw "Path not found: $Path" }
}

function Convert-ToRelative { param([string]$Base, [string]$Full)
  $baseItem = Get-Item -LiteralPath $Base -ErrorAction Stop
  $fullItem = Get-Item -LiteralPath $Full -ErrorAction Stop
  $baseUri = $baseItem.FullName.TrimEnd('\') + '\'
  $fullUri = $fullItem.FullName
  if ($fullUri.StartsWith($baseUri, [System.StringComparison]::OrdinalIgnoreCase)) { return $fullUri.Substring($baseUri.Length) }
  return $Full
}

function Test-Excluded { param([string]$RelativePath, [string[]]$Patterns)
  $rel = $RelativePath -replace '\\','/'
  foreach ($p in $Patterns) {
    $pat = $p -replace '\\','/'
    if ($rel -like $pat) { return $true }
    $parts = $rel.Split('/')
    for ($i=0; $i -lt $parts.Count; $i++) {
      $head = ($parts[0..$i] -join '/')
      if ($head -like $pat) { return $true }
    }
  }
  return $false
}

function Get-TreeLines {
  param(
    [string]$BasePath,[string]$CurrentPath,[int]$Depth,[int]$MaxDepth,
    [string[]]$Exclude,[switch]$IncludeHidden,[string[]]$PrefixParts = @()
  )
  $items = Get-ChildItem -LiteralPath $CurrentPath -Force:$IncludeHidden -ErrorAction SilentlyContinue |
           Sort-Object { -not $_.PSIsContainer }, Name

  # Exclude by relative path
  $items = $items | Where-Object {
    $rel = Convert-ToRelative -Base $BasePath -Full $_.FullName
    -not (Test-Excluded -RelativePath $rel -Patterns $Exclude)
  }

  $lastIndex = $items.Count - 1
  $i = 0
  foreach ($item in $items) {
    $isLast = ($i -eq $lastIndex)
    $branch = if ($isLast) { '└── ' } else { '├── ' }

    $prefix = ''
    foreach ($p in $PrefixParts) { $prefix += $p }

    if ($item.PSIsContainer) {
      [void]$script:Lines.Add("$prefix$branch$($item.Name)/")
      if ($MaxDepth -eq 0 -or $Depth -lt $MaxDepth) {
        $childPrefixParts = @($PrefixParts + @( if ($isLast) { '    ' } else { '│   ' } ))
        Get-TreeLines -BasePath $BasePath -CurrentPath $item.FullName -Depth ($Depth + 1) -MaxDepth $MaxDepth -Exclude $Exclude -IncludeHidden:$IncludeHidden -PrefixParts $childPrefixParts
      }
    } else {
      [void]$script:Lines.Add("$prefix$branch$($item.Name)")
    }

    $i++
  }
}

# ---- Main ----
$ErrorActionPreference = 'Stop'
$rootPath = Resolve-NormalPath $Root
$Out = [System.IO.Path]::GetFullPath($Out)

$script:Lines = New-Object System.Collections.Generic.List[string]
$script:Lines.Add("Project: $(Split-Path -Leaf $rootPath)")
$script:Lines.Add("Root:    $rootPath")
$script:Lines.Add("Date:    $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$script:Lines.Add("Excl:    " + ($Exclude -join ', '))
$script:Lines.Add("")
$script:Lines.Add("./")

Get-TreeLines -BasePath $rootPath -CurrentPath $rootPath -Depth 1 -MaxDepth $MaxDepth -Exclude $Exclude -IncludeHidden:$IncludeHidden -PrefixParts @()

$newDir = Split-Path -Parent $Out
if (-not (Test-Path -LiteralPath $newDir)) { New-Item -ItemType Directory -Path $newDir | Out-Null }
$script:Lines -join [Environment]::NewLine | Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host "Tree written to: $Out" -ForegroundColor Green
