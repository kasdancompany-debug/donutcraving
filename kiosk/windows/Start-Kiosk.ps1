<#
.SYNOPSIS
  Launches Chrome in locked-down kiosk mode pointed at the Donut Mirror kiosk URL.

.DESCRIPTION
  Uses a dedicated Chrome profile (separate from any staff browsing profile) and
  flags that suppress crash-recovery dialogs, the "restore pages" bubble, and
  other prompts that would otherwise sit on top of the kiosk forever waiting
  for a human. Intended to be called by the scheduled tasks installed via
  Install-KioskTasks.ps1, but safe to run by hand too.

.PARAMETER Url
  The deployed kiosk URL, e.g. https://your-site.vercel.app
  Add query params here if needed, e.g. "...?camRotate=90".
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Url
)

$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
    Write-Error "Google Chrome was not found in any of: $($chromeCandidates -join ', ')"
    exit 1
}

$userDataDir = Join-Path $env:LOCALAPPDATA "DonutMirrorKiosk\ChromeProfile"
New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null

$chromeArgs = @(
    "--kiosk", $Url,
    "--user-data-dir=$userDataDir",
    "--noerrdialogs",
    "--disable-session-crashed-bubble",
    "--disable-infobars",
    "--no-first-run",
    "--overscroll-history-navigation=0",
    "--disable-pinch",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-features=TranslateUI"
)

Start-Process -FilePath $chrome -ArgumentList $chromeArgs
