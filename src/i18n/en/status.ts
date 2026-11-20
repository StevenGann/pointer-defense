import type { Catalogue } from '../index.ts';

/** Status-bar hints: the one line of prose at the bottom of the game window. */
export const status = {
  'status.pickTower': 'Pick a tower, then click a tile',
  'status.startWave': 'Click Start Wave when you are ready',
  'status.shoot': 'Click enemies to shoot — aim for the notch',
  'status.callEarly': 'Call the next wave early for a salvage bonus — two waves at once',
  'status.laneBroke': 'The lane broke. Click Restart to try again',
  'status.victory': 'All waves cleared!',
  'status.placeTower': 'Click a tile to place {name} — right-click to cancel',
  'status.inspectTower': 'Click Upgrade, choose a branch, or sell — right-click to deselect',
  'status.contextHelp': 'Click something to read about it — Esc cancels',
} as const satisfies Catalogue;
