<#
.SYNOPSIS
  Disables sleep, display timeout, hibernation, and the screensaver on the
  current power plan so the kiosk never goes dark or locks unattended.

.DESCRIPTION
  Run once as Administrator during kiosk PC setup. Safe to re-run.
#>

Write-Host "Disabling sleep / display timeout / hibernation (AC power)..."
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-dc 0

Write-Host "Disabling the screensaver for the current user..."
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0"
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "0"

Write-Host "Done. Note: this does not disable Windows Update reboots — see kiosk/README.md for Active Hours setup."
