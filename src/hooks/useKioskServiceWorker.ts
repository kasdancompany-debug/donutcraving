import { useCallback, useEffect, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { logKioskEvent } from '../utils/kioskEventLog';

/** Re-check for a new deployed version — a kiosk tab is never closed/reopened. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the offline-caching service worker and holds any available
 * update until `applyPendingUpdate()` is called — call that from a safe
 * moment (the attract screen between guests), never mid-session, so a
 * deploy never yanks the page out from under someone's turn.
 */
export function useKioskServiceWorker() {
  const needsRefreshRef = useRef(false);
  const updateFnRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let pollId: number | undefined;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        needsRefreshRef.current = true;
        logKioskEvent('sw_update_available');
      },
      onOfflineReady() {
        logKioskEvent('sw_offline_ready');
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        pollId = window.setInterval(() => {
          void registration.update();
        }, UPDATE_CHECK_INTERVAL_MS);
      },
      onRegisterError(error) {
        logKioskEvent(
          'sw_register_error',
          error instanceof Error ? error.message : String(error),
        );
      },
    });

    updateFnRef.current = updateSW;

    return () => {
      if (pollId !== undefined) window.clearInterval(pollId);
    };
  }, []);

  const applyPendingUpdate = useCallback(() => {
    if (!needsRefreshRef.current) return;
    needsRefreshRef.current = false;
    logKioskEvent('sw_update_applied');
    void updateFnRef.current?.(true);
  }, []);

  return { applyPendingUpdate };
}
