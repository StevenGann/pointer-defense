import type { Catalogue } from '../index.ts';
import { achievements } from './achievements.ts';
import { levels } from './levels.ts';
import { menu } from './menu.ts';
import { status } from './status.ts';
import { upgrades } from './upgrades.ts';

/**
 * The English catalogue — the source locale and the runtime fallback.
 *
 * Split by surface so several people (or several agents) can extend different parts at once without
 * touching the same file. Every key is referenced by code, checked by `npm run i18n:check`.
 */
export const en = {
  ...menu,
  ...status,
  ...achievements,
  ...upgrades,
  ...levels,

  // Window title.
  'window.title': 'Pointer Defense',
} as const satisfies Catalogue;
