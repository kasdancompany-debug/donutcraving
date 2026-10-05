import { logKioskEvent } from './kioskEventLog';

/**
 * Soft hang detector for all-day kiosk use.
 * MirrorCanvas (or any render loop) should call `beatWatchdog()` regularly.
 *
 * On a stall we try a soft recovery first (restart the camera + ML
 * landmarkers in-page via `onSoftRecover`) rather than immediately reloading
 * the whole document — a flaky-wifi moment shouldn't force a full reload
 * that just re-triggers every asset fetch again. Only if the stall persists
 * through another full window do we fall back to a hard reload.
 */

let lastBeatMs = Date.now();
let intervalId: number | null = null;
let softRecoverAt: number | null = null;

export function beatWatchdog(): void {
  lastBeatMs = Date.now();
  softRecoverAt = null;
}

export function startKioskWatchdog(options: {
  stallMs?: number;
  checkIntervalMs?: number;
  /** Attempt an in-page recovery (e.g. restart camera/ML) before reloading. */
  onSoftRecover?: () => void;
} = {}): () => void {
  const stallMs = options.stallMs ?? 20_000;
  const checkIntervalMs = options.checkIntervalMs ?? 5_000;

  lastBeatMs = Date.now();
  softRecoverAt = null;

  if (intervalId !== null) {
    window.clearInterval(intervalId);
  }

  intervalId = window.setInterval(() => {
    if (document.visibilityState !== 'visible') {
      lastBeatMs = Date.now();
      softRecoverAt = null;
      return;
    }

    const stalledFor = Date.now() - lastBeatMs;
    if (stalledFor < stallMs) return;

    if (softRecoverAt === null && options.onSoftRecover) {
      softRecoverAt = Date.now();
      logKioskEvent('watchdog_soft_recover', `stalled ${Math.round(stalledFor / 1000)}s`);
      options.onSoftRecover();
      return;
    }

    // Soft recovery already attempted this episode (or none was offered)
    // and we're still stalled — escalate to a full reload.
    logKioskEvent('watchdog_hard_reload', `stalled ${Math.round(stalledFor / 1000)}s`);
    window.location.reload();
  }, checkIntervalMs);

  return () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}
