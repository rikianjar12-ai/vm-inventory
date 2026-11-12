# Jalankan aplikasi Next.js memakai Node portable di .tools\node.
#
# File ini diblokir jika ExecutionPolicy = Restricted.
# Jangan ubah kebijakan mesin. Gunakan salah satu:
#   .\run.cmd
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1

$nodeDir = Join-Path $PSScriptRoot ".tools\node"
$env:Path = "$nodeDir;" + $env:Path
Set-Location $PSScriptRoot

if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
    Write-Error "Node portable tidak ditemukan: $nodeDir\node.exe"
    exit 1
}

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "node_modules belum ada. Menjalankan npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not (Test-Path (Join-Path $PSScriptRoot ".next\BUILD_ID"))) {
    Write-Host "Belum ada build. Menjalankan npm run build..."
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

npm start
