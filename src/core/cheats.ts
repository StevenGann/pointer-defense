import { enemyName } from '../i18n/names.ts';
import type { EnemyKind } from './enemies.ts';

/**
 * The Cheats menu and its shortcuts are a testing tool: reach any state without grinding. They stay
 * hidden behind the Konami code until the player unlocks them, so every read goes through
 * `cheatsEnabled()`. The gate is a module flag seeded from `profile.cheatsUnlocked` at load (via
 * `setCheatsUnlocked`), not a compile-time constant, so an unlocked player stays unlocked across
 * sessions while a fresh save stays hidden.
 */

let cheatsUnlocked = false;

export function cheatsEnabled(): boolean {
  return cheatsUnlocked;
}

/** Seed the gate from the persisted profile at load, and flip it on unlock. */
export function setCheatsUnlocked(unlocked: boolean): void {
  cheatsUnlocked = unlocked;
}

/** The classic Konami code, lowercased, in order. */
export const KONAMI_SEQUENCE: readonly string[] = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];

/**
 * Advance the rolling Konami cursor by one key. A matching key moves the cursor forward; any other
 * key drops it back to 0 — except ArrowUp, which restarts at 1 and then re-matches, so a stray extra
 * Up folds into the opening Up-Up pair instead of breaking the sequence.
 */
export function advanceKonami(cursor: number, key: string): number {
  const k = key.toLowerCase();
  if (k === KONAMI_SEQUENCE[cursor]) return cursor + 1;
  const restart = k === 'arrowup' ? 1 : 0;
  return KONAMI_SEQUENCE[restart] === k ? restart + 1 : restart;
}

/** Every enemy kind and every boss variant the Spawn column lists, in introduction order. */
export const SPAWN_KINDS: readonly EnemyKind[] = [
  'grunt',
  'runner',
  'shielded',
  'flyer',
  'armoured',
  'saboteur',
  'breacher',
  'popup',
  'grunt-boss',
  'runner-boss',
  'shielded-boss',
  'flyer-boss',
  'armoured-boss',
  'saboteur-boss',
  'breacher-boss',
];

/** The display name for a spawnable kind. */
export function spawnKindLabel(kind: EnemyKind): string {
  return enemyName(kind);
}
