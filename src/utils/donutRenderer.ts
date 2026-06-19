import { COLORS, rgba } from '../config/theme';

/** Set false in branding to use a custom PNG instead of the built-in premium donut. */
export const USE_PROCEDURAL_DONUT = true;

const SPRINKLE_COLORS = [
  COLORS.pinkGlaze,
  COLORS.pinkGlazeSoft,
  COLORS.caramelLight,
  COLORS.creamLight,
  '#ffffff',
  COLORS.caramel,
];

interface Sprinkle {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
}

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function createSprinkles(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  count: number,
): Sprinkle[] {
  const rand = seededRandom(42);
  const sprinkles: Sprinkle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = innerR + (outerR - innerR) * (0.35 + rand() * 0.55);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    // Keep sprinkles on the glazed top half
    if (y > cy + outerR * 0.12) continue;

    sprinkles.push({
      x,
      y,
      w: outerR * (0.045 + rand() * 0.025),
      h: outerR * (0.014 + rand() * 0.01),
      rotation: rand() * Math.PI,
      color: SPRINKLE_COLORS[Math.floor(rand() * SPRINKLE_COLORS.length)],
    });
  }

  return sprinkles;
}

function clipDonutRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
}

function drawDoughBase(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
) {
  clipDonutRing(ctx, cx, cy, outerR, innerR);

  const doughGrad = ctx.createRadialGradient(
    cx - outerR * 0.25,
    cy - outerR * 0.3,
    innerR * 0.5,
    cx + outerR * 0.1,
    cy + outerR * 0.15,
    outerR * 1.15,
  );
  doughGrad.addColorStop(0, '#F2D4A8');
  doughGrad.addColorStop(0.35, '#E8B878');
  doughGrad.addColorStop(0.65, '#C8874A');
  doughGrad.addColorStop(1, '#8B5A2B');

  ctx.fillStyle = doughGrad;
  ctx.fill();

  // Fried edge crust
  ctx.lineWidth = outerR * 0.035;
  ctx.strokeStyle = 'rgba(107, 62, 30, 0.45)';
  ctx.stroke();
}

function drawHoleDepth(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
) {
  const holeGrad = ctx.createRadialGradient(
    cx,
    cy - innerR * 0.15,
    innerR * 0.1,
    cx,
    cy,
    innerR * 1.15,
  );
  holeGrad.addColorStop(0, 'rgba(20, 10, 5, 0.55)');
  holeGrad.addColorStop(0.55, 'rgba(42, 24, 16, 0.35)');
  holeGrad.addColorStop(1, 'rgba(62, 36, 24, 0)');

  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 1.08, 0, Math.PI * 2);
  ctx.fillStyle = holeGrad;
  ctx.fill();
}

function drawGlaze(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
) {
  ctx.save();
  clipDonutRing(ctx, cx, cy, outerR, innerR);
  ctx.clip();

  // Main pink glaze cap on top
  ctx.beginPath();
  ctx.ellipse(cx, cy - outerR * 0.18, outerR * 1.02, outerR * 0.72, 0, 0, Math.PI * 2);

  const glazeGrad = ctx.createRadialGradient(
    cx - outerR * 0.15,
    cy - outerR * 0.55,
    outerR * 0.05,
    cx,
    cy - outerR * 0.1,
    outerR * 1.05,
  );
  glazeGrad.addColorStop(0, rgba(COLORS.creamLight, 0.95));
  glazeGrad.addColorStop(0.25, rgba(COLORS.pinkGlazeSoft, 0.92));
  glazeGrad.addColorStop(0.55, rgba(COLORS.pinkGlaze, 0.88));
  glazeGrad.addColorStop(0.85, rgba(COLORS.pinkGlaze, 0.55));
  glazeGrad.addColorStop(1, rgba(COLORS.caramel, 0.15));

  ctx.fillStyle = glazeGrad;
  ctx.fill();

  // Icing drips
  const drips = [
    { x: cx - outerR * 0.38, w: outerR * 0.11, len: outerR * 0.28 },
    { x: cx - outerR * 0.12, w: outerR * 0.09, len: outerR * 0.22 },
    { x: cx + outerR * 0.18, w: outerR * 0.1, len: outerR * 0.26 },
    { x: cx + outerR * 0.42, w: outerR * 0.08, len: outerR * 0.2 },
  ];

  for (const drip of drips) {
    const top = cy + outerR * 0.02;
    ctx.beginPath();
    ctx.moveTo(drip.x - drip.w / 2, top);
    ctx.bezierCurveTo(
      drip.x - drip.w * 0.4,
      top + drip.len * 0.45,
      drip.x - drip.w * 0.15,
      top + drip.len * 0.85,
      drip.x,
      top + drip.len,
    );
    ctx.bezierCurveTo(
      drip.x + drip.w * 0.15,
      top + drip.len * 0.85,
      drip.x + drip.w * 0.4,
      top + drip.len * 0.45,
      drip.x + drip.w / 2,
      top,
    );
    ctx.closePath();
    ctx.fillStyle = rgba(COLORS.pinkGlaze, 0.9);
    ctx.fill();
  }

  ctx.restore();
}

function drawSprinkles(
  ctx: CanvasRenderingContext2D,
  sprinkles: Sprinkle[],
) {
  for (const s of sprinkles) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);
    ctx.fillStyle = s.color;
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 1;
    ctx.beginPath();
    ctx.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, s.h / 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSpecularHighlight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.beginPath();
  ctx.ellipse(
    cx - outerR * 0.22,
    cy - outerR * 0.38,
    outerR * 0.28,
    outerR * 0.14,
    -0.35,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();
  ctx.restore();
}

function drawDropShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.beginPath();
  ctx.ellipse(cx, cy + outerR * 0.92, outerR * 0.75, outerR * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(62, 36, 24, 0.22)';
  ctx.filter = 'blur(6px)';
  ctx.fill();
  ctx.restore();
}

/**
 * Renders a premium Kasdan-style donut with pink glaze, drips, and sprinkles.
 * Transparent background — ready for canvas overlay compositing.
 */
export function renderPremiumDonut(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2 - size * 0.04;
  const outerR = size * 0.4;
  const innerR = size * 0.165;

  drawDropShadow(ctx, cx, cy, outerR);
  drawDoughBase(ctx, cx, cy, outerR, innerR);
  drawHoleDepth(ctx, cx, cy, innerR);
  drawGlaze(ctx, cx, cy, outerR, innerR);
  drawSprinkles(ctx, createSprinkles(cx, cy, outerR, innerR, 38));
  drawSpecularHighlight(ctx, cx, cy, outerR);

  return canvas;
}

let cachedDonut: HTMLCanvasElement | null = null;

export function getPremiumDonutCanvas(): HTMLCanvasElement {
  if (!cachedDonut) {
    cachedDonut = renderPremiumDonut(512);
  }
  return cachedDonut;
}

export function loadDonutImage(imagePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load donut image: ${imagePath}`));
    image.src = imagePath;
  });
}

/**
 * Returns the donut drawable — procedural premium art by default,
 * or a custom PNG from `public/assets/` when USE_PROCEDURAL_DONUT is false.
 */
export async function resolveDonutDrawable(
  imagePath: string,
): Promise<CanvasImageSource> {
  if (USE_PROCEDURAL_DONUT) {
    return getPremiumDonutCanvas();
  }
  return loadDonutImage(imagePath);
}

/** Data URL for <img> tags (attract screen floating donuts). */
export function getPremiumDonutDataUrl(): string {
  return getPremiumDonutCanvas().toDataURL('image/png');
}
