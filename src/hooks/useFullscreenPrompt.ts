import { useEffect, useState } from 'react';
import { FULLSCREEN_PROMPT_DELAY_MS } from '../config/branding';

export function useFullscreenPrompt(isFullscreen: boolean, enabled: boolean) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || isFullscreen || dismissed) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, FULLSCREEN_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, isFullscreen, dismissed]);

  useEffect(() => {
    if (isFullscreen) {
      setVisible(false);
      setDismissed(true);
    }
  }, [isFullscreen]);

  const dismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  return { visible, dismiss };
}
