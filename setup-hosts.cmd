@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Tambah 127.0.0.1 vm-inventoryserver.lrt ke hosts Windows.
rem Klik kanan file ini -> Run as administrator.
rem Tidak mengubah ExecutionPolicy PowerShell.

net session >nul 2>&1
if errorlevel 1 (
  echo Meminta hak Administrator untuk menulis file hosts...
  powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "HOSTS=%SystemRoot%\System32\drivers\etc\hosts"
set "HOSTNAME=vm-inventoryserver.lrt"
set "ENTRY=127.0.0.1    vm-inventoryserver.lrt"

findstr /I /C:"%HOSTNAME%" "%HOSTS%" >nul 2>&1
if not errorlevel 1 (
  echo Entri hosts untuk %HOSTNAME% sudah ada.
  goto :flush
)

echo Menulis ke %HOSTS% ...
>> "%HOSTS%" echo.
>> "%HOSTS%" echo %ENTRY%
if errorlevel 1 (
  echo GAGAL menulis file hosts. Pastikan dijalankan sebagai Administrator.
  pause
  exit /b 1
)
echo Entri ditambahkan: %ENTRY%

:flush
ipconfig /flushdns >nul
echo Selesai. Buka: http://vm-inventoryserver.lrt:3000
pause
endlocal
