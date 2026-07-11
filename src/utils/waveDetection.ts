import { WAVE_HOLD_FRAMES } from './donutConfig';

export interface WaveDetectorState {
  wristSamples: number[];
  visibleFrames: number;
}

export function createWaveDetectorState(): WaveDetectorState {
  return { wristSamples: [], visibleFrames: 0 };
}

const MAX_SAMPLES = 18;
const MIN_REVERSALS = 2;
const MIN_DELTA = 0.005;

/** True when the user waves (horizontal motion) or holds a hand in frame briefly. */
export function updateWaveDetector(
  state: WaveDetectorState,
  wristX: number | null,
): boolean {
  if (wristX === null) {
    state.wristSamples = [];
    state.visibleFrames = 0;
    return false;
  }

  state.visibleFrames += 1;
  state.wristSamples.push(wristX);
  if (state.wristSamples.length > MAX_SAMPLES) {
    state.wristSamples.shift();
  }

  if (state.wristSamples.length >= 6) {
    let reversals = 0;
    for (let i = 2; i < state.wristSamples.length; i += 1) {
      const v1 = state.wristSamples[i - 1] - state.wristSamples[i - 2];
      const v2 = state.wristSamples[i] - state.wristSamples[i - 1];
      if (v1 * v2 < 0 && Math.abs(v1) >= MIN_DELTA && Math.abs(v2) >= MIN_DELTA) {
        reversals += 1;
      }
    }
    if (reversals >= MIN_REVERSALS) {
      return true;
    }
  }

  return state.visibleFrames >= WAVE_HOLD_FRAMES;
}

export function resetWaveDetector(state: WaveDetectorState): void {
  state.wristSamples = [];
  state.visibleFrames = 0;
}
