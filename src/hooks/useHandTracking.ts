import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { INIT_TIMEOUT_MS } from '../config/performance';
import type { VisionFrameSource } from '../utils/cameraOrientation';
import { withTimeout } from '../utils/withTimeout';

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type HandTrackingStatus = 'loading' | 'ready' | 'error';

interface UseHandTrackingOptions {
  lite?: boolean;
}

export function useHandTracking(options: UseHandTrackingOptions = {}) {
  const lite = options.lite ?? false;
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const [status, setStatus] = useState<HandTrackingStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempt = 0;

    async function createLandmarker(delegate: 'GPU' | 'CPU') {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: lite ? 1 : 2,
        minHandDetectionConfidence: lite ? 0.45 : 0.55,
        minHandPresenceConfidence: lite ? 0.45 : 0.55,
        minTrackingConfidence: lite ? 0.45 : 0.55,
      });
    }

    async function init() {
      setStatus('loading');
      setError(null);

      try {
        const create = async () => {
          try {
            return await createLandmarker('GPU');
          } catch {
            return createLandmarker('CPU');
          }
        };

        const landmarker = await withTimeout(
          create(),
          INIT_TIMEOUT_MS,
          'Hand tracking timed out while loading.',
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
            : 'Failed to initialize hand tracking.';
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
  }, [lite, retryToken]);

  const detect = useCallback(
    (source: VisionFrameSource, timestamp: number): HandLandmarkerResult | null => {
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
    [],
  );

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  return { status, error, detect, retry };
}
