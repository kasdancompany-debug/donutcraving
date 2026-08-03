/**
 * =============================================================================
 * BRANDING & COPY — customize everything for your kiosk installation here.
 * Visual palette & fonts: see `src/config/theme.ts`
 * =============================================================================
 */

/** Company / event name shown near the QR code. */
export const BRAND_NAME = 'Kasdan Co.';

/** App title shown on the attract screen and browser tab (also set in index.html). */
export const APP_TITLE = 'Donut Mirror';

/**
 * Primary donut — used in the live mirror experience.
 * Blueberry glaze artwork in `public/assets/donut-blueberry.png`.
 * Set USE_PROCEDURAL_DONUT = true in `src/utils/donutRenderer.ts` for the built-in canvas donut.
 */
export const DONUT_IMAGE_PATH = '/assets/donut-blueberry.png';

/** Vanilla / white glaze — mixed with blueberry on the attract homescreen. */
export const DONUT_WHITE_IMAGE_PATH = '/assets/donut.png';

/** Kasdan logo shown in the lower-left corner. */
export const KASDAN_LOGO_PATH = '/assets/kasdan-logo.png';

/**
 * Where the mirror QR code should send people.
 * Uses your live site origin in production; works locally at /craving.html too.
 */
export function getQrTargetUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/craving.html`;
  }
  return '/craving.html';
}

/** Label beneath the QR code. */
export const QR_LABEL = 'Scan to find your craving';

// --- Attract screen (shown before the experience starts) ---

export const ATTRACT_EYEBROW = APP_TITLE;
export const ATTRACT_HEADLINE = 'Step closer to reveal your craving';
export const ATTRACT_SUBTEXT = 'Tap anywhere to begin';
export const ATTRACT_SUBTEXT_KIOSK = 'Touch to begin';
export const ATTRACT_SUBTEXT_WAVE = 'Wave your hand to begin';

// --- In-experience copy (drawn on canvas) ---

/** Shown while idle — hand not close enough or not detected. */
export const IDLE_HINT_TEXT = 'Step closer to reveal your craving';

/** Fades in when the user is holding the donut. */
export const DESIRE_TEXT = 'You desire… the perfect donut.';

// --- Kiosk chrome ---

export const FULLSCREEN_BUTTON_LABEL = 'Fullscreen';
export const FULLSCREEN_PROMPT_TITLE = 'For the best experience, go fullscreen';
export const FULLSCREEN_PROMPT_HINT = 'Press F or tap the button below';

/** Shown subtly on the attract screen; hidden during the live mirror. */
export const KEYBOARD_HINTS =
  'F · Fullscreen   ·   D · Debug   ·   R · Recalibrate   ·   S · Screenshot';

/** Prefix for downloaded screenshot files (timestamp appended automatically). */
export const SCREENSHOT_FILENAME_PREFIX = 'donut-mirror';

/** Delay before the fullscreen prompt appears (milliseconds). */
export const FULLSCREEN_PROMPT_DELAY_MS = 2500;

// --- Kiosk sleep loop ---

/** Return to the attract screen after this long with no hand at the mirror (ms). */
export const KIOSK_IDLE_TIMEOUT_MS = 40_000;

/** Maximum mirror session length before resetting for the next visitor (ms). */
export const KIOSK_MAX_SESSION_MS = 90_000;
