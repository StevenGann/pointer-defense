# Synergy in the tower tooltip

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `e9dc590`.

A tower sitting in a synergy gives no sign of it unless you look at the board and read the link. The
tooltip is where a player looks at a tower, so the synergy belongs there.

## 1. What the tooltip says

One line per synergy the tower is actually part of, in catalogue order, no duplicates:

```
Synergy: Chill
Synergy: Shatter
```

- A tower in two synergies shows two lines. A tower in none shows no line at all — the line means
  "this tower is in it", not "this tower could be".
- Names come from the existing `synergy.<id>.name` keys, so the tooltip and the Help page cannot
  disagree. The one row without a name — `aa-sync` — gains one: **Synchronized Fire**, the name
  `docs/SYNERGIES.md` §3 already uses.
- No roles, no arrows, no "leads"/"follows" inside the tooltip. Direction is the link's job, and a
  tower in a cluster leads or follows per hit; a static tooltip line would be wrong half the time.

## 2. Where it comes from

`SynergyEdge` does not carry its row id, so an edge can be drawn but not named. Add the row id to the
edge, and add one lookup to the layout:

```ts
/** Tower id -> the synergy rows it is a member of, in catalogue order, deduped. */
rowsOf: ReadonlyMap<number, readonly string[]>;
```

`buildSynergyLayout` fills it: an edge contributes its row to both ends; a cluster contributes its
row (`aa-sync`) to every member. One map, built in the same pure pass that already runs and is
memoised on `synergyRev` — no per-frame scan, no second source of truth.

`towerTooltipLines` grows one parameter, `synergyRows: readonly string[] = []`, and appends the lines.
`main.ts` reads `synergyLayout(state).rowsOf.get(tower.id) ?? []` and passes it. Palette tooltips are
unchanged: an unbuilt tower is in nothing.

## 3. Strings

- New: `tooltip.synergy` = `Synergy: {name}`.
- New: `synergy.aaSync.name` = `Synchronized Fire`.
- In the six non-English catalogues, both go in as English with `draft: true`, like the rest of the
  pending translation work. Key names never translate — only the value.

## 4. Tests

- `rowsOf`: a lone Frost has none; a Frost beside an AA and a Cannon has `chill` and `shatter`; a
  two-AA cluster has `aa-sync` on both members; a Gun with Marksman beside an AA has `spotter` on
  both ends even though only the AA benefits.
- The tooltip shows one line per row, in catalogue order, and none for a tower outside every synergy.
- The line survives a tier upgrade and a branch change (the row is membership, not stats).
- `fit:` assertions for `tooltip.synergy` in every locale, with the longest shipped synergy name.
- A run's outcome is unchanged: the tooltip is view-only, and nothing in the sim reads `rowsOf`.

## 5. Out of scope

No new board overlay, no tooltip icons, no HUD changes. The Help page already documents each synergy;
this only surfaces membership at the tower.
