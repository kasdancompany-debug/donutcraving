import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

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

  useEffect(() => {
    let cancelled = false;

    async function createLandmarker(delegate: 'GPU' | 'CPU') {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: lite ? 0.5 : 0.55,
        minHandPresenceConfidence: lite ? 0.5 : 0.55,
        minTrackingConfidence: lite ? 0.5 : 0.55,
      });
    }

    async function init() {
      try {
        let landmarker: HandLandmarker;
        if (lite) {
          try {
            landmarker = await createLandmarker('CPU');
          } catch {
            landmarker = await createLandmarker('GPU');
          }
        } else {
          try {
            landmarker = await createLandmarker('GPU');
          } catch {
            landmarker = await createLandmarker('CPU');
          }
        }

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to initialize hand tracking.';
        setError(message);
        setStatus('error');
      }
    }

    void init();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [lite]);

  const detect = useCallback(
    (video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return null;
      }

      return landmarker.detectForVideo(video, timestamp);
    },
    [],
  );

  return { status, error, detect };
}
