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

Write-Host "`n  Thanks! Uploading the update now. This takes a few minutes - you can leave it running.`n" -ForegroundColor Green
try {
  & (Join-Path $PSScriptRoot 'deploy-functions.ps1') -ProjectRef $ProjectRef
  Write-Host "`n  ALL DONE. Close this window and tell Claude it finished." -ForegroundColor Green
} catch {
  Write-Host "`n  Something went wrong: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '  Tell Claude what this window says.' -ForegroundColor Red
}
Read-Host "`n  Press Enter to close"
