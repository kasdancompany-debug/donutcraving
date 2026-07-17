/** Shared geometry helpers for primary-subject tracking (normalized 0–1 space). */

export interface Point2 {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function midpoint(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function boxCenter(box: BoundingBox): Point2 {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function boxArea(box: BoundingBox): number {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

export function expandBox(box: BoundingBox, padX: number, padY: number): BoundingBox {
  return {
    x: box.x - padX,
    y: box.y - padY,
    width: box.width + padX * 2,
    height: box.height + padY * 2,
  };
}

export function pointInBox(point: Point2, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

export function boxFromPoints(points: Point2[], pad = 0.02): BoundingBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/** Exponential moving average for a 2D point. Higher alpha = snappier. */
export function smoothPoint(
  previous: Point2 | null,
  next: Point2,
  alpha: number,
): Point2 {
  if (!previous) return { ...next };
  const a = clamp(alpha, 0, 1);
  return {
    x: previous.x + (next.x - previous.x) * a,
    y: previous.y + (next.y - previous.y) * a,
  };
}

export function smoothBox(
  previous: BoundingBox | null,
  next: BoundingBox,
  alpha: number,
): BoundingBox {
  if (!previous) return { ...next };
  const a = clamp(alpha, 0, 1);
  return {
    x: previous.x + (next.x - previous.x) * a,
    y: previous.y + (next.y - previous.y) * a,
    width: previous.width + (next.width - previous.width) * a,
    height: previous.height + (next.height - previous.height) * a,
  };
}

export function estimateVelocity(
  previous: Point2 | null,
  next: Point2,
  dtMs: number,
): Point2 {
  if (!previous || dtMs <= 0) return { x: 0, y: 0 };
  const dt = dtMs / 1000;
  return {
    x: (next.x - previous.x) / dt,
    y: (next.y - previous.y) / dt,
  };
}

export function predictPoint(point: Point2, velocity: Point2, dtMs: number): Point2 {
  const dt = dtMs / 1000;
  return {
    x: point.x + velocity.x * dt,
    y: point.y + velocity.y * dt,
  };
}
