# =============================================================================
#   UnifiedOps v2 - dev one-shot teardown
# -----------------------------------------------------------------------------
#   Stops everything start-all.ps1 spawned:
#     - All 11 syslog listener python processes
#     - The FastAPI backend
#     - The trap-sender UI
#     - The 14 InfluxDB containers (kept by default; pass -KeepPodman to
#       leave the data running)
#
#   Volumes are preserved unless you pass -Flush.
#
#   Usage:
#       .\stop-all.ps1                  # stop python + stop containers
#       .\stop-all.ps1 -KeepPodman      # only stop python services
#       .\stop-all.ps1 -Flush           # also wipe all Influx volumes
# =============================================================================
[CmdletBinding()]
param(
    [switch] $KeepPodman,
    [switch] $Flush
)

$ErrorActionPreference = 'Continue'

$DevDir = $PSScriptRoot

Write-Host '=== stop python services ===' -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'UnifiedOpsv2_dev' } |
    ForEach-Object {
        $tag = ($_.CommandLine -split '\\')[-1]
        Write-Host "  stop PID $($_.ProcessId)  $tag"
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
    }

if (-not $KeepPodman) {
    Write-Host ''
    Write-Host '=== stop podman containers ===' -ForegroundColor Cyan
    Push-Location $DevDir
    try {
        podman-compose --env-file .env -f podman-compose.yml down 2>&1 | ForEach-Object {
            Write-Host "  $_"
        }
    } finally {
        Pop-Location
    }
}

if ($Flush) {
    Write-Host ''
    Write-Host '=== flushing all influx volumes ===' -ForegroundColor Yellow
    podman volume ls --format '{{.Name}}' 2>$null |
        Where-Object { $_ -match '^influx-' } |
        ForEach-Object {
            Write-Host "  volume rm $_"
            podman volume rm $_ 2>$null | Out-Null
        }
}

Write-Host ''
Write-Host '=== final state ===' -ForegroundColor Green

$running = podman ps --format '{{.Names}}' 2>$null |
    Where-Object { $_ -match '^unifiedops-influx-' }
Write-Host ("  InfluxDB containers up:  {0}" -f ($running | Measure-Object).Count)

$pythonProcs = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'UnifiedOpsv2_dev' }
Write-Host ("  UnifiedOps python procs: {0}" -f ($pythonProcs | Measure-Object).Count)
