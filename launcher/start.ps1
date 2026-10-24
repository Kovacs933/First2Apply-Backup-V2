# One-click launcher for Foundation on this PC.
# Started by the "Start Foundation" shortcut on the Desktop.
#
# Starts the local backend (Docker, database, functions) in the background and opens the
# installed Foundation app. Use -Dev to instead open the developer tabs (function logs,
# web dashboard and the desktop app running from source).
param([switch]$Dev)

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Foundation Launcher'
$root    = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'apps\backend'
$probe   = Join-Path $root 'apps\desktopProbe'
$installedApp = Join-Path $env:LOCALAPPDATA 'foundation\Foundation.exe'
# Hide npm's harmless "Unknown project config" warnings from the pnpm .npmrc
$env:npm_config_loglevel = 'error'

function Fail($msg) {
  Write-Host "`n$msg" -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}

$useInstalledApp = -not $Dev -and (Test-Path $installedApp)
if (-not $useInstalledApp -and -not (Get-Command wt -ErrorAction SilentlyContinue)) {
  Fail 'Windows Terminal (wt) was not found on this PC.'
}

# 1. Docker
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '[1/3] Starting Docker Desktop...' -ForegroundColor Cyan
  Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 3
    docker info *> $null
    if ((Get-Date) -gt $deadline) { Fail 'Docker did not start within 3 minutes.' }
  } while ($LASTEXITCODE -ne 0)
} else {
  Write-Host '[1/3] Docker already running.' -ForegroundColor DarkGray
}

# 2. Supabase (local database)
# After a Docker restart the old containers come back on their own and take a
# moment to boot, so wait for them instead of treating "starting" as a failure.
Set-Location $backend
Write-Host '[2/3] Starting database...' -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(4)
$startTried = $false
while ($true) {
  npx supabase status *> $null
  if ($LASTEXITCODE -eq 0) { break }
  $dbHealth = docker inspect -f '{{.State.Health.Status}}' supabase_db_first2apply 2> $null
  if ($dbHealth -ne 'starting' -and -not $startTried) {
    npx supabase start
    $startTried = $true
  } else {
    Write-Host '      waiting for the database to finish booting...' -ForegroundColor DarkGray
  }
  if ((Get-Date) -gt $deadline) { Fail 'The database did not come up within 4 minutes (see output above).' }
  Start-Sleep -Seconds 5
}
Write-Host '      Database is up.' -ForegroundColor DarkGray

$functionsCommand = 'npx supabase functions serve --env-file ./supabase/functions/.env'

if ($useInstalledApp) {
  # 3. Functions in the background (logs go to launcher\functions.log), then the installed app
  Write-Host '[3/3] Opening Foundation...' -ForegroundColor Cyan
  $functionsRunning = Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" |
    Where-Object { $_.CommandLine -match 'supabase functions serve' }
  if (-not $functionsRunning) {
    $log = Join-Path $PSScriptRoot 'functions.log'
    Start-Process cmd -ArgumentList "/c $functionsCommand > `"$log`" 2>&1" -WorkingDirectory $backend -WindowStyle Hidden
  }
  Start-Process $installedApp
  Start-Sleep -Seconds 2
  exit 0
}

# 3. Developer mode: functions, web dashboard and desktop app, as tabs in one Windows Terminal window
Write-Host '[3/3] Opening Foundation (developer mode)...' -ForegroundColor Cyan
wt --window new `
  new-tab --title '1 FUNCTIONS (logs)' --suppressApplicationTitle -d "$backend" cmd /k "$functionsCommand" `; `
  new-tab --title '2 WEB DASHBOARD' --suppressApplicationTitle -d "$root" cmd /k "pnpm --filter @first2apply/webapp dev" `; `
  new-tab --title '3 DESKTOP APP' --suppressApplicationTitle -d "$probe" cmd /k "pnpm start" `; `
  focus-tab -t 0

Start-Sleep -Seconds 2
