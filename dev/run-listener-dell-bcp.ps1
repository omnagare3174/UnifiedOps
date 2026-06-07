$env:HITRACK_INFLUX_URL    = 'http://127.0.0.1:8387'
$env:HITRACK_INFLUX_TOKEN  = 'unifiedops-dev-token-dell-bcp'
$env:HITRACK_INFLUX_ORG    = 'HDFC'
$env:HITRACK_INFLUX_BUCKET = 'Dell_BCP_Bucket'
$env:HITRACK_LISTEN_HOST   = '127.0.0.1'
$env:HITRACK_LISTEN_PORT   = '5415'
$env:HITRACK_TEST_MODE     = '1'

# Heartbeat (BCP site)
$env:HITRACK_HEARTBEAT_URL      = 'http://127.0.0.1:8487'
$env:HITRACK_HEARTBEAT_TOKEN    = 'unifiedops-dev-token-heartbeat-bcp'
$env:HITRACK_HEARTBEAT_ORG      = 'HDFC'
$env:HITRACK_HEARTBEAT_BUCKET   = 'BCP_Heartbeat_Bucket'
$env:HITRACK_HEARTBEAT_INTERVAL = '10'

$root = Split-Path -Parent $PSScriptRoot
& "$root\.venv\Scripts\python.exe" "$root\listener\syslog_trap_listener_dell_bcp.py"
