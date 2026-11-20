import { t } from './index.ts';

/**
 * The display name for a tower or enemy kind.
 *
 * Kind ids are identifiers and stay English in the data model; these helpers are the only sanctioned
 * way to turn one into text a player reads. An unknown id throws in development, which is how a new
 * tower kind gets caught before it ships with a blank name.
 */
export function towerName(kind: string): string {
  return t(`name.tower.${kind}`);
}

export function enemyName(kind: string): string {
  return t(`name.enemy.${kind}`);
}
