@echo off
setlocal

set "ROOT=%~dp0..\.."

echo Starting Song Thanh API on http://localhost:4000
start "Song Thanh API" cmd /k "cd /d ""%ROOT%\api"" && npm.cmd run dev"

echo Starting Song Thanh Admin on http://localhost:3001/admin/login
start "Song Thanh Admin" cmd /k "cd /d ""%ROOT%\admin"" && npm.cmd run dev"

echo.
echo Started API + Admin.

endlocal