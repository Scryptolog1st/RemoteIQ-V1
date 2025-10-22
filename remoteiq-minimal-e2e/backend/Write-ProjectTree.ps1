<# 
.SYNOPSIS
  Print a Unicode directory tree (dirs + files), excluding common folders, and write to a .txt file.

.EXAMPLE
  .\Write-ProjectTree.ps1
  # writes project-tree.txt in the current folder

.EXAMPLE
  .\Write-ProjectTree.ps1 -Depth 3 -Output ".\my-tree.txt"
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Path = ".",
    [int]$Depth = [int]::MaxValue,
    [string[]]$ExcludeDirs = @("node_modules", "dist"),  # default excludes
    [string[]]$ExcludeFiles = @(),                       # e.g. *.map,*.log
    [switch]$ShowHidden,
    [string]$Output = "project-tree.txt"                 # output file
)

function Test-ExcludedFile {
    param(
        [System.IO.FileInfo]$File,
        [string[]]$Patterns
    )
    if (-not $Patterns -or $Patterns.Count -eq 0) { return $false }
    foreach ($pat in $Patterns) {
        if ($File.Name -like $pat) { return $true }
    }
    return $false
}

function Write-Tree {
    param(
        [System.IO.DirectoryInfo]$Dir,
        [int]$CurrentDepth,
        [int]$MaxDepth,
        [string]$Prefix,
        [string[]]$ExcludeDirs,
        [string[]]$ExcludeFiles,
        [bool]$ShowHidden,
        [System.Collections.Generic.List[string]]$Lines
    )
    if ($CurrentDepth -ge $MaxDepth) { return }

    $getParams = @{ LiteralPath = $Dir.FullName; ErrorAction = 'SilentlyContinue' }
    if ($ShowHidden) { $getParams.Force = $true }

    # Directories first
    $dirs = Get-ChildItem @getParams -Directory |
    Where-Object { $ExcludeDirs -notcontains $_.Name } |
    Sort-Object Name

    # Then files
    $files = Get-ChildItem @getParams -File |
    Where-Object { -not (Test-ExcludedFile -File $_ -Patterns $ExcludeFiles) } |
    Sort-Object Name

    $children = @(); $children += $dirs; $children += $files

    for ($i = 0; $i -lt $children.Count; $i++) {
        $child = $children[$i]
        $isLast = ($i -eq ($children.Count - 1))
        $connector = if ($isLast) { "└── " } else { "├── " }
        $null = $Lines.Add("$Prefix$connector$($child.Name)")

        if ($child.PSIsContainer) {
            $nextPrefix = if ($isLast) { "$Prefix    " } else { "$Prefix│   " }
            Write-Tree -Dir $child -CurrentDepth ($CurrentDepth + 1) -MaxDepth $MaxDepth `
                -Prefix $nextPrefix -ExcludeDirs $ExcludeDirs -ExcludeFiles $ExcludeFiles `
                -ShowHidden:$ShowHidden -Lines $Lines
        }
    }
}

# Resolve root
try {
    $rootPath = (Resolve-Path -LiteralPath $Path).Path
}
catch {
    Write-Error "Path not found: $Path"
    exit 1
}

$rootItem = Get-Item -LiteralPath $rootPath -ErrorAction Stop
if (-not $rootItem.PSIsContainer) {
    Write-Error "Path must be a directory: $($rootItem.FullName)"
    exit 1
}

# Build output lines
$lines = New-Object System.Collections.Generic.List[string]
$null = $lines.Add($rootItem.Name)

Write-Tree -Dir $rootItem -CurrentDepth 0 -MaxDepth $Depth -Prefix "" `
    -ExcludeDirs $ExcludeDirs -ExcludeFiles $ExcludeFiles -ShowHidden:$ShowHidden -Lines $lines

# Write to file (UTF-8)
$outFull = Resolve-Path -LiteralPath (Join-Path -Path (Get-Location) -ChildPath $Output) -ErrorAction SilentlyContinue
$target = if ($outFull) { $outFull.Path } else { (Join-Path -Path (Get-Location) -ChildPath $Output) }
$lines | Out-File -FilePath $target -Encoding utf8

Write-Host "Saved project tree to: $target"
