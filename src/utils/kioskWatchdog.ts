/**
 * Soft hang detector for all-day kiosk use.
 * MirrorCanvas (or any render loop) should call `beatWatchdog()` regularly.
 * If no beat arrives for `stallMs`, the page reloads.
 */

let lastBeatMs = Date.now();
let intervalId: number | null = null;

export function beatWatchdog(): void {
  lastBeatMs = Date.now();
}

export function startKioskWatchdog(options: {
  stallMs?: number;
  checkIntervalMs?: number;
} = {}): () => void {
  const stallMs = options.stallMs ?? 20_000;
  const checkIntervalMs = options.checkIntervalMs ?? 5_000;

  lastBeatMs = Date.now();

  if (intervalId !== null) {
    window.clearInterval(intervalId);
  }

  intervalId = window.setInterval(() => {
    if (document.visibilityState !== 'visible') {
      lastBeatMs = Date.now();
      return;
    }

    if (Date.now() - lastBeatMs >= stallMs) {
      window.location.reload();
    }
  }, checkIntervalMs);

  return () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}
