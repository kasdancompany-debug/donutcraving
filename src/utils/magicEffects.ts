import { BRAND_NAME, DESIRE_TEXT, IDLE_HINT_TEXT } from '../config/branding';
import { COLORS, rgba, serifFont, sansFont } from '../config/theme';

export interface Sparkle {
  orbitRadius: number;
  angle: number;
  speed: number;
  size: number;
  phase: number;
  tint: 'cream' | 'pink' | 'caramel';
}

export interface AmbientParticle {
  x: number;
  y: number;
  drift: number;
  speed: number;
  size: number;
  phase: number;
  kind: 'mote' | 'crumb';
  tint: 'cream' | 'pink' | 'caramel';
}

const SPARKLE_COUNT = 12;
const AMBIENT_COUNT = 24;

const TINTS = {
  cream: COLORS.creamLight,
  pink: COLORS.pinkGlazeSoft,
  caramel: COLORS.caramelLight,
} as const;

export function createSparkles(): Sparkle[] {
  const tintCycle: Sparkle['tint'][] = ['cream', 'pink', 'caramel'];
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
    orbitRadius: 0.54 + (i % 4) * 0.06,
    angle: (i / SPARKLE_COUNT) * Math.PI * 2,
    speed: 0.00055 + (i % 3) * 0.0002,
    size: 1.1 + (i % 4) * 0.35,
    phase: i * 1.17,
    tint: tintCycle[i % tintCycle.length],
  }));
}

export function createAmbientParticles(): AmbientParticle[] {
  const kinds: AmbientParticle['kind'][] = ['mote', 'crumb', 'mote', 'crumb'];
  const tints: AmbientParticle['tint'][] = ['cream', 'pink', 'caramel'];
  return Array.from({ length: AMBIENT_COUNT }, (_, i) => ({
    x: 0.08 + ((i * 47) % 84) / 100,
    y: 0.06 + ((i * 31) % 88) / 100,
    drift: 0.00012 + (i % 4) * 0.00007,
    speed: 0.00035 + (i % 5) * 0.0001,
    size: kinds[i % kinds.length] === 'crumb' ? 2.2 + (i % 3) : 1 + (i % 3) * 0.5,
    phase: i * 2.1,
    kind: kinds[i % kinds.length],
    tint: tints[i % tints.length],
  }));
}

