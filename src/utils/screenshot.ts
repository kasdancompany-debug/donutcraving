import { SCREENSHOT_FILENAME_PREFIX } from '../config/branding';

/** Capture the mirror canvas and trigger a local PNG download. */
export function downloadCanvasScreenshot(canvas: HTMLCanvasElement | null) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return;

  const link = document.createElement('a');
  link.download = `${SCREENSHOT_FILENAME_PREFIX}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
