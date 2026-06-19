import type { HandPoseDebug } from './handMath';
import { HAND_CONNECTIONS } from './handMath';

const COLORS = {
  landmark: '#5ce0ff',
  connection: 'rgba(92, 224, 255, 0.45)',
  wrist: '#ff6b6b',
  indexMcp: '#ffd166',
  indexTip: '#f72585',
  thumbTip: '#06d6a0',
  anchorPinch: '#ffb703',
  anchorPartial: '#fb8500',
  anchorPalm: '#e85d04',
  final: '#ffe066',
  unreliable: 'rgba(255, 255, 255, 0.35)',
};

export function drawHandDebug(
  ctx: CanvasRenderingContext2D,
  debug: HandPoseDebug,
  donutPosition: { x: number; y: number },
) {
  const { allLandmarks, wrist, indexMcp, indexTip, thumbTip, anchor, anchorSource } =
    debug;

  ctx.save();

  ctx.strokeStyle = COLORS.connection;
  ctx.lineWidth = 1.5;
  for (const [from, to] of HAND_CONNECTIONS) {
    const a = allLandmarks[from];
    const b = allLandmarks[to];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const point of allLandmarks) {
    ctx.beginPath();
    ctx.fillStyle = COLORS.landmark;
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMarker(ctx, wrist, COLORS.wrist, 'wrist', 6);
  drawMarker(
    ctx,
    indexMcp,
    debug.indexReliable ? COLORS.indexMcp : COLORS.unreliable,
    'index MCP',
    7,
  );
  drawMarker(
    ctx,
    indexTip,
    debug.indexTipReliable ? COLORS.indexTip : COLORS.unreliable,
    'index tip',
    7,
  );
  drawMarker(
    ctx,
    thumbTip,
    debug.thumbReliable ? COLORS.thumbTip : COLORS.unreliable,
    'thumb',
    7,
  );

  const anchorColor =
    anchorSource === 'pinch'
      ? COLORS.anchorPinch
      : anchorSource === 'partial'
        ? COLORS.anchorPartial
        : COLORS.anchorPalm;
  drawMarker(ctx, anchor, anchorColor, `anchor (${anchorSource})`, 9);

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(thumbTip.x, thumbTip.y);
  ctx.lineTo(indexTip.x, indexTip.y);
  ctx.stroke();
  ctx.setLineDash([]);

  drawMarker(ctx, donutPosition, COLORS.final, 'donut', 8);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(12, 12, 118, 28);
  ctx.fillStyle = '#ffe066';
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('DEBUG (D)', 20, 18);

  ctx.restore();
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  color: string,
  label: string,
  radius: number,
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}33`;
  ctx.lineWidth = 2;
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, point.x + radius + 4, point.y);
}
