export type {
  TrackingState,
  ActiveSubject,
  PersonCandidate,
  HandObservation,
  FaceObservation,
  TrackingFrameInput,
  TrackingSnapshot,
  TrackingConfig,
  GestureDebug,
  PoseLandmarksNorm,
} from './types';

export { DEFAULT_TRACKING_CONFIG, createTrackingConfig } from './config';
export { CandidateScorer, candidateAnchor } from './CandidateScorer';
export { HandAssociator } from './HandAssociator';
export { GestureStabilizer } from './GestureStabilizer';
export { SubjectTracker, TrackingStateMachine } from './SubjectTracker';
export {
  drawTrackingDebugOverlay,
  TrackingDebugOverlay,
} from './TrackingDebugOverlay';
export {
  buildPeopleCandidates,
  peopleFromHands,
  handsFromLandmarks,
  facesFromLandmarks,
  poseFromLandmarks,
  personFromPose,
  POSE_LANDMARK,
} from './detections';
export type {
  TrackingEvent,
  TrackingEventType,
  TrackingEventListener,
  PlaybackSummary,
} from './events';
export {
  summarizeTrackingSession,
  exportTrackingConfigJson,
} from './events';
