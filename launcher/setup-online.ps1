# "Set up Foundation online" shortcut: puts Foundation's backend on Supabase and builds the
# installer for other computers. The only thing it asks for is a Supabase access token.
$Host.UI.RawUI.WindowTitle = 'Set up Foundation online'
Clear-Host
Write-Host ''
Write-Host '  SET UP FOUNDATION ONLINE' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Your browser is opening the Supabase "Access Tokens" page.'
Write-Host ''
Write-Host '   1. Sign in (or sign up) to Supabase.'
Write-Host '   2. Click  "Generate new token", name it  Foundation, click Generate.'
Write-Host '   3. Click the copy button next to the token.'
Write-Host '   4. Come back to this window, right-click to paste it, and press Enter.'
Write-Host ''
Start-Process 'https://supabase.com/dashboard/account/tokens'

# the token is only kept in this window's memory while the setup runs
$secure = Read-Host '  Paste your token here' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $token.StartsWith('sbp_')) {
  Write-Host "`n  That doesn't look like a Supabase token (they start with sbp_). Please run the shortcut again." -ForegroundColor Red
  Read-Host '  Press Enter to close'
  exit 1
}
$env:SUPABASE_ACCESS_TOKEN = $token

Write-Host "`n  Thanks! Setting everything up now. This takes about 10 minutes - you can leave it running.`n" -ForegroundColor Green
try {
  & (Join-Path $PSScriptRoot 'create-hosted-backend.ps1')
  Write-Host "`n  ALL DONE. Close this window and tell Claude it finished." -ForegroundColor Green
} catch {
  Write-Host "`n  Something went wrong: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '  Tell Claude what this window says.' -ForegroundColor Red
}
Read-Host "`n  Press Enter to close"
