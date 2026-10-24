# Creates the hosted Supabase project for Foundation (London region) and deploys everything to it.
# Run after `npx supabase login`. Re-running is safe: an existing "Foundation" project is reused.
param(
  [string]$OrgId,
  [string]$ProjectName = 'Foundation',
  [string]$Region = 'eu-west-2'
)
$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'apps\backend'
$passwordFile = Join-Path $PSScriptRoot 'hosted-db-password.txt'
$env:npm_config_loglevel = 'error'
Set-Location $backend

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (see the messages above)" } }

Step 'Finding your Supabase organisation'
$orgs = npx supabase orgs list -o json | ConvertFrom-Json
Check 'Listing organisations'
if (-not $OrgId -and @($orgs).Count -eq 0) {
  # brand new Supabase accounts have no organisation yet, and projects must live in one
  Write-Host 'No organisation yet - creating one called "Foundation" (free plan)'
  npx supabase orgs create Foundation
  Check 'Creating the organisation'
  $orgs = npx supabase orgs list -o json | ConvertFrom-Json
  Check 'Listing organisations'
}
if (-not $OrgId) {
  if (@($orgs).Count -ne 1) { throw "You have $(@($orgs).Count) organisations; re-run with -OrgId <id>: $($orgs | ForEach-Object { "$($_.id) ($($_.name))" })" }
  $OrgId = @($orgs)[0].id
}
Write-Host "Using organisation $OrgId"

# the database password is generated here and kept only in launcher\hosted-db-password.txt
if (Test-Path $passwordFile) {
  $dbPassword = (Get-Content $passwordFile -Raw).Trim()
} else {
  $chars = (48..57) + (65..90) + (97..122)
  $dbPassword = -join (1..32 | ForEach-Object { [char]($chars | Get-Random) })
  Set-Content $passwordFile $dbPassword -NoNewline
}

$projects = npx supabase projects list -o json | ConvertFrom-Json
Check 'Listing projects'
$project = $projects | Where-Object { $_.name -eq $ProjectName -and $_.organization_id -eq $OrgId } | Select-Object -First 1
if ($project) {
  Write-Host "Reusing existing project $($project.id)"
} else {
  Step "Creating project '$ProjectName' in $Region"
  npx supabase projects create $ProjectName --org-id $OrgId --db-password $dbPassword --region $Region
  Check 'Creating the project'
  $project = (npx supabase projects list -o json | ConvertFrom-Json) | Where-Object { $_.name -eq $ProjectName -and $_.organization_id -eq $OrgId } | Select-Object -First 1
}
$ref = $project.id

Step 'Waiting for the project to be ready (usually 1-3 minutes)'
$deadline = (Get-Date).AddMinutes(10)
do {
  $status = ((npx supabase projects list -o json | ConvertFrom-Json) | Where-Object { $_.id -eq $ref }).status
  Write-Host "  status: $status"
  if ($status -eq 'ACTIVE_HEALTHY') { break }
  if ((Get-Date) -gt $deadline) { throw "Project $ref is still '$status' after 10 minutes." }
  Start-Sleep -Seconds 15
} while ($true)

Step 'Linking and creating the database tables and job boards'
npx supabase link --project-ref $ref --password $dbPassword
Check 'Linking the project'
npx supabase db push --include-seed --password $dbPassword --yes
Check 'Database push'

Step 'Uploading function secrets and deploying functions'
npx supabase secrets set --env-file supabase/functions/.env --project-ref $ref
Check 'Setting secrets'
& (Join-Path $PSScriptRoot 'deploy-functions.ps1') -ProjectRef $ref
Set-Location $backend

Step 'Building the installer against the hosted backend'
$keys = npx supabase projects api-keys --project-ref $ref -o json | ConvertFrom-Json
Check 'Reading the project keys'
# the anon key is the public one that ships inside the app (never the service role key)
$anonKey = ($keys | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
if (-not $anonKey) { throw 'Could not find the anon key for this project.' }
& (Join-Path $PSScriptRoot 'build-installer.ps1') -SupabaseUrl "https://$ref.supabase.co" -SupabaseKey $anonKey

Write-Host "`nBackend ready: https://$ref.supabase.co (project $ref)" -ForegroundColor Green
Write-Host 'release\FoundationSetup.exe now connects to it.' -ForegroundColor Green
