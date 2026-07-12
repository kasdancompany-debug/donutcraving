/** Canvas follow easing in lite mode — higher = snappier mirror feel. */
export const LITE_BLEND_SMOOTHING = 0.24;

/** Pose / scale follow in lite mode. */
export const LITE_POSE_SMOOTHING = 0.48;

/** Position follow in lite mode. */
export const LITE_POSITION_SMOOTHING = 0.58;

export const LITE_POSITION_SMOOTHING_FAST = 0.78;

export const LITE_CAMERA = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 480, max: 480 },
  frameRate: { ideal: 24, max: 30 },
} as const;

export const FULL_CAMERA = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 60 },
} as const;

/** Attract-screen hand ML interval — cooler than every RAF frame. */
export const ATTRACT_TRACK_INTERVAL_MS = 100;

/** Camera / MediaPipe init must finish within this window. */
export const INIT_TIMEOUT_MS = 20_000;

/** Soft hang detector: reload if the draw loop stops beating. */
export const WATCHDOG_STALL_MS = 20_000;
