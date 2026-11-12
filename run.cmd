@echo off
setlocal
cd /d "%~dp0"

rem Pakai Node portable di .tools\node (tidak perlu Node di PATH sistem).
set "PATH=%~dp0.tools\node;%PATH%"

if not exist "%~dp0.tools\node\node.exe" (
  echo Node portable tidak ditemukan: %~dp0.tools\node\node.exe
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo node.exe tidak bisa dijalankan dari .tools\node
  exit /b 1
)

if not exist "%~dp0node_modules\" (
  echo node_modules belum ada. Menjalankan npm install...
  call npm install
  if errorlevel 1 exit /b 1
)

rem Production: next start -H 0.0.0.0 (lebih stabil daripada next dev).
rem URL lokal: http://vm-inventoryserver.lrt:3000
if not exist "%~dp0.next\BUILD_ID" (
  echo Belum ada build. Menjalankan npm run build...
  call npm run build
  if errorlevel 1 exit /b 1
)
call npm start
endlocal
