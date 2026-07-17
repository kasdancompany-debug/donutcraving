import type { TrackingConfig } from './types';

export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  acquireHoldMs: 650,
  missingGraceMs: 1800,
  cooldownMs: 1500,
  gestureDwellMs: 350,
  /** Stricter to acquire. */
  acquireConfidence: 0.45,
  /** Looser to keep. */
  keepConfidence: 0.28,
  /** New candidate must beat active by this score margin to start a switch. */
  switchScoreMargin: 0.18,
  smoothingAlpha: 0.35,
  /** Normalized image area — children/short guests allowed smaller faces. */
  minFaceArea: 0.004,
  minBodyArea: 0.02,
  interactionZoneCenterY: 0.55,
  interactionZoneMaxY: 0.98,
  handLandmarkProximity: 0.14,
  handBoxPaddingX: 0.12,
  handBoxPaddingY: 0.18,
  handMatchProximity: 0.1,
  maxPeople: 4,
};

export function createTrackingConfig(
  overrides: Partial<TrackingConfig> = {},
): TrackingConfig {
  return { ...DEFAULT_TRACKING_CONFIG, ...overrides };
}
