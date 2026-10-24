@echo off
cd /d C:\Users\Edward\Desktop\first2apply-master\apps\backend
call npx supabase stop
taskkill /FI "WINDOWTITLE eq F2A Web*" /T /F
taskkill /FI "WINDOWTITLE eq F2A Desktop*" /T /F
echo Stopped.
pause
