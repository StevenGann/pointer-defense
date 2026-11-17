/**
 * Screen / device-pixel-ratio helpers, kept Pixi-free so the smoke harness can assert the backing
 * store invariant headlessly.
 *
 * `devicePixelRatio` is not a constant: it changes when the window moves to a display with another
 * scale factor, when the OS scale changes, and when the browser zooms. The canvas backing store must
 * always equal the CSS size times the *live* ratio, so the wiring re-applies `renderer.resize` with
 * the fresh ratio whenever it drifts.
 */

/** The live device pixel ratio, or 1 when unavailable (headless / no window). */
export function liveDevicePixelRatio(): number {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
}

/** The CSS viewport size, matching Pixi's `resizeTo: window` (layout viewport in CSS px). */
export function cssViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The backing-store size a canvas must have to be crisp at `dpr` for a CSS size. */
export function backingStorePixelSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): { width: number; height: number } {
  return { width: Math.round(cssWidth * dpr), height: Math.round(cssHeight * dpr) };
}
