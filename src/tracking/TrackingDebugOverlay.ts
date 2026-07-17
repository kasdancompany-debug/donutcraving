import { sansFont } from '../config/theme';
import type { TrackingSnapshot } from './types';

export interface TrackingDebugOverlayOptions {
  fps: number;
  inferenceMs: number;
  /** When true, landmark X is mirrored for display (selfie camera). */
  mirrored?: boolean;
}

/**
 * Canvas debug HUD for primary-subject tracking (developer only).
 * Toggle from the app with the existing debug shortcut when ?debug=1.
 */
export function drawTrackingDebugOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: TrackingSnapshot,
  options: TrackingDebugOverlayOptions,
): void {
  const mirrorX = (x: number) => (options.mirrored ? 1 - x : x);
  const toX = (x: number) => mirrorX(x) * width;
  const toY = (y: number) => y * height;

  const strokeBox = (
    box: { x: number; y: number; width: number; height: number },
    color: string,
    lineWidth: number,
  ) => {
    const x1 = toX(box.x);
    const x2 = toX(box.x + box.width);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(
      Math.min(x1, x2),
      toY(box.y),
      Math.abs(x2 - x1),
      box.height * height,
    );
  };

  ctx.save();

  for (const candidate of snapshot.candidates) {
    strokeBox(candidate.box, 'rgba(212, 165, 116, 0.75)', 2);
    ctx.fillStyle = 'rgba(250, 246, 239, 0.9)';
    ctx.font = sansFont(12, 600);
    ctx.fillText(
      `score ${candidate.score.toFixed(2)}`,
      Math.min(toX(candidate.box.x), toX(candidate.box.x + candidate.box.width)),
      toY(candidate.box.y) - 6,
    );
  }

  if (snapshot.activeSubject) {
    strokeBox(snapshot.activeSubject.smoothedBox, 'rgba(120, 220, 160, 0.95)', 3);

    const torso = snapshot.activeSubject.torsoCenter;
    ctx.fillStyle = 'rgba(120, 220, 160, 0.95)';
    ctx.beginPath();
    ctx.arc(toX(torso.x), toY(torso.y), 6, 0, Math.PI * 2);
    ctx.fill();

    if (snapshot.activeSubject.faceCenter) {
      const f = snapshot.activeSubject.faceCenter;
      ctx.fillStyle = 'rgba(232, 160, 168, 0.95)';
      ctx.beginPath();
      ctx.arc(toX(f.x), toY(f.y), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const hand of snapshot.associatedHands) {
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(hand.wrist.x), toY(hand.wrist.y), 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (snapshot.controllingHand) {
    const h = snapshot.controllingHand;
    ctx.fillStyle = 'rgba(100, 180, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(toX(h.center.x), toY(h.center.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const lines = [
    `State: ${snapshot.state}`,
    `Active: ${snapshot.activeSubject?.trackingId ?? 'none'}`,
    `Acquire: ${snapshot.acquisitionElapsedMs.toFixed(0)}ms`,
    `Missing: ${snapshot.missingGraceElapsedMs.toFixed(0)}ms`,
    `Cooldown: ${snapshot.cooldownRemainingMs.toFixed(0)}ms`,
    `Gesture: ${(snapshot.gesture.dwellProgress * 100).toFixed(0)}% conf=${snapshot.gesture.confidence.toFixed(2)}`,
    `FPS: ${options.fps.toFixed(1)}  infer: ${options.inferenceMs.toFixed(1)}ms`,
    `Candidates: ${snapshot.candidates.length}  Hands: ${snapshot.associatedHands.length}`,
  ];

  ctx.fillStyle = 'rgba(20, 12, 8, 0.55)';
  ctx.fillRect(8, 8, 320, 12 + lines.length * 18);
  ctx.fillStyle = 'rgba(250, 246, 239, 0.95)';
  ctx.font = sansFont(13, 600);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, 16, 14 + i * 18);
  });

  ctx.restore();
}

/** Alias matching the requested module name. */
export const TrackingDebugOverlay = {
  draw: drawTrackingDebugOverlay,
};
