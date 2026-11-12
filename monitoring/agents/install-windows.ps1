# Pasang windows_exporter di Windows Server (port 9182).
# Jalankan di PowerShell Administrator:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -MonitorIp 192.168.38.11 -ServerId NAMA-SERVER
param(
  [string]$MonitorIp = "192.168.38.11",
  [string]$Version = "0.29.2",
  [string]$ServerId = $env:COMPUTERNAME,
  [string]$Application = "",
  [string]$Lokasi = ""
)

$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Write-Error "Jalankan PowerShell sebagai Administrator."
}

$msiName = "windows_exporter-$Version-amd64.msi"
$url = "https://github.com/prometheus-community/windows_exporter/releases/download/v$Version/$msiName"
$msi = Join-Path $env:TEMP $msiName

Write-Host "==> Unduh $url"
Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing

$collectors = "cpu,cs,logical_disk,memory,net,os,service,system"
Write-Host "==> Install windows_exporter :9182"
Start-Process msiexec.exe -ArgumentList @(
  "/i", "`"$msi`"",
  "/qn",
  "ENABLED_COLLECTORS=$collectors",
  "LISTEN_PORT=9182"
) -Wait

$ruleName = "lrt-windows-exporter"
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9182 -RemoteAddress $MonitorIp | Out-Null

Start-Sleep -Seconds 2
try {
  $code = (Invoke-WebRequest -Uri "http://127.0.0.1:9182/metrics" -UseBasicParsing -TimeoutSec 8).StatusCode
  Write-Host "Cek lokal :9182 HTTP $code"
} catch {
  Write-Host "Exporter terpasang, tetapi :9182 belum menjawab. Cek service windows_exporter."
}

$ip = (
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1 -ExpandProperty IPAddress
)
if (-not $ip) { $ip = "IP_SERVER_INI" }

Write-Host ""
Write-Host "==== SELESAI di $ServerId ($ip) ===="
Write-Host "Tempel blok ini ke prometheus/targets/windows.yml di server pantauan ${MonitorIp}:"
Write-Host @"
- targets:
    - ${ip}:9182
  labels:
    server_id: $ServerId
    application: $(if ($Application) { $Application } else { "isi-aplikasi" })
    lokasi: $(if ($Lokasi) { $Lokasi } else { "isi-lokasi" })
"@
Write-Host "Lalu buka http://${MonitorIp}:9091/targets  (job windows harus UP)"
