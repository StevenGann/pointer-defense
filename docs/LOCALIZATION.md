# Localization: where each kind of text lives

Roughly 900 user-facing strings are scattered across 60 modules. This is how they get compartmentalised
without turning the game into a resource-file project.

## The three tiers

**1. UI strings — a typed catalogue in TypeScript, not XML.**

`src/i18n/en.ts` holds every label, tooltip line, button, dialog title and status message:

```ts
export const en = {
  'menu.file': 'File',
  'status.pickTower': 'Pick a tower, then click a tile',
  'hud.waveOf': 'Wave {wave} / {total}',
  'tooltip.upgrade': 'Upgrade {cost}',
} as const satisfies Catalogue;
```

XML was the right answer when a Win32 resource compiler turned `.rc` files into binaries. There is no
such step here, and XML costs the two things that keep a catalogue honest: the TypeScript compiler
cannot tell you that `hud.waveOf` is misspelled, and it cannot check that `{wave}` and `{total}` were
actually passed. A missing key in XML is a runtime `undefined` painted onto the screen. When a
translator eventually needs a standard exchange format, `npm run i18n:export` writes XLIFF out of the
catalogue — the XML becomes a build artifact, not the source of truth.

**2. Long-form content — Markdown with placeholders.**

Help pages are already Markdown-rendered. Prose paragraphs move into `src/content/help/en/*.md`, with
`{placeholder}` tokens where a number goes. Numbers are never translated and never typed by hand: a
page says "deals {damage} damage" and the code passes `effectiveStats(...).damage`. That keeps the
manual true and makes the prose translatable without shipping the game's balance tables to a
translator.

**3. Data that is not text at all.**

Balance numbers, seeds, save keys, level codes and enemy kinds stay in code. A translator must never
see `1.09` or `pd.run.v1`.

## The catalogue is typed

- `t(key, params)` returns the string, throws in development when a key is missing or a placeholder is
  unfilled, and falls back to English at runtime.
- `plural(n, one, other)` uses `Intl.PluralRules`, so languages with more than two forms work later
  without touching call sites.
- Numbers go through `formatInt(n, locale)` / `formatMoney(n, locale)` rather than `formatNumber`'s
  `k`/`M` suffixes, which are English shorthand baked into `src/core/format.ts`.

## Width is the real problem

The chrome is a fixed-pixel Windows 95 layout: a 156 px pointer panel, menu columns sized by
`label.length * 7`, table columns sized by their content. Localisation breaks those heuristics before it
breaks anything else — German labels are longer, CJK glyphs are wider than the estimate assumes. Every
place that guesses a width from character count must switch to the measured text width; `textWidth()`
and the menu's own measurement helper already exist.

## Enforcement

`npm run i18n:check` scans `src/view`, `src/input` and `src/main.ts` for quoted or template prose that
is not a catalogue reference. A checked-in baseline file lists the modules that have not been migrated
yet; the script fails when a migrated module regains a bare string, and the baseline is shrunk module by
module until it is empty. Without this, the catalogue rots the first time someone is in a hurry.

## Migration order

1. `menu.ts`, `menuScreen.ts`, status-bar hints (small, high visibility, proves the machinery)
2. `hud.ts` labels and `tooltipText.ts` (the biggest single payoff: most strings)
3. `upgrades.ts`, `restore.ts`, `records.ts`, `mapLibrary.ts`, `editor.ts`, `dialog.ts`
4. `achievements.ts`, `upgrades` catalogue names and blurbs
5. `content/help.ts` prose into Markdown files; generators keep the numbers
6. `i18n:export` to XLIFF, and a `?lang=` switch proving a second locale renders

## Tests

1. `t()` interpolates, and throws on a missing key or an unfilled placeholder.
2. `plural()` matches `Intl.PluralRules` for a locale with more than two forms (Polish).
3. Every key in the catalogue is referenced by code, and every referenced key exists.
4. The checker fails on a bare literal added to a migrated module and passes on the current tree.
5. A help page's Markdown render with placeholders substituted equals the current generated text for
   one tower and one enemy page — the migration does not change a single word on screen.
