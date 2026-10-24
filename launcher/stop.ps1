# Stops everything start.ps1 launched.
$Host.UI.RawUI.WindowTitle = 'Foundation - Stopping'
$root    = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'apps\backend'
$env:npm_config_loglevel = 'error'

Write-Host 'Closing Foundation, functions and web dashboard...' -ForegroundColor Cyan
# the installed app keeps running in the system tray when its window is closed
Get-Process Foundation -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" |
  Where-Object { $_.CommandLine -match 'supabase functions serve|@first2apply/webapp dev|pnpm start' } |
  ForEach-Object { taskkill /PID $_.ProcessId /T /F *> $null }

Write-Host 'Stopping database...' -ForegroundColor Cyan
Set-Location $backend
npx supabase stop

Write-Host 'Stopped.' -ForegroundColor Green
Start-Sleep -Seconds 3
