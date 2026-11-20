import { en } from './en.ts';

/**
 * Localisation machinery (docs/LOCALIZATION.md).
 *
 * UI strings live in a typed TypeScript catalogue (`src/i18n/en.ts`), not a resource file. `t()`
 * looks a key up in the active locale, falls back to English when a locale is missing the key, and
 * throws in development when the key is missing entirely or a placeholder is left unfilled. Numbers
 * go through `formatInt` / `formatMoney`, and plural form choice through `plural`, both built on the
 * `Intl` APIs so a second locale works without touching call sites.
 */

/** A string catalogue: every key maps to a (possibly placeholder-bearing) string. */
export type Catalogue = Readonly<Record<string, string>>;

/** Development builds throw on a missing key or an unfilled placeholder; production falls back. */
const DEV: boolean = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? true;

let activeLocale: Catalogue = en;
let activeLocaleName = 'en';

// The English catalogue, widened to the Catalogue index signature so runtime lookups by string work
// (`en` is declared `as const`, whose literal type has no index signature).
const english: Catalogue = en;

/** Switch the active catalogue. `name` is the BCP-47 tag used for `Intl` number/plural formatting. */
export function setLocale(locale: Catalogue, name: string): void {
  activeLocale = locale;
  activeLocaleName = name;
}

/** The BCP-47 tag of the active locale, for `plural` / `formatInt` / `formatMoney` defaults. */
export function currentLocaleName(): string {
  return activeLocaleName;
}

/** The resolved template for a key: the active locale, then English, then an error (dev) or the key. */
function resolveTemplate(key: string): string {
  const local = activeLocale[key];
  if (local !== undefined) return local;
  const fallback = english[key];
  if (fallback !== undefined) return fallback;
  if (DEV) throw new Error(`i18n: missing catalogue key "${key}"`);
  return key;
}

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Look up a string and fill its `{placeholders}` from `params`. Throws in development when the key is
 * missing or a placeholder is left unfilled; production falls back to the raw template (or the key
 * itself when the key is unknown) rather than painting an error onto the screen.
 */
export function t(key: string, params?: Readonly<Record<string, string | number>>): string {
  const template = resolveTemplate(key);
  if (!PLACEHOLDER_RE.test(template)) return template;
  PLACEHOLDER_RE.lastIndex = 0;
  return template.replace(PLACEHOLDER_RE, (whole, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      if (DEV) throw new Error(`i18n: unfilled placeholder "${name}" in key "${key}"`);
      return whole;
    }
    return String(value);
  });
}

/**
 * Pick `one` when `Intl.PluralRules` selects the singular form for `locale`, `other` otherwise.
 * Languages with more than two forms (e.g. Polish's `few` / `many`) currently map to `other`, so
 * adding those forms later changes only the catalogue, not the call sites.
 */
export function plural(n: number, one: string, other: string, locale: string = activeLocaleName): string {
  return new Intl.PluralRules(locale).select(n) === 'one' ? one : other;
}

/** An integer formatted for a locale (`1,234` in en-US, `1 234` in fr-FR). */
export function formatInt(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/** A whole-dollar amount formatted for a locale, in its local currency symbol position. */
export function formatMoney(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
