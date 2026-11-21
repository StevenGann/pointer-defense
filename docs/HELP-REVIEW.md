# Help review

Status: audit complete, fixes not built. Owner: Guppy. Written 2026-11-21 against `main` at
`c059ffa`.

Scope: every page the Help viewer can print, checked against the code that decides the number or the
behaviour; the missing topics for features shipped since Help was last written; and the CHM chrome,
measured against the real Windows HTML Help viewer rather than against memory.

Method: `HELP_PAGES` was rendered to plain text from the real modules (all 35 pages, tables
included), and each claim was checked against the constant, function or branch it describes.
The numbers that already travel as `{placeholders}` were spot-checked and are correct; the risk is
in the sentences that spell a number out.

---

## 1. Content that is correct

Verified against code, no change needed:

- Enemy and boss stat lines, HP tables (`waveHpScale`), the seven boss gimmicks: Pacer 3 tiles
  (`PACER_AURA_RADIUS`), Carrier 3 every 4 s and 6 on death (`CARRIER_*`), Wirecutter 2.5 tiles for
  3 s (`WIRECUTTER_EMP_*`), Dreadnought's half-strength slows.
- AA: "only shoots flyers, hits them for double damage, holds fire on ground-only waves"
  (`flyerDamageMult: 2`).
- Taser ignores armour; clicks ignore armour; shields absorb tower damage until the pointer breaks
  them; Pop-up shields everything under it and dies only to its close box.
- Mesh blocks flyers (`wallBlocksFlyers`), and a wall mid-repair blocks nothing — the last part is
  true and not yet written down.
- Specs, RP costs and the reboot curve, which are all computed at the call site.

## 2. Content that has drifted or will drift

Each of these prints a number as prose. Several are still true today; that is the problem — nothing
will tell us when they stop being true.

| Where | Today | What it should read from |
|---|---|---|
| `help.getting-started.4` | "you start with 20" | `STARTING_INTEGRITY` |
| `help.mechanics-early-call.2` | "a floor of 5" | the early-call floor constant |
| `help.tower-frost.5` | "30% speed for 3 s" | `TOWER_STATS.frost.slowFactor` / `slowTicks` |
| `help.tower-taser.3` | "chains to 3 targets" | the Arc branch's chain count |
| `help.tower-aa.5` | "double damage" | `TOWER_STATS.aa.flyerDamageMult` |
| `help.tower-cursor.6` | "half your click damage" | the cursor damage factor |
| `help.tower-cursor.5` | "below 80%" | `CURSOR_REPAIR_THRESHOLD` (already a param on the branch bullet, not on the role line) |
| `help.boss-runner-boss.2` | "within 3 tiles" | `PACER_AURA_RADIUS` |
| `help.boss-flyer-boss.2` | "three every 4 s ... six more" | `CARRIER_BROOD_*` |
| `help.boss-saboteur-boss.2` | "2.5 tiles ... 3 s" | `WIRECUTTER_EMP_*` |
| `help.boss-armoured-boss.2` | "half as well" | the Dreadnought slow-resist constant |
| `help.tower-*.2` (seven keys) | "at tier 3" | `BRANCH_TIER` |
| `help.mechanics-endless.1` | "the hundredth wave" | the final wave constant |

Rule: the English sentence carries a `{placeholder}`, `src/content/help.ts` fills it from the
constant, and the smoke suite asserts the rendered page against the same constant. No exception for
"it is obviously 3".

## 3. Content that is missing

Ordered by how much a player needs it.

1. **Spotter is not on the Synergies page.** It is the only shipped synergy absent — the page lists
   Chill, Interlock, Shatter and Buttress and skips the one that predates them. Add it in the same
   shape, and add the one fact none of the five states: what the chevroned line means (the arrow
   points from the tower that does the lending to the tower that receives).
2. **Tower licences** (`docs/PRESTIGE.md`). Eight per-tower unlocks bought with Restore Points, the
   price ladder, that they apply from wave 1 of the next run, that they are owned once, and that a
   Daily run inherits them. This shipped yesterday and Help says nothing.
3. **Maps and the map gallery** (`docs/MAP-SELECT.md`). Ten maps, the gallery, the scrollbar, and
   that the last map chosen is remembered. One page, no map-by-map notes.
4. **Global upgrades** (`docs/GLOBAL-UPGRADES.md`). The right-hand panel exists in every run and Help
   never names it.
5. **Daily challenge** (`docs/DAILY.md`). What it is, that the seed is the UTC date, that it is not
   a scored record.
6. **Achievements.** One page: there are 118, they unlock out of run, the window is the trophy.
7. **The editor**, if it still ships: one short page saying a map can be authored and played.

Nothing else in the game is undocumented; the list above is the whole gap.

## 4. The CHM chrome, against the real viewer

The window already matches the real thing in the ways that matter: three panes, tabs along the
**bottom** of the navigation pane, a drag splitter, a status bar carrying the topic path, and a
six-button toolbar. The gaps are all in the buttons and the list.

Reference for the button set: the `htmlhelp.h` window-type flags as used by a real `.hhp`
(`0x000002` Hide/Show, `0x000004` Back, `0x000008` Forward, `0x000040` Home, `0x000200` Locate,
`0x001000` Options, `0x002000` Print, `0x100000` Zoom/Font).

1. **Print is drawn disabled and does nothing.** In the real viewer it is a live button. Make it
   live: render the open topic to a printable plain-text document in a new window and print it. If
   the pop-up is blocked, the status bar says so instead of failing silently.
2. **Options is drawn enabled and does nothing.** Either give it the real menu — Hide tabs, Back,
   Forward, Home, Print, Refresh — or draw it disabled. An enabled button that ignores clicks is the
   worst of the three states.
3. **Locate is missing.** The real viewer can scroll the contents tree to the open topic. Add it
   between Home and Print, enabled only when the open topic is in the tree.
4. **The contents tree has no keyboard.** Up/Down move the selection, Left collapses or walks to the
   parent, Right expands, Enter opens. `PageUp`/`PageDown` already exist on the page, not the tree.
5. **No context menu on the navigation pane.** The real one has Open, Print, and Expand All. A
   two-item menu (Open, Print) is enough.
6. **Status bar.** Keep the topic path; add the viewer's other idiom, the count of topics ("Topic 4 of
   35"), and use the free panel for the locked-page reason that is currently only a tooltip.
7. **Search tab.** A real viewer lists topics matching *all* words, case-insensitively, and says "No
   topics found" rather than showing an empty box. Check ours against that; fix whichever half is
   wrong.
8. **The tooltip on every toolbar button.** The real viewer has none, but ours is a game and the
   icons are drawn by hand — name each button on hover.

Do not touch: the three-pane geometry, the tab strip at the foot, the splitter bounds, the title
bar, RTL mirroring, or the page typography that `docs/HELP-MARKDOWN.md` governs.

## 5. Tests

- One smoke check per numbered item in section 2: the rendered English page contains the value read
  from the constant, and the constant is not written into the catalogue.
- A catalogue check that every `help.*` string's placeholders are a subset of the params its call
  site passes — a missing param must fail the build, not print `{cost}` on screen.
- One check per new page that it is present, gated correctly, and non-empty in all seven locales.
- CHM: Print and Options produce an effect or are disabled; Locate's enabled state follows the tree;
  keyboard navigation moves the selection; the context menu opens.

## 6. Order

Content first, then the chrome, then translations — the chrome adds strings, and translating before
it would mean translating twice.

1. This document's sections 1–3 and 5: content fixes and new pages.
2. Section 4: the chrome.
3. All seven catalogues: every new and changed key, non-English still `draft: true`.
