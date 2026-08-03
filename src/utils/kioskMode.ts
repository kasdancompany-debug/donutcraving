import { ATTRACT_SUBTEXT_WAVE } from '../config/branding';
import { parseCameraRotation, type CameraRotation } from './cameraOrientation';

export interface KioskProfile {
  /** Clean cafe UI — no fullscreen prompts or staff hints. */
  isKiosk: boolean;
  /** Performance profile for cafe / Android / weak devices. */
  isLite: boolean;
  /** Allow staff debug overlay via ?debug=1 */
  allowDebug: boolean;
  /** Face + bite detection. */
  enableBite: boolean;
  /** Ms between ML inference passes. */
  trackIntervalMs: number;
  /** Attract screen subtext. */
  attractSubtext: string;
  /** Start mirror when a hand is detected (no touch needed). */
  waveToStart: boolean;
  /** Rotate USB webcam feed (?camRotate=90|270|180). */
  camRotate: CameraRotation;
  /** Multi-person pose model — off by default (heavy). Opt in with ?pose=1. */
  enablePose: boolean;
}

function parseFlag(value: string | null): boolean {
  return value === '1' || value === 'true';
}

/**
 * One main URL for the cafe. Defaults are seamless kiosk behavior.
 * Optional overrides: ?full=1 ?bite=0 ?touch=1 ?pose=1 ?camRotate=90 ?debug=1
 */
function parseKioskProfile(): KioskProfile {
  const params = new URLSearchParams(window.location.search);
  const fullQuality = parseFlag(params.get('full')) || params.get('lite') === '0';
  const isLite = !fullQuality;
  // Clean cafe chrome by default; ?demo=1 shows desktop hints / fullscreen prompt.
  const isKiosk = !parseFlag(params.get('demo'));
  const allowDebug = parseFlag(params.get('debug'));
  const biteParam = params.get('bite');
  const biteOff = biteParam === '0' || biteParam === 'false';
  const touchStart = parseFlag(params.get('touch'));
  const waveToStart = !touchStart;
  const enablePose = parseFlag(params.get('pose'));

  return {
    isKiosk,
    isLite,
    allowDebug,
    enableBite: !biteOff,
    // ~18fps inference — leaves headroom to paint a smooth camera feed.
    trackIntervalMs: isLite ? 55 : 0,
    attractSubtext: ATTRACT_SUBTEXT_WAVE,
    waveToStart,
    camRotate: parseCameraRotation(false),
    enablePose,
  };
}

export const kioskProfile = parseKioskProfile();
