import { clamp } from './math';
import type { GestureDebug, TrackingConfig } from './types';

/**
 * Requires a gesture to stay valid for gestureDwellMs before triggering,
 * and requires a return to neutral before the same gesture can fire again.
 */
export class GestureStabilizer {
  private dwellStart: number | null = null;
  private triggered = false;
  private needsNeutral = false;
  private readonly config: TrackingConfig;

  constructor(config: TrackingConfig) {
    this.config = config;
  }

  reset(): void {
    this.dwellStart = null;
    this.triggered = false;
    this.needsNeutral = false;
  }

  update(valid: boolean, timestamp: number): GestureDebug {
    if (!valid) {
      this.dwellStart = null;
      if (this.needsNeutral) {
        this.needsNeutral = false;
        this.triggered = false;
      }
      return {
        confidence: 0,
        dwellProgress: 0,
        armed: !this.needsNeutral,
        triggered: false,
      };
    }

    if (this.needsNeutral) {
      return {
        confidence: 0.2,
        dwellProgress: 0,
        armed: false,
        triggered: false,
      };
    }

    if (this.dwellStart === null) {
      this.dwellStart = timestamp;
    }

    const elapsed = timestamp - this.dwellStart;
    const progress = clamp(elapsed / this.config.gestureDwellMs, 0, 1);

    let justTriggered = false;
    if (progress >= 1 && !this.triggered) {
      this.triggered = true;
      this.needsNeutral = true;
      justTriggered = true;
    }

    return {
      confidence: progress,
      dwellProgress: progress,
      armed: !this.needsNeutral,
      triggered: justTriggered,
    };
  }
}
