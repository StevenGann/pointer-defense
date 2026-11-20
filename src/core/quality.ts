/**
 * The frame-time governor (docs/PERFORMANCE.md §1). A presentation-only state machine: it never
 * reads or writes the simulation, it only picks how much the view is allowed to draw. A run's
 * outcome cannot depend on it.
 *
 * Frame time is smoothed with a 30-frame exponential moving average. When that average climbs above
 * 22 ms the level steps down one step (`full -> no-shadows -> lean`); it only steps back up once the
 * average has stayed below 14 ms for 120 consecutive frames. The asymmetry (fast down, slow up)
 * keeps a borderline machine from oscillating between two levels, and the 30-frame warm-up after
 * every change means one slow frame is noise, not a reason to degrade.
 */

export type QualityLevel = 'full' | 'no-shadows' | 'lean';

/** The levels in step-down order; stepping down moves right, stepping up moves left. */
const LEVELS: readonly QualityLevel[] = ['full', 'no-shadows', 'lean'];

const EMA_WINDOW = 30;
const STEP_DOWN_MS = 22;
const STEP_UP_MS = 14;
const STEP_UP_FRAMES = 120;

/** The smoothed frame time used by the thresholds and the `?fps=1` readout. */
let emaMs = 0;
/** Frames since the last level change (or session start); the governor is silent during the first 30. */
let windowFrames = 0;
/** Consecutive frames the smoothed time has stayed below `STEP_UP_MS`. */
let belowFrames = 0;

function stepDown(current: QualityLevel): QualityLevel {
  const i = LEVELS.indexOf(current);
  return LEVELS[Math.min(LEVELS.length - 1, i + 1)];
}

function stepUp(current: QualityLevel): QualityLevel {
  const i = LEVELS.indexOf(current);
  return LEVELS[Math.max(0, i - 1)];
}

/**
 * Advance the governor one frame and return the quality level to draw at.
 *
 * @param current the level drawn last frame.
 * @param frameMs  the measured time of the current frame, in milliseconds.
 * @param samples  the 0-based index of this frame; index 0 starts a fresh sampling session.
 */
export function nextQuality(current: QualityLevel, frameMs: number, samples: number): QualityLevel {
  if (samples === 0) {
    emaMs = frameMs;
    windowFrames = 0;
    belowFrames = 0;
  } else {
    emaMs += (frameMs - emaMs) / EMA_WINDOW;
  }
  windowFrames += 1;

  // One frame is noise: no decision until the smoothing window has filled.
  if (windowFrames < EMA_WINDOW) return current;

  if (emaMs > STEP_DOWN_MS) {
    belowFrames = 0;
    windowFrames = 0;
    emaMs = frameMs;
    return stepDown(current);
  }
  if (emaMs < STEP_UP_MS) {
    belowFrames += 1;
    if (belowFrames >= STEP_UP_FRAMES) {
      belowFrames = 0;
      windowFrames = 0;
      emaMs = frameMs;
      return stepUp(current);
    }
    return current;
  }
  belowFrames = 0;
  return current;
}

/** The governor's current smoothed frame time, for the `?fps=1` readout. */
export function qualityFrameMs(): number {
  return emaMs;
}

/** The `?quality=full|no-shadows|lean` pin, or null when the level is not pinned. */
export function qualityPin(): QualityLevel | null {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get('quality');
  if (raw === null) return null;
  return (LEVELS as readonly string[]).includes(raw) ? (raw as QualityLevel) : null;
}
