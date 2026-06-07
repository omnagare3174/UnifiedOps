# Load dev\.env into the current PowerShell session as $env:* vars.
# Sourced by every run-*.ps1 launcher so the launchers have no hard-coded
# tokens / ports / buckets - everything flows from the single .env file.
$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) {
    Write-Host "FATAL: $envFile not found - cannot load env" -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $name  = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    Set-Item -Path "env:$name" -Value $value
}
