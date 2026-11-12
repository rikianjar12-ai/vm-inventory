$TaskName = "VM Inventory Watchdog"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Task '$TaskName' dihapus (jika ada)."
