import { useCallback, useEffect, useRef, useState } from 'react';

export type ReplayStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ReplaySpeed = 0.25 | 0.5 | 1 | 2;

const FRAME_STEP_SEC = 1 / 30;

export function useReplayCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeedState] = useState<ReplaySpeed>(1);
  const [stepToken, setStepToken] = useState(0);

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const video = videoRef.current;
      if (!video) return;

      revokeUrl();
      setStatus('loading');
      setError(null);
      setFileName(file.name);
      setPaused(true);

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Could not load this video file.'));
        };
        const cleanup = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('error', onError);
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.loop = false;
        video.load();
      })
        .then(() => {
          video.pause();
          video.currentTime = 0;
          video.playbackRate = speed;
          setDuration(video.duration || 0);
          setCurrentTime(0);
          setStatus('ready');
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load video.');
          setStatus('error');
        });
    },
    [revokeUrl, speed],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => setCurrentTime(video.currentTime);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onEnded = () => setPaused(true);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('seeked', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => () => revokeUrl(), [revokeUrl]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    void video.play().catch(() => undefined);
  }, [speed]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const setSpeed = useCallback((next: ReplaySpeed) => {
    setSpeedState(next);
    const video = videoRef.current;
    if (video) video.playbackRate = next;
  }, []);

  const seek = useCallback((timeSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, timeSec), video.duration || timeSec);
    setStepToken((token) => token + 1);
  }, []);

  const stepFrame = useCallback(
    (direction: 1 | -1 = 1) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      const next = video.currentTime + direction * FRAME_STEP_SEC;
      video.currentTime = Math.min(Math.max(0, next), video.duration || next);
      setStepToken((token) => token + 1);
    },
    [],
  );

  const restart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setCurrentTime(0);
    setStepToken((token) => token + 1);
  }, []);

  /** Media time in ms — use for MediaPipe + tracker so dwell/grace match the recording. */
  const getMediaTimestampMs = useCallback(() => {
    const video = videoRef.current;
    return Math.round((video?.currentTime ?? 0) * 1000);
  }, []);

  return {
    videoRef,
    status,
    error,
    fileName,
    duration,
    currentTime,
    paused,
    speed,
    stepToken,
    loadFile,
    play,
    pause,
    setSpeed,
    seek,
    stepFrame,
    restart,
    getMediaTimestampMs,
  };
}
