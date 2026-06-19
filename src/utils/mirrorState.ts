import { measureHandScale } from './handMath';
import type { HandLandmarks } from './handMath';
import { PROXIMITY_SCALE_RATIO } from './donutConfig';
import type { HandPose } from './handMath';

export type MirrorMode = 'idle' | 'active';

export function isHandCloseEnough(scaleRatio: number): boolean {
  return scaleRatio >= PROXIMITY_SCALE_RATIO;
}

export function resolveMirrorMode(
  hand: HandLandmarks | null,
  pose: HandPose | null,
  canvasWidth: number,
  canvasHeight: number,
): MirrorMode {
  if (!hand || !pose) return 'idle';
  const canvasSize = Math.min(canvasWidth, canvasHeight);
  return isHandCloseEnough(measureHandScale(pose, canvasSize)) ? 'active' : 'idle';
}
