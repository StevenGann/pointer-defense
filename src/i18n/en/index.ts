import type { Catalogue } from '../index.ts';
import { hud } from './hud.ts';
import { menu } from './menu.ts';
import { status } from './status.ts';
import { tooltip } from './tooltip.ts';

/**
 * The English catalogue — the source locale and the runtime fallback.
 *
 * Split by surface so several people (or several agents) can extend different parts at once without
 * touching the same file. Every key is referenced by code, checked by `npm run i18n:check`.
 */
export const en = {
  ...hud,
  ...menu,
  ...status,
  ...tooltip,

  // Window title.
  'window.title': 'Pointer Defense',
} as const satisfies Catalogue;
