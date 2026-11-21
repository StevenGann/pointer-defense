import type { Catalogue } from '../index.ts';

/** The shipped synergy rows' display names and descriptions (docs/SYNERGIES.md §9, docs/SYNERGIES-BATCH-2.md). */
export const synergy = {
  'synergy.aaSync.name': 'Synchronized Fire',
  'synergy.spotter.name': 'Spotter',
  'synergy.spotter.description': 'A Gun on its Marksman branch lends its range to adjacent AA and Cannon towers.',
  'synergy.chill.name': 'Chill',
  'synergy.chill.description': 'An adjacent Frost lets this AA slow every flyer it hits.',
  'synergy.interlock.name': 'Interlock',
  'synergy.interlock.description': 'An adjacent Laser lets this Taser fire at whatever the Laser is targeting.',
  'synergy.shatter.name': 'Shatter',
  'synergy.shatter.description': 'A Cannon beside a Frost leaves a second, smaller burst where a shell hits a slowed enemy.',
  'synergy.buttress.name': 'Buttress',
  'synergy.buttress.description': 'Adjacent Bulwark walls share incoming damage so the whole group falls together.',
} as const satisfies Catalogue;
