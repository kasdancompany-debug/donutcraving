import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useKioskIdleTimeout } from './hooks/useKioskIdleTimeout';
import { downloadCanvasScreenshot } from './utils/screenshot';
import './App.css';

function App() {
  const [started, setStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [recalibrateToken, setRecalibrateToken] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { videoRef, status: cameraStatus, error: cameraError, retry } =
    useCamera();
  const { status: trackingStatus, error: trackingError, detect } =
    useHandTracking();
  const { status: faceStatus, detect: detectFace } = useFaceTracking();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const isLoading =
    cameraStatus === 'idle' ||
    cameraStatus === 'requesting' ||
    trackingStatus === 'loading';

  const hasError = cameraStatus === 'error' || trackingStatus === 'error';
  const { visible: showFullscreenPrompt, dismiss: dismissFullscreenPrompt } =
    useFullscreenPrompt(isFullscreen, !hasError);
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
    setRecalibrateToken((token) => token + 1);
  }, []);

  const { pingActivity } = useKioskIdleTimeout({
    enabled: started && !hasError,
    idleTimeoutMs: KIOSK_IDLE_TIMEOUT_MS,
    maxSessionMs: KIOSK_MAX_SESSION_MS,
    onSleep: handleSleep,
  });

  useEffect(() => {
    if (!started) return;

    const onPointer = () => pingActivity();
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [started, pingActivity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        void toggleFullscreen();
      }
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
  }, [toggleFullscreen, handleRecalibrate, handleScreenshot]);

  return (
    <div className="app">
      <div className="film-grain" aria-hidden />
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
          debugMode={debugMode}
          recalibrateToken={recalibrateToken}
          onActivity={pingActivity}
        />
      )}

      <AttractScreen visible={showAttract} onStart={() => setStarted(true)} />

      {started && !hasError && <BrandLogo />}

      <KioskChrome
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
        showFullscreenPrompt={showFullscreenPrompt && !hasError}
        onDismissFullscreenPrompt={dismissFullscreenPrompt}
        showKeyboardHints={showAttract}
        showQrCorner={started && !hasError}
      />

      {isLoading && !hasError && (
        <div className="overlay">
          <p className="overlay-text">Awakening the mirror…</p>
          <p className="overlay-subtext">Allow webcam access when prompted</p>
        </div>
      )}

      {hasError && (
        <div className="overlay overlay-error">
          <p className="overlay-text">Something went wrong</p>
          <p className="overlay-subtext">{errorMessage}</p>
          {cameraStatus === 'error' && (
            <button type="button" className="retry-button" onClick={() => void retry()}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
