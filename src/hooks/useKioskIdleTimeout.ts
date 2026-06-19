import { useCallback, useEffect, useRef } from 'react';

interface UseKioskIdleTimeoutOptions {
  /** When false, the timer does not run (e.g. attract screen). */
  enabled: boolean;
  /** Return to attract after this long without interaction (ms). */
  idleTimeoutMs: number;
  /** Hard cap on a single mirror session even if someone stays active (ms). */
  maxSessionMs: number;
  onSleep: () => void;
}

const TICK_MS = 1000;

export function useKioskIdleTimeout({
  enabled,
  idleTimeoutMs,
  maxSessionMs,
  onSleep,
}: UseKioskIdleTimeoutOptions) {
  const lastActivityRef = useRef(0);
  const sessionStartRef = useRef(0);
  const onSleepRef = useRef(onSleep);
  const sleptRef = useRef(false);

  useEffect(() => {
    onSleepRef.current = onSleep;
  }, [onSleep]);

  const pingActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) {
      sleptRef.current = false;
      return;
    }

    const now = Date.now();
    sessionStartRef.current = now;
    lastActivityRef.current = now;
    sleptRef.current = false;

    const tick = () => {
      if (sleptRef.current) return;

      const current = Date.now();
      const idleFor = current - lastActivityRef.current;
      const sessionFor = current - sessionStartRef.current;

      if (sessionFor >= maxSessionMs || idleFor >= idleTimeoutMs) {
        sleptRef.current = true;
        onSleepRef.current();
      }
    };

    const intervalId = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, idleTimeoutMs, maxSessionMs]);

  return { pingActivity };
}
