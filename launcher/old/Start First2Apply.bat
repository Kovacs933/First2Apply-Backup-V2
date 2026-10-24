@echo off
title First2Apply Launcher

where wt >nul 2>&1
if errorlevel 1 (
  echo Windows Terminal was not found on this PC.
  echo Tell Claude and we will install it.
  pause
  exit /b
)

echo [1/3] Starting Docker Desktop...
start "" "C:\Users\Edward\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"

echo Waiting for Docker to be ready...
:waitdocker
docker info >nul 2>&1
if errorlevel 1 (
  timeout /t 3 /nobreak >nul
  goto waitdocker
)

echo [2/3] Starting database...
cd /d C:\Users\Edward\Desktop\first2apply-master\apps\backend
call npx supabase start

echo [3/3] Opening First2Apply in one Windows Terminal window...
wt --window new new-tab --title "1 FUNCTIONS (logs)" --suppressApplicationTitle -d "C:\Users\Edward\Desktop\first2apply-master\apps\backend" cmd /k "npx supabase functions serve --env-file ./supabase/functions/.env" ; new-tab --title "2 WEB DASHBOARD" --suppressApplicationTitle -d "C:\Users\Edward\Desktop\first2apply-master" cmd /k "pnpm --filter @first2apply/webapp dev" ; new-tab --title "3 DESKTOP APP" --suppressApplicationTitle -d "C:\Users\Edward\Desktop\first2apply-master\apps\desktopProbe" cmd /k "pnpm start" ; focus-tab -t 0

echo Done. You can close this window.
timeout /t 5 >nul
