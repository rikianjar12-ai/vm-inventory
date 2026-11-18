# Isi alertmanager.yml dari .env
#   powershell -ExecutionPolicy Bypass -File .\scripts\render-alertmanager.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
node .\scripts\render-alertmanager.mjs
