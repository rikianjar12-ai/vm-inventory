# Pasang Task Scheduler: cek kesehatan setiap 1 jam + saat logon.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Watchdog = Join-Path $Root "watchdog.ps1"
$TaskName = "VM Inventory Watchdog"

if (-not (Test-Path $Watchdog)) {
    Write-Error "watchdog.ps1 tidak ditemukan: $Watchdog"
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Watchdog`""

$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date
$triggerRepeat.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
    -RepetitionInterval (New-TimeSpan -Hours 1) `
    -RepetitionDuration (New-TimeSpan -Days 3650)).Repetition

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 4)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($triggerLogon, $triggerRepeat) `
    -Settings $settings `
    -Principal $principal `
    -Description "Cek HTTP /api/health setiap 1 jam. Restart Next.js jika mati atau hang." `
    -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Host "Task '$TaskName' terpasang. Cek kesehatan setiap 1 jam dan saat logon."
Write-Host "Log: $Root\logs\watchdog.log"
