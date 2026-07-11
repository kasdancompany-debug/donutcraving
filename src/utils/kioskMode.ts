import { ATTRACT_SUBTEXT } from '../config/branding';
import { parseCameraRotation, type CameraRotation } from './cameraOrientation';

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
  /** Start mirror when a hand is detected (no touch needed). */
  waveToStart: boolean;
  /** Rotate USB webcam feed for portrait kiosk (?camRotate=90|270|180|auto). */
  camRotate: CameraRotation;
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
  const touchStart = parseFlag(params.get('touch'));
  const waveToStart = isKiosk && !touchStart;

  return {
    isKiosk,
    isLite,
    allowDebug,
    enableBite: biteRequested || !isLite,
    trackIntervalMs: isLite ? 48 : 0,
    attractSubtext: ATTRACT_SUBTEXT,
    waveToStart,
    camRotate: parseCameraRotation(isKiosk),
  };
}

export const kioskProfile = parseKioskProfile();
