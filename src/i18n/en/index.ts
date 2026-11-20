import type { Catalogue } from '../index.ts';
import { achievements } from './achievements.ts';
import { dialogs } from './dialogs.ts';
import { hud } from './hud.ts';
import { levels } from './levels.ts';
import { menu } from './menu.ts';
import { screen } from './screen.ts';
import { shell } from './shell.ts';
import { status } from './status.ts';
import { tooltip } from './tooltip.ts';
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
  ...hud,
  ...tooltip,
  ...dialogs,
  ...achievements,
  ...upgrades,
  ...levels,
  ...shell,
  ...screen,

  // Window title.
  'window.title': 'Pointer Defense',
} as const satisfies Catalogue;
