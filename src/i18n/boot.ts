/**
 * Installs the chosen locale as a side effect of being imported.
 *
 * This module exists because of evaluation order. Several data modules (`src/core/levels.ts` among
 * them) call `t()` while they are being evaluated to fill in names, so the catalogue has to be
 * installed before any of them run. Importing this module first in `src/main.ts` guarantees that:
 * ES modules evaluate depth-first in import order, so the locale is active before the next import in
 * the list is touched. Nothing else should depend on this module; tests that import data modules
 * directly and never ask for a locale get English.
 */
import { initLocale } from './activate.ts';
import { localeMeta } from './locales.ts';
import { setDirection } from '../view/direction.ts';

export const activeLocaleCode: string = initLocale();

// Install the writing direction before any view module asks for it (docs/RTL.md).
setDirection(localeMeta(activeLocaleCode).dir);
