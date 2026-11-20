import type { Catalogue } from '../index.ts';

/**
 * Display names for tower and enemy kinds.
 *
 * The kind ids (`gun`, `flyer-boss`, …) are identifiers: they appear in save files, seeded runs and
 * regression hashes, so they never move. Only the words a player reads live here.
 */
export const names = {
  'name.tower.gun': 'Gun',
  'name.tower.cannon': 'Cannon',
  'name.tower.taser': 'Taser',
  'name.tower.frost': 'Frost',
  'name.tower.laser': 'Laser',
  'name.tower.aa': 'AA',
  'name.tower.beacon': 'Beacon',
  'name.tower.repair': 'Repair',
  'name.tower.wall': 'Wall',
  'name.tower.cursor': 'Cursor',

  'name.enemy.grunt': 'Grunt',
  'name.enemy.runner': 'Runner',
  'name.enemy.shielded': 'Shielded',
  'name.enemy.flyer': 'Flyer',
  'name.enemy.armoured': 'Armoured',
  'name.enemy.saboteur': 'Saboteur',
  'name.enemy.breacher': 'Breacher',
  'name.enemy.popup': 'Pop-up',
  'name.enemy.grunt-boss': 'Sergeant',
  'name.enemy.runner-boss': 'Pacer',
  'name.enemy.shielded-boss': 'Bastion',
  'name.enemy.flyer-boss': 'Carrier',
  'name.enemy.armoured-boss': 'Dreadnought',
  'name.enemy.saboteur-boss': 'Wirecutter',
  'name.enemy.breacher-boss': 'Ram',

  // Pointer stages and wave modifiers: data-held names, translated like the roster.
  'name.pointer.1': 'Click',
  'name.pointer.2': 'Reticle',
  'name.modifier.fog': 'Fog',
  'name.modifier.no-build': 'No-Build',
  'name.modifier.fast': 'Fast Forward',
  'name.modifier.blackout': 'Blackout',
  'name.modifier.rush': 'Rush',
} as const satisfies Catalogue;
