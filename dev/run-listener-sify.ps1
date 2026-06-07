$env:HITRACK_INFLUX_URL    = 'http://127.0.0.1:8088'
$env:HITRACK_INFLUX_TOKEN  = 'unifiedops-dev-token-sify'
$env:HITRACK_INFLUX_ORG    = 'HDFC'
$env:HITRACK_INFLUX_BUCKET = 'Hitachi_SIFY_Bucket'
$env:HITRACK_LISTEN_HOST   = '127.0.0.1'
$env:HITRACK_LISTEN_PORT   = '5516'
$env:HITRACK_TEST_MODE     = '1'

# Heartbeat (SIFY site)
$env:HITRACK_HEARTBEAT_URL      = 'http://127.0.0.1:8488'
$env:HITRACK_HEARTBEAT_TOKEN    = 'unifiedops-dev-token-heartbeat-sify'
$env:HITRACK_HEARTBEAT_ORG      = 'HDFC'
$env:HITRACK_HEARTBEAT_BUCKET   = 'SIFY_Heartbeat_Bucket'
$env:HITRACK_HEARTBEAT_INTERVAL = '10'

$root = Split-Path -Parent $PSScriptRoot
& "$root\.venv\Scripts\python.exe" "$root\listener\syslog_trap_listener_sify.py"
