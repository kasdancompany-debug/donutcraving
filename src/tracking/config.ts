import type { TrackingConfig } from './types';

export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  acquireHoldMs: 650,
  /** Stay locked through brief occlusion / crowd motion before releasing. */
  missingGraceMs: 2800,
  cooldownMs: 1500,
  gestureDwellMs: 350,
  /** Stricter to acquire. */
  acquireConfidence: 0.45,
  /** Looser to keep. */
  keepConfidence: 0.22,
  /** Unused when exclusiveLock is on — kept for replay-lab tuning. */
  switchScoreMargin: 0.35,
  exclusiveLock: true,
  lockMatchDistance: 0.32,
  smoothingAlpha: 0.35,
  /** Normalized image area — children/short guests allowed smaller faces. */
  minFaceArea: 0.004,
  minBodyArea: 0.02,
  interactionZoneCenterY: 0.55,
  interactionZoneMaxY: 0.98,
  handLandmarkProximity: 0.16,
  handBoxPaddingX: 0.16,
  handBoxPaddingY: 0.22,
  handMatchProximity: 0.12,
  maxPeople: 4,
};

export function createTrackingConfig(
  overrides: Partial<TrackingConfig> = {},
): TrackingConfig {
  return { ...DEFAULT_TRACKING_CONFIG, ...overrides };
}
