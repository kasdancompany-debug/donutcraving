import { ATTRACT_SUBTEXT, ATTRACT_SUBTEXT_KIOSK } from '../config/branding';

export interface KioskProfile {
  /** Clean cafe UI — no fullscreen prompts or staff hints. */
  isKiosk: boolean;
  /** Performance profile for Android / weak devices. */
  isLite: boolean;
  /** Allow staff debug overlay via ?debug=1 */
  allowDebug: boolean;
  /** Face + bite detection (off in lite for speed). */
  enableBite: boolean;
  /** Ms between ML inference passes (~20fps at 48ms). */
  trackIntervalMs: number;
  /** Attract screen subtext. */
  attractSubtext: string;
}

function parseFlag(value: string | null): boolean {
  return value === '1' || value === 'true';
}

function parseKioskProfile(): KioskProfile {
  const params = new URLSearchParams(window.location.search);
  const isKiosk = parseFlag(params.get('kiosk'));
  const liteParam = params.get('lite');
  const isLite =
    parseFlag(liteParam) || (isKiosk && liteParam !== '0');
  const allowDebug = parseFlag(params.get('debug'));
  const biteRequested = parseFlag(params.get('bite'));

  return {
    isKiosk,
    isLite,
    allowDebug,
    enableBite: biteRequested || !isLite,
    trackIntervalMs: isLite ? 48 : 0,
    attractSubtext: isKiosk ? ATTRACT_SUBTEXT_KIOSK : ATTRACT_SUBTEXT,
  };
}

export const kioskProfile = parseKioskProfile();
