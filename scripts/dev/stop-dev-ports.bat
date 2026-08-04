@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo This script frees Song Thanh local dev ports: 3000, 3001, 4000.
echo.

for %%P in (3000 3001 4000) do (
  echo Checking port %%P...
  set "FOUND="
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    set "PID=%%A"
    if not "!PID!"=="" (
      set "FOUND=1"
      echo   Killing PID !PID! on port %%P
      taskkill /PID !PID! /F >nul 2>nul
    )
  )
  if not defined FOUND (
    echo   No listener found on port %%P
  )
)

echo.
echo Done.

endlocal
