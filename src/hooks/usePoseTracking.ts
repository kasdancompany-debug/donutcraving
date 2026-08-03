import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { INIT_TIMEOUT_MS } from '../config/performance';
import type { VisionFrameSource } from '../utils/cameraOrientation';
import { withTimeout } from '../utils/withTimeout';

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export type PoseTrackingStatus = 'loading' | 'ready' | 'error' | 'disabled';

interface UsePoseTrackingOptions {
  enabled?: boolean;
  lite?: boolean;
  numPoses?: number;
}

export function usePoseTracking(options: UsePoseTrackingOptions = {}) {
  const enabled = options.enabled ?? true;
  const lite = options.lite ?? false;
  const numPoses = options.numPoses ?? (lite ? 1 : 4);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const [status, setStatus] = useState<PoseTrackingStatus>(
    enabled ? 'loading' : 'disabled',
  );
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      setError(null);
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;
    let attempt = 0;

    async function createLandmarker(delegate: 'GPU' | 'CPU') {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate,
        },
        runningMode: 'VIDEO',
        numPoses,
        minPoseDetectionConfidence: lite ? 0.4 : 0.5,
        minPosePresenceConfidence: lite ? 0.4 : 0.5,
        minTrackingConfidence: lite ? 0.4 : 0.5,
      });
    }

    async function init() {
      setStatus('loading');
      setError(null);

      try {
        const create = async () => {
          if (lite) {
            try {
              return await createLandmarker('CPU');
            } catch {
              return createLandmarker('GPU');
            }
          }
          try {
            return await createLandmarker('GPU');
          } catch {
            return createLandmarker('CPU');
          }
        };

        const landmarker = await withTimeout(
          create(),
          INIT_TIMEOUT_MS,
          'Pose tracking timed out while loading.',
        );

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current?.close();
        landmarkerRef.current = landmarker;
        attempt = 0;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to initialize pose tracking.';
        setError(message);
        setStatus('error');

        const delay = Math.min(30_000, 3_000 * 2 ** attempt);
        attempt += 1;
        retryTimer = window.setTimeout(() => {
          void init();
        }, delay);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [enabled, lite, numPoses, retryToken]);

  const detect = useCallback(
    (source: VisionFrameSource, timestamp: number): PoseLandmarkerResult | null => {
      if (!enabled) return null;
      const landmarker = landmarkerRef.current;
      if (!landmarker) return null;
      if (
        source instanceof HTMLVideoElement &&
        source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return null;
      }

      try {
        return landmarker.detectForVideo(source, timestamp);
      } catch {
        return null;
      }
    },
    [enabled],
  );

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  return { status, error, detect, retry };
}
