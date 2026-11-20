import type { Catalogue } from '../index.ts';

/** Authored map names and the level-validation problem messages (src/core/levels.ts). */
export const levels = {
  'level.corridor.name': 'The Corridor',
  'level.dumbbell.name': 'Dumbbell',
  'level.openField.name': 'Open Field',
  'level.turnstile.name': 'Turnstile',
  'level.fork.name': 'The Fork',
  'level.ladder.name': 'The Ladder',

  'level.problem.tooManyShutters': 'too many shutters',
  'level.problem.shutterOutOfBounds': 'a shutter is out of bounds',
  'level.problem.shutterOnWall': 'a shutter sits on a wall',
  'level.problem.shutterPeriodPositive': 'a shutter period must be positive',
  'level.problem.shutterOpenWindowRange': 'a shutter open window is out of range',
  'level.problem.sealedRoute': 'no route from start to exit',
  'level.problem.routesOverlap': 'routes overlap outside the spawn and exit',
} as const satisfies Catalogue;
