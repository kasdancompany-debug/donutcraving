import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { INIT_TIMEOUT_MS } from '../config/performance';
import type { VisionFrameSource } from '../utils/cameraOrientation';
import { withTimeout } from '../utils/withTimeout';

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export type FaceTrackingStatus = 'loading' | 'ready' | 'error';

interface UseFaceTrackingOptions {
  enabled?: boolean;
}

export function useFaceTracking(options: UseFaceTrackingOptions = {}) {
  const enabled = options.enabled ?? true;
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const [status, setStatus] = useState<FaceTrackingStatus>(
    enabled ? 'loading' : 'ready',
  );
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      setError(null);
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;
    let attempt = 0;

    async function createLandmarker(delegate: 'GPU' | 'CPU') {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    }

    async function init() {
      setStatus('loading');
      setError(null);

      try {
        const create = async () => {
          try {
            return await createLandmarker('CPU');
          } catch {
            return createLandmarker('GPU');
          }
        };

        const landmarker = await withTimeout(
          create(),
          INIT_TIMEOUT_MS,
          'Face tracking timed out while loading.',
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
            : 'Failed to initialize face tracking.';
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
  }, [enabled, retryToken]);

  const detect = useCallback(
    (source: VisionFrameSource, timestamp: number): FaceLandmarkerResult | null => {
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
