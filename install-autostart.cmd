@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"
if errorlevel 1 (
  echo Gagal memasang auto-start.
  pause
  exit /b 1
)
echo.
pause
