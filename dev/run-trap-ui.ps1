# Dev trap-sender UI - on-demand syslog packet generator
. (Join-Path $PSScriptRoot 'load-env.ps1')

$env:UNIFIEDOPS_TRAP_UI_HOST = $env:TRAP_UI_HOST
$env:UNIFIEDOPS_TRAP_UI_PORT = $env:TRAP_UI_PORT

$root = Split-Path -Parent $PSScriptRoot
& "$root\.venv\Scripts\python.exe" "$root\dev\trap_sender_ui.py"
