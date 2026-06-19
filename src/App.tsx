import { useCallback, useEffect, useRef, useState } from 'react';
import { AttractScreen } from './components/AttractScreen';
import { KioskChrome } from './components/KioskChrome';
import { MirrorCanvas } from './components/MirrorCanvas';
import { useCamera } from './hooks/useCamera';
import { useFullscreen } from './hooks/useFullscreen';
import { useFullscreenPrompt } from './hooks/useFullscreenPrompt';
import { useHandTracking } from './hooks/useHandTracking';
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
          trackingReady={trackingStatus === 'ready'}
          started={started}
          debugMode={debugMode}
          recalibrateToken={recalibrateToken}
        />
      )}

      <AttractScreen visible={showAttract} onStart={() => setStarted(true)} />

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
