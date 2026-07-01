import { useCallback, useEffect, useRef, useState } from 'react';
import { FULL_CAMERA, LITE_CAMERA } from '../config/performance';

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
    return err.message;
  }

  return 'Unable to access the webcam.';
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
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<CameraDimensions>({
    width: 0,
    height: 0,
  });

  const startCamera = useCallback(async (waitForRelease = false) => {
    const session = ++sessionRef.current;

    setStatus('requesting');
    setError(null);

    stopStream(streamRef.current);
    streamRef.current = null;

    if (waitForRelease) {
      await new Promise((resolve) => setTimeout(resolve, RELEASE_DELAY_MS));
    }

    if (session !== sessionRef.current) return;

    try {
      const stream = await requestVideoStream(lite);

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
      await video.play();

      if (session !== sessionRef.current) {
        stopStream(stream);
        streamRef.current = null;
        return;
      }

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
    }
  }, [lite]);

  useEffect(() => {
    void startCamera(true);

    return () => {
      sessionRef.current += 1;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [startCamera]);

  const retry = useCallback(() => {
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
