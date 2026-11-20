import { setLocale } from './index.ts';
import { catalogueFor } from './catalogues.ts';
import { LOCALES, SOURCE_LOCALE, localeMeta } from './locales.ts';

/** Where the player's choice is remembered between visits. */
export const LOCALE_STORAGE_KEY = 'pd.lang.v1';

/**
 * Choose the locale for this visit: `?lang=` wins, then the stored choice, then English.
 *
 * Pure so the precedence rule can be tested without a browser. An unknown or unsupported tag is
 * ignored rather than half-applied, which keeps a typo from blanking the UI.
 */
export function chooseLocale(search: string, stored: string | null): string {
  const fromUrl = new URLSearchParams(search).get('lang');
  for (const candidate of [fromUrl, stored]) {
    if (!candidate) continue;
    const wanted = candidate.toLowerCase();
    const match = LOCALES.find((l) => l.code.toLowerCase() === wanted || l.code.split('-')[0] === wanted);
    if (match) return match.code;
  }
  return SOURCE_LOCALE;
}

/** Install the catalogue and the locale tag used by `Intl` for numbers and plurals. */
export function activateLocale(code: string): void {
  setLocale(catalogueFor(code), localeMeta(code).code);
}

/** Read the choice, install it, and return the locale in effect. Call before any view is built. */
export function initLocale(): string {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the URL and English still work.
  }
  const code = chooseLocale(window.location.search, stored);
  activateLocale(code);
  return code;
}

/** Remember a choice and reload, so every cached string and measured width is rebuilt from scratch. */
export function switchLocale(code: string): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    // If storage is unavailable the reload still applies the `?lang=` in the URL below.
  }
  const url = new URL(window.location.href);
  if (code === SOURCE_LOCALE) url.searchParams.delete('lang');
  else url.searchParams.set('lang', code);
  window.location.replace(url.toString());
}
