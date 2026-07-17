import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { getVideoCoverRect, type Point } from './handMath';

/** MediaPipe face mesh landmark indices. */
export const FACE_LANDMARK = {
  UPPER_LIP: 13,
  LOWER_LIP: 14,
  LEFT_EYE: 33,
  RIGHT_EYE: 263,
} as const;

export interface MouthPose {
  center: Point;
  /** Inter-ocular span in canvas pixels — used to normalize bite distance. */
  faceScale: number;
}

function createMapper(
  cover: ReturnType<typeof getVideoCoverRect>,
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

export function extractMouthPose(
  faceLandmarks: NormalizedLandmark[][],
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number,
  mirrored = true,
  faceIndex = 0,
): MouthPose | null {
  if (faceLandmarks.length === 0 || !faceLandmarks[faceIndex]) return null;

  const face = faceLandmarks[faceIndex];
  const cover = getVideoCoverRect(
    videoWidth,
    videoHeight,
    canvasWidth,
    canvasHeight,
  );
  const toCanvas = createMapper(cover, mirrored);

  const upperLip = toCanvas(face[FACE_LANDMARK.UPPER_LIP]);
  const lowerLip = toCanvas(face[FACE_LANDMARK.LOWER_LIP]);
  const leftEye = toCanvas(face[FACE_LANDMARK.LEFT_EYE]);
  const rightEye = toCanvas(face[FACE_LANDMARK.RIGHT_EYE]);

  const center = {
    x: (upperLip.x + lowerLip.x) / 2,
    y: (upperLip.y + lowerLip.y) / 2,
  };
  const faceScale = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

  if (faceScale < 8) return null;

  return { center, faceScale };
}