function drawMote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  color: string,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 2.2;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrumb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.3, size * 0.75, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Refined magical glow — cream core, pink glaze accent, caramel halo. */
export function drawAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number,
  blend: number,
) {
  if (blend <= 0.01) return;

  const pulse = 0.92 + 0.08 * Math.sin(time * 0.0022);
  const outer = radius * 1.45 * pulse;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const layers = [
    { inner: radius * 0.2, outer, alpha: 1 },
    { inner: radius * 0.55, outer: outer * 0.72, alpha: 0.65 },
  ];

  for (const layer of layers) {
    const grad = ctx.createRadialGradient(x, y, layer.inner, x, y, layer.outer);
    grad.addColorStop(0, rgba(COLORS.creamLight, 0.12 * blend * layer.alpha));
    grad.addColorStop(0.4, rgba(COLORS.pinkGlaze, 0.06 * blend * layer.alpha));
    grad.addColorStop(0.7, rgba(COLORS.caramel, 0.035 * blend * layer.alpha));
    grad.addColorStop(1, rgba(COLORS.espresso, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, layer.outer, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawOrbitingSparkles(
  ctx: CanvasRenderingContext2D,
  sparkles: Sparkle[],
  x: number,
  y: number,
  radius: number,
  rotation: number,
  time: number,
  blend: number,
) {
  if (blend <= 0.01) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  for (const sparkle of sparkles) {
    const angle = sparkle.angle + time * sparkle.speed;
    const wobble = Math.sin(time * 0.0035 + sparkle.phase) * radius * 0.03;
    const orbit = radius * sparkle.orbitRadius + wobble;
    const sx = Math.cos(angle) * orbit;
    const sy = Math.sin(angle) * orbit;
    const twinkle = 0.35 + 0.65 * Math.sin(time * 0.005 + sparkle.phase);
    drawMote(ctx, sx, sy, sparkle.size, twinkle * 0.55 * blend, TINTS[sparkle.tint]);
  }

  ctx.restore();
}

export function drawGoldenShimmer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  time: number,
  blend: number,
) {
  if (blend <= 0.01) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.46, height * 0.46, 0, 0, Math.PI * 2);
  ctx.clip();

  const sweep = (time * 0.00038) % 1;
  const span = width * 1.5;
  const offset = -span + sweep * span * 2;
  const grad = ctx.createLinearGradient(offset, -height, offset + span * 0.3, height);
  grad.addColorStop(0, rgba(COLORS.cream, 0));
  grad.addColorStop(0.44, rgba(COLORS.cream, 0));
  grad.addColorStop(0.5, rgba(COLORS.creamLight, 0.28 * blend));
  grad.addColorStop(0.52, rgba(COLORS.pinkGlazeSoft, 0.18 * blend));
  grad.addColorStop(0.58, rgba(COLORS.cream, 0));
  grad.addColorStop(1, rgba(COLORS.cream, 0));

  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grad;
  ctx.fillRect(-width * 0.55, -height * 0.55, width * 1.1, height * 1.1);
  ctx.restore();
}

export function drawDesireText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  blend: number,
) {
  if (blend <= 0.02) return;

  const fadeIn = Math.min(1, Math.max(0, (blend - 0.3) / 0.45));
  const breathe = 0.94 + 0.06 * Math.sin(time * 0.0014);
  const alpha = fadeIn * breathe;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize = Math.max(28, Math.min(width * 0.052, 64));
  ctx.font = serifFont(fontSize, 600, true);

  const text = DESIRE_TEXT;
  const textY = height * 0.11;

  ctx.shadowColor = rgba(COLORS.creamLight, 0.92 * alpha);
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 0;

  const grad = ctx.createLinearGradient(
    width * 0.22,
    textY - fontSize,
    width * 0.78,
    textY + fontSize * 0.5,
  );
  grad.addColorStop(0, rgba(COLORS.textPrimary, alpha));
  grad.addColorStop(0.5, rgba(COLORS.textSecondary, alpha));
  grad.addColorStop(1, rgba(COLORS.textPrimary, alpha * 0.95));

  ctx.fillStyle = grad;
  ctx.fillText(text, width / 2, textY);

  ctx.globalAlpha = alpha * 0.82;
  ctx.font = sansFont(Math.max(10, fontSize * 0.22), 600);
  ctx.fillStyle = rgba(COLORS.textMuted, 1);
  ctx.shadowBlur = 10;
  ctx.fillText(BRAND_NAME.toUpperCase(), width / 2, textY + fontSize * 0.88);

  ctx.restore();
}

export function drawIdleVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blend: number,
) {
  if (blend <= 0.01) return;

  ctx.save();
  const cx = width / 2;
  const cy = height / 2;
  const grad = ctx.createRadialGradient(cx, cy, height * 0.12, cx, cy, height * 0.74);
  grad.addColorStop(0, rgba(COLORS.espresso, 0));
  grad.addColorStop(1, rgba(COLORS.espressoDeep, 0.55 * blend));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawIdlePulse(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  blend: number,
) {
  if (blend <= 0.01) return;

  const cx = width / 2;
  const cy = height * 0.54;
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.0015);
  const radius = Math.min(width, height) * (0.11 + pulse * 0.035);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, rgba(COLORS.cream, 0.06 * blend * pulse));
  grad.addColorStop(0.55, rgba(COLORS.pinkGlaze, 0.03 * blend * pulse));
  grad.addColorStop(1, rgba(COLORS.espresso, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawAmbientSparkles(
  ctx: CanvasRenderingContext2D,
  particles: AmbientParticle[],
  width: number,
  height: number,
  time: number,
  blend: number,
) {
  if (blend <= 0.01) return;

  for (const p of particles) {
    const x = (p.x + Math.sin(time * p.speed + p.phase) * p.drift * 80) * width;
    const y = ((p.y + time * p.drift * 0.28) % 1.08 - 0.04) * height;
    const twinkle = 0.2 + 0.8 * Math.sin(time * 0.0028 + p.phase);
    const alpha = twinkle * 0.4 * blend;
    const color = TINTS[p.tint];

    if (p.kind === 'crumb') {
      drawCrumb(ctx, x, y, p.size, p.phase + time * 0.0004, alpha, color);
    } else {
      drawMote(ctx, x, y, p.size, alpha, color);
    }
  }
}

export function drawIdleHint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  blend: number,
  text = IDLE_HINT_TEXT,
) {
  if (blend <= 0.02) return;

  const pulse = 0.72 + 0.28 * Math.sin(time * 0.0018);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.max(18, Math.min(width * 0.032, 38));
  ctx.font = serifFont(fontSize, 500, true);
  ctx.fillStyle = rgba(COLORS.textPrimary, 0.9 * blend * pulse);
  ctx.shadowColor = rgba(COLORS.creamLight, 0.92 * blend);
  ctx.shadowBlur = 14;
  ctx.fillText(text, width / 2, height * 0.87);
  ctx.restore();
}
