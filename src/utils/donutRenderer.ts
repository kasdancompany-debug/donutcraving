import { COLORS } from '../config/theme';

/** Set false to use the donut image at public/assets/donut.png */
export const USE_PROCEDURAL_DONUT = false;

const OUTLINE = '#2A1810';
const OUTLINE_WIDTH_RATIO = 0.028;

interface Jimmi {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

interface GoldPearl {
  x: number;
  y: number;
  r: number;
}

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
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

function strokeRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  lineWidth: number,
) {
  clipDonutRing(ctx, cx, cy, outerR, innerR);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function createJimmies(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): Jimmi[] {
  const rand = seededRandom(77);
  const jimmies: Jimmi[] = [];

  for (let i = 0; i < 22; i++) {
    const angle = -Math.PI * 0.85 + rand() * Math.PI * 0.95;
    const dist = innerR + (outerR - innerR) * (0.42 + rand() * 0.48);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    if (y > cy + outerR * 0.08) continue;

    jimmies.push({
      x,
      y,
      w: outerR * (0.11 + rand() * 0.05),
      h: outerR * (0.028 + rand() * 0.012),
      rotation: angle + Math.PI / 2 + (rand() - 0.5) * 0.5,
    });
  }

  return jimmies;
}

function createGoldPearls(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): GoldPearl[] {
  const rand = seededRandom(99);
  const pearls: GoldPearl[] = [];

  for (let i = 0; i < 9; i++) {
    const angle = -Math.PI * 0.7 + rand() * Math.PI * 0.85;
    const dist = innerR + (outerR - innerR) * (0.5 + rand() * 0.38);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    if (y > cy + outerR * 0.05) continue;

    pearls.push({
      x,
      y,
      r: outerR * (0.028 + rand() * 0.014),
    });
  }

  return pearls;
}

function drawToonShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(42, 24, 16, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + outerR * 0.88, outerR * 0.7, outerR * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawToonDough(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  outline: number,
) {
  clipDonutRing(ctx, cx, cy, outerR, innerR);

  const doughGrad = ctx.createLinearGradient(cx, cy - outerR, cx, cy + outerR);
  doughGrad.addColorStop(0, '#F0C078');
  doughGrad.addColorStop(0.45, '#E8A84E');
  doughGrad.addColorStop(1, '#C47A32');

  ctx.fillStyle = doughGrad;
  ctx.fill();

  // Cel-shade shadow band on lower dough
  ctx.save();
  clipDonutRing(ctx, cx, cy, outerR, innerR);
  ctx.clip();
  ctx.fillStyle = 'rgba(90, 45, 18, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + outerR * 0.35, outerR * 0.95, outerR * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  strokeRing(ctx, cx, cy, outerR, innerR, outline);
}

function drawToonHole(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outline: number,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  const holeGrad = ctx.createRadialGradient(
    cx - innerR * 0.2,
    cy - innerR * 0.25,
    innerR * 0.1,
    cx,
    cy,
    innerR,
  );
  holeGrad.addColorStop(0, '#5C3820');
  holeGrad.addColorStop(0.7, '#3E2418');
  holeGrad.addColorStop(1, '#2A1810');
  ctx.fillStyle = holeGrad;
  ctx.fill();
  ctx.lineWidth = outline * 0.85;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawVanillaGlaze(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  outline: number,
) {
  ctx.save();
  clipDonutRing(ctx, cx, cy, outerR, innerR);
  ctx.clip();

  // Thick cartoon glaze cap — inspired by Kasdan Vanilla Bean
  ctx.beginPath();
  ctx.ellipse(cx, cy - outerR * 0.14, outerR * 0.98, outerR * 0.62, 0, Math.PI, 0);

  const glazeGrad = ctx.createLinearGradient(cx, cy - outerR, cx, cy);
  glazeGrad.addColorStop(0, '#FFFEF9');
  glazeGrad.addColorStop(0.35, '#F8F2E8');
  glazeGrad.addColorStop(0.75, '#EDE4D4');
  glazeGrad.addColorStop(1, '#E0D4C0');

  ctx.fillStyle = glazeGrad;
  ctx.fill();

  // Glaze edge line
  ctx.beginPath();
  ctx.ellipse(cx, cy - outerR * 0.14, outerR * 0.98, outerR * 0.62, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.lineWidth = outline * 0.55;
  ctx.strokeStyle = 'rgba(42, 24, 16, 0.35)';
  ctx.stroke();

  // One playful cartoon drip
  const dripX = cx + outerR * 0.28;
  const dripTop = cy + outerR * 0.04;
  ctx.beginPath();
  ctx.moveTo(dripX - outerR * 0.05, dripTop);
  ctx.quadraticCurveTo(
    dripX - outerR * 0.02,
    dripTop + outerR * 0.18,
    dripX,
    dripTop + outerR * 0.24,
  );
  ctx.quadraticCurveTo(
    dripX + outerR * 0.02,
    dripTop + outerR * 0.18,
    dripX + outerR * 0.05,
    dripTop,
  );
  ctx.closePath();
  ctx.fillStyle = '#F5F0E8';
  ctx.fill();
  ctx.lineWidth = outline * 0.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.restore();
}

function drawJimmi(
  ctx: CanvasRenderingContext2D,
  j: Jimmi,
  outline: number,
) {
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.rotate(j.rotation);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = outline * 0.45;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(-j.w / 2, -j.h / 2, j.w, j.h, j.h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGoldPearl(
  ctx: CanvasRenderingContext2D,
  p: GoldPearl,
  outline: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(
    p.x - p.r * 0.3,
    p.y - p.r * 0.35,
    p.r * 0.1,
    p.x,
    p.y,
    p.r,
  );
  grad.addColorStop(0, '#FFF4C2');
  grad.addColorStop(0.45, COLORS.goldWarm);
  grad.addColorStop(1, '#B8862E');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = outline * 0.4;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // Tiny specular dot
  ctx.beginPath();
  ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.28, p.r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.restore();
}

function drawToonHighlight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
) {
  ctx.save();
  clipDonutRing(ctx, cx, cy, outerR, outerR * 0.42);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - outerR * 0.2, cy - outerR * 0.42, outerR * 0.22, outerR * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Heightened toon donut — Vanilla Bean inspired:
 * cream glaze, white jimmies, gold pearls, bold outlines.
 */
export function renderPremiumDonut(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2 - size * 0.03;
  const outerR = size * 0.39;
  const innerR = size * 0.17;
  const outline = size * OUTLINE_WIDTH_RATIO;

  drawToonShadow(ctx, cx, cy, outerR);
  drawToonDough(ctx, cx, cy, outerR, innerR, outline);
  drawToonHole(ctx, cx, cy, innerR, outline);
  drawVanillaGlaze(ctx, cx, cy, outerR, innerR, outline);

  for (const j of createJimmies(cx, cy, outerR, innerR)) {
    drawJimmi(ctx, j, outline);
  }
  for (const p of createGoldPearls(cx, cy, outerR, innerR)) {
    drawGoldPearl(ctx, p, outline);
  }

  drawToonHighlight(ctx, cx, cy, outerR);
  strokeRing(ctx, cx, cy, outerR, innerR, outline);

  return canvas;
}

let cachedDonut: HTMLCanvasElement | null = null;

export function getPremiumDonutCanvas(): HTMLCanvasElement {
  cachedDonut ??= renderPremiumDonut(512);
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

/** Remove near-black backdrop with soft edges, then crop empty margins. */
export function knockOutDarkBackground(
  image: HTMLImageElement,
  threshold = 50,
  feather = 70,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = Math.max(r, g, b);

    if (luminance <= threshold) {
      data[i + 3] = 0;
    } else if (luminance < threshold + feather) {
      const edge = (luminance - threshold) / feather;
      data[i + 3] = Math.round(data[i + 3] * edge);
    }
  }

  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  return cropCanvasToAlpha(canvas);
}

function cropCanvasToAlpha(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx) return source;

  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return source;

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cropW;
  cropped.height = cropH;

  const cropCtx = cropped.getContext('2d');
  cropCtx?.drawImage(source, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return cropped;
}

let cachedProcessedDonut: HTMLCanvasElement | null = null;

export async function getProcessedDonutCanvas(
  imagePath: string,
): Promise<HTMLCanvasElement> {
  if (USE_PROCEDURAL_DONUT) {
    return getPremiumDonutCanvas();
  }
  if (!cachedProcessedDonut) {
    const image = await loadDonutImage(imagePath);
    cachedProcessedDonut = knockOutDarkBackground(image);
  }
  return cachedProcessedDonut;
}

export async function getDonutImageDataUrl(imagePath: string): Promise<string> {
  const canvas = await getProcessedDonutCanvas(imagePath);
  return canvas.toDataURL('image/png');
}

export async function resolveDonutDrawable(
  imagePath: string,
): Promise<CanvasImageSource> {
  return getProcessedDonutCanvas(imagePath);
}

export function getPremiumDonutDataUrl(): string {
  return getPremiumDonutCanvas().toDataURL('image/png');
}
