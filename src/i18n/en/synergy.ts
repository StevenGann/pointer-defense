import type { Catalogue } from '../index.ts';

/** The four batch-2 synergy rows (docs/SYNERGIES-BATCH-2.md §0, §6). */
export const synergy = {
  'synergy.chill.name': 'Chill',
  'synergy.chill.description': 'An adjacent Frost lets this AA slow every flyer it hits.',
  'synergy.interlock.name': 'Interlock',
  'synergy.interlock.description': 'An adjacent Laser lets this Taser fire at whatever the Laser is targeting.',
  'synergy.shatter.name': 'Shatter',
  'synergy.shatter.description': 'A Cannon beside a Frost leaves a second, smaller burst where a shell hits a slowed enemy.',
  'synergy.buttress.name': 'Buttress',
  'synergy.buttress.description': 'Adjacent Bulwark walls share incoming damage so the whole group falls together.',
} as const satisfies Catalogue;
