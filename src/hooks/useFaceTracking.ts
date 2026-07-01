import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

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

  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      setError(null);
      return;
    }

    let cancelled = false;

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
      try {
        let landmarker: FaceLandmarker;
        try {
          landmarker = await createLandmarker('CPU');
        } catch {
          landmarker = await createLandmarker('GPU');
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
            : 'Failed to initialize face tracking.';
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
  }, [enabled]);

  const detect = useCallback(
    (video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult | null => {
      if (!enabled) return null;

      const landmarker = landmarkerRef.current;
      if (!landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return null;
      }

      return landmarker.detectForVideo(video, timestamp);
    },
    [enabled],
  );

  return { status, error, detect };
}
