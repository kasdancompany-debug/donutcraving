import { useCallback, useEffect, useRef, useState } from 'react';
import { FULL_CAMERA, INIT_TIMEOUT_MS, LITE_CAMERA } from '../config/performance';
import { withTimeout } from '../utils/withTimeout';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';

export interface CameraDimensions {
  width: number;
  height: number;
}

interface UseCameraOptions {
  lite?: boolean;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function friendlyCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : undefined;

  switch (name) {
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera is in use by another app or browser tab. Close other webcam tabs (including “Webcam AR”), then tap Try again.';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found. Connect a webcam and try again.';
    default:
      break;
  }

  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (lower.includes('device in use') || lower.includes('not readable')) {
      return 'Your camera is in use by another app or browser tab. Close other webcam tabs, then tap Try again.';
    }
    if (lower.includes('timed out')) {
      return 'Camera took too long to start. Trying again…';
    }
    return err.message;
  }

  return 'Unable to access the webcam.';
}

function isPermissionDenied(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
  );
}

/** Brief pause so the OS releases the camera after the previous stream stops. */
const RELEASE_DELAY_MS = 350;

async function requestVideoStream(lite: boolean): Promise<MediaStream> {
  const profile = lite ? LITE_CAMERA : FULL_CAMERA;

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: profile.width,
        height: profile.height,
        frameRate: profile.frameRate,
      },
      audio: false,
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export function useCamera(options: UseCameraOptions = {}) {
  const lite = options.lite ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(0);
  const autoRetryAttemptRef = useRef(0);
  const autoRetryTimerRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<CameraDimensions>({
    width: 0,
    height: 0,
  });

  const clearAutoRetry = useCallback(() => {
    if (autoRetryTimerRef.current !== undefined) {
      window.clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = undefined;
    }
  }, []);

  const startCamera = useCallback(async (waitForRelease = false) => {
    const session = ++sessionRef.current;
    clearAutoRetry();

    setStatus('requesting');
    setError(null);

    stopStream(streamRef.current);
    streamRef.current = null;

    if (waitForRelease) {
      await new Promise((resolve) => setTimeout(resolve, RELEASE_DELAY_MS));
    }

    if (session !== sessionRef.current) return;

    try {
      const stream = await withTimeout(
        requestVideoStream(lite),
        INIT_TIMEOUT_MS,
        'Camera timed out while starting.',
      );

      if (session !== sessionRef.current) {
        stopStream(stream);
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stopStream(stream);
        throw new Error('Video element is not available.');
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;

      const track = stream.getVideoTracks()[0];
      const onTrackEnded = () => {
        if (sessionRef.current === session) {
          void startCamera(true);
        }
      };
      track?.addEventListener('ended', onTrackEnded);

      await withTimeout(
        video.play(),
        INIT_TIMEOUT_MS,
        'Camera timed out while playing.',
      );

      if (session !== sessionRef.current) {
        stopStream(stream);
        streamRef.current = null;
        return;
      }

      autoRetryAttemptRef.current = 0;
      setDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
      setStatus('ready');
    } catch (err) {
      if (session !== sessionRef.current) return;
      stopStream(streamRef.current);
      streamRef.current = null;
      setError(friendlyCameraError(err));
      setStatus('error');

      if (!isPermissionDenied(err)) {
        const delay = Math.min(30_000, 5_000 * 2 ** autoRetryAttemptRef.current);
        autoRetryAttemptRef.current += 1;
        autoRetryTimerRef.current = window.setTimeout(() => {
          void startCamera(true);
        }, delay);
      }
    }
  }, [lite, clearAutoRetry]);

  useEffect(() => {
    void startCamera(true);

    let ignoreNextPageshow = true;

    const recoverIfNeeded = () => {
      if (document.visibilityState !== 'visible') return;

      const track = streamRef.current?.getVideoTracks()[0];
      const video = videoRef.current;

      if (!track || track.readyState === 'ended') {
        void startCamera(true);
        return;
      }

      if (
        video &&
        (video.videoWidth === 0 ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
      ) {
        void startCamera(true);
        return;
      }

      if (video?.paused) {
        void video.play().catch(() => void startCamera(true));
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      recoverIfNeeded();
    };

    const onPageShow = () => {
      if (ignoreNextPageshow) {
        ignoreNextPageshow = false;
        return;
      }
      recoverIfNeeded();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      sessionRef.current += 1;
      clearAutoRetry();
      stopStream(streamRef.current);
      streamRef.current = null;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [startCamera, clearAutoRetry]);

  const retry = useCallback(() => {
    autoRetryAttemptRef.current = 0;
    void startCamera(true);
  }, [startCamera]);

  return {
    videoRef,
    status,
    error,
    dimensions,
    retry,
  };
}
