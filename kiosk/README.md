# Running Donut Mirror as an unattended cafe kiosk

This folder has the scripts for locking a Windows PC down to just this app,
running day in and day out without anyone babysitting it. The app itself
(camera auto-recovery, a soft-then-hard watchdog, offline-capable asset
caching) handles software-level failures; these scripts handle everything
the app can't reach — the browser process, the OS, and the physical machine.

## 1. Hardware

- A dedicated mini-PC (Intel NUC or similar) or a locked-down Windows tablet.
  Not a shared staff laptop — it needs to stay logged in and running 24/7.
- A USB webcam you can mount at roughly eye height, with a clear line of
  sight to where a guest will stand. Avoid pointing it at a window — strong
  backlight is the single biggest cause of flaky hand/face tracking.
- Wired ethernet if at all possible. Wifi works (the app now self-hosts its
  camera-ML assets and caches them offline after first load — see the main
  README), but a stable connection still means fewer watchdog recoveries.

## 2. Windows account setup

1. Create a dedicated **standard** Windows user for the kiosk (not an admin
   account used day-to-day).
2. Enable auto-login for that account: `netplwiz` → uncheck "users must
   enter a password" → select the kiosk account.
3. Install Google Chrome under that account.
4. Sign in to the site once by hand (or just load the URL) to confirm camera
   permission is granted — Chrome will remember it for that profile.

## 3. Run the setup scripts (as Administrator)

From this `kiosk/windows` folder, in order:

```powershell
.\Disable-PowerSaving.ps1
.\Start-Kiosk.ps1 -Url "https://YOUR-DEPLOYED-URL"
```

Confirm the kiosk loads, the camera comes up, and tracking works. Then close
it and install the scheduled tasks that keep it running unattended:

```powershell
.\Install-KioskTasks.ps1 -Url "https://YOUR-DEPLOYED-URL"
```

This installs three Scheduled Tasks:

| Task | What it does | Why |
|---|---|---|
| `DonutMirror-KioskLaunch` | Starts Chrome in kiosk mode at logon | So a power loss + reboot comes back up on its own |
| `DonutMirror-Watchdog` | Every 2 min, relaunches Chrome if the process isn't running | The in-page watchdog ([src/utils/kioskWatchdog.ts](../src/utils/kioskWatchdog.ts)) can recover a *hung page*, but not a crashed/closed *browser* |
| `DonutMirror-NightlyRestart` | Full OS restart at 3am | Clears any slow memory growth from an 8+ hour camera/WASM session and lets a new deploy take over cleanly |

Re-run `Install-KioskTasks.ps1` any time to change the URL or schedule.

## 4. Windows Update

Windows Update can reboot the machine mid-business-day. Set Active Hours
(Settings → Windows Update → Advanced options → Active hours) to your cafe's
full opening window so updates only install/reboot overnight, when the
nightly restart task already expects a restart.

## 5. Useful URL query params

Append these to the kiosk URL (combine with `&`):

| Param | Effect |
|---|---|
| `?debug=1` | Staff debug overlay: tracking state, bite phase, fps, and a rolling **Health (24h)** summary of camera/tracking errors and watchdog recoveries — your first stop when something "isn't working" |
| `?camRotate=90` / `180` / `270` | Rotate the camera feed if the USB webcam is mounted sideways/upside-down |
| `?touch=1` | Require a tap to start instead of wave-to-start — worth testing if a busy counter causes false wave-starts |
| `?full=1` | Full-quality (non-lite) tracking profile, for a stronger kiosk PC |
| `?bite=0` | Disable face/bite detection if you only want the hand-follow donut |
| `?pose=1` | Enable the (heavier) multi-person pose model |

With `?debug=1` active, press:
- **D** — toggle the debug overlay
- **C** — cycle to the next camera device (if the PC has more than one)
- **R** — recalibrate / reset the current session
- **S** — save a screenshot

## 6. Weekly maintenance checklist

- Wipe the camera lens.
- Confirm the camera mount hasn't shifted.
- Load `?debug=1` for a minute and glance at the Health summary — repeated
  `camera_error` or `watchdog_hard_reload` entries mean something's
  degrading (loose USB cable, wifi dead zone, etc.) before a customer
  notices.
- Check Task Scheduler → the three `DonutMirror-*` tasks should show recent
  "Last Run Result: 0x0".

## 7. Removing the kiosk tasks

```powershell
Unregister-ScheduledTask -TaskName "DonutMirror-*" -Confirm:$false
```
