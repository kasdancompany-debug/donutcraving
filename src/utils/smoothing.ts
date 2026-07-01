import {
  FAST_MOVE_THRESHOLD,
  POSE_SMOOTHING,
  POSITION_SMOOTHING,
  POSITION_SMOOTHING_FAST,
} from './donutConfig';

export interface Point {
  x: number;
  y: number;
}

export interface DonutTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  visible: boolean;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPoint(from: Point, to: Point, t: number): Point {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
  };
}

export function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return from + diff * t;
}

export function smoothScalar(
  current: number,
  target: number,
  easing: number,
): number {
  return lerp(current, target, easing);
}

function movementSpeed(current: DonutTransform, target: DonutTransform): number {
  return Math.hypot(target.x - current.x, target.y - current.y);
}

export interface SmoothTransformOptions {
  poseSmoothing?: number;
  positionSmoothing?: number;
  positionSmoothingFast?: number;
  fastMoveThreshold?: number;
}

export function smoothTransform(
  current: DonutTransform,
  target: DonutTransform,
  fadeEasing = POSE_SMOOTHING,
  options: SmoothTransformOptions = {},
): DonutTransform {
  const poseSmoothing = options.poseSmoothing ?? POSE_SMOOTHING;
  const positionSmoothing = options.positionSmoothing ?? POSITION_SMOOTHING;
  const positionSmoothingFast =
    options.positionSmoothingFast ?? POSITION_SMOOTHING_FAST;
  const fastMoveThreshold = options.fastMoveThreshold ?? FAST_MOVE_THRESHOLD;

  if (!target.visible) {
    const scale = lerp(current.scale, 0, fadeEasing);
    if (scale < 4) {
      return { ...DEFAULT_TRANSFORM };
    }
    return { ...current, scale, visible: false };
  }

  if (!current.visible) {
    return { ...target, visible: true };
  }

  const speed = movementSpeed(current, target);
  const positionEase = lerp(
    positionSmoothing,
    positionSmoothingFast,
    Math.min(1, speed / fastMoveThreshold),
  );

  return {
    x: lerp(current.x, target.x, positionEase),
    y: lerp(current.y, target.y, positionEase),
    scale: lerp(current.scale, target.scale, poseSmoothing),
    rotation: lerpAngle(current.rotation, target.rotation, poseSmoothing),
    visible: true,
  };
}

export const DEFAULT_TRANSFORM: DonutTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  visible: false,
};
