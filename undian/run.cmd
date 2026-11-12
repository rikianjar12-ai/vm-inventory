@echo off
setlocal
cd /d "%~dp0"

rem Pakai Node portable dari folder induk (vm_inventory\.tools\node)
set "PATH=%~dp0..\.tools\node;%PATH%"

if not exist "%~dp0..\.tools\node\node.exe" (
  echo Node portable tidak ditemukan: %~dp0..\.tools\node\node.exe
  exit /b 1
)

if not exist "%~dp0node_modules\" (
  echo node_modules belum ada. Menjalankan npm install...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Menjalankan Undian Hadiah di http://localhost:3010
call npm run dev
endlocal
