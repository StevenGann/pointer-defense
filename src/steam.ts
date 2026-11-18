/**
 * The Steam achievement bridge.
 *
 * The game is the single source of truth for achievements: `state.ts` evaluates the unlock
 * conditions and `main.ts` toasts them. This module only *reports* an unlock that has already
 * happened — it never re-derives one, so the web build and the Steam build can never disagree.
 *
 * In the browser (and when the Electron preload has not injected a bridge) there is nothing to
 * report and every call is a no-op, so `npm run dev` and the plain web build are unchanged.
 * Under the Steam wrapper the preload exposes `window.steamBridge`, whose single method forwards
 * the id to the main process, which forwards it to the Steamworks client when Steam is live.
 */

export interface SteamBridge {
  /** Ask the wrapper to activate a Steam achievement of the same id. May be async/ignored. */
  activateAchievement(id: string): void;
}

/** The preload-injected bridge, or null when running without the Steam wrapper. */
export function steamBridge(): SteamBridge | null {
  const w = globalThis as { steamBridge?: SteamBridge };
  const bridge = w.steamBridge;
  return typeof bridge?.activateAchievement === 'function' ? bridge : null;
}

/** Report an already-unlocked achievement to Steam, if the wrapper is present. */
export function unlockAchievement(id: string): void {
  steamBridge()?.activateAchievement(id);
}
