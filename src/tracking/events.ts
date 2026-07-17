import type { TrackingConfig, TrackingState } from './types';

export type TrackingEventType =
  | 'candidate_entered'
  | 'acquisition_started'
  | 'subject_locked'
  | 'hand_associated'
  | 'gesture_started'
  | 'gesture_cancelled'
  | 'gesture_triggered'
  | 'subject_temporarily_missing'
  | 'subject_reacquired'
  | 'subject_released';

export interface TrackingEvent {
  type: TrackingEventType;
  timestamp: number;
  detail?: string;
  subjectId?: string;
}

export interface PlaybackSummary {
  subjectSwitches: number;
  falseTriggers: number;
  lostLocks: number;
  reacquisitions: number;
  averageInferenceMs: number;
  eventCounts: Record<TrackingEventType, number>;
  totalEvents: number;
  durationMs: number;
}

const EMPTY_COUNTS = (): Record<TrackingEventType, number> => ({
  candidate_entered: 0,
  acquisition_started: 0,
  subject_locked: 0,
  hand_associated: 0,
  gesture_started: 0,
  gesture_cancelled: 0,
  gesture_triggered: 0,
  subject_temporarily_missing: 0,
  subject_reacquired: 0,
  subject_released: 0,
});

export function summarizeTrackingSession(
  events: TrackingEvent[],
  inferenceSamplesMs: number[],
): PlaybackSummary {
  const eventCounts = EMPTY_COUNTS();
  for (const event of events) {
    eventCounts[event.type] += 1;
  }

  const lockedIds: string[] = [];
  for (const event of events) {
    if (event.type === 'subject_locked' && event.subjectId) {
      lockedIds.push(event.subjectId);
    }
  }
  let subjectSwitches = 0;
  for (let i = 1; i < lockedIds.length; i += 1) {
    if (lockedIds[i] !== lockedIds[i - 1]) subjectSwitches += 1;
  }

  const averageInferenceMs =
    inferenceSamplesMs.length === 0
      ? 0
      : inferenceSamplesMs.reduce((sum, value) => sum + value, 0) /
        inferenceSamplesMs.length;

  const first = events[0]?.timestamp ?? 0;
  const last = events[events.length - 1]?.timestamp ?? first;

  return {
    subjectSwitches,
    falseTriggers: eventCounts.gesture_cancelled,
    lostLocks: eventCounts.subject_temporarily_missing,
    reacquisitions: eventCounts.subject_reacquired,
    averageInferenceMs,
    eventCounts,
    totalEvents: events.length,
    durationMs: Math.max(0, last - first),
  };
}

export function exportTrackingConfigJson(config: TrackingConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export type TrackingEventListener = (event: TrackingEvent) => void;

/** Lightweight helpers used while instrumenting state transitions. */
export function describeStateChange(
  from: TrackingState,
  to: TrackingState,
): string {
  return `${from} → ${to}`;
}
