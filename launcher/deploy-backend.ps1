# Puts the Foundation backend on a hosted Supabase project and builds an installer that uses it.
#
#   .\deploy-backend.ps1 -ProjectRef <reference id>
#
# The reference id is in the project's address: https://supabase.com/dashboard/project/<reference id>
# You'll be asked for the database password you chose when creating the project.
param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  # skip building the installer at the end
  [switch]$NoInstaller
)
$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'apps\backend'
$env:npm_config_loglevel = 'error'
Set-Location $backend

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (see the messages above)" } }

Step '1/6 Checking you are logged in to Supabase'
npx supabase projects list *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'A browser window will open: sign in to Supabase and approve the CLI.' -ForegroundColor Yellow
  npx supabase login
  Check 'Supabase login'
}

Step '2/6 Linking this folder to your project (enter the database password when asked)'
npx supabase link --project-ref $ProjectRef
Check 'Linking the project'

Step '3/6 Creating the database tables and job boards'
# migrations/ holds the tables, sites.sql (the seed) the job boards
npx supabase db push --include-seed
Check 'Database push'

Step '4/6 Uploading function secrets from supabase\functions\.env'
npx supabase secrets set --env-file supabase/functions/.env --project-ref $ProjectRef
Check 'Setting secrets'

Step '5/6 Deploying the backend functions'
npx supabase functions deploy --project-ref $ProjectRef
Check 'Deploying functions'

$url = "https://$ProjectRef.supabase.co"
if ($NoInstaller) {
  Write-Host "`nBackend ready at $url" -ForegroundColor Green
  exit 0
}

Step '6/6 Building the installer against the hosted backend'
$keys = npx supabase projects api-keys --project-ref $ProjectRef -o json | ConvertFrom-Json
Check 'Reading the project keys'
# the anon / publishable key is the public one that ships inside the app (never the service role key)
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
if (-not $anonKey) { throw 'Could not find the anon key for this project.' }
& (Join-Path $PSScriptRoot 'build-installer.ps1') -SupabaseUrl $url -SupabaseKey $anonKey
Check 'Building the installer'

Write-Host "`nDone. release\FoundationSetup.exe now connects to $url" -ForegroundColor Green
