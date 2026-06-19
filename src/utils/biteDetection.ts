import type { MouthPose } from './faceMath';
import {
  BITE_COOLDOWN_MS,
  BITE_DISTANCE_RATIO,
  BITE_HOLD_FRAMES,
  EXPLOSION_DURATION_MS,
  RESPAWN_DURATION_MS,
} from './donutConfig';

export type BitePhase = 'held' | 'exploding' | 'respawning';

export interface BiteDetectorState {
  phase: BitePhase;
  proximityFrames: number;
  lastBiteAt: number;
  phaseStartedAt: number;
}

export function createBiteDetectorState(): BiteDetectorState {
  return {
    phase: 'held',
    proximityFrames: 0,
    lastBiteAt: -Infinity,
    phaseStartedAt: 0,
  };
}

export interface BiteCheckInput {
  timestamp: number;
  donutX: number;
  donutY: number;
  donutScale: number;
  mouth: MouthPose | null;
  isActive: boolean;
  faceReady: boolean;
}

export function getBiteRadius(donutScale: number, mouth: MouthPose): number {
  const donutRadius = donutScale * 0.48;
  const mouthSlack = mouth.faceScale * 0.38;
  return donutRadius + Math.max(mouthSlack, donutScale * BITE_DISTANCE_RATIO);
}

function isDonutNearMouth(
  donutX: number,
  donutY: number,
  donutScale: number,
  mouth: MouthPose,
): boolean {
  const centerDistance = Math.hypot(
    donutX - mouth.center.x,
    donutY - mouth.center.y,
  );
  return centerDistance < getBiteRadius(donutScale, mouth);
}

export function updateBiteDetector(
  state: BiteDetectorState,
  input: BiteCheckInput,
): BiteDetectorState {
  const { timestamp, mouth, isActive, faceReady } = input;
  let next = { ...state };

  if (next.phase === 'exploding') {
    if (timestamp - next.phaseStartedAt >= EXPLOSION_DURATION_MS) {
      next = {
        ...next,
        phase: 'respawning',
        phaseStartedAt: timestamp,
      };
    }
    return next;
  }

  if (next.phase === 'respawning') {
    if (timestamp - next.phaseStartedAt >= RESPAWN_DURATION_MS) {
      next = {
        ...next,
        phase: 'held',
        proximityFrames: 0,
      };
    }
    return next;
  }

  if (
    !isActive ||
    !faceReady ||
    !mouth ||
    timestamp - next.lastBiteAt < BITE_COOLDOWN_MS
  ) {
    next.proximityFrames = 0;
    return next;
  }

  if (isDonutNearMouth(input.donutX, input.donutY, input.donutScale, mouth)) {
    next.proximityFrames += 1;
    if (next.proximityFrames >= BITE_HOLD_FRAMES) {
      return {
        phase: 'exploding',
        proximityFrames: 0,
        lastBiteAt: timestamp,
        phaseStartedAt: timestamp,
      };
    }
    return next;
  }

  next.proximityFrames = 0;
  return next;
}

export function getRespawnProgress(state: BiteDetectorState, timestamp: number): number {
  if (state.phase !== 'respawning') return 1;
  const elapsed = timestamp - state.phaseStartedAt;
  return Math.min(1, elapsed / RESPAWN_DURATION_MS);
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
