/**
 * The locales the game ships, in the order they appear in the settings dialog.
 *
 * `code` is the BCP-47 tag handed to `Intl` for plurals and number formatting; `dir` drives the
 * layout mirroring (see docs/LOCALES.md). English is the source locale and the runtime fallback.
 */
export interface LocaleMeta {
  readonly code: string;
  /** The name of the language in its own script, as it appears in a settings list. */
  readonly label: string;
  readonly dir: 'ltr' | 'rtl';
  /** True until a native speaker has reviewed the machine-drafted strings. */
  readonly draft: boolean;
}

export const LOCALES: readonly LocaleMeta[] = [
  { code: 'en', label: 'English', dir: 'ltr', draft: false },
  { code: 'es', label: 'Español', dir: 'ltr', draft: true },
  { code: 'fr', label: 'Français', dir: 'ltr', draft: true },
  { code: 'zh-Hans', label: '简体中文', dir: 'ltr', draft: true },
  { code: 'ru', label: 'Русский', dir: 'ltr', draft: true },
  { code: 'uk', label: 'Українська', dir: 'ltr', draft: true },
  { code: 'he', label: 'עברית', dir: 'rtl', draft: true },
];

/** The locale used when a string is missing everywhere else, and when no choice has been made. */
export const SOURCE_LOCALE = 'en';

/** Look up a locale's metadata by its BCP-47 tag; unknown tags fall back to the source locale. */
export function localeMeta(code: string): LocaleMeta {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]!;
}
