# Cek kesehatan HTTP, bukan hanya port.
# Kalau mati atau hang, hentikan proses di :3000 lalu nyalakan production (npm start).
# Dipanggil Task Scheduler setiap 1 jam dan saat logon.

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "watchdog.log"
$LockFile = Join-Path $LogDir "watchdog.lock"
$NodeDir = Join-Path $Root ".tools\node"
$Port = 3000
$HealthUrl = "http://127.0.0.1:$Port/api/health"

function Write-Log([string]$msg) {
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Test-AppHealthy {
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 8
        return ($r.StatusCode -eq 200 -and $r.Content -match '"ok"\s*:\s*true')
    } catch {
        return $false
    }
}

function Stop-AppOnPort {
    $pids = @(
        Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique |
            Where-Object { $_ -and $_ -ne 0 }
    )
    foreach ($procId in $pids) {
        Write-Log "kill: pid $procId on port $Port"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

function Start-App {
    $nodeExe = Join-Path $NodeDir "node.exe"
    $npmCmd = Join-Path $NodeDir "npm.cmd"
    if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
        Write-Log "error: Node portable tidak ditemukan di $NodeDir"
        return $false
    }

    $buildId = Join-Path $Root ".next\BUILD_ID"
    $env:Path = "$NodeDir;" + $env:Path
    if (-not (Test-Path $buildId)) {
        Write-Log "build: .next belum ada, menjalankan npm run build"
        Push-Location $Root
        try {
            & $npmCmd run build
            if ($LASTEXITCODE -ne 0) {
                Write-Log "error: npm run build gagal (exit $LASTEXITCODE)"
                return $false
            }
        } finally {
            Pop-Location
        }
    }

    Write-Log "start: npm start (production) on port $Port"
    Start-Process -FilePath $npmCmd -ArgumentList "start" -WorkingDirectory $Root -WindowStyle Hidden
    return $true
}

if (Test-AppHealthy) { exit 0 }

if (Test-Path $LockFile) {
    $age = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    if ($age.TotalMinutes -lt 4) {
        Write-Log "skip: restart already in progress"
        exit 0
    }
}

New-Item -ItemType File -Path $LockFile -Force | Out-Null
try {
    if (Test-AppHealthy) { exit 0 }

    Write-Log "unhealthy: HTTP health check gagal"
    Stop-AppOnPort
    if (-not (Start-App)) { exit 1 }

    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        if (Test-AppHealthy) {
            $ok = $true
            break
        }
    }

    if ($ok) {
        Write-Log "up: health check OK"
    } else {
        Write-Log "warn: started but /api/health belum merespons"
        exit 1
    }
} finally {
    Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
}
