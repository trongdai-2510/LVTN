@echo off
setlocal

set "ROOT=%~dp0..\.."
set "ADMIN_NEXT=%ROOT%\admin\.next"

if exist "%ADMIN_NEXT%" (
  echo Removing admin Next.js cache: %ADMIN_NEXT%
  rmdir /s /q "%ADMIN_NEXT%"
  echo Removed admin/.next
) else (
  echo admin/.next does not exist. Nothing to clean.
)

echo.
echo node_modules was not removed.
echo frontend/.next was not touched.
echo _legacy_cms_backup/ was not touched.

endlocal
