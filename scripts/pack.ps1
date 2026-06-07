<#
.SYNOPSIS
    Pack UnifiedOpsv2_dev/ -> UnifiedOpsv2/ + UnifiedOpsv2.zip for the
    airgapped RHEL deployment.

.DESCRIPTION
    Builds the React frontend, stages everything the production VMs
    need (server source, listener source, frontend dist, systemd unit
    files, offline pip wheel cache, requirements.txt), drops the
    staged tree into the sibling `UnifiedOpsv2/` directory and zips it.

    Trap-sender is NOT included in production output. It lives only in
    the dev tree.

.PARAMETER OutDir
    Absolute path to the production output directory. Defaults to the
    sibling `UnifiedOpsv2/` of `UnifiedOpsv2_dev/`.

.PARAMETER SkipBuild
    Skip the `npm run build` step (use when dist/ is already current).

.PARAMETER SkipWheels
    Skip including `offline/pip-wheels-linux-py39` in the output.
#>
[CmdletBinding()]
param(
    [string] $OutDir,
    [switch] $SkipBuild,
    [switch] $SkipWheels
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
$dev = (Resolve-Path "$PSScriptRoot\..").Path
if (-not $OutDir) {
    $OutDir = (Resolve-Path "$dev\..").Path + '\UnifiedOpsv2'
}
$zip = $OutDir + '.zip'

Write-Host ""
Write-Host "=== UnifiedOpsv2 pack ==="
Write-Host ("  dev    : {0}" -f $dev)
Write-Host ("  output : {0}" -f $OutDir)
Write-Host ("  zip    : {0}" -f $zip)
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Build the React bundle (skip on -SkipBuild)
# ---------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "=== build frontend ==="
    Push-Location "$dev\frontend"
    npm run build 2>&1 | Select-Object -Last 6
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "frontend build failed (exit $LASTEXITCODE)" }
    Pop-Location
    Write-Host ""
} else {
    Write-Host "=== skipping frontend build (-SkipBuild) ==="
}

# ---------------------------------------------------------------------------
# 2. Stage the production tree (mirror, no dev junk)
# ---------------------------------------------------------------------------
if (Test-Path $OutDir) {
    Write-Host "=== wiping previous $OutDir ==="
    Remove-Item $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$copies = @(
    @{ src = "$dev\frontend\dist";  dst = "$OutDir\frontend\dist" },
    @{ src = "$dev\server";          dst = "$OutDir\server"        },
    @{ src = "$dev\listener";        dst = "$OutDir\listener"      },
    @{ src = "$dev\deploy";          dst = "$OutDir\deploy"        }
)

foreach ($c in $copies) {
    if (-not (Test-Path $c.src)) {
        Write-Host ("  WARN: $($c.src) does not exist - skipping")
        continue
    }
    Write-Host ("  copy {0,-30} -> {1}" -f (Split-Path $c.src -Leaf), $c.dst)
    $null = robocopy $c.src $c.dst /E /NFL /NDL /NJH /NJS /NC /NP /NS `
        /XD '__pycache__' '.venv' 'node_modules' '.vite' '.pytest_cache' `
        /XF '*.pyc' '*.pyo' '*.log' '.DS_Store' 'Thumbs.db'
}

# Offline wheels - rename to the canonical name used by INSTALL.md.
if (-not $SkipWheels) {
    $linWheels = "$dev\offline\pip-wheels-linux-py39"
    if (Test-Path $linWheels) {
        Write-Host ("  copy {0,-30} -> {1}" -f "offline/pip-wheels", "$OutDir\offline\pip-wheels")
        $null = robocopy $linWheels "$OutDir\offline\pip-wheels" /E /NFL /NDL /NJH /NJS /NC /NP /NS
    } else {
        Write-Host "  WARN: offline\pip-wheels-linux-py39 missing - production install will need internet"
    }
}

# Root-level files
$rootFiles = @(
    'VERSION', 'README.md', 'INSTALL.md', 'CHANGELOG.md'
)
foreach ($f in $rootFiles) {
    $src = Join-Path $dev $f
    if (Test-Path $src) {
        Copy-Item $src $OutDir
        Write-Host ("  copy {0}" -f $f)
    }
}

# requirements.txt lives next to server.py; surface it at the root for INSTALL.md.
if (Test-Path "$dev\server\requirements.txt") {
    Copy-Item "$dev\server\requirements.txt" "$OutDir\requirements.txt"
    Write-Host "  copy requirements.txt (from server/)"
}

# ---------------------------------------------------------------------------
# 3. Summary
# ---------------------------------------------------------------------------
$sizes = Get-ChildItem -Path $OutDir -Directory | ForEach-Object {
    $b = (Get-ChildItem -Path $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{ Name = $_.Name; MB = if ($b) { [math]::Round($b/1MB, 2) } else { 0 } }
}
Write-Host ""
Write-Host "=== staged tree ==="
$sizes | Sort-Object MB -Descending | ForEach-Object {
    Write-Host ("  {0,-18}  {1,8} MB" -f $_.Name, $_.MB)
}

# ---------------------------------------------------------------------------
# 4. Zip
# ---------------------------------------------------------------------------
if (Test-Path $zip) { Remove-Item $zip -Force }
Write-Host ""
Write-Host "=== creating $zip ==="
Compress-Archive -Path "$OutDir\*" -DestinationPath $zip -CompressionLevel Optimal -Force

$info = Get-Item $zip
$sizeMb    = "{0:N2}" -f ($info.Length/1MB)
$sizeBytes = "{0:N0}" -f $info.Length
Write-Host "  size: $sizeMb MB / $sizeBytes bytes"
Write-Host ""
Write-Host "=== done ==="


# Robocopy returns 0-7 for success-with-info, which PowerShell otherwise
# bubbles up as $LASTEXITCODE != 0 and downstream tooling treats as a
# failure. Force a clean exit when the zip was actually produced.
if (Test-Path $zip) { exit 0 } else { exit 1 }
