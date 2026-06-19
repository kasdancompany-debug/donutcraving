import {
  FULLSCREEN_BUTTON_LABEL,
  FULLSCREEN_PROMPT_HINT,
  FULLSCREEN_PROMPT_TITLE,
  KEYBOARD_HINTS,
} from '../config/branding';
import { QRCodePanel } from './QRCodePanel';

interface KioskChromeProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showFullscreenPrompt: boolean;
  onDismissFullscreenPrompt: () => void;
  showKeyboardHints: boolean;
  showQrCorner: boolean;
}

export function KioskChrome({
  isFullscreen,
  onToggleFullscreen,
  showFullscreenPrompt,
  onDismissFullscreenPrompt,
  showKeyboardHints,
  showQrCorner,
}: KioskChromeProps) {
  return (
    <>
      {showFullscreenPrompt && (
        <div className="kiosk-fullscreen-prompt" role="status">
          <div className="kiosk-fullscreen-prompt-body">
            <p className="kiosk-fullscreen-prompt-title">
              {FULLSCREEN_PROMPT_TITLE}
            </p>
            <p className="kiosk-fullscreen-prompt-hint">
              {FULLSCREEN_PROMPT_HINT}
            </p>
            <div className="kiosk-fullscreen-prompt-actions">
              <button
                type="button"
                className="kiosk-btn kiosk-btn--primary"
                onClick={onToggleFullscreen}
              >
                {FULLSCREEN_BUTTON_LABEL}
              </button>
              <button
                type="button"
                className="kiosk-btn kiosk-btn--ghost"
                onClick={onDismissFullscreenPrompt}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="kiosk-toolbar">
        <button
          type="button"
          className="kiosk-btn kiosk-btn--toolbar"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title="Press F"
        >
          {isFullscreen ? 'Exit Fullscreen' : FULLSCREEN_BUTTON_LABEL}
          <span className="kiosk-btn-shortcut">F</span>
        </button>
      </div>

      {showKeyboardHints && (
        <p className="kiosk-keyboard-hints">{KEYBOARD_HINTS}</p>
      )}

      {showQrCorner && (
        <div className="kiosk-qr-corner">
          <QRCodePanel compact />
        </div>
      )}
    </>
  );
}
