/**
 * Hand-tracking tuning constants.
 * For branding, copy, images, and QR code — see `src/config/branding.ts`.
 */

/** Fine-tune donut placement in hand-local space (pixels along rotation axes). */
export const DONUT_OFFSET_X = 0;
/** Positive shifts toward fingertips along the grip axis. */
export const DONUT_OFFSET_Y = 6;

/** Multiplier on thumb↔index pinch span for donut diameter. */
export const DONUT_SCALE_MULTIPLIER = 3.1;

/** Fallback scale from index MCP to thumb tip (never uses wrist). */
export const DONUT_PALM_SCALE_MULTIPLIER = 2.9;

/** Added to the thumb→index grip angle (radians). Ignored when LOCK_DONUT_UPRIGHT is true. */
export const DONUT_ROTATION_OFFSET = 0;

/**
 * Keep the donut artwork upright (top-down view). Recommended for photo/illustration assets.
 */
export const LOCK_DONUT_UPRIGHT = true;

/** How much to blend pinch anchor toward inner palm (0 = pure pinch, 1 = inner palm). */
export const PALM_BLEND = 0.18;

/** Scale bounds as a ratio of the shorter canvas edge. */
export const MIN_SCALE_RATIO = 0.06;
export const MAX_SCALE_RATIO = 0.32;

/** Proximity threshold for idle → active transition. */
export const PROXIMITY_SCALE_RATIO = 0.07;

/** Position follow speed per frame at 60fps (higher = snappier). */
export const POSITION_SMOOTHING = 0.42;

/** Rotation / scale follow speed (slightly slower reduces wobble). */
export const POSE_SMOOTHING = 0.32;

/** Max position smoothing when the hand is moving quickly. */
export const POSITION_SMOOTHING_FAST = 0.62;

/** Hand speed (px/frame) that triggers faster follow. */
export const FAST_MOVE_THRESHOLD = 18;
