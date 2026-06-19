import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
} from 'react';
import type { FaceLandmarkerResult, HandLandmarkerResult } from '@mediapipe/tasks-vision';
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
import {
  createBiteDetectorState,
  easeOutBack,
  getBiteRadius,
  getRespawnProgress,
  updateBiteDetector,
  type BiteDetectorState,
} from '../utils/biteDetection';
import { sansFont } from '../config/theme';
import { BITE_HOLD_FRAMES } from '../utils/donutConfig';
import { createBiteExplosion, drawBiteExplosion, type BiteExplosion } from '../utils/biteEffects';
import { extractMouthPose } from '../utils/faceMath';
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
  detectFace: (video: HTMLVideoElement, timestamp: number) => FaceLandmarkerResult | null;
  trackingReady: boolean;
  faceReady: boolean;
  faceStatus: 'loading' | 'ready' | 'error';
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
      detectFace,
      trackingReady,
      faceReady,
      faceStatus,
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
    const biteStateRef = useRef<BiteDetectorState>(createBiteDetectorState());
    const explosionRef = useRef<BiteExplosion | null>(null);

    useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);

    useEffect(() => {
      transformRef.current = { ...DEFAULT_TRANSFORM };
      activeBlendRef.current = 0;
      idleBlendRef.current = 1;
      cachedTargetRef.current = { ...DEFAULT_TRANSFORM };
      cachedPoseRef.current = null;
      biteStateRef.current = createBiteDetectorState();
      explosionRef.current = null;
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
        let mouthPose = null;

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

        if (faceReady) {
          const faceResults = detectFace(video, timestamp);
          mouthPose = extractMouthPose(
            faceResults?.faceLandmarks ?? [],
            width,
            height,
            video.videoWidth,
            video.videoHeight,
            true,
          );
        }

        const prevBitePhase = biteStateRef.current.phase;
        biteStateRef.current = updateBiteDetector(biteStateRef.current, {
          timestamp,
          donutX: targetTransform.x,
          donutY: targetTransform.y,
          donutScale: targetTransform.scale,
          mouth: mouthPose,
          isActive: mode === 'active' && targetTransform.visible && targetTransform.scale > 1,
          faceReady,
        });

        if (
          prevBitePhase === 'held' &&
          biteStateRef.current.phase === 'exploding'
        ) {
          explosionRef.current = createBiteExplosion(
            targetTransform.x,
            targetTransform.y,
            targetTransform.scale,
            timestamp,
          );
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
        const bitePhase = biteStateRef.current.phase;
        const respawnProgress =
          bitePhase === 'respawning'
            ? getRespawnProgress(biteStateRef.current, timestamp)
            : 1;
        const respawnScale = bitePhase === 'respawning' ? easeOutBack(respawnProgress) : 1;
        const respawnAlpha =
          bitePhase === 'respawning' ? Math.min(1, respawnProgress * 1.6) : 1;
        const showDonut = bitePhase !== 'exploding';

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
          showDonut &&
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
          const drawHeight = donut.scale * respawnScale;
          const drawWidth = drawHeight * aspect;
          const { x, y, rotation } = donut;
          const donutAlpha = activeBlend * respawnAlpha;

          if (USE_PROCEDURAL_DONUT) {
            drawAura(ctx, x, y, drawHeight * 0.55, timestamp, donutAlpha);
          } else {
            drawAura(ctx, x, y, drawHeight * 0.5, timestamp, donutAlpha * 0.35);
          }

          ctx.save();
          ctx.globalAlpha = donutAlpha;
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
              donutAlpha,
            );

            drawOrbitingSparkles(
              ctx,
              sparklesRef.current,
              x,
              y,
              drawHeight * 0.55,
              rotation,
              timestamp,
              donutAlpha,
            );
          }
        }

        if (explosionRef.current) {
          const stillActive = drawBiteExplosion(
            ctx,
            explosionRef.current,
            timestamp,
            width,
            height,
          );
          if (!stillActive) {
            explosionRef.current = null;
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

          if (mouthPose && targetTransform.scale > 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(232, 160, 168, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
              mouthPose.center.x,
              mouthPose.center.y,
              getBiteRadius(targetTransform.scale, mouthPose),
              0,
              Math.PI * 2,
            );
            ctx.stroke();
            ctx.fillStyle = 'rgba(232, 160, 168, 0.9)';
            ctx.beginPath();
            ctx.arc(mouthPose.center.x, mouthPose.center.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.save();
          ctx.fillStyle = 'rgba(250, 246, 239, 0.92)';
          ctx.font = sansFont(14, 600);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const biteState = biteStateRef.current;
          const lines = [
            `Face tracking: ${faceStatus}`,
            `Bite phase: ${biteState.phase}`,
            mouthPose
              ? `Mouth lock: ${biteState.proximityFrames}/${BITE_HOLD_FRAMES} frames`
              : 'Mouth: not detected — face the mirror',
          ];
          lines.forEach((line, index) => {
            ctx.fillText(line, 16, 16 + index * 20);
          });
          ctx.restore();
        }

        frameId = requestAnimationFrame(draw);
      };

      frameId = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
      };
    }, [
      videoRef,
      detect,
      detectFace,
      trackingReady,
      faceReady,
      faceStatus,
      started,
      debugMode,
    ]);

    return (
      <canvas
        ref={canvasRef}
        className="mirror-canvas"
        aria-label="Desire mirror with magical donut overlay"
      />
    );
  },
);
