import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
} from 'react';
import type { FaceLandmarkerResult, HandLandmarkerResult, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
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
  extractHandByIndex,
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
import {
  createWaveDetectorState,
  resetWaveDetector,
  updateWaveDetector,
  type WaveDetectorState,
} from '../utils/waveDetection';
import { createBiteExplosion, drawBiteExplosion, type BiteExplosion } from '../utils/biteEffects';
import { drawHandDebug } from '../utils/handDebug';
import {
  renderCorrectedVideoFrame,
  type CameraRotation,
  type VisionFrameSource,
} from '../utils/cameraOrientation';
import {
  LITE_BLEND_SMOOTHING,
  LITE_POSE_SMOOTHING,
  LITE_POSITION_SMOOTHING,
  LITE_POSITION_SMOOTHING_FAST,
  ATTRACT_TRACK_INTERVAL_MS,
  MOUTH_CACHE_MS,
} from '../config/performance';
import { resolveMirrorMode } from '../utils/mirrorState';
import {
  DEFAULT_TRANSFORM,
  smoothScalar,
  smoothTransform,
  type DonutTransform,
} from '../utils/smoothing';
import { beatWatchdog } from '../utils/kioskWatchdog';
import { extractMouthPose, type MouthPose } from '../utils/faceMath';
import {
  SubjectTracker,
  createTrackingConfig,
  buildPeopleCandidates,
  peopleFromHands,
  handsFromLandmarks,
  facesFromLandmarks,
  poseFromLandmarks,
  drawTrackingDebugOverlay,
  type TrackingSnapshot,
  type TrackingConfig,
  type TrackingEvent,
  type PoseLandmarksNorm,
} from '../tracking';

const BLEND_SMOOTHING = 0.1;

export interface MirrorPerformanceOptions {
  lite: boolean;
  trackIntervalMs: number;
  enableBite: boolean;
}

interface MirrorCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  detect: (source: VisionFrameSource, timestamp: number) => HandLandmarkerResult | null;
  detectFace: (source: VisionFrameSource, timestamp: number) => FaceLandmarkerResult | null;
  detectPose: (source: VisionFrameSource, timestamp: number) => PoseLandmarkerResult | null;
  trackingReady: boolean;
  faceReady: boolean;
  poseReady: boolean;
  faceStatus: 'loading' | 'ready' | 'error';
  started: boolean;
  debugMode: boolean;
  recalibrateToken: number;
  performance: MirrorPerformanceOptions;
  camRotate: CameraRotation;
  waveToStart?: boolean;
  onWaveStart?: () => void;
  onActivity?: () => void;
  /** When set, MediaPipe/tracker timestamps come from video.currentTime (replay lab). */
  useVideoTimestamps?: boolean;
  /** Force tracking debug overlay even without ?debug=1. */
  forceDebugOverlay?: boolean;
  /** Live threshold overrides from the replay lab. */
  trackingConfig?: Partial<TrackingConfig>;
  /** Bump to force a track pass while paused (frame step). */
  stepToken?: number;
  /** Optional mirror override (recordings may already be upright). */
  mirrorFeed?: boolean;
  onTrackingEvent?: (event: TrackingEvent) => void;
  onInferenceSample?: (inferenceMs: number, mediaTimestampMs: number) => void;
  /**
   * When true, canvas only draws overlays (donut/debug). Use a visible <video>
   * underneath so playback stays smooth while ML runs.
   */
  videoUnderlay?: boolean;
  /** Snappier donut follow — useful for replay / debugging lag. */
  lowLatencyFollow?: boolean;
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  dimAmount: number,
  mirror: boolean,
) {
  const { offsetX, offsetY, drawWidth, drawHeight } = getVideoCoverRect(
    sourceWidth,
    sourceHeight,
    canvasWidth,
    canvasHeight,
  );

  ctx.save();
  if (mirror) {
    ctx.translate(canvasWidth, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();

  if (dimAmount > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(42, 24, 16, ${dimAmount * 0.38})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }
}

export const MirrorCanvas = forwardRef<HTMLCanvasElement, MirrorCanvasProps>(
  function MirrorCanvas(
    {
      videoRef,
      detect,
      detectFace,
      detectPose,
      trackingReady,
      faceReady,
      poseReady,
      faceStatus,
      started,
      debugMode,
      recalibrateToken,
      performance,
      camRotate,
      waveToStart = false,
      onWaveStart,
      onActivity,
      useVideoTimestamps = false,
      forceDebugOverlay = false,
      trackingConfig,
      stepToken = 0,
      mirrorFeed = true,
      onTrackingEvent,
      onInferenceSample,
      videoUnderlay = false,
      lowLatencyFollow = false,
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
    const cachedMouthRef = useRef<{ pose: MouthPose; at: number } | null>(null);
    const faceTickRef = useRef(0);
    const biteStateRef = useRef<BiteDetectorState>(createBiteDetectorState());
    const explosionRef = useRef<BiteExplosion | null>(null);
    const onActivityRef = useRef(onActivity);
    const onWaveStartRef = useRef(onWaveStart);
    const onTrackingEventRef = useRef(onTrackingEvent);
    const onInferenceSampleRef = useRef(onInferenceSample);
    const lastMediaTsRef = useRef(-1);
    const lastTrackTimeRef = useRef(0);
    const lastPoseLandmarksRef = useRef<PoseLandmarksNorm[]>([]);
    const waveDetectorRef = useRef<WaveDetectorState>(createWaveDetectorState());
    const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const subjectTrackerRef = useRef<SubjectTracker | null>(null);
    const trackingSnapshotRef = useRef<TrackingSnapshot | null>(null);
    const wasInteractingRef = useRef(false);
    const fpsRef = useRef({ lastTs: 0, fps: 0, inferMs: 0 });
    const { lite, trackIntervalMs, enableBite } = performance;
    if (!subjectTrackerRef.current) {
      subjectTrackerRef.current = new SubjectTracker(
        createTrackingConfig({
          smoothingAlpha: lite ? 0.55 : 0.35,
          acquireHoldMs: lite ? 280 : 500,
          cooldownMs: lite ? 800 : 1500,
        }),
      );
    }
    const blendSmoothing = lowLatencyFollow
      ? 0.55
      : lite
        ? LITE_BLEND_SMOOTHING
        : BLEND_SMOOTHING;
    const smoothOptions = lowLatencyFollow
      ? {
          poseSmoothing: 0.72,
          positionSmoothing: 0.82,
          positionSmoothingFast: 0.94,
          fastMoveThreshold: 28,
        }
      : lite
        ? {
            poseSmoothing: LITE_POSE_SMOOTHING,
            positionSmoothing: LITE_POSITION_SMOOTHING,
            positionSmoothingFast: LITE_POSITION_SMOOTHING_FAST,
          }
        : undefined;
    const attractTrackIntervalMs = Math.max(
      trackIntervalMs || 0,
      ATTRACT_TRACK_INTERVAL_MS,
    );

    useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);

    useEffect(() => {
      onActivityRef.current = onActivity;
    }, [onActivity]);

    useEffect(() => {
      onWaveStartRef.current = onWaveStart;
    }, [onWaveStart]);

    useEffect(() => {
      onTrackingEventRef.current = onTrackingEvent;
    }, [onTrackingEvent]);

    useEffect(() => {
      onInferenceSampleRef.current = onInferenceSample;
    }, [onInferenceSample]);

    useEffect(() => {
      subjectTrackerRef.current?.setEventListener((event) => {
        onTrackingEventRef.current?.(event);
      });
      return () => subjectTrackerRef.current?.setEventListener(null);
    }, []);

    useEffect(() => {
      if (trackingConfig) {
        subjectTrackerRef.current?.patchConfig(trackingConfig);
      }
    }, [trackingConfig]);

    useEffect(() => {
      if (!started && waveToStart) {
        resetWaveDetector(waveDetectorRef.current);
      }
    }, [started, waveToStart]);

    useEffect(() => {
      transformRef.current = { ...DEFAULT_TRANSFORM };
      activeBlendRef.current = 0;
      idleBlendRef.current = 1;
      cachedTargetRef.current = { ...DEFAULT_TRANSFORM };
      cachedPoseRef.current = null;
      biteStateRef.current = createBiteDetectorState();
      explosionRef.current = null;
      resetWaveDetector(waveDetectorRef.current);
      subjectTrackerRef.current?.reset();
      wasInteractingRef.current = false;
      trackingSnapshotRef.current = null;
      lastMediaTsRef.current = -1;
      cachedMouthRef.current = null;
      cachedPoseRef.current = null;
      cachedTargetRef.current = { ...DEFAULT_TRANSFORM };
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
        beatWatchdog();

        try {
          const video = videoRef.current;
          const width = canvas.width;
          const height = canvas.height;

          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            frameId = requestAnimationFrame(draw);
            return;
          }

          const previewMode = waveToStart && !started;
          if (!started && !previewMode) {
            frameId = requestAnimationFrame(draw);
            return;
          }

          let frameSource: VisionFrameSource = video;
          let frameWidth = video.videoWidth;
          let frameHeight = video.videoHeight;
          let mirrorLandmarks = mirrorFeed;
          let mirrorCover = mirrorFeed;

          if (camRotate !== 0) {
            if (!processingCanvasRef.current) {
              processingCanvasRef.current = document.createElement('canvas');
            }
            const corrected = renderCorrectedVideoFrame(
              processingCanvasRef.current,
              video,
              camRotate,
              mirrorFeed,
            );
            if (corrected.width > 0 && corrected.height > 0) {
              frameSource = processingCanvasRef.current;
              frameWidth = corrected.width;
              frameHeight = corrected.height;
              mirrorLandmarks = false;
              mirrorCover = false;
            }
          }

          const mediaTimestamp = useVideoTimestamps
            ? Math.round(video.currentTime * 1000)
            : timestamp;

          // Always throttle on wall-clock so ML cannot block every RAF (choppy video).
          // Video timestamps are still passed into MediaPipe/tracker for realistic dwell/grace.
          const trackDue =
            trackIntervalMs === 0 ||
            timestamp - lastTrackTimeRef.current >= trackIntervalMs;
          const mediaAdvanced =
            !useVideoTimestamps || mediaTimestamp !== lastMediaTsRef.current;

          const shouldTrack = trackingReady && trackDue && mediaAdvanced;

          if (shouldTrack && useVideoTimestamps) {
            lastMediaTsRef.current = mediaTimestamp;
          }

          if (previewMode) {
            const shouldTrackPreview =
              trackingReady &&
              timestamp - lastTrackTimeRef.current >= attractTrackIntervalMs;

            if (shouldTrackPreview) {
              lastTrackTimeRef.current = timestamp;
              const results = detect(frameSource, mediaTimestamp);
              const hand = extractPrimaryHand(results?.landmarks ?? []);
              const wristX = hand?.wrist.x ?? null;
              if (updateWaveDetector(waveDetectorRef.current, wristX)) {
                resetWaveDetector(waveDetectorRef.current);
                onWaveStartRef.current?.();
              }
            }

            ctx.clearRect(0, 0, width, height);
            if (!videoUnderlay) {
              drawVideoCover(
                ctx,
                frameSource,
                frameWidth,
                frameHeight,
                width,
                height,
                0.4,
                mirrorCover,
              );
            }
            drawIdleVignette(ctx, width, height, 0.82);
            drawCinematicVignette(ctx, width, height, 0.45);
            frameId = requestAnimationFrame(draw);
            return;
          }

        let targetTransform: DonutTransform = { ...DEFAULT_TRANSFORM };
        let mode: 'idle' | 'active' = 'idle';
        let mouthPose: MouthPose | null = null;
        let handDetected = false;

        if (shouldTrack) {
          lastTrackTimeRef.current = timestamp;
          const inferStart = globalThis.performance.now();

          const results = detect(frameSource, mediaTimestamp);

          // Face is cheaper than pose — run every other tick in lite.
          faceTickRef.current += 1;
          const runFace =
            enableBite &&
            faceReady &&
            (!lite || faceTickRef.current % 2 === 0);
          const faceResults = runFace
            ? detectFace(frameSource, mediaTimestamp)
            : null;

          const poseResults = poseReady
            ? detectPose(frameSource, mediaTimestamp)
            : null;

          const poses = (poseResults?.landmarks ?? [])
            .map((lm) => poseFromLandmarks(lm))
            .filter((p): p is NonNullable<typeof p> => !!p);
          if (poses.length > 0) {
            lastPoseLandmarksRef.current = poses;
          }
          const posesForPeople =
            poses.length > 0 ? poses : lastPoseLandmarksRef.current;
          const faces = facesFromLandmarks(faceResults?.faceLandmarks ?? []);
          const hands = handsFromLandmarks(results?.landmarks ?? []);
          let people = buildPeopleCandidates(posesForPeople, faces);
          if (people.length === 0 && hands.length > 0) {
            people = peopleFromHands(hands);
          }

          const tracker = subjectTrackerRef.current!;
          const snapshot = tracker.update({
            timestamp: mediaTimestamp,
            people,
            hands,
            faces,
            interactionActive: wasInteractingRef.current,
            gestureValid: false,
          });
          trackingSnapshotRef.current = snapshot;

          let hand = null as ReturnType<typeof extractPrimaryHand>;
          if (
            snapshot.controllingHand &&
            (snapshot.state === 'LOCKED' ||
              snapshot.state === 'INTERACTING' ||
              snapshot.state === 'COOLDOWN')
          ) {
            const handIndex = Number(
              snapshot.controllingHand.id.split('_')[1] ?? 0,
            );
            hand = extractHandByIndex(results?.landmarks ?? [], handIndex);
          }

          // Never leave guests without a donut if a hand is clearly present.
          if (!hand) {
            hand = extractPrimaryHand(results?.landmarks ?? []);
          }

          if (hand) {
            handDetected = true;
            const pose = estimateHandPose(
              hand,
              width,
              height,
              frameWidth,
              frameHeight,
              mirrorLandmarks,
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

          const interacting = mode === 'active' && targetTransform.visible;
          if (interacting && !wasInteractingRef.current) {
            tracker.notifyInteractionStarted(mediaTimestamp);
            wasInteractingRef.current = true;
          } else if (!interacting && wasInteractingRef.current) {
            tracker.notifyInteractionCompleted(mediaTimestamp);
            wasInteractingRef.current = false;
          }

          if (enableBite && faceReady && faceResults) {
            let faceIndex = 0;
            if (snapshot.activeSubject?.faceCenter && faces.length > 1) {
              const anchor = snapshot.activeSubject.faceCenter;
              let best = 0;
              let bestDist = Infinity;
              faces.forEach((face, index) => {
                const d = Math.hypot(
                  face.center.x - anchor.x,
                  face.center.y - anchor.y,
                );
                if (d < bestDist) {
                  bestDist = d;
                  best = index;
                }
              });
              faceIndex = best;
            }
            const detectedMouth = extractMouthPose(
              faceResults.faceLandmarks ?? [],
              width,
              height,
              frameWidth,
              frameHeight,
              mirrorLandmarks,
              faceIndex,
            );
            if (detectedMouth) {
              cachedMouthRef.current = { pose: detectedMouth, at: timestamp };
              mouthPose = detectedMouth;
            } else {
              const prev = cachedMouthRef.current;
              if (prev && timestamp - prev.at <= MOUTH_CACHE_MS) {
                mouthPose = prev.pose;
              } else {
                cachedMouthRef.current = null;
              }
            }
          } else {
            const prev = cachedMouthRef.current;
            if (prev && timestamp - prev.at <= MOUTH_CACHE_MS) {
              mouthPose = prev.pose;
            }
          }

          fpsRef.current.inferMs = globalThis.performance.now() - inferStart;
          onInferenceSampleRef.current?.(fpsRef.current.inferMs, mediaTimestamp);
        } else {
          targetTransform = cachedTargetRef.current;
          mode = targetTransform.visible ? 'active' : 'idle';
          handDetected = cachedPoseRef.current !== null;
          const prev = cachedMouthRef.current;
          if (prev && timestamp - prev.at <= MOUTH_CACHE_MS) {
            mouthPose = prev.pose;
          }
        }

        if (enableBite) {
          const prevBitePhase = biteStateRef.current.phase;
          biteStateRef.current = updateBiteDetector(biteStateRef.current, {
            timestamp,
            donutX: targetTransform.x,
            donutY: targetTransform.y,
            donutScale: targetTransform.scale,
            mouth: mouthPose,
            isActive:
              mode === 'active' &&
              targetTransform.visible &&
              targetTransform.scale > 1,
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
        }

        if (
          handDetected ||
          mode === 'active' ||
          (enableBite && biteStateRef.current.phase !== 'held')
        ) {
          onActivityRef.current?.();
        }

        const targetActive = mode === 'active' ? 1 : 0;
        const targetIdle = 1 - targetActive;

        activeBlendRef.current = smoothScalar(
          activeBlendRef.current,
          targetActive,
          blendSmoothing,
        );
        idleBlendRef.current = smoothScalar(
          idleBlendRef.current,
          targetIdle,
          blendSmoothing,
        );

        transformRef.current = smoothTransform(
          transformRef.current,
          targetTransform,
          lowLatencyFollow ? 0.72 : lite ? LITE_POSE_SMOOTHING : blendSmoothing,
          smoothOptions,
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
        if (!videoUnderlay) {
          drawVideoCover(
            ctx,
            frameSource,
            frameWidth,
            frameHeight,
            width,
            height,
            idleBlend,
            mirrorCover,
          );
        } else if (idleBlend > 0.02) {
          ctx.save();
          ctx.fillStyle = `rgba(42, 24, 16, ${idleBlend * 0.38})`;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }

        if (!lite && !videoUnderlay) {
          drawBakeryLighting(ctx, width, height);
        }

        if (!lite && !videoUnderlay) {
          const particleBlend = Math.max(idleBlend, activeBlend * 0.35);
          drawAmbientSparkles(
            ctx,
            ambientRef.current,
            width,
            height,
            timestamp,
            particleBlend,
          );
          drawIdlePulse(ctx, width, height, timestamp, idleBlend);
        }

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

        if (enableBite && explosionRef.current) {
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
        drawCinematicVignette(ctx, width, height, lite ? 0.34 : 0.42);

        if (!lite && !videoUnderlay) {
          drawFilmGrain(ctx, width, height, timestamp);
        }

        if (debugMode && cachedPoseRef.current) {
          drawHandDebug(ctx, cachedPoseRef.current, {
            x: donut.x,
            y: donut.y,
          });

          if (enableBite && mouthPose && targetTransform.scale > 1) {
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
          const lines = enableBite
            ? [
                `Face tracking: ${faceStatus}`,
                `Bite phase: ${biteState.phase}`,
                mouthPose
                  ? `Mouth lock: ${biteState.proximityFrames}/${BITE_HOLD_FRAMES} frames`
                  : 'Mouth: not detected — face the mirror',
                lite ? 'Lite performance mode' : 'Full quality mode',
              ]
            : [
                lite ? 'Lite performance mode' : 'Full quality mode',
                `Track interval: ${trackIntervalMs || 'every frame'}ms`,
                `Camera rotate: ${camRotate}°`,
              ];
          lines.forEach((line, index) => {
            ctx.fillText(line, 16, 16 + index * 20);
          });
          ctx.restore();
        }

        if ((debugMode || forceDebugOverlay) && trackingSnapshotRef.current) {
          const prev = fpsRef.current.lastTs;
          if (prev > 0) {
            const dt = timestamp - prev;
            if (dt > 0) {
              const instant = 1000 / dt;
              fpsRef.current.fps = fpsRef.current.fps
                ? fpsRef.current.fps * 0.85 + instant * 0.15
                : instant;
            }
          }
          fpsRef.current.lastTs = timestamp;

          drawTrackingDebugOverlay(
            ctx,
            width,
            height,
            trackingSnapshotRef.current,
            {
              fps: fpsRef.current.fps,
              inferenceMs: fpsRef.current.inferMs,
              mirrored: mirrorLandmarks,
            },
          );
        }

          frameId = requestAnimationFrame(draw);
        } catch (err) {
          console.error('Mirror draw frame failed:', err);
          frameId = requestAnimationFrame(draw);
        }
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
      detectPose,
      trackingReady,
      faceReady,
      poseReady,
      faceStatus,
      started,
      debugMode,
      forceDebugOverlay,
      useVideoTimestamps,
      videoUnderlay,
      lowLatencyFollow,
      mirrorFeed,
      stepToken,
      lite,
      trackIntervalMs,
      enableBite,
      attractTrackIntervalMs,
      camRotate,
      waveToStart,
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
