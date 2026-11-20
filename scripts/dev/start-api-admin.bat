@echo off
setlocal

set "ROOT=%~dp0..\.."

rem The media assistant needs the local vision model on the API machine.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo Starting Song Thanh local AI on http://127.0.0.1:11434
  start "Song Thanh Local AI" powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\api\scripts\startLocalAi.ps1"
)

echo Starting Song Thanh API on http://localhost:4000
start "Song Thanh API" cmd /k "cd /d ""%ROOT%\api"" && npm.cmd run dev"

echo Starting Song Thanh Admin on http://localhost:3001/admin/login
start "Song Thanh Admin" cmd /k "cd /d ""%ROOT%\admin"" && npm.cmd run dev"

echo.
echo Started API + Admin.

endlocal
