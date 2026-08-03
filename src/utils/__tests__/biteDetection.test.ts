import { describe, expect, it } from 'vitest';
import {
  createBiteDetectorState,
  updateBiteDetector,
} from '../biteDetection';

describe('updateBiteDetector mouth hold', () => {
  const mouth = { center: { x: 100, y: 100 }, faceScale: 40 };

  it('accumulates proximity across frames when mouth stays cached', () => {
    let state = createBiteDetectorState();

    state = updateBiteDetector(state, {
      timestamp: 1000,
      donutX: 100,
      donutY: 100,
      donutScale: 80,
      mouth,
      isActive: true,
      faceReady: true,
    });
    expect(state.phase).toBe('held');
    expect(state.proximityFrames).toBe(1);

    state = updateBiteDetector(state, {
      timestamp: 1016,
      donutX: 100,
      donutY: 100,
      donutScale: 80,
      mouth,
      isActive: true,
      faceReady: true,
    });
    expect(state.phase).toBe('exploding');
  });

  it('resets proximity when mouth drops out', () => {
    let state = createBiteDetectorState();

    state = updateBiteDetector(state, {
      timestamp: 1000,
      donutX: 100,
      donutY: 100,
      donutScale: 80,
      mouth,
      isActive: true,
      faceReady: true,
    });
    expect(state.proximityFrames).toBe(1);

    state = updateBiteDetector(state, {
      timestamp: 1016,
      donutX: 100,
      donutY: 100,
      donutScale: 80,
      mouth: null,
      isActive: true,
      faceReady: true,
    });
    expect(state.proximityFrames).toBe(0);
    expect(state.phase).toBe('held');
  });
});
