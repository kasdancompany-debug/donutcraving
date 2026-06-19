import { COLORS, rgba, sansFont } from '../config/theme';
import { EXPLOSION_DURATION_MS } from './donutConfig';

export interface ExplosionParticle {
  angle: number;
  speed: number;
  size: number;
  spin: number;
  tint: 'cream' | 'pink' | 'caramel' | 'gold';
  kind: 'spark' | 'crumb' | 'shard';
}

export interface BiteExplosion {
  x: number;
  y: number;
  scale: number;
  startTime: number;
  particles: ExplosionParticle[];
}

const TINTS = {
  cream: COLORS.creamLight,
  pink: COLORS.pinkGlazeSoft,
  caramel: COLORS.caramelLight,
  gold: COLORS.goldWarm,
} as const;

const PARTICLE_COUNT = 32;

export function createBiteExplosion(
  x: number,
  y: number,
  scale: number,
  timestamp: number,
): BiteExplosion {
  const kinds: ExplosionParticle['kind'][] = ['spark', 'crumb', 'shard'];
  const tints: ExplosionParticle['tint'][] = ['cream', 'pink', 'caramel', 'gold'];

  const particles: ExplosionParticle[] = Array.from(
    { length: PARTICLE_COUNT },
    (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 3) * 0.12,
      speed: 2.4 + (i % 5) * 0.55 + Math.random() * 0.8,
      size: 2 + (i % 4) * 1.1 + Math.random() * 2,
      spin: (Math.random() - 0.5) * 0.18,
      tint: tints[i % tints.length],
      kind: kinds[i % kinds.length],
    }),
  );

  return { x, y, scale, startTime: timestamp, particles };
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha: number,
  color: string,
  kind: ExplosionParticle['kind'],
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 2.5;

  if (kind === 'spark') {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'crumb') {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.3, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.45, size);
    ctx.lineTo(-size * 0.45, size);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawBiteExplosion(
  ctx: CanvasRenderingContext2D,
  explosion: BiteExplosion,
  timestamp: number,
  width: number,
  height: number,
): boolean {
  const elapsed = timestamp - explosion.startTime;
  const progress = Math.min(1, elapsed / EXPLOSION_DURATION_MS);
  if (progress >= 1) return false;

  const fade = 1 - progress ** 1.6;
  const { x, y, scale, particles } = explosion;
  const burstScale = scale * (0.35 + progress * 0.9);

  ctx.save();
  const flashAlpha = Math.max(0, (1 - progress * 3.5) * 0.22);
  if (flashAlpha > 0.01) {
    ctx.fillStyle = rgba(COLORS.creamLight, flashAlpha);
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  const ringRadius = burstScale * (0.4 + progress * 1.8);
  const ringAlpha = fade * 0.55;
  if (ringAlpha > 0.02) {
    ctx.save();
    ctx.strokeStyle = rgba(COLORS.goldWarm, ringAlpha);
    ctx.lineWidth = 3 + (1 - progress) * 5;
    ctx.shadowColor = rgba(COLORS.pinkGlaze, ringAlpha);
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const innerGlow = fade * 0.7;
  if (innerGlow > 0.02) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, burstScale * 0.85);
    gradient.addColorStop(0, rgba(COLORS.creamLight, innerGlow * 0.9));
    gradient.addColorStop(0.35, rgba(COLORS.pinkGlazeSoft, innerGlow * 0.45));
    gradient.addColorStop(1, rgba(COLORS.caramel, 0));
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, burstScale * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const particle of particles) {
    const dist = particle.speed * progress * scale * 0.14;
    const px = x + Math.cos(particle.angle) * dist;
    const py = y + Math.sin(particle.angle) * dist;
    const alpha = fade * (0.55 + (1 - progress) * 0.45);
    drawParticle(
      ctx,
      px,
      py,
      particle.size * (1 - progress * 0.35),
      particle.angle + particle.spin * elapsed,
      alpha,
      TINTS[particle.tint],
      particle.kind,
    );
  }

  if (progress < 0.45) {
    const textAlpha = (1 - progress / 0.45) * 0.95;
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.fillStyle = COLORS.creamLight;
    ctx.strokeStyle = rgba(COLORS.espresso, 0.35);
    ctx.lineWidth = 2;
    ctx.font = sansFont(scale * 0.14, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelY = y - burstScale * 0.55;
    const label = 'CRAVING!';
    ctx.strokeText(label, x, labelY);
    ctx.fillText(label, x, labelY);
    ctx.restore();
  }

  return true;
}
