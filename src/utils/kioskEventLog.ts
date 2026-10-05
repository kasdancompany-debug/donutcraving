/**
 * Local, best-effort event log for unattended kiosk operation.
 * No remote alerting (by design, for now) — this just makes failures
 * diagnosable from the ?debug=1 overlay without standing in the cafe.
 */

export interface KioskLogEntry {
  at: number;
  type: string;
  detail?: string;
}

const STORAGE_KEY = 'donut-mirror:kiosk-log';
const MAX_ENTRIES = 200;

function readLog(): KioskLogEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KioskLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLog(entries: KioskLogEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — logging is best-effort and must never
    // block the kiosk experience.
  }
}

export function logKioskEvent(type: string, detail?: string): void {
  if (typeof window === 'undefined') return;

  const entries = readLog();
  entries.push({ at: Date.now(), type, detail });
  while (entries.length > MAX_ENTRIES) entries.shift();
  writeLog(entries);

  if (import.meta.env.DEV) {
    console.info(`[kiosk] ${type}`, detail ?? '');
  }
}

export function getKioskLog(): KioskLogEntry[] {
  return readLog();
}

export function clearKioskLog(): void {
  writeLog([]);
}

/** Rolling counts per event type within the trailing window — a quick health glance. */
export function summarizeKioskLog(
  windowMs = 24 * 60 * 60 * 1000,
): Record<string, number> {
  const cutoff = Date.now() - windowMs;
  const summary: Record<string, number> = {};
  for (const entry of readLog()) {
    if (entry.at < cutoff) continue;
    summary[entry.type] = (summary[entry.type] ?? 0) + 1;
  }
  return summary;
}
