import type { Catalogue } from './index.ts';
import { en } from './en/index.ts';
import { es } from './es/index.ts';
import { he } from './he/index.ts';
import { fr } from './fr/index.ts';
import { ru } from './ru/index.ts';
import { uk } from './uk/index.ts';
import { zh } from './zh-Hans/index.ts';

/**
 * The catalogues, keyed by BCP-47 tag.
 *
 * They are imported statically rather than fetched: the game boots synchronously and a run's first
 * frame must not wait on a network request to know what to draw. Every catalogue is a plain object of
 * short strings, so the cost is a few tens of kilobytes before gzip.
 */
export const CATALOGUES: Readonly<Record<string, Catalogue>> = {
  en,
  es,
  he,
  fr,
  ru,
  uk,
  'zh-Hans': zh,
};

/** The catalogue for a locale tag, falling back to English when the locale has no catalogue yet. */
export function catalogueFor(code: string): Catalogue {
  return CATALOGUES[code] ?? en;
}
