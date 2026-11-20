# Localising the Help prose

The Help pages are 32 documents of Markdown generated in `src/content/help.ts`. Every number in them
is computed from the live simulation, which is the reason they stay correct when balance moves — and
the reason they cannot simply be pasted into a translation file.

This is the last surface where an English sentence reaches a non-English player.

Status: spec, then extraction, then six translation runs.

## The shape of the problem

A body line is currently one template literal:

```ts
`A bare click deals ${fmt(POINTER_STAGES[1].clickDamage)} damage; the Reticle deals ${fmt(...)} and holds for ${fmt(...)} damage per second.`,
```

Three things are tangled in it: the sentence, the numbers, and the order the sentence puts them in.
Translation needs the sentence, the engine needs to keep computing the numbers.

## The contract

1. **Every prose line becomes a catalogue key.** `src/i18n/en/help.ts`, namespaced
   `help.<page-id>.<n>` with `n` counting from 1 within a page, plus `help.page.<page-id>.title` and
   `help.category.<id>`.
2. **Numbers travel as placeholders.** Anything currently interpolated becomes `{name}`:
   `help.mechanics-pointer.1` = `'A bare click deals {click} damage; the Reticle deals {reticle} and holds for {hold} damage per second.'`
   The call site computes `fmt(...)` exactly as it does now and passes it in.
3. **Sentence order is the translator's.** A locale may reorder placeholders freely; it may not drop
   one, add one, or rename one.
4. **Tables stay generated.** Markdown tables are assembled from `TOWER_STATS`, `ENEMY_STATS` and the
   tier ladder. Their *headers* and *row labels* go through the catalogue (`help.table.tier`,
   `help.table.damage`, `help.table.range`, `help.table.rate`, …); their cells stay numeric.
5. **Rendered English must not change by one byte.** The smoke suite hashes Help Markdown; a
   refactor that alters a space fails it, and that failure is correct.

## What must not move

- `help.<page>.n` ids, page ids, category ids, gates.
- Any computed value, its formatting (`fmt`, `fmtPct`, money) or the function that produces it.
- The Markdown subset the renderer understands (`##`, `-`, tables, bold, inline code). A translator
  may not introduce a construct the parser drops.

## Length and fit

Help is a text pane, not a button: 130 % of the English is acceptable, 160 % is not. Every translated
page must render in the Help window at 1024×768 without a label colliding with the pane edge — measured
in smoke, not eyeballed.

## Order of work

1. Extraction in English, rendering byte-identical, smoke green.
2. Six translation runs, one per locale, each writing only its own `src/i18n/<locale>/help.ts`.
3. Width/fit smoke group per locale.
4. Deploy.

Machine drafts, as everywhere else: `draft` until a native speaker has read the pages their players
will actually read first — Getting started, Mechanics, then Towers.
