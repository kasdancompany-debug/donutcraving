import { describe, expect, it } from 'vitest';
import {
  exportTrackingConfigJson,
  summarizeTrackingSession,
  type TrackingEvent,
} from '../events';
import { DEFAULT_TRACKING_CONFIG } from '../config';

describe('tracking session summary', () => {
  it('aggregates switches, lost locks, reacquisitions and inference', () => {
    const events: TrackingEvent[] = [
      { type: 'subject_locked', timestamp: 1000, subjectId: 'subj_1' },
      { type: 'subject_temporarily_missing', timestamp: 1500, subjectId: 'subj_1' },
      { type: 'subject_reacquired', timestamp: 1700, subjectId: 'subj_1' },
      { type: 'subject_released', timestamp: 2200, subjectId: 'subj_1' },
      { type: 'subject_locked', timestamp: 3000, subjectId: 'subj_2' },
      { type: 'gesture_started', timestamp: 3100 },
      { type: 'gesture_cancelled', timestamp: 3200 },
      { type: 'gesture_triggered', timestamp: 3600 },
    ];

    const summary = summarizeTrackingSession(events, [10, 20, 30]);
    expect(summary.subjectSwitches).toBe(1);
    expect(summary.lostLocks).toBe(1);
    expect(summary.reacquisitions).toBe(1);
    expect(summary.falseTriggers).toBe(1);
    expect(summary.averageInferenceMs).toBe(20);
    expect(summary.totalEvents).toBe(8);
  });

  it('exports tracking config as JSON', () => {
    const json = exportTrackingConfigJson(DEFAULT_TRACKING_CONFIG);
    expect(JSON.parse(json).acquireHoldMs).toBe(650);
  });
});
