let grainTile: HTMLCanvasElement | null = null;

/** Build a reusable noise tile once — cheap to stamp every frame. */
function ensureGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;

  const size = 128;
  grainTile = document.createElement('canvas');
  grainTile.width = size;
  grainTile.height = size;

  const ctx = grainTile.getContext('2d');
  if (!ctx) return grainTile;

  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = Math.random() * 255;
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
    imageData.data[i + 3] = Math.random() * 28 + 12;
  }
  ctx.putImageData(imageData, 0, 0);
  return grainTile;
}

/** Soft film-grain overlay — subtle, not noisy. */
export function drawFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  intensity = 0.065,
) {
  const tile = ensureGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;

  const offsetX = (time * 0.019) % tile.width;
  const offsetY = (time * 0.023) % tile.height;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = intensity;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(offsetX, offsetY, width + tile.width, height + tile.height);
  ctx.restore();
}

/** Warm bakery lighting grade over the mirrored feed. */
export function drawBakeryLighting(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.save();

  const warmth = ctx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    height * 0.05,
    width * 0.5,
    height * 0.5,
    height * 0.72,
  );
  warmth.addColorStop(0, 'rgba(255, 235, 210, 0.14)');
  warmth.addColorStop(0.45, 'rgba(255, 210, 165, 0.06)');
  warmth.addColorStop(1, 'rgba(62, 36, 24, 0)');
  ctx.fillStyle = warmth;
  ctx.fillRect(0, 0, width, height);

  const leftGlow = ctx.createLinearGradient(0, 0, width * 0.35, 0);
  leftGlow.addColorStop(0, 'rgba(212, 165, 116, 0.1)');
  leftGlow.addColorStop(1, 'rgba(212, 165, 116, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, height);

  const rightGlow = ctx.createLinearGradient(width, 0, width * 0.65, 0);
  rightGlow.addColorStop(0, 'rgba(232, 160, 168, 0.07)');
  rightGlow.addColorStop(1, 'rgba(232, 160, 168, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(245, 220, 195, 0.06)';
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/** Always-on cinematic vignette — espresso edges, cream center. */
export function drawCinematicVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength = 0.48,
) {
  ctx.save();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(width, height) * 0.62;

  const grad = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, radius);
  grad.addColorStop(0, 'rgba(42, 24, 16, 0)');
  grad.addColorStop(0.65, 'rgba(42, 24, 16, 0.08)');
  grad.addColorStop(1, `rgba(26, 14, 8, ${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
