/**
 * Recorded-session replay lab is development-only.
 * In production builds `import.meta.env.DEV` is false, so this always returns false
 * even if someone appends ?replay=1 to the kiosk URL.
 */
export function isReplayLabEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  const flag = params.get('replay');
  return flag === '1' || flag === 'true';
}
