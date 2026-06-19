import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  DONUT_OFFSET_X,
  DONUT_OFFSET_Y,
  DONUT_PALM_SCALE_MULTIPLIER,
  DONUT_ROTATION_OFFSET,
  DONUT_SCALE_MULTIPLIER,
  LOCK_DONUT_UPRIGHT,
  MAX_SCALE_RATIO,
  MIN_SCALE_RATIO,
  PALM_BLEND,
} from './donutConfig';

export interface Point {
  x: number;
  y: number;
}

export interface HandLandmarks {
  wrist: NormalizedLandmark;
  indexMcp: NormalizedLandmark;
  indexTip: NormalizedLandmark;
  middleMcp: NormalizedLandmark;
  thumbTip: NormalizedLandmark;
  all: NormalizedLandmark[];
}

export type AnchorSource = 'pinch' | 'partial' | 'palm';

export interface HandPoseDebug {
  wrist: Point;
  indexMcp: Point;
  indexTip: Point;
  thumbTip: Point;
  anchor: Point;
  anchorSource: AnchorSource;
  allLandmarks: Point[];
  thumbReliable: boolean;
  indexReliable: boolean;
  indexTipReliable: boolean;
}

export interface HandPose extends HandPoseDebug {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface VideoCoverRect {
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

/** MediaPipe hand landmark indices. */
export const LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
} as const;

export const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
];

export function getVideoCoverRect(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): VideoCoverRect {
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  if (videoAspect > canvasAspect) {
    const drawHeight = canvasHeight;
    const drawWidth = canvasHeight * videoAspect;
    return {
      offsetX: (canvasWidth - drawWidth) / 2,
      offsetY: 0,
      drawWidth,
      drawHeight,
    };
  }

  const drawWidth = canvasWidth;
  const drawHeight = canvasWidth / videoAspect;
  return {
    offsetX: 0,
    offsetY: (canvasHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}

export function extractPrimaryHand(
  landmarks: NormalizedLandmark[][],
): HandLandmarks | null {
  if (landmarks.length === 0) return null;

  const hand = landmarks[0];
  return {
    wrist: hand[LANDMARK.WRIST],
    indexMcp: hand[LANDMARK.INDEX_MCP],
    indexTip: hand[LANDMARK.INDEX_TIP],
    middleMcp: hand[LANDMARK.MIDDLE_MCP],
    thumbTip: hand[LANDMARK.THUMB_TIP],
    all: hand,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function blendPoints(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * MediaPipe hand landmarks often report visibility = 0 even when accurate.
 * Only treat visibility as unreliable when explicitly low AND non-zero.
 */
function isLandmarkReliable(landmark: NormalizedLandmark): boolean {
  const visibility = landmark.visibility;
  if (visibility === undefined || visibility === null) return true;
  if (visibility === 0) return true;
  return visibility >= 0.2;
}

function createMapper(
  cover: VideoCoverRect,
  mirrored: boolean,
): (landmark: NormalizedLandmark) => Point {
  return (landmark) => {
    const xNorm = mirrored ? 1 - landmark.x : landmark.x;
    return {
      x: cover.offsetX + xNorm * cover.drawWidth,
      y: cover.offsetY + landmark.y * cover.drawHeight,
    };
  };
}

function applyLocalOffset(
  anchor: Point,
  rotation: number,
  offsetX: number,
  offsetY: number,
): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: anchor.x + offsetX * cos - offsetY * sin,
    y: anchor.y + offsetX * sin + offsetY * cos,
  };
}

/**
 * Donut sits in the thumb↔index pinch, nudged slightly into the inner palm.
 * Wrist is never used for placement.
 */
function resolveAnchor(
  indexMcp: Point,
  middleMcp: Point,
  indexTip: Point,
  thumbTip: Point,
): { anchor: Point; source: AnchorSource } {
  const pinch = midpoint(thumbTip, indexTip);
  const innerPalm = midpoint(indexMcp, middleMcp);

  return {
    anchor: blendPoints(pinch, innerPalm, PALM_BLEND),
    source: 'pinch',
  };
}

function resolveRotation(
  indexMcp: Point,
  indexTip: Point,
  thumbTip: Point,
): number {
  if (LOCK_DONUT_UPRIGHT) {
    return 0;
  }

  const pinchSpan = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);

  if (pinchSpan > 6) {
    return (
      Math.atan2(indexTip.y - thumbTip.y, indexTip.x - thumbTip.x) +
      DONUT_ROTATION_OFFSET
    );
  }

  return (
    Math.atan2(indexTip.y - indexMcp.y, indexTip.x - indexMcp.x) +
    DONUT_ROTATION_OFFSET
  );
}

function resolveScale(
  indexMcp: Point,
  indexTip: Point,
  thumbTip: Point,
  canvasSize: number,
): number {
  const pinchSpan = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  const gripSpan = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - indexMcp.y);

  const rawScale =
    pinchSpan > 8
      ? pinchSpan * DONUT_SCALE_MULTIPLIER
      : gripSpan * DONUT_PALM_SCALE_MULTIPLIER;

  return clamp(
    rawScale,
    canvasSize * MIN_SCALE_RATIO,
    canvasSize * MAX_SCALE_RATIO,
  );
}

/**
 * Estimates donut placement for a natural grip pose.
 * Anchors on the thumb↔index pinch with soft fallbacks.
 */
export function estimateHandPose(
  hand: HandLandmarks,
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number,
  mirrored: boolean,
): HandPose {
  const cover = getVideoCoverRect(
    videoWidth,
    videoHeight,
    canvasWidth,
    canvasHeight,
  );
  const toCanvas = createMapper(cover, mirrored);

  const wrist = toCanvas(hand.wrist);
  const indexMcp = toCanvas(hand.indexMcp);
  const middleMcp = toCanvas(hand.middleMcp);
  const indexTip = toCanvas(hand.indexTip);
  const thumbTip = toCanvas(hand.thumbTip);
  const allLandmarks = hand.all.map(toCanvas);

  const { anchor, source: anchorSource } = resolveAnchor(
    indexMcp,
    middleMcp,
    indexTip,
    thumbTip,
  );

  const rotation = resolveRotation(indexMcp, indexTip, thumbTip);
  const canvasSize = Math.min(canvasWidth, canvasHeight);
  const scale = resolveScale(indexMcp, indexTip, thumbTip, canvasSize);

  const positioned = applyLocalOffset(
    anchor,
    rotation,
    DONUT_OFFSET_X,
    DONUT_OFFSET_Y,
  );

  return {
    wrist,
    indexMcp,
    indexTip,
    thumbTip,
    anchor,
    anchorSource,
    allLandmarks,
    thumbReliable: isLandmarkReliable(hand.thumbTip),
    indexReliable: isLandmarkReliable(hand.indexMcp),
    indexTipReliable: isLandmarkReliable(hand.indexTip),
    x: positioned.x,
    y: positioned.y,
    scale,
    rotation,
  };
}

export function measureHandScale(pose: HandPose, canvasSize: number): number {
  return pose.scale / canvasSize;
}
