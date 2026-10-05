<#
.SYNOPSIS
  Installs the three Scheduled Tasks that keep the Donut Mirror kiosk running
  unattended: launch-at-logon, a watchdog that relaunches Chrome if it's not
  running, and a nightly restart to clear any slow memory growth from an
  all-day WASM/camera session.

.DESCRIPTION
  Run once as Administrator, from the dedicated kiosk Windows account, after
  Disable-PowerSaving.ps1 and after confirming Start-Kiosk.ps1 launches the
  site correctly by hand. Re-run any time to update the URL or schedule —
  it overwrites the existing tasks.

.PARAMETER Url
  The deployed kiosk URL, e.g. https://your-site.vercel.app

.PARAMETER WatchdogIntervalMinutes
  How often to check whether Chrome is still running. Default 2 minutes —
  this is a cheap check (Get-Process), not a full relaunch, so a short
  interval is fine.

.PARAMETER NightlyRestartTime
  24h HH:mm time for the nightly full OS restart. Pick a time outside
  business hours. Default 03:00.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [int]$WatchdogIntervalMinutes = 2,

    [string]$NightlyRestartTime = "03:00"
)

$scriptDir = $PSScriptRoot
$startKioskPath = Join-Path $scriptDir "Start-Kiosk.ps1"

if (-not (Test-Path $startKioskPath)) {
    Write-Error "Start-Kiosk.ps1 not found next to this script at $startKioskPath"
    exit 1
}

# --- 1) Launch the kiosk when the kiosk account logs in ---
$launchAction = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startKioskPath`" -Url `"$Url`""
$launchTrigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "DonutMirror-KioskLaunch" `
    -Action $launchAction -Trigger $launchTrigger -RunLevel Highest -Force | Out-Null
Write-Host "Installed: DonutMirror-KioskLaunch (runs at logon)"

# --- 2) Watchdog: relaunch Chrome if it's not running (covers a Chrome crash
#        or someone accidentally closing the window — the in-page watchdog
#        can only recover a hung page, not a dead browser process) ---
$watchdogCommand = "if (-not (Get-Process chrome -ErrorAction SilentlyContinue)) { & '$startKioskPath' -Url '$Url' }"
$watchdogAction = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$watchdogCommand`""
$watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $WatchdogIntervalMinutes) `
    -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "DonutMirror-Watchdog" `
    -Action $watchdogAction -Trigger $watchdogTrigger -RunLevel Highest -Force | Out-Null
Write-Host "Installed: DonutMirror-Watchdog (checks every $WatchdogIntervalMinutes min)"

# --- 3) Nightly full restart — clears any slow memory growth from an 8+ hour
#        camera/WASM session and lets a new deploy's service worker take over
#        cleanly. The 60s delay gives any in-progress guest a moment to finish. ---
$nightlyAction = New-ScheduledTaskAction -Execute "shutdown.exe" `
    -Argument "/r /t 60 /c `"Donut Mirror nightly restart`""
$nightlyTrigger = New-ScheduledTaskTrigger -Daily -At $NightlyRestartTime
Register-ScheduledTask -TaskName "DonutMirror-NightlyRestart" `
    -Action $nightlyAction -Trigger $nightlyTrigger -RunLevel Highest -Force | Out-Null
Write-Host "Installed: DonutMirror-NightlyRestart (daily at $NightlyRestartTime)"

Write-Host ""
Write-Host "Done. View/edit these under Task Scheduler > Task Scheduler Library."
Write-Host "To remove them later: Unregister-ScheduledTask -TaskName 'DonutMirror-*' -Confirm:`$false"
