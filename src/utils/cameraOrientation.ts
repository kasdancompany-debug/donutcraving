export type CameraRotation = 0 | 90 | 180 | 270;

export function parseCameraRotation(isKiosk: boolean): CameraRotation {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('camRotate');

  if (raw === '0' || raw === 'off' || raw === 'none') return 0;
  if (raw === '90') return 90;
  if (raw === '180') return 180;
  if (raw === '270') return 270;

  // Sideways USB webcams in portrait kiosk — default to 90° unless overridden.
  if (raw === 'auto' || (isKiosk && !raw && window.innerHeight > window.innerWidth)) {
    return 90;
  }

  return 0;
}

export function getEffectiveVideoDimensions(
  videoWidth: number,
  videoHeight: number,
  rotation: CameraRotation,
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: videoHeight, height: videoWidth };
  }
  return { width: videoWidth, height: videoHeight };
}

/**
 * Rotate + mirror the raw camera frame for portrait USB webcams.
 * Mirror is baked in so tracking and display stay aligned.
 */
export function renderCorrectedVideoFrame(
  target: HTMLCanvasElement,
  video: HTMLVideoElement,
  rotation: CameraRotation,
  mirror: boolean,
): { width: number; height: number } {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    return { width: 0, height: 0 };
  }

  if (rotation === 0 && !mirror) {
    if (target.width !== videoWidth || target.height !== videoHeight) {
      target.width = videoWidth;
      target.height = videoHeight;
    }
    const ctx = target.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    return { width: videoWidth, height: videoHeight };
  }

  const { width: outW, height: outH } = getEffectiveVideoDimensions(
    videoWidth,
    videoHeight,
    rotation,
  );

  if (target.width !== outW || target.height !== outH) {
    target.width = outW;
    target.height = outH;
  }

  const ctx = target.getContext('2d');
  if (!ctx) return { width: outW, height: outH };

  ctx.clearRect(0, 0, outW, outH);
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(video, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);
  ctx.restore();

  return { width: outW, height: outH };
}

export type VisionFrameSource = HTMLVideoElement | HTMLCanvasElement;
