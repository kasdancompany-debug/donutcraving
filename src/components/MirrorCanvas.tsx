import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
} from 'react';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { DONUT_IMAGE_PATH } from '../config/branding';
import { USE_PROCEDURAL_DONUT, resolveDonutDrawable } from '../utils/donutRenderer';
import {
  createAmbientParticles,
  createSparkles,
  drawAmbientSparkles,
  drawAura,
  drawDesireText,
  drawGoldenShimmer,
  drawIdleHint,
  drawIdlePulse,
  drawIdleVignette,
  drawOrbitingSparkles,
} from '../utils/magicEffects';
import {
  estimateHandPose,
  extractPrimaryHand,
  getVideoCoverRect,
  type HandPose,
} from '../utils/handMath';
import {
  drawBakeryLighting,
  drawCinematicVignette,
  drawFilmGrain,
} from '../utils/filmGrain';
import { drawHandDebug } from '../utils/handDebug';
import { resolveMirrorMode } from '../utils/mirrorState';
import {
  DEFAULT_TRANSFORM,
  smoothScalar,
  smoothTransform,
  type DonutTransform,
} from '../utils/smoothing';

const BLEND_SMOOTHING = 0.1;

interface MirrorCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  detect: (video: HTMLVideoElement, timestamp: number) => HandLandmarkerResult | null;
  trackingReady: boolean;
  started: boolean;
  debugMode: boolean;
  recalibrateToken: number;
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  dimAmount: number,
) {
  const { offsetX, offsetY, drawWidth, drawHeight } = getVideoCoverRect(
    video.videoWidth,
    video.videoHeight,
    width,
    height,
  );

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();

  if (dimAmount > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(42, 24, 16, ${dimAmount * 0.38})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export const MirrorCanvas = forwardRef<HTMLCanvasElement, MirrorCanvasProps>(
  function MirrorCanvas(
    {
      videoRef,
      detect,
      trackingReady,
      started,
      debugMode,
      recalibrateToken,
    },
    forwardedRef,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const transformRef = useRef<DonutTransform>({ ...DEFAULT_TRANSFORM });
    const activeBlendRef = useRef(0);
    const idleBlendRef = useRef(1);
    const donutDrawableRef = useRef<CanvasImageSource | null>(null);
    const sparklesRef = useRef(createSparkles());
    const ambientRef = useRef(createAmbientParticles());
    const cachedTargetRef = useRef<DonutTransform>({ ...DEFAULT_TRANSFORM });
    const cachedPoseRef = useRef<HandPose | null>(null);

    useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);

    useEffect(() => {
      transformRef.current = { ...DEFAULT_TRANSFORM };
      activeBlendRef.current = 0;
      idleBlendRef.current = 1;
      cachedTargetRef.current = { ...DEFAULT_TRANSFORM };
      cachedPoseRef.current = null;
    }, [recalibrateToken]);

    useEffect(() => {
      let cancelled = false;

      void resolveDonutDrawable(DONUT_IMAGE_PATH).then((drawable) => {
        if (!cancelled) {
          donutDrawableRef.current = drawable;
        }
      });

      return () => {
        cancelled = true;
        donutDrawableRef.current = null;
      };
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frameId = 0;

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };

      resize();
      window.addEventListener('resize', resize);

      const draw = (timestamp: number) => {
        const video = videoRef.current;
        const width = canvas.width;
        const height = canvas.height;

        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !started) {
          frameId = requestAnimationFrame(draw);
          return;
        }

        let targetTransform: DonutTransform = { ...DEFAULT_TRANSFORM };
        let mode: 'idle' | 'active' = 'idle';

        if (trackingReady) {
          const results = detect(video, timestamp);
          const hand = extractPrimaryHand(results?.landmarks ?? []);

          if (hand) {
            const pose = estimateHandPose(
              hand,
              width,
              height,
              video.videoWidth,
              video.videoHeight,
              true,
            );
            cachedPoseRef.current = pose;
            mode = resolveMirrorMode(hand, pose, width, height);
            targetTransform = {
              x: pose.x,
              y: pose.y,
              scale: pose.scale,
              rotation: pose.rotation,
              visible: mode === 'active',
            };
          } else {
            cachedPoseRef.current = null;
          }

          cachedTargetRef.current = targetTransform;
        } else {
          targetTransform = cachedTargetRef.current;
          mode = targetTransform.visible ? 'active' : 'idle';
        }

        const targetActive = mode === 'active' ? 1 : 0;
        const targetIdle = 1 - targetActive;

        activeBlendRef.current = smoothScalar(
          activeBlendRef.current,
          targetActive,
          BLEND_SMOOTHING,
        );
        idleBlendRef.current = smoothScalar(
          idleBlendRef.current,
          targetIdle,
          BLEND_SMOOTHING,
        );

        transformRef.current = smoothTransform(
          transformRef.current,
          targetTransform,
          BLEND_SMOOTHING,
        );

        const activeBlend = activeBlendRef.current;
        const idleBlend = idleBlendRef.current;
        const donut = transformRef.current;
        const donutDrawable = donutDrawableRef.current;

        const donutWidth =
          donutDrawable instanceof HTMLCanvasElement
            ? donutDrawable.width
            : donutDrawable instanceof HTMLImageElement
              ? donutDrawable.naturalWidth
              : 0;

        ctx.clearRect(0, 0, width, height);
        drawVideoCover(ctx, video, width, height, idleBlend);
        drawBakeryLighting(ctx, width, height);

        const particleBlend = Math.max(idleBlend, activeBlend * 0.35);
        drawAmbientSparkles(ctx, ambientRef.current, width, height, timestamp, particleBlend);
        drawIdlePulse(ctx, width, height, timestamp, idleBlend);
        drawIdleVignette(ctx, width, height, idleBlend);
        drawIdleHint(ctx, width, height, timestamp, idleBlend);

        if (
          activeBlend > 0.02 &&
          donutDrawable &&
          donutWidth > 0 &&
          donut.scale > 1
        ) {
          const aspect =
            donutDrawable instanceof HTMLCanvasElement
              ? donutDrawable.width / donutDrawable.height
              : (donutDrawable as HTMLImageElement).naturalWidth /
                (donutDrawable as HTMLImageElement).naturalHeight;
          const drawHeight = donut.scale;
          const drawWidth = drawHeight * aspect;
          const { x, y, rotation } = donut;

          if (USE_PROCEDURAL_DONUT) {
            drawAura(ctx, x, y, drawHeight * 0.55, timestamp, activeBlend);
          } else {
            drawAura(ctx, x, y, drawHeight * 0.5, timestamp, activeBlend * 0.35);
          }

          ctx.save();
          ctx.globalAlpha = activeBlend;
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.drawImage(
            donutDrawable,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight,
          );
          ctx.restore();

          if (USE_PROCEDURAL_DONUT) {
            drawGoldenShimmer(
              ctx,
              x,
              y,
              drawWidth,
              drawHeight,
              rotation,
              timestamp,
              activeBlend,
            );

            drawOrbitingSparkles(
              ctx,
              sparklesRef.current,
              x,
              y,
              drawHeight * 0.55,
              rotation,
              timestamp,
              activeBlend,
            );
          }
        }

        drawDesireText(ctx, width, height, timestamp, activeBlend);
        drawCinematicVignette(ctx, width, height, 0.42);
        drawFilmGrain(ctx, width, height, timestamp);

        if (debugMode && cachedPoseRef.current) {
          drawHandDebug(ctx, cachedPoseRef.current, {
            x: donut.x,
            y: donut.y,
          });
        }

        frameId = requestAnimationFrame(draw);
      };

      frameId = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
      };
    }, [videoRef, detect, trackingReady, started, debugMode]);

    return (
      <canvas
        ref={canvasRef}
        className="mirror-canvas"
        aria-label="Desire mirror with magical donut overlay"
      />
    );
  },
);
