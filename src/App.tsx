import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttractScreen } from './components/AttractScreen';
import { BrandLogo } from './components/BrandLogo';
import { KioskChrome } from './components/KioskChrome';
import { MirrorCanvas } from './components/MirrorCanvas';
import { useCamera } from './hooks/useCamera';
import { useFullscreen } from './hooks/useFullscreen';
import { useFullscreenPrompt } from './hooks/useFullscreenPrompt';
import { useFaceTracking } from './hooks/useFaceTracking';
import { useHandTracking } from './hooks/useHandTracking';
import {
  KIOSK_IDLE_TIMEOUT_MS,
  KIOSK_MAX_SESSION_MS,
} from './config/branding';
import { WATCHDOG_STALL_MS } from './config/performance';
import { useKioskIdleTimeout } from './hooks/useKioskIdleTimeout';
import { kioskProfile } from './utils/kioskMode';
import { startKioskWatchdog } from './utils/kioskWatchdog';
import { downloadCanvasScreenshot } from './utils/screenshot';
import './App.css';

function App() {
  const { isKiosk, isLite, allowDebug, enableBite, trackIntervalMs, attractSubtext, camRotate, waveToStart } =
    kioskProfile;

  const [started, setStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [recalibrateToken, setRecalibrateToken] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { videoRef, status: cameraStatus, error: cameraError, retry: retryCamera } =
    useCamera({ lite: isLite });
  const {
    status: trackingStatus,
    error: trackingError,
    detect,
    retry: retryTracking,
  } = useHandTracking({ lite: isLite });
  const { status: faceStatus, detect: detectFace } = useFaceTracking({
    enabled: enableBite,
  });
  const { isFullscreen, enter: enterFullscreen, toggle: toggleFullscreen } =
    useFullscreen();

  const isLoading =
    cameraStatus === 'idle' ||
    cameraStatus === 'requesting' ||
    trackingStatus === 'loading';

  const hasError = cameraStatus === 'error' || trackingStatus === 'error';
  const { visible: showFullscreenPrompt, dismiss: dismissFullscreenPrompt } =
    useFullscreenPrompt(isFullscreen, !hasError && !isKiosk);
  const errorMessage = cameraError ?? trackingError;
  const showAttract = !started && !hasError && !isLoading;

  const handleScreenshot = useCallback(() => {
    downloadCanvasScreenshot(canvasRef.current);
  }, []);

  const handleRecalibrate = useCallback(() => {
    setRecalibrateToken((token) => token + 1);
  }, []);

  const handleSleep = useCallback(() => {
    setStarted(false);
    setDebugMode(false);
    setRecalibrateToken((token) => token + 1);
  }, []);

  const handleStart = useCallback(() => {
    setStarted(true);
    if (isKiosk) {
      void enterFullscreen();
    }
  }, [isKiosk, enterFullscreen]);

  const handleRetry = useCallback(() => {
    if (cameraStatus === 'error') retryCamera();
    if (trackingStatus === 'error') retryTracking();
  }, [cameraStatus, trackingStatus, retryCamera, retryTracking]);

  const { pingActivity } = useKioskIdleTimeout({
    enabled: started && !hasError,
    idleTimeoutMs: KIOSK_IDLE_TIMEOUT_MS,
    maxSessionMs: KIOSK_MAX_SESSION_MS,
    onSleep: handleSleep,
  });

  useEffect(() => {
    if (!allowDebug) {
      setDebugMode(false);
    }
  }, [allowDebug]);

  useEffect(() => {
    if (!started || waveToStart) return;

    const onPointer = () => pingActivity();
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [started, pingActivity, waveToStart]);

  useEffect(() => {
    if (cameraStatus !== 'ready') return;
    return startKioskWatchdog({ stallMs: WATCHDOG_STALL_MS });
  }, [cameraStatus]);

  useEffect(() => {
    if (!isKiosk) return;

    let hiddenAt = 0;
    let wakeTimer: number | undefined;
    const MIN_HIDDEN_MS = 2_000;
    const DEBOUNCE_MS = 800;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        if (wakeTimer !== undefined) {
          window.clearTimeout(wakeTimer);
          wakeTimer = undefined;
        }
        return;
      }

      if (!hiddenAt || Date.now() - hiddenAt < MIN_HIDDEN_MS) {
        hiddenAt = 0;
        return;
      }

      hiddenAt = 0;
      wakeTimer = window.setTimeout(() => {
        if (document.visibilityState !== 'visible') return;
        handleSleep();
      }, DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (wakeTimer !== undefined) window.clearTimeout(wakeTimer);
    };
  }, [isKiosk, handleSleep]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isKiosk && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        void toggleFullscreen();
      }

      if (!allowDebug) return;

      if (event.key === 'd' || event.key === 'D') {
        setDebugMode((value) => !value);
      }
      if (event.key === 'r' || event.key === 'R') {
        handleRecalibrate();
      }
      if (event.key === 's' || event.key === 'S') {
        handleScreenshot();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen, handleRecalibrate, handleScreenshot, isKiosk, allowDebug]);

  const performance = useMemo(
    () => ({
      lite: isLite,
      trackIntervalMs,
      enableBite,
    }),
    [isLite, trackIntervalMs, enableBite],
  );

  return (
    <div className={`app${isLite ? ' app--lite' : ''}${isKiosk ? ' app--kiosk' : ''}`}>
      {!isLite && <div className="film-grain" aria-hidden />}
      <video ref={videoRef} className="hidden-video" playsInline muted />

      {cameraStatus === 'ready' && (
        <MirrorCanvas
          ref={canvasRef}
          videoRef={videoRef}
          detect={detect}
          detectFace={detectFace}
          trackingReady={trackingStatus === 'ready'}
          faceReady={faceStatus === 'ready'}
          faceStatus={faceStatus}
          started={started}
          debugMode={allowDebug && debugMode}
          recalibrateToken={recalibrateToken}
          performance={performance}
          camRotate={camRotate}
          waveToStart={waveToStart}
          onWaveStart={handleStart}
          onActivity={pingActivity}
        />
      )}

      <AttractScreen
        visible={showAttract}
        onStart={handleStart}
        subtext={attractSubtext}
        waveMode={waveToStart}
      />

      {started && !hasError && <BrandLogo />}

      <KioskChrome
        isKiosk={isKiosk}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
        showFullscreenPrompt={showFullscreenPrompt && !hasError}
        onDismissFullscreenPrompt={dismissFullscreenPrompt}
        showKeyboardHints={showAttract && !isKiosk}
        showQrCorner={started && !hasError}
      />

      {isLoading && !hasError && (
        <div className="overlay">
          <p className="overlay-text">Awakening the mirror…</p>
          <p className="overlay-subtext">
            {isKiosk
              ? 'Getting the camera ready…'
              : 'Allow webcam access when prompted'}
          </p>
        </div>
      )}

      {hasError && (
        <div className="overlay overlay-error">
          <p className="overlay-text">Something went wrong</p>
          <p className="overlay-subtext">{errorMessage}</p>
          <button type="button" className="retry-button" onClick={handleRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
