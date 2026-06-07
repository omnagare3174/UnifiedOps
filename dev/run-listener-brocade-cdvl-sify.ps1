$env:HITRACK_INFLUX_URL    = 'http://127.0.0.1:8186'
$env:HITRACK_INFLUX_TOKEN  = 'unifiedops-dev-token-brocade-cdvl'
$env:HITRACK_INFLUX_ORG    = 'HDFC'
$env:HITRACK_INFLUX_BUCKET = 'Brocade_CDVL_Bucket'
$env:HITRACK_LISTEN_HOST   = '127.0.0.1'
$env:HITRACK_LISTEN_PORT   = '5214'
$env:HITRACK_TEST_MODE     = '1'

# Heartbeat (CDVL site - Brocade listener)
$env:HITRACK_HEARTBEAT_URL      = 'http://127.0.0.1:8486'
$env:HITRACK_HEARTBEAT_TOKEN    = 'unifiedops-dev-token-heartbeat-cdvl'
$env:HITRACK_HEARTBEAT_ORG      = 'HDFC'
$env:HITRACK_HEARTBEAT_BUCKET   = 'CDVL_Heartbeat_Bucket'
$env:HITRACK_HEARTBEAT_INTERVAL = '10'

$root = Split-Path -Parent $PSScriptRoot
& "$root\.venv\Scripts\python.exe" "$root\listener\syslog_trap_listener_cdvl_n_sify.py"
