# "Update Foundation online" shortcut: uploads the latest backend functions (the code that reads job boards
# and saves new jobs) to the hosted Supabase project. The only thing it asks for is a Supabase access token.
$Host.UI.RawUI.WindowTitle = 'Update Foundation online'
$ProjectRef = 'fybhwybxztwbapjszdfs'
Clear-Host
Write-Host ''
Write-Host '  UPDATE FOUNDATION ONLINE' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Your browser is opening the Supabase "Access Tokens" page.'
Write-Host ''
Write-Host '   1. Click  "Generate new token", name it  Foundation update, click Generate.'
Write-Host '   2. Click the copy button next to the token.'
Write-Host '   3. Come back to this window, right-click to paste it, and press Enter.'
Write-Host '      (Nothing shows when you paste - that is normal.)'
Write-Host ''
Start-Process 'https://supabase.com/dashboard/account/tokens'

# the token is only kept in this window's memory while the update runs
$secure = Read-Host '  Paste your token here' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $token.StartsWith('sbp_')) {
  Write-Host "`n  That doesn't look like a Supabase token (they start with sbp_). Please run the shortcut again." -ForegroundColor Red
  Read-Host '  Press Enter to close'
  exit 1
}
$env:SUPABASE_ACCESS_TOKEN = $token

# optional: the AI key used by the AI filters and the AI CV writer (from openrouter.ai/keys)
Write-Host ''
Write-Host '  OPTIONAL: to switch on the AI filters and AI CV writing, paste an OpenRouter key'
Write-Host '  (from https://openrouter.ai/keys, it starts with sk-or-). Or just press Enter to skip.'
$secureAi = Read-Host '  OpenRouter key' -AsSecureString
$aiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAi)).Trim()

Write-Host "`n  Thanks! Uploading the update now. This takes a few minutes - you can leave it running.`n" -ForegroundColor Green
try {
  $env:npm_config_loglevel = 'error'
  $passwordFile = Join-Path $PSScriptRoot 'hosted-db-password.txt'
  if (-not (Test-Path $passwordFile)) { throw 'launcher\hosted-db-password.txt is missing (it was made by the first online setup).' }
  $dbPassword = (Get-Content $passwordFile -Raw).Trim()
  Set-Location (Join-Path (Split-Path $PSScriptRoot -Parent) 'apps\backend')

  # 1. the database first: the new functions save to its new columns
  Write-Host '== Updating the database' -ForegroundColor Cyan
  npx supabase link --project-ref $ProjectRef --password $dbPassword
  if ($LASTEXITCODE -ne 0) { throw 'Linking the project failed (see the messages above)' }
  npx supabase db push --include-seed --password $dbPassword --yes
  if ($LASTEXITCODE -ne 0) { throw 'Updating the database failed (see the messages above)' }

  # 2. the AI key, if one was pasted
  if ($aiKey) {
    if (-not $aiKey.StartsWith('sk-or-')) { throw "That doesn't look like an OpenRouter key (they start with sk-or-)." }
    Write-Host '== Saving the AI key' -ForegroundColor Cyan
    npx supabase secrets set "OPENROUTER_API_KEY=$aiKey" --project-ref $ProjectRef
    if ($LASTEXITCODE -ne 0) { throw 'Saving the AI key failed (see the messages above)' }
  }

  # 3. the functions
  Write-Host '== Uploading the functions' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'deploy-functions.ps1') -ProjectRef $ProjectRef
  Write-Host "`n  ALL DONE. Close this window and tell Claude it finished." -ForegroundColor Green
} catch {
  Write-Host "`n  Something went wrong: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '  Tell Claude what this window says.' -ForegroundColor Red
}
Read-Host "`n  Press Enter to close"
