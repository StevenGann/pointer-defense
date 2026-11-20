import { enemyName } from '../i18n/names.ts';
import type { EnemyKind } from './enemies.ts';

/**
 * The Cheats menu and its shortcuts are a testing tool: reach any state without grinding. They are
 * deliberately visible now and hidden behind an easter egg before public release, so every read goes
 * through `cheatsEnabled()`. Flip `CHEATS_VISIBLE` to false (or replace it with the unlock check) and
 * the menu word, the shortcuts and every scrap of cheats UI disappear in one place.
 */

export let CHEATS_VISIBLE = true;

export function cheatsEnabled(): boolean {
  return CHEATS_VISIBLE;
}

/** Test hook: the smoke harness flips the gate to assert the hidden shape, then restores it. */
export function setCheatsVisibleForTests(visible: boolean): void {
  CHEATS_VISIBLE = visible;
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
