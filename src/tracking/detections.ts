import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  boxFromPoints,
  midpoint,
  type Point2,
} from './math';
import type {
  FaceObservation,
  HandObservation,
  PersonCandidate,
  PoseLandmarksNorm,
} from './types';

/** MediaPipe Pose Landmarker indices (BlazePose). */
export const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

function lmPoint(lm: NormalizedLandmark | undefined): Point2 | undefined {
  if (!lm || (lm.visibility !== undefined && lm.visibility < 0.3)) return undefined;
  return { x: lm.x, y: lm.y };
}

export function poseFromLandmarks(
  landmarks: NormalizedLandmark[],
): PoseLandmarksNorm | null {
  if (!landmarks.length) return null;

  const nose = lmPoint(landmarks[POSE_LANDMARK.NOSE]);
  const leftShoulder = lmPoint(landmarks[POSE_LANDMARK.LEFT_SHOULDER]);
  const rightShoulder = lmPoint(landmarks[POSE_LANDMARK.RIGHT_SHOULDER]);
  const leftElbow = lmPoint(landmarks[POSE_LANDMARK.LEFT_ELBOW]);
  const rightElbow = lmPoint(landmarks[POSE_LANDMARK.RIGHT_ELBOW]);
  const leftWrist = lmPoint(landmarks[POSE_LANDMARK.LEFT_WRIST]);
  const rightWrist = lmPoint(landmarks[POSE_LANDMARK.RIGHT_WRIST]);
  const leftHip = lmPoint(landmarks[POSE_LANDMARK.LEFT_HIP]);
  const rightHip = lmPoint(landmarks[POSE_LANDMARK.RIGHT_HIP]);

  if (!leftShoulder && !rightShoulder && !leftHip && !rightHip && !nose) {
    return null;
  }

  const visibles = landmarks.filter((l) => (l.visibility ?? 1) >= 0.3);
  const confidence =
    visibles.length === 0
      ? 0.3
      : visibles.reduce((s, l) => s + (l.visibility ?? 0.7), 0) / visibles.length;

  return {
    nose,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    confidence,
  };
}

export function personFromPose(
  pose: PoseLandmarksNorm,
  index: number,
): PersonCandidate {
  const points: Point2[] = [
    pose.nose,
    pose.leftShoulder,
    pose.rightShoulder,
    pose.leftElbow,
    pose.rightElbow,
    pose.leftWrist,
    pose.rightWrist,
    pose.leftHip,
    pose.rightHip,
  ].filter((p): p is Point2 => !!p);

  const shoulderMid =
    pose.leftShoulder && pose.rightShoulder
      ? midpoint(pose.leftShoulder, pose.rightShoulder)
      : pose.leftShoulder ?? pose.rightShoulder ?? pose.nose;

  const hipMid =
    pose.leftHip && pose.rightHip
      ? midpoint(pose.leftHip, pose.rightHip)
      : pose.leftHip ?? pose.rightHip;

  const torsoCenter =
    shoulderMid && hipMid
      ? midpoint(shoulderMid, hipMid)
      : shoulderMid ?? hipMid ?? pose.nose ?? { x: 0.5, y: 0.55 };

  const faceCenter = pose.nose ?? shoulderMid ?? null;

  return {
    frameId: `pose_${index}`,
    box: boxFromPoints(points.length ? points : [torsoCenter], 0.04),
    faceCenter,
    torsoCenter,
    pose,
    detectionConfidence: pose.confidence,
    faceVisible: !!pose.nose,
    poseVisible: true,
    visibleMs: 0,
    distanceFromActive: 0,
  };
}

/**
 * Build people list from poses, falling back to faces when pose is unavailable
 * (children may lack a strong face signal — pose torso is preferred).
 */
export function buildPeopleCandidates(
  poses: PoseLandmarksNorm[],
  faces: FaceObservation[],
): PersonCandidate[] {
  if (poses.length > 0) {
    return poses.map((pose, index) => {
      const person = personFromPose(pose, index);
      // Attach nearest face if present (does not require face to stay valid).
      let bestFace: FaceObservation | null = null;
      let bestDist = 0.2;
      for (const face of faces) {
        const anchor = person.faceCenter ?? person.torsoCenter;
        const d = Math.hypot(face.center.x - anchor.x, face.center.y - anchor.y);
        if (d < bestDist) {
          bestDist = d;
          bestFace = face;
        }
      }
      if (bestFace) {
        person.faceCenter = bestFace.center;
        person.faceVisible = true;
        person.detectionConfidence = Math.max(
          person.detectionConfidence,
          bestFace.confidence,
        );
      }
      return person;
    });
  }

  // Face-only fallback when pose model is cold / disabled.
  return faces.map((face, index) => ({
    frameId: `face_${index}`,
    box: { ...face.box },
    faceCenter: face.center,
    torsoCenter: { x: face.center.x, y: Math.min(0.95, face.center.y + 0.18) },
    pose: null,
    detectionConfidence: face.confidence,
    faceVisible: true,
    poseVisible: false,
    visibleMs: 0,
    distanceFromActive: 0,
  }));
}

export function handsFromLandmarks(
  landmarkSets: NormalizedLandmark[][],
): HandObservation[] {
  return landmarkSets.map((landmarks, index) => {
    const wrist = landmarks[0];
    const tips = [4, 8, 12, 16, 20].map((i) => landmarks[i]).filter(Boolean);
    const center = tips.length
      ? {
          x: tips.reduce((s, l) => s + l.x, wrist.x) / (tips.length + 1),
          y: tips.reduce((s, l) => s + l.y, wrist.y) / (tips.length + 1),
        }
      : { x: wrist.x, y: wrist.y };

    return {
      id: `hand_${index}`,
      wrist: { x: wrist.x, y: wrist.y },
      center,
      landmarks: landmarks.map((l) => ({ x: l.x, y: l.y })),
      confidence: 0.7,
    };
  });
}

export function facesFromLandmarks(
  faceLandmarkSets: NormalizedLandmark[][],
): FaceObservation[] {
  return faceLandmarkSets.map((face, index) => {
    const nose = face[1] ?? face[4] ?? face[0];
    const points = face.slice(0, 50).map((l) => ({ x: l.x, y: l.y }));
    return {
      id: `face_${index}`,
      center: { x: nose.x, y: nose.y },
      box: boxFromPoints(points, 0.02),
      confidence: 0.65,
    };
  });
}

/** When pose/face are cold, treat the strongest hand as a person so control never stalls. */
export function peopleFromHands(hands: HandObservation[]): PersonCandidate[] {
  return hands.map((hand, index) => {
    const faceCenter = {
      x: hand.wrist.x,
      y: Math.max(0.05, hand.wrist.y - 0.18),
    };
    return {
      frameId: `hand_person_${index}`,
      box: boxFromPoints([hand.wrist, hand.center, faceCenter], 0.1),
      faceCenter,
      torsoCenter: hand.center,
      pose: null,
      detectionConfidence: Math.max(0.5, hand.confidence),
      faceVisible: true,
      poseVisible: false,
      visibleMs: 0,
      distanceFromActive: 0,
    };
  });
}
