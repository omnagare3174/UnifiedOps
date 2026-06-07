# Restart only the components that picked up code changes:
#   - 6 placeholder listeners (NetApp + Dell)
#   - Backend (dashboard get_severity rewrite)
#   - Trap sender UI (new VENDOR_TARGETS keys + larger catalogues)
#
# Hitachi + Brocade listeners and the 3 main syslog listeners are
# unchanged, so we leave them running.

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root '.venv\Scripts\python.exe'

function Stop-Service-By-Script {
    param([string]$ScriptName)
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -match [regex]::Escape($ScriptName) } |
        ForEach-Object {
            Write-Host "stopping PID $($_.ProcessId) :: $ScriptName"
            try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
        }
}

# 1. Stop the changed services.
$ChangedListeners = @(
    'syslog_trap_listener_netapp_cdvl.py',
    'syslog_trap_listener_netapp_bcp.py',
    'syslog_trap_listener_netapp_sify.py',
    'syslog_trap_listener_dell_cdvl.py',
    'syslog_trap_listener_dell_bcp.py',
    'syslog_trap_listener_dell_sify.py'
)
foreach ($l in $ChangedListeners) { Stop-Service-By-Script $l }
Stop-Service-By-Script 'server\server.py'
Stop-Service-By-Script 'dev\trap_sender_ui.py'

Start-Sleep -Seconds 2

# 2. Restart the listeners. Each launcher script lives in dev\ and
#    sets the correct HITRACK_* env before exec-ing the listener.
$Launchers = @(
    'run-listener-netapp-cdvl.ps1',
    'run-listener-netapp-bcp.ps1',
    'run-listener-netapp-sify.ps1',
    'run-listener-dell-cdvl.ps1',
    'run-listener-dell-bcp.ps1',
    'run-listener-dell-sify.ps1'
)
foreach ($lp in $Launchers) {
    $path = Join-Path $PSScriptRoot $lp
    if (-not (Test-Path $path)) { continue }
    Write-Host "start $lp"
    Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' `
        -ArgumentList '-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',$path
    Start-Sleep -Milliseconds 300
}

# 3. Restart backend.
$BackendScript = Join-Path $PSScriptRoot 'run-backend.ps1'
Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' `
    -ArgumentList '-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',$BackendScript
Write-Host 'start backend'

# 4. Restart trap-sender UI.
$TrapUi = Join-Path $Root 'dev\trap_sender_ui.py'
Start-Process -WindowStyle Hidden -FilePath $Venv -ArgumentList $TrapUi
Write-Host 'start trap_sender_ui'

Start-Sleep -Seconds 3

Write-Host ''
Write-Host '--- post-restart processes ---'
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'UnifiedOpsv2_dev' } |
    Select-Object ProcessId, @{n='cmd';e={ ($_.CommandLine -split '\\')[-1] }} |
    Sort-Object cmd
