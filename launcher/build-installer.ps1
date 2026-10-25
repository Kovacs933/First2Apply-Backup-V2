# Builds the Windows installer: release\FoundationSetup.exe
#
# The backend address is baked into the installer when it is built.
#   - For other people's computers, pass your hosted Supabase project:
#       .\build-installer.ps1 -SupabaseUrl https://<project>.supabase.co -SupabaseKey <anon or publishable key>
#   - With no parameters it uses apps\desktopProbe\.env (http://localhost:54321), which only works
#     on this PC while the local backend is running.
param(
  [string]$SupabaseUrl,
  [string]$SupabaseKey,
  # optional: folder where you publish releases (<platform>/<arch>/RELEASES.json) to turn on update checks
  [string]$UpdateFeedUrl
)
$ErrorActionPreference = 'Stop'
$root  = Split-Path $PSScriptRoot -Parent
$probe = Join-Path $root 'apps\desktopProbe'
$env:npm_config_loglevel = 'error'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

# values passed here override apps\desktopProbe\.env (dotenv never overwrites existing variables)
if ($SupabaseUrl) { $env:SUPABASE_URL = $SupabaseUrl }
if ($SupabaseKey) { $env:SUPABASE_KEY = $SupabaseKey }
if ($UpdateFeedUrl) { $env:UPDATE_FEED_URL = $UpdateFeedUrl }
if (-not $SupabaseUrl) {
  Write-Host 'No -SupabaseUrl given: the installer will connect to the backend on THIS PC only.' -ForegroundColor Yellow
}
if ($SupabaseUrl -and -not $SupabaseKey) { throw 'Pass -SupabaseKey together with -SupabaseUrl.' }

Step 'Building shared code'
Set-Location $root
pnpm --filter @first2apply/core build
if ($LASTEXITCODE -ne 0) { throw 'core build failed' }
pnpm --filter @first2apply/ui build
if ($LASTEXITCODE -ne 0) { throw 'ui build failed' }

Step 'Building the Windows installer (takes a few minutes)'
Set-Location $probe
# "squirrel" picks the configured installer maker in forge.config.ts (a package name would create an unconfigured one)
npx electron-forge make --platform win32 --arch x64 --targets squirrel
if ($LASTEXITCODE -ne 0) { throw 'electron-forge make failed' }

$setup = Join-Path $probe 'out\make\squirrel.windows\x64\FoundationSetup.exe'
if (-not (Test-Path $setup)) { throw "Installer not found at $setup" }

$release = Join-Path $root 'release'
New-Item -ItemType Directory -Force $release | Out-Null
Copy-Item $setup $release -Force
# RELEASES + .nupkg are what an update feed needs if you host updates later
Copy-Item (Join-Path $probe 'out\make\squirrel.windows\x64\*.nupkg'), (Join-Path $probe 'out\make\squirrel.windows\x64\RELEASES') $release -Force

# the Desktop "Upload this" folder is what gets attached to the GitHub release, so keep it in step
$upload = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Upload this'
New-Item -ItemType Directory -Force $upload | Out-Null
Copy-Item (Join-Path $release 'FoundationSetup.exe') $upload -Force

Step 'Done'
Get-Item (Join-Path $release 'FoundationSetup.exe') | Select-Object FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
