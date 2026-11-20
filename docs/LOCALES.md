# Locales

Target locales, in shipping order:

| Code | Language | Script | Direction |
|---|---|---|---|
| `en` | English | Latin | LTR |
| `es` | Spanish | Latin | LTR |
| `fr` | French | Latin | LTR |
| `zh-Hans` | Chinese (Simplified) | Han | LTR |
| `ru` | Russian | Cyrillic | LTR |
| `uk` | Ukrainian | Cyrillic | LTR |
| `he` | Hebrew | Hebrew | **RTL** |

English is the source locale and the fallback. A locale file is `src/i18n/<code>.ts` and must satisfy the
same `Catalogue` type, so a missing key is a build error rather than a blank label.

## What each locale costs beyond translation

**Plural forms.** `Intl.PluralRules` returns `one/few/many/other` for Russian and Ukrainian,
`one/two/many/other` for Hebrew, `one/many/other` for French, and `other` alone for Chinese. `plural()`
therefore takes a category map, not two strings:

```ts
plural(n, { one: '...', few: '...', many: '...', other: '...' })
```

Missing categories fall back to `other`, and a smoke test asserts every locale supplies the categories
its language actually uses.

**Right-to-left.** Hebrew is the only RTL locale and it is the single largest piece of work in this
project. The board never mirrors — a tower defence map is a map. The chrome does:

- Panels swap sides (build panel right, status panel left).
- Menu words and menu items lay out from the right; separators and check marks mirror.
- Text runs right-aligned, but numbers, prices and wave counters stay in their left-to-right run so
  `$1,250` does not become `052,1$`.
- The title-bar controls keep their visual order (close still sits at the far right), because that is
  what a Hebrew Windows user expects.
- Scrollbars stay on the left of a pane that is on the right.

Every one of those is a `dir` flag read by the layout, `src/view/chrome.ts` computes it once from the
active locale, and each layout function takes it as an argument so the smoke suite can assert both
directions from the same test.

**Width.** German-length strings are the usual suspect, but Chinese is the harder case: fewer
characters, each much wider, and the existing `label.length * 7` heuristics are wrong in both
directions. Every width that is currently estimated from a character count becomes a measured width.
The smoke suite runs the panel-fit assertions once per locale, so a translation that overflows fails
the build instead of the screenshot.

**Fonts.** The stack gains Noto Sans fallbacks for Han, Cyrillic and Hebrew after the Windows faces, so
a machine without Tahoma still resolves every script. No webfont is bundled: a CJK font is several
megabytes and the platform already ships one.

## Rules that outlive translation

- The daily challenge seed derives from the UTC date. It must not vary by locale, or two players on the
  same day get different maps.
- Save keys, level codes, enemy and tower ids never localise. They are persisted data.
- Numbers, prices and wave counters go through `Intl.NumberFormat` with the active locale.
- A translated string may reorder its placeholders freely; nothing may assume `{cost}` comes first.

## Workflow

1. Extract a surface to the catalogue (English), migrate its call sites.
2. Translate the new keys into the six locales in the same commit, or leave them out of those files and
   let `npm run i18n:missing` list them — never ship an English string in a non-English catalogue by
   accident.
3. Review: the first draft of every translation is machine-drafted and marked `draft: true` in the
   locale file; a locale with any draft key is listed in the settings dialog as a preview.

## Test plan

1. Every locale file satisfies `Catalogue` (build-time), and `i18n:missing` reports zero untranslated
   keys for a released locale.
2. Plural categories per locale are complete for the counts the game actually uses (2, 5, 21, 1.5).
3. Every panel-fit assertion runs once per locale: pointer panel, status bar, menu columns, help page
   tables, tooltips at 1024×640 and 1280×720.
4. RTL: the same layout assertions pass with `dir = rtl`, panel sides swap, and a formatted price keeps
   its digits in order.
5. The daily seed is identical across all seven locales.
6. A `?lang=` switch renders each locale, and switching reloads the profile without losing it.
