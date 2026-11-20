# Help content speaks Markdown

The help pages are arrays of plain strings, wrapped by hand and drawn with one font. Tiered stats —
the thing a player actually consults a manual for — come out as lines of prose like
`Tier 3 — $120: damage 6.75 · fire 0.50 s`. Put real Markdown behind the content and render tables,
and those ladders become tables.

## The subset

Support exactly this, and reject nothing loudly (an unknown line is a paragraph):

- `# ` / `## ` / `### ` headings
- paragraphs, separated by blank lines
- `- ` bullets, one level
- `**bold**`, `*italic*`, `` `code` `` inline, composable within one run list
- pipe tables:

```
| Tier | Cost | DPS |
|---|--:|--:|
| 1 | — | 6.0 |
| 2 | $22 | 7.5 |
```

`---`, `--:` and `:-:` set left, right and centre alignment. A column of numbers is right-aligned;
that is the whole point of the feature.

Anything else (links, images, nested lists, HTML) is out of scope. If a page needs something more,
write prose around it.

## Architecture

- `src/view/helpMarkdown.ts` — new, pure:
  - `parseHelpMarkdown(blocks: readonly string[]): HelpBlock[]` where a block is
    `{ kind: 'paragraph' | 'heading' | 'bullet', runs: InlineRun[], level?: number }` or
    `{ kind: 'table', header: string[], align: ('left'|'right'|'centre')[], rows: InlineRun[][][] }`.
  - `layoutHelpBlocks(blocks, maxWidth, art, measure): HelpLayout` — every line's y, every run's x and
    width, every table's column widths, row heights and rule positions. `measure(text, bold)` is
    injected so layout is testable in Node without Pixi.
- `src/view/help.ts` — draws the layout instead of wrapping strings. Text objects come from a pool
  keyed by line; table rules and the header fill are Graphics. Keep the existing invariant: the
  height `pageBodyHeight` reports is exactly the height the layout produced (same call, not a mirror).
- `src/content/help.ts` — bodies become Markdown. The generators that compute stat lines now emit
  table rows; **every number still comes from the sim's functions** (`effectiveStats`, `upgradeCost`,
  `wallMaxHp`, `repairHealRate`, `cursorClickRate`). No hand-typed stats.

## The tables the tower pages get

One table per tower page, rows = tiers 1–20, columns:

| Tier | Cost | <Branch A name> | <Branch B name> |
|---|---|---|---|

- **Cost** is the price of reaching that tier (`upgradeCost` off the previous tier's tower), `—` at
  tier 1.
- **Each branch column is that branch's headline stat at that tier**: DPS for damage towers, hit
  points for a Wall, heal rate for Repair, clicks per second for the Cursor, aura bonus for the
  Beacon.
- Tiers 1–2 have no branch yet: the branch columns show the unbranched figure in the first branch
  column and `—` in the rest, and a short note under the table says when the branch is chosen.
- Tier rows where the kind cannot go (Wall stops at 3, Repair at 3, Cursor at 5) are not printed;
  the table ends where the tower does.
- Under the table, one bullet per branch with its price and what it does, then the prose that is
  there today.

Enemy and boss pages get a small table too: wave 1 / 25 / 50 / 75 / 100 hit points, from
`waveHpScale` and the kind's base HP, because "how much HP does a Grunt have at wave 60" is the
question those pages exist to answer.

## Tests

1. Parser: a paragraph with all three inline styles; a bullet list; a two-line table; a table row with
   a different cell count than the header is a parse error (throw, do not silently pad).
2. Alignment: `--:` right-aligns, and a right-aligned numeric column's cells end at the same x.
3. Layout height is monotonic and equals the sum of line heights; `pageBodyHeight` equals it for
   every page at two widths (the scroll invariant, as today).
4. No laid-out line overlaps the artwork box, for every page, at both widths.
5. The Gun tier table's row for tier 5, tier 10 and tier 20 matches `effectiveStats` and
   `upgradeCost` computed in the test, branch column included.
6. A Wall page's table stops at tier 3, a Cursor's at 5, a Gun's at 20.
