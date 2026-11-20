# Ad tips

Status: spec, not built. Owner: Guppy. Written 2026-11-20. Queue position 2.

The desktop ads are the closest thing this game has to a quiet moment: a fake Windows dialog appears
over the board, the player has eight seconds to close it and collect a small bonus. Right now the
only thing an ad ever says is what it pays. A player who has just started has no idea that AA only
shoots flyers, that branches open at tier 3, or that a mesh wall is the only thing that touches a
flyer's route.

Put a real, true tip under the offer. Same dialog, same clock, no new UI.

## 1. What exists now

- `src/core/ads.ts` owns the six ad kinds (`defrag`, `autoupdate`, `timezone`, `freeware`,
  `screensaver`, `bluescreen`), the spawn clock, placement and effects.
- `src/view/ad.ts` draws the dialog: 176×64, a 22 px title bar, a 16×14 close box, and one centred
  message line at 13 px.
- Ads expire after 8 s with no penalty. Blue Screen is a trap: it pays nothing and disables a tower.
- **The ads are not localized.** `AD_SPECS` holds English `title` and `message` strings in core and
  the view prints them raw, while the System Update tray pop-up beside them goes through `t()`. In
  Russian the ads still read "Close for +8% salvage". Any change here has to fix that; adding a
  second English-only line would make the gap worse.

## 2. What ships

### 2.1 The dialog grows one block

The ad becomes **220×92**: title bar 22, the existing reward line, a 1 px separator, then the tip in
11 px at up to three wrapped lines. The extra block is always present, so the dialog does not resize
per kind and the placement logic keeps one rect.

```
+--------------------------------------+
| Defrag complete                   [x] |
+--------------------------------------+
| Close for +8% salvage                |
| ------------------------------------ |
| AA towers only shoot flyers. Put     |
| them where the flights cross.        |
+--------------------------------------+
```

Rules:

- Reward line first, at 13 px, in the same place it is now relative to the title bar. It is the
  reason to click; it must never move.
- Tip at 11 px (`FONT_SIZE.small`), wrapped with `textWidth` measurement, left-aligned, padded 6 px.
- A kind with no tip (Blue Screen) keeps the block and draws the separator plus nothing, so the
  dialog silhouette itself is never a tell. The trap stays identified by its 1 px-high title text.
- If a tip would need a fourth line it is too long: the string is shortened, not the box.

### 2.2 The tip pool

Tips are content, not code: `src/content/adTips.ts` holds the pool keyed by id, and
`src/i18n/en/ads.ts` holds the strings. Each tip below was checked against the source it cites; a
tip that cannot be verified does not ship.

| id | Text (English) | Source |
|---|---|---|
| `aa-flyers` | AA towers only shoot flyers. Put them where the flights cross. | `TOWER_STATS.aa.targetsFlyersOnly` |
| `branches` | Every tower picks a branch at tier 3. The two are different jobs. | `src/core/towers.ts` branch gate |
| `support-tiers` | Walls and Repair stop at tier 3. The Cursor stops at tier 5. | `kindMaxTier()` |
| `sell-refund` | Selling returns 70% of what you spent. Walls return nothing. | `sellValue()`, default refund |
| `mesh-wall` | Only a Mesh wall blocks flyers. Ordinary walls just bend the ground route. | `blocksFlyers()`, wall branch B |
| `fog` | Fog cuts every tower's range by a fifth. Build tight that wave. | `towerRangeMult()`, 0.8 |
| `rush` | Rush waves close the spawn gap by a quarter. Front-load your kills. | `intervalScale`, 0.75 |
| `beacon` | A Beacon raises the damage of every tower in its radius. | `TOWER_STATS.beacon.auraDamage` |
| `marked-crit` | Marked enemies crit more often. The weak point crits more often still. | `critChance()` |
| `mass-upgrade` | Ctrl+click a tower to buy every upgrade you can afford. | UX pass 2 |

### 2.3 Choosing a tip

- Deterministic and independent of the run's RNG stream: the index is
  `hash(ad.id, tipPool.length)`, so a replayed seed shows the same tip on the same ad and the
  pointer's crit rolls are untouched.
- No repeat inside a run until the pool is exhausted: `RunState` carries `adTipCursor`, advanced
  after each tip shown, seeded from the same hash so a fresh run does not always start at tip 0.
- Not saved. A run restored mid-wave may repeat one tip; nothing else changes.

## 3. Localization

- `src/i18n/en/ads.ts` gains `ads.kind.<kind>.title`, `ads.kind.<kind>.message` (the six existing
  strings, moved out of core) and `ads.tip.<id>` for each pool entry.
- All six non-English catalogues get the same keys as machine drafts, flagged like the rest.
- Numbers in the reward lines stay computed at the call site — `+8%`, `+40%` and `-50%` come from
  the same constants the effects use, not from the translated string.
- The tips are short sentences chosen to survive translation: no puns, no idioms, no wordplay.
  Russian runs ~130% of English; the three-line budget is what constrains the wording.

## 4. What proves it works

1. Layout: the ad is 220×92, the reward line does not move, and the close box still hits.
2. Fit: `en`, `es`, `fr`, `ru`, `uk`, `zh-Hans` and `he` each wrap their tips inside three lines at
   11 px, measured with `textWidth`, for every pool entry.
3. Blue Screen draws the block empty and remains the only kind without a tip.
4. Determinism: the same seed and the same ad id produce the same tip, and the run's RNG stream is
   unmoved (crit-roll sequence compared with and without the feature).
5. No repeat: a run shows every tip once before repeating any.
6. Placement: the larger dialog still lands inside the board field with its 8 px margin for every
   ad placement the sim can choose, including the four corners.
7. Localization: no `AD_SPECS` prose remains in `src/core/ads.ts`; `npm run i18n:check` reports no
   new bare strings.
8. Ads stay cheap: no per-frame allocation, the tip text object is reused and only reassigned when
   the ad changes.

## 5. Not in scope

- Tips anywhere else (loading screen, menu, tooltips). Those are their own surfaces with their own
  budgets.
- Any change to ad frequency, lifetime, weights or payouts.
- A "tip of the day" rotation on the menu. The ads are opportunistic by design; that is what makes
  them tolerable.
