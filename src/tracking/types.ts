import type { BoundingBox, Point2 } from './math';

export type TrackingState =
  | 'IDLE'
  | 'ACQUIRING'
  | 'LOCKED'
  | 'INTERACTING'
  | 'COOLDOWN';

export interface PoseLandmarksNorm {
  nose?: Point2;
  leftShoulder?: Point2;
  rightShoulder?: Point2;
  leftElbow?: Point2;
  rightElbow?: Point2;
  leftWrist?: Point2;
  rightWrist?: Point2;
  leftHip?: Point2;
  rightHip?: Point2;
  /** Visibility-weighted confidence 0–1 for the pose as a whole. */
  confidence: number;
}

export interface PersonCandidate {
  /** Stable within a single frame only (index-based). Continuity is tracker-owned. */
  frameId: string;
  box: BoundingBox;
  faceCenter: Point2 | null;
  torsoCenter: Point2;
  pose: PoseLandmarksNorm | null;
  detectionConfidence: number;
  faceVisible: boolean;
  poseVisible: boolean;
  /** Continuously visible duration in ms (filled by tracker). */
  visibleMs: number;
  /** Distance from previous active location (filled by tracker). */
  distanceFromActive: number;
}

export interface HandObservation {
  id: string;
  wrist: Point2;
  center: Point2;
  landmarks: Point2[];
  confidence: number;
}

export interface FaceObservation {
  id: string;
  center: Point2;
  box: BoundingBox;
  confidence: number;
}

export interface ActiveSubject {
  trackingId: string;
  box: BoundingBox;
  smoothedBox: BoundingBox;
  faceCenter: Point2 | null;
  torsoCenter: Point2;
  poseLandmarks: PoseLandmarksNorm | null;
  leftHand: HandObservation | null;
  rightHand: HandObservation | null;
  firstSeenAt: number;
  lastSeenAt: number;
  missingSince: number | null;
  confidence: number;
  velocity: Point2;
}

export interface TrackingFrameInput {
  timestamp: number;
  people: PersonCandidate[];
  hands: HandObservation[];
  faces: FaceObservation[];
  /** True when the guest’s controlling hand is in the “active” interaction zone. */
  interactionActive?: boolean;
  /** True while a stabilized gesture is considered valid this frame. */
  gestureValid?: boolean;
}

export interface GestureDebug {
  confidence: number;
  dwellProgress: number;
  armed: boolean;
  triggered: boolean;
}

export interface TrackingSnapshot {
  state: TrackingState;
  activeSubject: ActiveSubject | null;
  candidates: Array<PersonCandidate & { score: number }>;
  associatedHands: HandObservation[];
  acquisitionElapsedMs: number;
  missingGraceElapsedMs: number;
  cooldownRemainingMs: number;
  gesture: GestureDebug;
  controllingHand: HandObservation | null;
}

export interface TrackingConfig {
  acquireHoldMs: number;
  missingGraceMs: number;
  cooldownMs: number;
  gestureDwellMs: number;
  acquireConfidence: number;
  keepConfidence: number;
  switchScoreMargin: number;
  smoothingAlpha: number;
  minFaceArea: number;
  minBodyArea: number;
  interactionZoneCenterY: number;
  /** Lower Y extent of valid interaction (supports children). */
  interactionZoneMaxY: number;
  handLandmarkProximity: number;
  handBoxPaddingX: number;
  handBoxPaddingY: number;
  handMatchProximity: number;
  maxPeople: number;
}
